# dsh-conversation-style-tweaks

> Dependency version: deepseek-harness v0.1.2-rc.1

A [DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/) (DSH) web plugin that bundles a precise column-width control with a collection of opt-in CSS tweaks for the conversation view.

## Features

### Layout (ported from dsh-dialog-width)

- **Plugin width control (default on)** — when ON, the plugin's width input / presets drive the conversation column and DSH's native drag handles are hidden; when OFF, DSH's native handles own the column and the width input mirrors their value.
- **Dialog width** — any value between 600 and 1600 px; includes presets 748 (default) / 880 (Wide) / 1024 (Extra wide).
- **Side margin** — whitespace in px kept on each side of the conversation area. The column is clamped to the dialog width and narrows when the sidebar opens or the window shrinks, never hugging the edges. Minimum 32 px.

### Tweaks

- **Stable table layout (default on)** — locks table layout on hover so surrounding content does not reflow ("text jumps when I hover a table").
- **Stable turn-navigation rail (default on)** — keeps the turn-navigation rail at a stable position when scrolling up past the first message into the system prompt area (no longer drops by ~16 px).
- **Flush code-block top (default on)** — removes the 16 px gap above highlighted code blocks so the code sits flush with the preceding paragraph, list item, or heading.
- **Project running indicator (default on)** — shows the conversation title's animated running dot on the right side of each project directory in the sidebar, so a running conversation stays visible even when its group is collapsed.
- **Locate current session (default on)** — adds a "locate" button to the left of the native search button in the sidebar's "Workspaces" section header. Clicking it expands the current session's workspace directory (if collapsed) and its "Show {n} more sessions" overflow, then scrolls the session into the sidebar's visible area. Disabled with the tooltip "Open a session first" when no session is open.

```yaml
conversation-style-tweaks:
  # Layout
  usePluginWidth: true             # default true; false hands the column back to native handles
  dialogWidth: 748                 # 600–1600 px
  sideMargin: 50                   # ≥ 32 px
  # Tweaks
  stableTable: true                # default true; false disables the tweak
  stableTurnRail: true             # default true; false disables the tweak
  codeBlockFlushTop: true          # default true; false disables the tweak
  projectRunningIndicator: true    # default true; false disables the tweak
  locateCurrentSession: true       # default true; false hides the sidebar locate button
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
npx -y @deepseek-ai/dsh plugin --profile web add dsh-conversation-style-tweaks@0.0.2                    # pin the npm version
npx -y @deepseek-ai/dsh plugin --profile web add github:zhj9709/dsh-conversation-style-tweaks#v0.0.2     # pin a git tag
```

Restart DSH web once after installing (bundle plugins are scanned at process start).

## Development

### Build

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

### Hot Reload (no reinstall needed)

Only the client plugin (`lib/client.js`) needs to be loaded by the DSH runtime. After each code change:

1. **Build**:
   ```bash
   pnpm build
   ```

2. **Copy to the profile directory**:
   ```bash
   cp lib/client.js ~/.dsh/profiles/web/node_modules/dsh-conversation-style-tweaks/lib/client.js
   ```

3. **DSH's client-plugin HMR receiver** detects the change and automatically reloads the plugin — no reinstall required.

> Note: Sometimes the GUI process caches the old bundle, making it appear that changes have no effect. In this case, restart the `dsh web` process.

Only client plugins (`client.js`) support hot reloading. Changes to the `apps/web` shell or plain packages still require rebuilding web artifacts and a page refresh.

## How it works

- **Server** (`src/index.ts`) registers the `conversation-style-tweaks` settings namespace and mounts a same-origin route (`/_dsh/conversation-style-tweaks/settings`).
- **Browser** (`src/client/index.tsx`) reads/writes that route, renders the Settings section, and mounts / unmounts each tweak live based on its toggle (pure-CSS tweaks inject runtime `<style>` elements; JS-level tweaks also read the app's own state stores and patch the DOM).
- **Column-width engine** (`src/client/conversation-width.ts`) writes the `--dsh-chat-user-width` CSS variable and hides DSH's native `[data-width-handle]` drag strips while plugin width control is on; the chosen px is also mirrored into the localStorage slot the native handles read, so flipping the switch round-trips cleanly.
- **Tweak registry** (`src/client/tweaks/registry.ts`) centralises each tweak's metadata (id, settings field name, default value, i18n keys); adding a new tweak means appending one entry here and dropping a new injector file under `src/client/tweaks/`.
- **Project running indicator** (`src/client/tweaks/project-running-indicator.ts`) reads session running state and directory membership from `ctx.get('sessions')` / `ctx.get('workspaces')`, and uses a MutationObserver to mount the app's own `StateDot` (re-using `@deepseek-ai/dsh-client-ui-primitives` so the animation keyframes and style tokens are byte-identical to the conversation title's dot) inside each project directory header row (`role="treeitem"[aria-expanded]`, a stable hand-written attribute).
- **Locate current session** (`src/client/tweaks/locate-current-session.ts`) injects a new button into the sidebar's workspaces section header, to the left of the native search button. All anchors are i18n-safe: the search button's aria-label and the breadcrumb nav's aria-label are resolved through `ctx.locale.bind()` (the `workspace` / `conversation` namespace keys DSH itself uses), with structural class-fragment fallbacks (`searchButton`, `crumbs`) when the locale service is unavailable. Clicking it reads the current session title from the breadcrumb's disabled crumb, resolves the parent workspace via `ctx.get('sessions')` / `ctx.get('workspaces')` app stores (works even when the workspace's sidebar group is collapsed), finds the workspace row by exact title match, then pierces both collapse layers — clicking the collapsed workspace row to expand it, and auto-clicking the "Show {n} more sessions" overflow button (`[class*="sessionOverflowButton"][aria-expanded="false"]`) when the target row hides behind it — before `scrollIntoView({ block: 'center' })`. The hover tooltip replicates DSH's native `<Tooltip>` primitive (fixed-position bubble, theme tokens, 500 ms delay, viewport flip) instead of the browser-native `title`. A MutationObserver watches `aria-selected` / `aria-expanded` attribute changes to keep the button's enabled state and mount in sync.

## Acknowledgements

This plugin was inspired by and built with reference to [wlj521/dsh-ui-tweaks](https://github.com/wlj521/dsh-ui-tweaks) — a more comprehensive DSH UI customisation plugin covering fonts, tables, timeline, Git, and more. If this plugin does not cover what you need, check that one out.

## License

MIT