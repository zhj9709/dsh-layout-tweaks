# dsh-style-tweaks

> Dependency version: deepseek-harness v0.1.2-rc.1

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) web plugin that bundles a precise conversation column-width control with a collection of opt-in style tweaks for DSH's UI — including small fixes for the sidebar and the settings panel.

## Features

### Layout

- **Plugin width control (default on)** — when ON, the plugin's width input / presets drive the conversation column and DSH's native drag handles are hidden; when OFF, DSH's native handles own the column and the width input mirrors their value.
- **Dialog width** — any value between 600 and 1600 px; includes presets 748 (default) / 880 (Wide) / 1024 (Extra wide).
- **Side margin** — whitespace in px kept on each side of the conversation area. The column is clamped to the dialog width and narrows when the sidebar opens or the window shrinks, never hugging the edges. Minimum 32 px.

### Tweaks

- **Stable table layout (default on)** — locks table layout on hover so surrounding content does not reflow ("text jumps when I hover a table").
- **Stable turn-navigation rail (default on)** — keeps the turn-navigation rail at a stable position when scrolling up past the first message into the system prompt area (no longer drops by ~16 px).
- **Flush code-block top (default on)** — removes the 16 px gap above highlighted code blocks so the code sits flush with the preceding paragraph, list item, or heading.
- **Project running indicator (default on)** — shows the conversation title's animated running dot on the right side of each project directory in the sidebar, so a running conversation stays visible even when its group is collapsed.
- **Locate current session (default on)** — adds a "locate" button to the left of the native search button in the sidebar's "Workspaces" section header. Clicking it expands the current session's workspace directory (if collapsed) and its "Show {n} more sessions" overflow, then scrolls the session into the sidebar's visible area. Disabled with the tooltip "Open a session first" when no session is open.
- **Scrollable settings nav (default on)** — lets the settings dialog's left menu scroll when its entries outgrow the panel, instead of silently clipping the ones at the bottom (the panel has a fixed height and `overflow: hidden`; stock CSS only gave the right content column a scroll treatment). The scrollbar is an overlay-style thin strip: parked in the rail's spare right padding so it never squeezes the menu, and visible only while the list is actually scrolling, fading out ~0.8 s after scrolling stops.
- **Middle-click closes sidebar tabs (default on)** — since 0.1.5 the right sidebar is a tabbed panel. A middle mouse click on any of its tabs (docked or floating) closes it, the way browser tabs behave. The close rides the host's public `ctx.sidebarRight` close face, so the native rules stay in force: the guide standing as the sole docked tab cannot be closed, and closing the last docked tab collapses the column exactly as its ✕ does. Middle-click autoscroll is suppressed over the strips, and a held middle button can no longer drag or float a tab. On pre-0.1.5 hosts the tweak stays inert.
- **Legacy stats line (default off)** — since DSH 0.1.5 the stats under the input box are two icon pills that open dialogs; this tweak brings back the pre-0.1.5 centered text line (turns/steps · timings · speed · cache hit · tokens). It reads the same durable projections (`sessionStats` / `tokenUsage`) so every figure matches the pills; an overlong line truncates with an ellipsis and reveals itself on hover, and turning the tweak off hands the row straight back to the pills.
- **Cache hit with two decimals (default off)** — shows the composer stats' cache-hit share with two decimal places (e.g. `87.35%`) instead of integer rounding; the token-usage dialog follows. Applies to both presentations — the new icon pills and the legacy text line alike; with both toggles on, the legacy line renders and takes the flag.
- **Turn speed & TTFT (default off)** — since 0.1.5, cold sessions no longer rebuild per-token timing, so each turn's time dialog keeps only the wall-clock duration. Clicking a turn's time pill refills that dialog with the output speed and TTFT rows, rebuilt from the model stream embedded in the session log; history loads get the same figures a live session did.

```yaml
style-tweaks:
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
  settingsNavScroll: true          # default true; false disables the settings-nav scrolling
  sidebarMiddleClickClose: true    # default true; false disables middle-click tab closing
  legacyStatsLine: false           # default false; true swaps the pills for the 0.1.2 text line
  pillsCacheHitDecimals: false     # default false; true shows the cache hit with two decimals (pills and legacy line)
  turnSpeedMetrics: false          # default false; true refills the turn-time dialog with output speed and TTFT
```

Settings entry: **Settings → Style tweaks**.

## Install

```bash
# from npm (recommended, prebuilt)
npx -y @deepseek-ai/dsh plugin --profile web add dsh-style-tweaks

# from GitHub (source; runs the self-contained prepare build)
npx -y @deepseek-ai/dsh plugin --profile web add github:zhj9709/dsh-style-tweaks
```

