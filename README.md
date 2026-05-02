# ~ Alluvium

**Flow becomes knowledge.**

Alluvium is a browser-based journal processor that extracts atomic notes from free-form daily entries using Claude. No server, no backend — your API key stays in your browser.

Write in any language. Alluvium will understand you.

## How it works

1. **Write** or paste your journal entry
2. **Process** — Claude reads the entry and extracts distinct atomic notes (ideas, events, tasks, reflections, people, practice logs)
3. **Download** as Obsidian-compatible markdown files with YAML frontmatter, or copy to clipboard

Each note gets a type, domain, tags, wikilinks, and related connections — ready to drop into an Obsidian vault.

## PARA organization (opt-in)

Toggle **"Organize for Obsidian vault"** in the editor to enable [Tiago Forte's PARA method](https://fortelabs.com/blog/para/). When enabled:

- Claude classifies each note into **Projects**, **Areas**, **Resources**, or **Archive**
- The ZIP download mirrors your vault folder structure (`1 Projects/`, `2 Areas/`, `3 Resources/`, `4 Archive/`, `People/`)
- Journal entries are placed at the correct path with monthly subfolders (`00 Journal/`)
- Person-type notes go to `People/`

When disabled, you get a flat `alluvium-notes/` folder — simple and unopinionated.

## Setup

1. Get an [Anthropic API key](https://console.anthropic.com/)
2. Open Alluvium and paste your key in **Settings**
3. (Optional) Customise your life domains — these give Claude context for classifying notes
4. Start writing

Your API key is stored in `localStorage` and used only for direct browser-to-Claude calls. It never touches a server.

## Customisation

### Life domains

Domains give Claude context about your life areas. Default domains: Work, Writing, Sport, Music, Personal. Edit them in Settings — one per line, format: `key: Name — description`.

### Model

Choose between Claude Sonnet (recommended), Opus (slower, more thorough), or Haiku (fast, cheaper).

## Tech

- Pure HTML, CSS, JavaScript — no build step, no frameworks
- Direct browser-to-Anthropic API calls
- [JSZip](https://stuk.github.io/jszip/) for client-side ZIP generation
- Deployed on [Netlify](https://www.netlify.com/) as a static site

## Privacy

Everything runs in your browser. Your journal text is sent directly to the Anthropic API using your own key. Nothing is stored on any server. Nothing is logged.

## License

[MIT](LICENSE)

---

Built by [Paulo de Assis](https://github.com/MetamusicX)
