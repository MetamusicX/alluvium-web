# ~ Alluvium

**Flow becomes knowledge.**

Alluvium is a browser-based journal processor that extracts atomic notes from free-form daily entries using any major LLM. No server, no backend — your API key stays in your browser.

Write in any language. Alluvium will understand you.

## How it works

1. **Write** or paste your journal entry
2. **Process** — the AI reads the entry and extracts distinct atomic notes (ideas, events, tasks, reflections, people, practice logs)
3. **Download** as Obsidian-compatible markdown files with YAML frontmatter, or copy to clipboard

Each note gets a type, domain, tags, wikilinks, and related connections — ready to drop into an Obsidian vault.

## Supported providers

Bring your own API key from any of these providers:

- **Anthropic** — Claude Sonnet 4.6, Opus 4.8, Haiku 4.5
- **OpenAI** — GPT-4o, GPT-4.1, o4-mini
- **Google Gemini** — Gemini 2.5 Pro, Gemini 2.5 Flash
- **Mistral** — Mistral Large, Mistral Small
- **DeepSeek** — DeepSeek Chat, DeepSeek Reasoner

API keys are stored per provider — you can switch between them without re-entering.

## PARA organization (opt-in)

Toggle **"Organize for Obsidian vault"** in the editor to enable [Tiago Forte's PARA method](https://fortelabs.com/blog/para/). When enabled:

- The AI classifies each note into **Projects**, **Areas**, **Resources**, or **Archive**
- The ZIP download mirrors your vault folder structure (`1 Projects/`, `2 Areas/`, `3 Resources/`, `4 Archive/`, `5 Conversations/`, `People/`)
- Journal entries are placed at the correct path with monthly subfolders (`00 Journal/`)
- Person-type notes go to `People/`

When disabled, you get a flat `alluvium-notes/` folder — simple and unopinionated.

## Vault awareness (Chrome/Edge)

When you connect an output folder (ideally your Obsidian vault), Alluvium becomes vault-aware:

- Before each extraction it scans your existing notes (all people, plus the most recently modified notes)
- The AI sees those titles, links to them with `[[wikilinks]]`, and **does not re-create people or topics that already exist**
- New context about an existing person or topic is **appended to that note** as a dated update, instead of creating a duplicate
- Appends refresh the note's `date_modified` in the frontmatter

Everything stays local: the scan happens in your browser via the File System Access API, and only note *titles* are included in the prompt sent to your chosen provider.

## Conversations — dialogue with your sedimented knowledge

As your vault accumulates layers over weeks and months, a new possibility emerges: you can **interrogate your own sedimented knowledge**. Use any AI assistant (Claude Code, ChatGPT, Cursor, or similar) to ask questions about patterns, connections, and themes across your entire vault.

When a dialogue produces conclusions worth keeping, ask the assistant to summarize it into `5 Conversations/YYYY-MM-DD-<topic-slug>.md` with this structure:

- **Context** — what prompted the question
- **Key Findings** — what emerged
- **Conclusions** — interpretive takeaways
- **Decisions** — what was resolved
- **To-dos** — next actions

These files are not automatic. They preserve only the dialogues that crystallize something worth returning to. Over time, the Conversations folder becomes a record of your evolving understanding of your own material — the shift from a system that merely *stores* knowledge to one that helps you *think with* it.

## Setup

1. Get an API key from your preferred provider
2. Open Alluvium and select your provider in **Settings**
3. Paste your API key and choose a model
4. (Optional) Customise your life domains — these give the AI context for classifying notes
5. Start writing

Your API key is stored in `localStorage` and used only for direct browser-to-API calls. It never touches a server.

## Customisation

### Life domains

Domains give the AI context about your life areas. Default domains: Work, Writing, Sport, Music, Personal. Edit them in Settings — one per line, format: `key: Name — description`.

### Model

Each provider offers multiple models. The recommended model is pre-selected, but you can switch between faster/cheaper and slower/more thorough options.

## Tech

- Pure HTML, CSS, JavaScript — no build step, no frameworks
- Direct browser-to-API calls (bring your own key)
- [JSZip](https://stuk.github.io/jszip/) for client-side ZIP generation
- Deployed on [Netlify](https://www.netlify.com/) as a static site

## Privacy

Everything runs in your browser. Your journal text is sent directly to the selected provider's API using your own key. Nothing is stored on any server. Nothing is logged.

## License

[MIT](LICENSE)

---

Built by [Paulo de Assis](https://github.com/MetamusicX)