The package spec after `add` is forwarded to pnpm verbatim, so versions can be
pinned — `@version` for the npm package, `#tag` for the GitHub source:

```bash
npx -y @deepseek-ai/dsh plugin --profile web add dsh-style-tweaks@0.1.0                    # pin the npm version
npx -y @deepseek-ai/dsh plugin --profile web add github:zhj9709/dsh-style-tweaks#v0.1.0     # pin a git tag
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
   cp lib/client.js ~/.dsh/profiles/web/node_modules/dsh-style-tweaks/lib/client.js
   ```

3. **DSH's client-plugin HMR receiver** detects the change and automatically reloads the plugin — no reinstall required.

> Note: Sometimes the GUI process caches the old bundle, making it appear that changes have no effect. In this case, restart the `dsh web` process.

Only client plugins (`client.js`) support hot reloading. Changes to the `apps/web` shell or plain packages still require rebuilding web artifacts and a page refresh.

## How it works

- **Server** (`src/index.ts`) registers the `style-tweaks` settings namespace and mounts a same-origin route (`/_dsh/style-tweaks/settings`).
- **Browser** (`src/client/index.tsx`) reads/writes that route, renders the Settings section, and mounts / unmounts each tweak live based on its toggle (pure-CSS tweaks inject runtime `<style>` elements; JS-level tweaks also read the app's own state stores and patch the DOM).
- **Column-width engine** (`src/client/conversation-width.ts`) writes the `--dsh-chat-user-width` CSS variable and hides DSH's native `[data-width-handle]` drag strips while plugin width control is on; the chosen px is also mirrored into the localStorage slot the native handles read, so flipping the switch round-trips cleanly.
- **Tweak registry** (`src/client/tweaks/registry.ts`) centralises each tweak's metadata (id, settings field name, default value, i18n keys); adding a new tweak means appending one entry here and dropping a new injector file under `src/client/tweaks/`.
- **Project running indicator** (`src/client/tweaks/project-running-indicator.ts`) reads session running state and directory membership from `ctx.get('sessions')` / `ctx.get('workspaces')`, and uses a MutationObserver to mount the app's own `StateDot` (re-using `@deepseek-ai/dsh-client-ui-primitives` so the animation keyframes and style tokens are byte-identical to the conversation title's dot) inside each project directory header row (`role="treeitem"[aria-expanded]`, a stable hand-written attribute).
- **Locate current session** (`src/client/tweaks/locate-current-session.ts`) injects a new button into the sidebar's workspaces section header, to the left of the native search button. All anchors are i18n-safe: the search button's aria-label and the breadcrumb nav's aria-label are resolved through `ctx.locale.bind()` (the `workspace` / `conversation` namespace keys DSH itself uses), with structural class-fragment fallbacks (`searchButton`, `crumbs`) when the locale service is unavailable. Clicking it reads the current session title from the breadcrumb's disabled crumb, resolves the parent workspace via `ctx.get('sessions')` / `ctx.get('workspaces')` app stores (works even when the workspace's sidebar group is collapsed), finds the workspace row by exact title match, then pierces both collapse layers — clicking the collapsed workspace row to expand it, and auto-clicking the "Show {n} more sessions" overflow button (`[class*="sessionOverflowButton"][aria-expanded="false"]`) when the target row hides behind it — before `scrollIntoView({ block: 'center' })`. The hover tooltip replicates DSH's native `<Tooltip>` primitive (fixed-position bubble, theme tokens, 500 ms delay, viewport flip) instead of the browser-native `title`. A MutationObserver watches `aria-selected` / `aria-expanded` attribute changes to keep the button's enabled state and mount in sync.
- **Scrollable settings nav** (`src/client/tweaks/settings-nav-scroll.ts`) turns the settings dialog's left nav list into the scroll container of the nav rail: DSH's settings panel (`SettingsRoot`) has one fixed height with `overflow: hidden` and only gave the right content column (`.options`) an `overflow-y: auto`; the left `.navList` has neither `min-height: 0` nor an overflow treatment, so extra entries spill out and get clipped. Two CSS rules plus a small JS driver do it: the base rule `flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding-bottom: 12px; margin-inline-end: -12px` makes the list scrollable and parks the classic scrollbar in the nav rail's full 12px right padding gutter (8px gap + 4px strip), so the thumb floats over the spare padding 8px clear of the entries; a cell cap `max-width: 164px` (DSH's stock 188 nav − 2×12 padding) pins the entries to stock width in every state — bar present or not, hovering or scrolling — and `::-webkit-scrollbar { width: 4px }` is two notches thinner than DSH's global skin. The show timing is JS-driven: the first cut used `:not(:hover)` to blank the thumb, but Chromium does not reliably repaint custom scrollbar pseudo-elements when only the host's `:hover` state changes (in practice the bar appeared when clicking a nav cell — the React re-render forced the repaint), so the driver listens for `scroll` events on the list instead: scrolling adds a `cst-nav-scroll-show` class that reveals the thumb (coloured from the panel's inherited l2 tokens), and the class is removed ~0.8 s after scrolling stops; a MutationObserver re-attaches the listener whenever the dialog unmounts and reopens. The selector pairs the modal structure with a CSS Modules class fragment (DSH hashes classes as `[hash]_[local]`; the `navList` local name is unique across DSH), and needs no `!important`.
- **Middle-click closes sidebar tabs** (`src/client/tweaks/sidebar-middle-click-close.ts`): a right-Sidebar tab chip is `div[role="tab"][data-dockkit-tab="<tabId>"]`, rendered by `ui-dockkit`'s `TabPanel`, and the docking kit is adopted only by the right Sidebar (docked panel plus floating layer), so "chip" is exactly "Sidebar tab". The tweak hangs three listeners on `document` in the capture phase (React 17+ listens at the root container, so document capture precedes the whole React tree and the interception is total): `pointerdown` (middle) stops propagation so the chip's own press→drag gesture never begins — holding the middle button and drifting ≥4px can no longer place, split, or float the tab; `mousedown` (middle) calls `preventDefault()`, suppressing the browser's middle-click autoscroll (the `auxclick` that follows still fires); `auxclick` (middle — browsers deliver non-primary clicks as `auxclick`, never `click`) reads the chip's `TabId` and hands it to `ctx.sidebarRight.close()`, so every closing rule is the host store's own planner's (missing tab → no-op, the sole docked guide is unclosable, closing the last docked tab collapses the column) and the plugin duplicates none of them. `ctx.sidebarRight` only exists on 0.1.5+ hosts, and it is provided by `ui-sidebar-right` in that package's own plugin fiber — a plain property read resolves services only along the ancestor-fiber chain, so from a sibling plugin it throws ("cannot get property … without inject") even on hosts that have the face, while declaring the service in this plugin's `inject` would make it required and dead-lock the boot on pre-0.1.5 hosts; so the face is resolved at every middle close through `ctx.reflect.get('sidebarRight')` — the reflect instance and its store are shared per root and `provide` allocates the isolation key at the root, so `get` reads sibling-provided services across fibers with no inject requirement, and an unprovided name answers `undefined` instead of throwing (pre-0.1.5 hosts → `undefined`, where the tweak keeps its inert form — side-effect suppression only); a `close()` throw with no mounted seat is swallowed. Floating panels render no chip: their middle close forwards to the header's own ✕ control (absent — a no-op — when the embedder's `canCloseTab` withholds it), while the header's dock button is explicitly excluded; a press and a release on different elements hand the `auxclick` to their common ancestor, which answers neither helper and closes nothing.
- **Legacy stats line** (`src/client/tweaks/legacy-stats-line.tsx`): 0.1.5 replaced the composer stats line (the old `StatsLine`) with icon pills (the new `StatsPills`); both mount the same way — a `list` entry with id `stats` on the `conversation.composer.dock` slot. A list cell renders its lowest-priority live entry (see `SlotCore.register`), so while the tweak is on, the plugin shadows the shipped entry with `id: 'stats'` + `priority: -2` (one step below the pills-decimals row, which it outranks when both are on) — the slot system's own shadowing mechanism, no CSS hiding or DOM patching — and disposing the registration hands the cell straight back; a crashed entry retires itself, restoring the pills. The data plane matches the pills: the durable `sessionStats` (whole-log counts and wall times) and `tokenUsage` (billing buckets) projections, without the old whole-window fallback fold (no projection → no row, matching the old line's "no data, no row" rule). Copy lives in the plugin's own `style-tweaks` namespace (`legacyStats.*` keys) — DSH removed the old `stats.llm` family from its dictionaries in 0.1.5, so the plugin carries its own en/zh strings; the row skin (centered, tertiary text, ellipsis truncation) is ported from 0.1.2's `StatsLine.module.css` with the original tokens plus fallbacks. The row root carries the `data-composer-stats` marker: the host InputBar tightens its own 8px bottom clearance to 4px around any mounted stats row (`.root:has([data-composer-stats])`), and the row adds 2px of bottom padding so its total matches the pills row (26px row + 4px host clearance on both presentations) — toggling the tweak no longer shifts the conversation. The cache-hit share's precision follows the `pillsCacheHitDecimals` flag — two decimals while it is on, 0.1.2's integer rounding while off; the flag is captured at mount, and any settings change remounts every tweak, so the line always renders with the current value.
- **Cache hit with two decimals** (`src/client/tweaks/pills-cache-hit-decimals.tsx`): the pills' percent rounding happens inside a module-internal formatter in dsh-client-ui-chat that a plugin cannot reach, so while the tweak is on, it shadows the same `stats` slot cell (`priority: -1`) with its own render of the whole row — both pills and their click-open dialogs ported style-for-style from 0.1.5's `StatsPills` / `stat-dialog` (placement and outside-close ride the host primitives' own `useAnchoredPosition` / `useDismissOnOutsidePointer`), with the cache hit routed through the plugin's shared `formatCacheHitPercent(…, 2)` (two-decimal rounding; a hit that would read `100%` keeps its honest extra-precision tail, e.g. `99.97`). The dialog rows and pill labels follow. The data plane is the same `sessionStats` / `tokenUsage` projections (no window fold), and the root carries `data-composer-stats` as well. One icon note: the pills' gauge icon only exists in primitives 0.1.3+, while the plugin typechecks against 0.1.2-rc.1 — at runtime the host's `IconGaugeOutline16` is used when present, falling back to a clock icon. Layering with the legacy line: both tweaks write the same slot cell; the legacy line registers at `priority: -2` and renders instead, leaving this row shadowed (unrendered, zero cost) until the legacy line is turned off, and the shipped pills return only when both tweaks are off. The toggle stays visible either way: the legacy line reads the same flag for its own decimals.
- **Turn speed & TTFT** (`src/client/tweaks/turn-speed-metrics.tsx` + `src/client/tweaks/assistant-stream-timing.ts`): session format v2 (0.1.5) embeds each model attempt's exact timed stream inside its durable settlement (`assistant/message`'s `data.stream`), but the Chat UI's cold presentation builds settled output straight from the assembled message and never replays it (the v2 architecture note, verbatim: "Cold settled presentation therefore does not reconstruct per-token timing") — the turn footer's own fold reads the node's in-memory timing, whose `firstTokenTime` only survives live-chunk folding, so every turn's output speed (TPS) and first-token time (TTFT) vanish across a reload and the "turn time & speed" dialog keeps only the wall-clock duration. This tweak is the consumer that note anticipates: it reads the settlements out of the session binding's documented event window (`ctx.sessions.binding(sessionId).eventSource`, the same feed the Conversation assembly consumes), with the compact-stream readers ported verbatim from dsh-llm (`assistantStreamFirstTokenTime`: reconstructs the first token's time inside a packed run from `time0` plus the `dt` gap list) and the fold from 0.1.5's `deriveTurnMetrics` — TTFT is the lowest step's dispatch→first-token delta, TPS is Σ output tokens ÷ Σ decode wall time over the steps carrying both timing and usage. Everything rides the durable log, so history loads and freshly settled turns show identical figures. Display choice: the dialog belongs to `TurnTimePanel`, which offers no slot, so the tweak mounts an invisible controller on the `conversation.chat.assistant-actions` list slot (inside each turn's action row; list entries render additively, no election race with other plugins' entries). A capture click listener on the footer only hands that footer to one shared body-wide `MutationObserver` (the dialog is portaled to `<body>`, so the panel node cannot reach its footer through `closest()`); the observer callback is a microtask that always runs before the next frame's rendering steps, claims the freshly committed panel by its stable `data-turn-time-details` marker, and appends `<dt>/<dd>` pairs after the duration row — labels straight from DSH's surviving `chat` vocabulary (`message.turnTime.speed` / `message.turnTime.ttft` / `message.tokensPerSecond` / `duration.seconds`), values inheriting the dialog's own `.details dt/.details dd` grid rules, so the refilled panel reads exactly like the 0.1.2 one. Appending rows grows the panel, and `useAnchoredPosition` repositions through `ResizeObserver` → `setState`, whose render lands after the next paint — the panel would otherwise paint one frame at its stale `top` (48 px too low) before snapping up, the very flash this tweak shipped with — so the same microtask lifts the fixed-positioned card by the added height, the first paint lands at the final position, and the host's own reposition later writes the identical value; turns whose live timing already survived render their own rows and are skipped by label. The rows are plain DOM inside the React-owned panel: they die with the dialog and re-inject on every open; with no derivable figure (no token in the stream, or the settlement outside the loaded window) nothing is injected, and turning the tweak off restores the stock behaviour.

## Acknowledgements

This plugin was inspired by and built with reference to [wlj521/dsh-ui-tweaks](https://github.com/wlj521/dsh-ui-tweaks) — a more comprehensive DSH UI customisation plugin covering fonts, tables, timeline, Git, and more. If this plugin does not cover what you need, check that one out.

## License

MIT