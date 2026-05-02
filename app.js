/**
 * Alluvium — app.js
 * Flow becomes knowledge.
 *
 * All logic lives here. The LLM API is called directly from the browser
 * using the user's own key stored in localStorage. No server. No backend.
 */

'use strict';

// =============================================================
// Constants
// =============================================================

const LS_PROVIDER   = 'alluvium_provider';
const LS_DOMAINS    = 'alluvium_domains';
const LS_MODEL      = 'alluvium_model';
const LS_VAULT_ORG  = 'alluvium_vault_org';

// Per-provider key storage: alluvium_key_{provider}
function lsKeyFor(providerKey) { return `alluvium_key_${providerKey}`; }

const PROVIDERS = [
  {
    key: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    keyPlaceholder: 'sk-ant-...',
    models: [
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (recommended)' },
      { id: 'claude-opus-4-5',   label: 'Claude Opus 4.5 (slower, more thorough)' },
      { id: 'claude-haiku-4-5',  label: 'Claude Haiku 4.5 (fast, cheaper)' },
    ],
  },
  {
    key: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    keyPlaceholder: 'sk-...',
    models: [
      { id: 'gpt-4o',    label: 'GPT-4o (recommended)' },
      { id: 'gpt-4.1',   label: 'GPT-4.1' },
      { id: 'o4-mini',   label: 'o4-mini (fast, cheaper)' },
    ],
  },
  {
    key: 'google',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    keyPlaceholder: 'AIza...',
    models: [
      { id: 'gemini-2.5-pro',   label: 'Gemini 2.5 Pro (recommended)' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (fast, cheaper)' },
    ],
  },
  {
    key: 'mistral',
    name: 'Mistral',
    baseUrl: 'https://api.mistral.ai',
    keyPlaceholder: '...',
    models: [
      { id: 'mistral-large-latest', label: 'Mistral Large (recommended)' },
      { id: 'mistral-small-latest', label: 'Mistral Small (fast, cheaper)' },
    ],
  },
  {
    key: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    keyPlaceholder: 'sk-...',
    models: [
      { id: 'deepseek-chat',     label: 'DeepSeek Chat (recommended)' },
      { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
    ],
  },
];

function getProvider(key) {
  return PROVIDERS.find(p => p.key === key) || PROVIDERS[0];
}

const DEFAULT_DOMAINS = [
  { key: 'work',     name: 'Work',     description: 'Main professional activities and responsibilities' },
  { key: 'writing',  name: 'Writing',  description: 'Articles, books, manuscripts, editorial work' },
  { key: 'sport',    name: 'Sport',    description: 'Training, fitness, racing, athletic activities' },
  { key: 'music',    name: 'Music',    description: 'Practice, performance, listening, music study' },
  { key: 'personal', name: 'Personal', description: 'Everything else — life, relationships, reflection' },
];

const NOTE_TYPES = [
  'event', 'idea', 'task', 'reflection', 'practice-log',
  'meeting', 'reading', 'person',
];

// =============================================================
// Path resolution — matches vault monthly subfolder structure
// =============================================================

/**
 * Check whether a date string falls in the current calendar month.
 * Current-month files live at the folder root; older months live
 * in a YYYY-MM subfolder (created by the archive step on the 1st).
 */
function isCurrentMonth(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  const now = new Date();
  return y === now.getFullYear() && m === (now.getMonth() + 1);
}

/**
 * Return the vault-relative path for a journal entry.
 *   Current month → 00 Journal/YYYY-MM-DD.md
 *   Older month   → 00 Journal/YYYY-MM/YYYY-MM-DD.md
 */
function journalPath(dateStr) {
  if (isCurrentMonth(dateStr)) return `00 Journal/${dateStr}.md`;
  return `00 Journal/${dateStr.slice(0, 7)}/${dateStr}.md`;
}

/**
 * Return the vault-relative path for a day summary.
 *   Current month → Day Summaries/YYYY-MM-DD.md
 *   Older month   → Day Summaries/YYYY-MM/YYYY-MM-DD.md
 */
function summaryPath(dateStr) {
  if (isCurrentMonth(dateStr)) return `Day Summaries/${dateStr}.md`;
  return `Day Summaries/${dateStr.slice(0, 7)}/${dateStr}.md`;
}

/**
 * Map a PARA category to its vault folder name.
 * Person-type notes always go to People/, regardless of PARA.
 * If no PARA category, falls back to 01 Inbox/.
 */
const PARA_FOLDERS = {
  project:  '1 Projects',
  area:     '2 Areas',
  resource: '3 Resources',
  archive:  '4 Archive',
};

function paraFolder(note) {
  if (note.type === 'person') return 'People';
  return PARA_FOLDERS[note.para] || '01 Inbox';
}

// =============================================================
// IndexedDB — persist folder handle across sessions
// =============================================================

const DB_NAME  = 'alluvium';
const DB_STORE = 'handles';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveHandle(handle) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(handle, 'outputDir');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function loadHandle() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get('outputDir');
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function removeHandle() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete('outputDir');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

// =============================================================
// File list builder (shared by ZIP download and folder write)
// =============================================================

function buildFileList(notes, date, vaultOrg, journalText) {
  const files = [];

  if (vaultOrg) {
    if (journalText) {
      files.push({ path: journalPath(date), content: journalText + '\n' });
    }
    notes.forEach((note, idx) => {
      const fm      = buildFrontmatter(note, date);
      const content = fm + '\n\n' + (note.body || '') + '\n';
      const slug    = slugify(note.title || `note-${idx + 1}`);
      files.push({ path: `${paraFolder(note)}/${slug}.md`, content });
    });
  } else {
    notes.forEach((note, idx) => {
      const fm      = buildFrontmatter(note, date);
      const content = fm + '\n\n' + (note.body || '') + '\n';
      const slug    = slugify(note.title || `note-${idx + 1}`);
      files.push({ path: `alluvium-notes/${slug}.md`, content });
    });
  }

  return files;
}

async function writeFilesToFolder(handle, files) {
  for (const { path, content } of files) {
    const parts = path.split('/');
    let dir = handle;
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i], { create: true });
    }
    const fh = await dir.getFileHandle(parts[parts.length - 1], { create: true });
    const w  = await fh.createWritable();
    await w.write(content);
    await w.close();
  }
}

