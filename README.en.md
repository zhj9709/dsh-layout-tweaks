# dsh-conversation-style-tweaks

> **Version requirement**: requires **DSH v0.1.2-rc.1 or newer**.

A [DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/) (DSH) web plugin that bundles a precise column-width control with a collection of opt-in CSS tweaks for the conversation view.

## Features

### Layout (ported from dsh-dialog-width)

- **Plugin width control (default on)** — when ON, the plugin's width input / presets drive the conversation column and DSH's native drag handles are hidden; when OFF, DSH's native handles own the column and the width input mirrors their value.
- **Dialog width** — any value between 600 and 1600 px; includes presets 748 (default) / 880 (Wide) / 1024 (Extra wide).
- **Side margin** — whitespace in px kept on each side of the conversation area. The column is clamped to the dialog width and narrows when the sidebar opens or the window shrinks, never hugging the edges. Minimum 32 px.

### Tweaks

- **Stable table layout (default on)** — locks table layout on hover so surrounding content does not reflow ("text jumps when I hover a table").

```yaml
conversation-style-tweaks:
  # Layout
  usePluginWidth: true   # default true; false hands the column back to native handles
  dialogWidth: 748       # 600–1600 px
  sideMargin: 50         # ≥ 32 px
  # Tweaks
  stableTable: true      # default true; false disables the tweak
```

Settings entry: **Settings → Conversation style**.

## Install

```bash
# from npm (recommended, prebuilt)
npx -y @deepseek-ai/dsh plugin --profile web add dsh-conversation-style-tweaks

# from GitHub (source; runs the self-contained prepare build)
npx -y @deepseek-ai/dsh plugin --profile web add github:zhj9709/dsh-conversation-style-tweaks
```

The package spec after `add` is forwarded to pnpm verbatim, so versions can be
pinned — `@version` for the npm package, `#tag` for the GitHub source:

```bash
npx -y @deepseek-ai/dsh plugin --profile web add dsh-conversation-style-tweaks@0.0.1                    # pin the npm version
npx -y @deepseek-ai/dsh plugin --profile web add github:zhj9709/dsh-conversation-style-tweaks#v0.0.1     # pin a git tag
```

Restart DSH web once after installing (bundle plugins are scanned at process start).

## Development

```bash
pnpm install
pnpm build          # tsc (server) + tsc (client) + bundle lib/client.js
pnpm typecheck
```

Load against a running DSH with an overlay, or install as a bundle:

```bash
npx -y @deepseek-ai/dsh web --patch ./cordis.patch.yml   # dev overlay
npx -y @deepseek-ai/dsh plugin --profile web add .        # bundle install from this checkout
```

## How it works

- **Server** (`src/index.ts`) registers the `conversation-style-tweaks` settings namespace and mounts a same-origin route (`/_dsh/conversation-style-tweaks/settings`).
- **Browser** (`src/client/index.tsx`) reads/writes that route, renders the Settings section, and injects the corresponding CSS live via runtime `<style>` elements based on each toggle's state.
- **Column-width engine** (`src/client/conversation-width.ts`) writes the `--dsh-chat-user-width` CSS variable and hides DSH's native `[data-width-handle]` drag strips while plugin width control is on; the chosen px is also mirrored into the localStorage slot the native handles read, so flipping the switch round-trips cleanly.
- **Tweak registry** (`src/client/tweaks/registry.ts`) centralises each tweak's metadata (id, settings field name, default value, i18n keys); adding a new tweak means appending one entry here and dropping a new injector file under `src/client/tweaks/`.

## Acknowledgements

This plugin was inspired by and built with reference to [wlj521/dsh-ui-tweaks](https://github.com/wlj521/dsh-ui-tweaks) — a more comprehensive DSH UI customisation plugin covering fonts, tables, timeline, Git, and more. If this plugin does not cover what you need, check that one out.

## License

MIT