// =============================================================
// State
// =============================================================

let extractedNotes = [];
let currentDate    = '';

// =============================================================
// DOM refs
// =============================================================

const $ = id => document.getElementById(id);

const elJournalInput       = $('journal-input');
const elWordCount          = $('word-count');
const elEntryDate          = $('entry-date');
const elBtnProcess         = $('btn-process');
const elBtnProcessLabel    = $('btn-process-label');
const elBtnProcessSpinner  = $('btn-process-spinner');
const elBtnClear           = $('btn-clear');
const elProcessingStatus   = $('processing-status');
const elStatusText         = $('status-text');
const elErrorBanner        = $('error-banner');
const elErrorMessage       = $('error-message');

const elProviderSelect     = $('provider-select');
const elApiKeyInput        = $('api-key-input');
const elBtnToggleKey       = $('btn-toggle-key');
const elBtnSaveKey         = $('btn-save-key');
const elBtnClearKey        = $('btn-clear-key');
const elKeyStatus          = $('key-status');

const elDomainsInput       = $('domains-input');
const elBtnSaveDomains     = $('btn-save-domains');
const elBtnResetDomains    = $('btn-reset-domains');
const elDomainsStatus      = $('domains-status');

const elModelSelect        = $('model-select');
const elBtnSaveModel       = $('btn-save-model');
const elModelStatus        = $('model-status');

const elVaultOrgCheck      = $('vault-org-check');

const elFolderCard         = $('folder-card');
const elFolderName         = $('folder-name');
const elBtnChooseFolder    = $('btn-choose-folder');
const elBtnClearFolder     = $('btn-clear-folder');
const elFolderStatus       = $('folder-status');

const elResults            = $('results');
const elNavResults         = $('nav-results');
const elResultsCount       = $('results-count');
const elNotesGrid          = $('notes-grid');
const elBtnDownloadZip     = $('btn-download-zip');
const elBtnCopyAll         = $('btn-copy-all');

// =============================================================
// Init
// =============================================================

function init() {
  // Migrate legacy single-provider API key → per-provider storage
  const legacyKey = localStorage.getItem('alluvium_api_key');
  if (legacyKey) {
    localStorage.setItem(lsKeyFor('anthropic'), legacyKey);
    localStorage.removeItem('alluvium_api_key');
  }

  // Set today's date
  const today = new Date();
  const iso   = today.toISOString().split('T')[0];
  elEntryDate.value = iso;
  currentDate       = iso;

  // Load settings into UI
  loadSettingsUI();

  // Wire up events
  elJournalInput.addEventListener('input', onJournalInput);
  elEntryDate.addEventListener('change', () => { currentDate = elEntryDate.value; });

  elBtnProcess.addEventListener('click', onProcess);
  elBtnClear.addEventListener('click', onClear);

  elProviderSelect.addEventListener('change', onProviderChange);
  elBtnToggleKey.addEventListener('click', toggleKeyVisibility);
  elBtnSaveKey.addEventListener('click', saveApiKey);
  elBtnClearKey.addEventListener('click', clearApiKey);

  elBtnSaveDomains.addEventListener('click', saveDomains);
  elBtnResetDomains.addEventListener('click', resetDomains);

  elBtnSaveModel.addEventListener('click', saveModel);

  elBtnChooseFolder.addEventListener('click', chooseFolder);
  elBtnClearFolder.addEventListener('click', clearFolder);

  elVaultOrgCheck.addEventListener('change', () => {
    localStorage.setItem(LS_VAULT_ORG, elVaultOrgCheck.checked ? '1' : '');
  });

  elBtnDownloadZip.addEventListener('click', downloadZip);
  elBtnCopyAll.addEventListener('click', copyAll);

  // Initial word count
  updateWordCount();
}

// =============================================================
// Settings — load / save
// =============================================================

function loadSettingsUI() {
  // Provider
  populateProviderSelect();
  const providerKey = localStorage.getItem(LS_PROVIDER) || 'anthropic';
  elProviderSelect.value = providerKey;

  const provider = getProvider(providerKey);

  // API key for selected provider
  const savedKey = localStorage.getItem(lsKeyFor(providerKey));
  if (savedKey) {
    elApiKeyInput.value = savedKey;
    setKeyStatus('Key saved.', 'ok');
  }
  elApiKeyInput.placeholder = provider.keyPlaceholder;

  // Models for selected provider
  populateModelSelect(providerKey);
  const savedModel = localStorage.getItem(LS_MODEL);
  if (savedModel && provider.models.some(m => m.id === savedModel)) {
    elModelSelect.value = savedModel;
  }

  // Domains
  const savedDomains = loadDomains();
  elDomainsInput.value = domainsToText(savedDomains);

  // Vault organization
  elVaultOrgCheck.checked = !!localStorage.getItem(LS_VAULT_ORG);

  // Output folder
  loadFolderUI();
}

// =============================================================
// Output folder — File System Access API
// =============================================================

async function loadFolderUI() {
  if (!('showDirectoryPicker' in window)) {
    // API not available — disable button, show guidance
    elBtnChooseFolder.disabled = true;
    setFolderStatus('Not available in this browser. Use Chrome or Edge, or lower Brave Shields for this site.', 'err');
    return;
  }

  try {
    const handle = await loadHandle();
    if (handle) {
      elFolderName.textContent = handle.name;
      elBtnClearFolder.style.display = 'inline-flex';
      const perm = await handle.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        setFolderStatus('Ready. Notes will save here automatically.', 'ok');
      } else {
        setFolderStatus('Permission needed — will be requested on next extraction.', '');
      }
    }
  } catch (e) { /* ignore */ }
}

async function chooseFolder() {
  if (!('showDirectoryPicker' in window)) {
    setFolderStatus('Not available in this browser. Use Chrome or Edge, or lower Brave Shields for this site.', 'err');
    return;
  }
  setFolderStatus('Opening folder picker...', '');
  try {
    const handle = await window.showDirectoryPicker();
    await saveHandle(handle);
    elFolderName.textContent = handle.name;
    elBtnClearFolder.style.display = 'inline-flex';
    setFolderStatus('Folder set. Notes will save here automatically.', 'ok');
  } catch (err) {
    if (err.name === 'AbortError') {
      setFolderStatus('', '');
      return;
    }
    setFolderStatus(`Could not access folder: ${err.message}`, 'err');
  }
}

async function clearFolder() {
  await removeHandle();
  elFolderName.textContent = 'No folder selected';
  elBtnClearFolder.style.display = 'none';
  setFolderStatus('Folder removed.', '');
}

function setFolderStatus(msg, cls) {
  elFolderStatus.textContent = msg;
  elFolderStatus.className   = 'settings-note' + (cls ? ' ' + cls : '');
}

function populateProviderSelect() {
  elProviderSelect.innerHTML = '';
  PROVIDERS.forEach(p => {
    const opt = document.createElement('option');
    opt.value       = p.key;
    opt.textContent = p.name;
    elProviderSelect.appendChild(opt);
  });
}

function populateModelSelect(providerKey) {
  const provider = getProvider(providerKey);
  elModelSelect.innerHTML = '';
  provider.models.forEach(m => {
    const opt = document.createElement('option');
    opt.value       = m.id;
    opt.textContent = m.label;
    elModelSelect.appendChild(opt);
  });
}

function onProviderChange() {
  const providerKey = elProviderSelect.value;
  localStorage.setItem(LS_PROVIDER, providerKey);

  const provider = getProvider(providerKey);

  // Load saved key for this provider
  const savedKey = localStorage.getItem(lsKeyFor(providerKey));
  elApiKeyInput.value       = savedKey || '';
  elApiKeyInput.placeholder = provider.keyPlaceholder;
  setKeyStatus(savedKey ? 'Key saved.' : '', savedKey ? 'ok' : '');

  // Rebuild model list, auto-select recommended
  populateModelSelect(providerKey);
  localStorage.setItem(LS_MODEL, provider.models[0].id);
  elModelStatus.textContent = '';
  elModelStatus.className   = 'settings-note';
}

function loadDomains() {
  try {
    const raw = localStorage.getItem(LS_DOMAINS);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return DEFAULT_DOMAINS;
}

function domainsToText(domains) {
  return domains
    .map(d => `${d.key}: ${d.name} — ${d.description}`)
    .join('\n');
}

function parseDomainText(text) {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      // Format: "key: Name — description"
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) return null;
      const key  = line.slice(0, colonIdx).trim();
      const rest = line.slice(colonIdx + 1).trim();
      const dashIdx = rest.indexOf('—');
      if (dashIdx === -1) {
        return { key, name: rest, description: rest };
      }
      const name = rest.slice(0, dashIdx).trim();
      const desc = rest.slice(dashIdx + 1).trim();
      return { key, name, description: desc };
    })
    .filter(Boolean);
}

function saveApiKey() {
  const key = elApiKeyInput.value.trim();
  if (!key) {
    setKeyStatus('Enter a key first.', 'err');
    return;
  }
  const providerKey = elProviderSelect.value;
  localStorage.setItem(lsKeyFor(providerKey), key);
  setKeyStatus('Saved.', 'ok');
}

function clearApiKey() {
  const providerKey = elProviderSelect.value;
  localStorage.removeItem(lsKeyFor(providerKey));
  elApiKeyInput.value = '';
  setKeyStatus('Key removed.', '');
}

function setKeyStatus(msg, cls) {
  elKeyStatus.textContent = msg;
  elKeyStatus.className   = 'settings-note' + (cls ? ' ' + cls : '');
}

function toggleKeyVisibility() {
  const show = elApiKeyInput.type === 'password';
  elApiKeyInput.type       = show ? 'text' : 'password';
  elBtnToggleKey.textContent = show ? 'Hide' : 'Show';
}

function saveDomains() {
  const text    = elDomainsInput.value.trim();
  const domains = parseDomainText(text);
  if (!domains.length) {
    elDomainsStatus.textContent = 'No valid domains found.';
    elDomainsStatus.className   = 'settings-note err';
    return;
  }
  localStorage.setItem(LS_DOMAINS, JSON.stringify(domains));
  elDomainsStatus.textContent = `${domains.length} domain(s) saved.`;
  elDomainsStatus.className   = 'settings-note ok';
}

function resetDomains() {
  localStorage.removeItem(LS_DOMAINS);
  elDomainsInput.value        = domainsToText(DEFAULT_DOMAINS);
  elDomainsStatus.textContent = 'Reset to defaults.';
  elDomainsStatus.className   = 'settings-note';
}

function saveModel() {
  const model = elModelSelect.value;
  localStorage.setItem(LS_MODEL, model);
  elModelStatus.textContent = 'Saved.';
  elModelStatus.className   = 'settings-note ok';
}

// =============================================================
// Editor
// =============================================================

function onJournalInput() {
  updateWordCount();
  hideError();
}

function updateWordCount() {
  const text  = elJournalInput.value.trim();
  const words = text ? text.split(/\s+/).length : 0;
  elWordCount.textContent = words === 1 ? '1 word' : `${words} words`;
}

function onClear() {
  elJournalInput.value = '';
  updateWordCount();
  hideError();
}

// =============================================================
// Prompt builder — matches process_journal.py logic exactly
// =============================================================

const FEW_SHOT_EXAMPLE = `
## Example

**Journal entry (2026-03-10):**
Ran 12km this morning, easy pace around 5:30/km. Legs felt heavy from yesterday's bike.
Later had a call with Henrik about the panel review — we agreed to split the applications by discipline. Need to send him my half by Friday.
Reading Deleuze's "Difference and Repetition" again. The concept of the virtual is exactly what I need for the Nunes chapter on layered temporality.

**Extracted notes:**
[
  {
    "title": "12km Easy Run",
    "type": "practice-log",
    "domain": "sport",
    "tags": ["running", "easy-pace", "fatigue"],
    "related": ["Training Log"],
    "body": "12km easy run at ~5:30/km. Legs felt heavy from yesterday's bike session — cumulative fatigue building. Extracted from [[2026-03-10]]."
  },
  {
    "title": "Henrik",
    "type": "person",
    "domain": "work",
    "tags": ["evaluator", "panel-review"],
    "related": ["Panel Review Split"],
    "body": "Colleague involved in panel reviews. Discussed splitting applications by discipline. Extracted from [[2026-03-10]]."
  },
  {
    "title": "Panel Review Split",
    "type": "task",
    "domain": "work",
    "tags": ["evaluation", "deadline"],
    "related": ["Henrik"],
    "body": "Agreed with [[Henrik]] to split panel review applications by discipline. Send my half by Friday (2026-03-14). Extracted from [[2026-03-10]]."
  },
  {
    "title": "Deleuze — The Virtual and Layered Temporality",
    "type": "idea",
    "domain": "writing",
    "tags": ["deleuze", "difference-and-repetition", "temporality", "philosophy"],
    "related": ["Writing Projects"],
    "body": "Re-reading Deleuze's *Difference and Repetition*. The concept of the virtual — real but not actual — maps onto layered temporal strata that only become audible through their interactions. Extracted from [[2026-03-10]]."
  }
]
`;

function buildPrompt(journalText, domains, targetDate, vaultOrg) {
  const domainsDesc = domains
    .map(d => `- **${d.name}** (${d.key}): ${d.description}`)
    .join('\n');

  const noteTypes = NOTE_TYPES.join(', ');

  const paraRules = vaultOrg ? `
## PARA Classification (Tiago Forte)
Classify each note into one of the PARA categories:
- **project** — an active effort with a clear outcome or deadline (e.g. a grant application, preparing for a race, writing a chapter)
- **area** — an ongoing responsibility with no end date (e.g. health, career, a professional role)
- **resource** — a topic of interest, reference material, ideas worth keeping (e.g. a book insight, a technique, a concept)
- **archive** — completed items, things no longer active

Most freshly extracted notes will be "resource" (ideas, readings, reflections) or "project" (tasks with deadlines, active work). Use "area" for ongoing commitments. Use "archive" only when the note explicitly describes something finished or closed. Person-type notes do not need a PARA category.
` : '';

  const paraOutputField = vaultOrg
    ? `\n- "para": one of "project", "area", "resource", "archive" — the PARA category (omit for person-type notes)`
    : '';

  return `You are a journal analyst for a personal knowledge management system. Your job is to read a daily journal entry and extract distinct atomic notes from it.

## Context — Life Domains
${domainsDesc}

## Rules
1. Extract each distinct item as a separate note. One idea = one note. One event = one note. One task = one note.
2. Assign each note a type from: ${noteTypes}
3. Assign a domain key if one clearly fits. Use "personal" if none match.
4. Extract tags — emergent from content, not forced. Use lowercase, hyphenated. Include domain-relevant tags.
5. Identify people mentioned. For new people not previously known, create a person-type note.
6. Use [[wikilinks]] in the note body to reference other notes and concepts.
7. Keep the original voice and feeling. Don't sanitize or over-summarize.
8. For practice logs (training, music practice), include specific details: duration, what was practiced/trained, how it felt.
9. Every note body should end with: Extracted from [[${targetDate}]].
10. The "related" field lists titles of other notes this one connects to.
${paraRules}${FEW_SHOT_EXAMPLE}

## Output Format
Return a JSON array of objects, each with:
- "title": short descriptive title (will become the filename)
- "type": one of the note types
- "domain": primary domain key from the domains listed above
- "tags": list of tags (lowercase, no #, use hyphens not spaces)
- "related": list of titles this note connects to (used as [[wikilinks]])
- "body": the note content in markdown, using [[wikilinks]] for connections${paraOutputField}

Journal date: ${targetDate}

## Journal Entry
${journalText}

Return ONLY the JSON array. No markdown code fences, no commentary.`;
}

// =============================================================
// API call — multi-provider
// =============================================================

async function callLLM(providerKey, apiKey, model, prompt) {
  const provider = getProvider(providerKey);
  if (providerKey === 'anthropic') {
    return callAnthropic(provider.baseUrl, apiKey, model, prompt);
  } else if (providerKey === 'google') {
    return callGemini(provider.baseUrl, apiKey, model, prompt);
  } else {
    // OpenAI-compatible: openai, mistral, deepseek
    return callOpenAICompatible(provider.baseUrl, apiKey, model, prompt);
  }
}

async function callAnthropic(baseUrl, apiKey, model, prompt) {
  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type':         'application/json',
      'x-api-key':            apiKey,
      'anthropic-version':    '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${response.status}`);
  }
  const data = await response.json();
  return data.content[0].text.trim();
}

async function callOpenAICompatible(baseUrl, apiKey, model, prompt) {
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${response.status}`);
  }
  const data = await response.json();
  return data.choices[0].message.content.trim();
}

async function callGemini(baseUrl, apiKey, model, prompt) {
  const url = `${baseUrl}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 8192 },
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${response.status}`);
  }
  const data = await response.json();
  return data.candidates[0].content.parts[0].text.trim();
}

// =============================================================
// Parse response
// =============================================================

function parseNotes(raw) {
  // Strip markdown code fences if the model wraps the JSON
  let text = raw.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  }
  const notes = JSON.parse(text);
  if (!Array.isArray(notes)) throw new Error('Expected a JSON array.');
  return notes;
}

// =============================================================
// Main processing flow
// =============================================================

async function onProcess() {
  hideError();

  const journalText = elJournalInput.value.trim();
  if (!journalText) {
    showError('Write something in the journal editor first.');
    return;
  }

  const providerKey = localStorage.getItem(LS_PROVIDER) || 'anthropic';
  const provider    = getProvider(providerKey);
  const apiKey      = localStorage.getItem(lsKeyFor(providerKey)) || '';
  if (!apiKey) {
    showError('No API key found. Add your API key in Settings below.');
    document.getElementById('settings').scrollIntoView({ behavior: 'smooth' });
    return;
  }

  const model    = localStorage.getItem(LS_MODEL) || provider.models[0].id;
  const domains  = loadDomains();
  const date     = elEntryDate.value || currentDate;
  const vaultOrg = elVaultOrgCheck.checked;

  // Pre-verify folder permission within user gesture (before async API call)
  let folderHandle = null;
  try {
    const handle = await loadHandle();
    if (handle) {
      const perm = await handle.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') folderHandle = handle;
    }
  } catch (e) { /* folder access not available */ }

  setProcessing(true, `Sending to ${provider.name}...`);

  try {
    const prompt = buildPrompt(journalText, domains, date, vaultOrg);

    setProcessing(true, 'Extracting atomic notes...');
    const raw   = await callLLM(providerKey, apiKey, model, prompt);

    setProcessing(true, 'Parsing response...');
    const notes = parseNotes(raw);

    extractedNotes = notes;

    // Auto-save to folder if set
    if (folderHandle) {
      setProcessing(true, `Saving to ${folderHandle.name}...`);
      const files = buildFileList(notes, date, vaultOrg, vaultOrg ? journalText : '');
      await writeFilesToFolder(folderHandle, files);
    }

    renderResults(notes, date, folderHandle);

  } catch (err) {
    let msg = err.message || 'Unknown error.';
    // Surface useful guidance for common errors
    if (msg.includes('401') || msg.includes('authentication')) {
      msg = 'Invalid API key. Check your key in Settings.';
    } else if (msg.includes('403')) {
      msg = 'API key does not have permission. Check your account with the selected provider.';
    } else if (msg.includes('429')) {
      msg = 'Rate limited. Wait a moment and try again.';
    } else if (msg.includes('overloaded') || msg.includes('529')) {
      msg = 'The API is overloaded. Try again in a moment.';
    } else if (msg.includes('NetworkError') || msg.includes('Failed to fetch')) {
      msg = 'Network error. Check your internet connection. Some providers may not support direct browser calls — try a different provider if this persists.';
    }
    showError(msg);
  } finally {
    setProcessing(false);
  }
}

// =============================================================
// UI state helpers
// =============================================================

function setProcessing(active, statusText) {
  elBtnProcess.disabled          = active;
  elBtnProcessLabel.style.display = active ? 'none' : 'inline';
  elBtnProcessSpinner.style.display = active ? 'inline-block' : 'none';
  elProcessingStatus.style.display  = active ? 'flex' : 'none';
  if (statusText) elStatusText.textContent = statusText;
}

function showError(msg) {
  elErrorMessage.textContent  = msg;
  elErrorBanner.style.display = 'block';
}

function hideError() {
  elErrorBanner.style.display = 'none';
}

// =============================================================
// Render results
// =============================================================

function renderResults(notes, date, folderHandle) {
  elNotesGrid.innerHTML = '';

  if (!notes.length) {
    elNotesGrid.innerHTML = '<p style="color:var(--text-muted);font-size:14px;">No notes extracted. Try a longer or more detailed journal entry.</p>';
  } else {
    notes.forEach((note, idx) => {
      const card = buildNoteCard(note, date, idx);
      elNotesGrid.appendChild(card);
    });
  }

  const n = notes.length;
  const label = `${n} note${n !== 1 ? 's' : ''}`;
  elResultsCount.textContent = folderHandle
    ? `${label} saved to ${folderHandle.name}`
    : `${label} extracted`;
  elResults.style.display    = 'block';
  elNavResults.style.display = 'inline';

  // Scroll to results
  elResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function typeClass(type) {
  const map = {
    'event':        'type-event',
    'idea':         'type-idea',
    'task':         'type-task',
    'reflection':   'type-reflection',
    'practice-log': 'type-practice-log',
    'meeting':      'type-meeting',
    'reading':      'type-reading',
    'person':       'type-person',
  };
  return map[type] || 'type-default';
}

function buildFrontmatter(note, date) {
  const related = (note.related || []).map(r => `  - "[[${r}]]"`).join('\n');
  const tags    = (note.tags || []).map(t => `  - ${t}`).join('\n');

  const lines = [
    '---',
    `title: "${escapeYaml(note.title)}"`,
    `aliases: []`,
    `date_created: ${date}`,
    `date_modified: ${date}`,
    `type: ${note.type || 'note'}`,
    `domain: ${note.domain || 'personal'}`,
  ];

  if (note.para) {
    lines.push(`para: ${note.para}`);
  }

  lines.push(
    `tags:`,
    tags || '  []',
    `source_entries:`,
    `  - "[[${date}]]"`,
    `related:`,
    related || '  []',
    `status: active`,
    '---',
  );

  return lines.join('\n');
}

function escapeYaml(str) {
  return (str || '').replace(/"/g, '\\"');
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function highlightFrontmatter(fm) {
  // Basic syntax color for the YAML display
  return fm
    .replace(/^(---)/gm,         '<span class="fm-fence">$1</span>')
    .replace(/^(\w[\w-]*)(:)/gm, '<span class="fm-key">$1</span><span class="fm-fence">$2</span>')
    .replace(/("[\[]{2}[^"]+[\]]{2}")/g, '<span class="fm-list">$1</span>');
}

function renderBody(body) {
  // Turn [[wikilinks]] into styled spans
  return (body || '')
    .replace(/\[\[([^\]]+)\]\]/g, '<span class="wikilink">[[<em>$1</em>]]</span>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function buildNoteCard(note, date, idx) {
  const fm   = buildFrontmatter(note, date);
  const slug = slugify(note.title || `note-${idx + 1}`);

  const card = document.createElement('article');
  card.className = 'note-card';
  card.dataset.idx = idx;

  // Header
  const header = document.createElement('div');
  header.className = 'note-card-header';

  const title = document.createElement('h3');
  title.className   = 'note-card-title';
  title.textContent = note.title || 'Untitled';

  const badge = document.createElement('span');
  badge.className   = `note-type-badge ${typeClass(note.type)}`;
  badge.textContent = note.type || 'note';

  header.appendChild(title);
  header.appendChild(badge);

  // Meta (domain + tags)
  const meta = document.createElement('div');
  meta.className = 'note-card-meta';

  if (note.para) {
    const paraEl = document.createElement('span');
    paraEl.className   = `note-para para-${note.para}`;
    paraEl.textContent = note.para;
    meta.appendChild(paraEl);
  }

  if (note.domain) {
    const domEl = document.createElement('span');
    domEl.className   = 'note-domain';
    domEl.textContent = note.domain;
    meta.appendChild(domEl);
  }

  (note.tags || []).slice(0, 6).forEach(tag => {
    const t = document.createElement('span');
    t.className   = 'note-tag';
    t.textContent = tag;
    meta.appendChild(t);
  });

  // Body preview
  const body = document.createElement('div');
  body.className = 'note-card-body';
  body.innerHTML = renderBody(note.body);

  // Frontmatter (hidden by default)
  const fmEl = document.createElement('pre');
  fmEl.className = 'note-card-frontmatter';
  fmEl.innerHTML = highlightFrontmatter(escapeHtml(fm));

  // Footer
  const footer = document.createElement('div');
  footer.className = 'note-card-footer';

  const toggleFm = document.createElement('button');
  toggleFm.className   = 'btn-toggle-fm';
  toggleFm.textContent = 'Show frontmatter';
  toggleFm.addEventListener('click', () => {
    const visible = fmEl.classList.toggle('visible');
    toggleFm.textContent = visible ? 'Hide frontmatter' : 'Show frontmatter';
  });

  const copyBtn = document.createElement('button');
  copyBtn.className   = 'btn-copy-note';
  copyBtn.textContent = 'Copy';
  copyBtn.addEventListener('click', () => {
    const fullContent = fm + '\n\n' + (note.body || '');
    copyText(fullContent);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
  });

  footer.appendChild(toggleFm);
  footer.appendChild(copyBtn);

  // Assemble
  card.appendChild(header);
  card.appendChild(meta);
  card.appendChild(body);
  card.appendChild(fmEl);
  card.appendChild(footer);

  return card;
}

// =============================================================
// Download ZIP
// =============================================================

async function downloadZip() {
  if (!extractedNotes.length) return;

  const date       = elEntryDate.value || currentDate;
  const vaultOrg   = elVaultOrgCheck.checked;
  const journalText = vaultOrg ? elJournalInput.value.trim() : '';
  const zip        = new JSZip();

  const files = buildFileList(extractedNotes, date, vaultOrg, journalText);
  files.forEach(({ path, content }) => zip.file(path, content));

  const blob = await zip.generateAsync({ type: 'blob' });
  const url  = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href     = url;
  a.download = `alluvium-${date}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

// =============================================================
// Copy all
// =============================================================

function copyAll() {
  if (!extractedNotes.length) return;
  const date = elEntryDate.value || currentDate;

  const all = extractedNotes.map(note => {
    const fm = buildFrontmatter(note, date);
    return fm + '\n\n' + (note.body || '') + '\n';
  }).join('\n\n---\n\n');

  copyText(all);
  elBtnCopyAll.textContent = 'Copied!';
  setTimeout(() => { elBtnCopyAll.textContent = 'Copy all'; }, 1800);
}

// =============================================================
// Utilities
// =============================================================

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:absolute;left:-9999px;top:-9999px';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// =============================================================
// Boot
// =============================================================

document.addEventListener('DOMContentLoaded', init);
