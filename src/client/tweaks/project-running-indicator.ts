/**
 * dsh-conversation-style-tweaks — project-running-indicator tweak.
 *
 * The first non-pure-CSS tweak: it renders the *app's own* `StateDot`
 * (the animated pixel-chase shown left of a running conversation's title,
 * `ui-primitives/src/StateDot.tsx`) on the right side of every project
 * directory header row in the sidebar, so a running conversation stays
 * visible even when its group is collapsed.
 *
 * ## Why DOM patching
 *
 * DSH's project header (`ProjectRowItem`, `ui-workspace/src/client/rows/
 * Rows.tsx:112`) exposes no plugin slot, and the `sidebar.workspaces` seat
 * is already occupied by the stock browser — so the header row can only be
 * decorated from outside, via a MutationObserver. Consistent with this
 * repo's selector philosophy, the engine anchors exclusively on hand-written
 * DOM facts that survive CSS-Modules hashing:
 *
 *   - group header rows are the only `role="treeitem"` elements carrying
 *     `aria-expanded` (session rows and flat-list rows never have it);
 *   - the row's title text is the only `:scope > span > span` descendant
 *     with non-empty text (folder/chevron slots hold bare SVGs, the action
 *     buttons' labels live on `aria-label`, not text).
 *
 * ## Data source
 *
 * Running state is read from the app's own stores, not inferred from the
 * DOM (a collapsed group hides its child rows, so the DOM cannot answer):
 *
 *   - `ctx.get('sessions').list` — snapshot store of `SessionSummary`s
 *     (`byId[id].running`);
 *   - `ctx.get('workspaces').list` — `WorkspaceSnapshot.items`, each
 *     `WorkspaceView.sessionIds` mapping sessions to directories.
 *
 * Membership is computed from the workspace arrays (mirroring
 * `deriveGroups` in `ui-workspace/src/client/tree.ts`): archived and blank
 * sessions are skipped, sessions not in any workspace count toward the
 * "Ungrouped" bucket. A running subagent marks its top-level ancestor
 * session busy (same lineage walk as `indexSubagentDescendants`), which is
 * what the title's own dot shows.
 *
 * Header rows are matched to workspaces by title text; a header whose label
 * matches no workspace title is the Ungrouped bucket. This avoids depending
 * on DSH's locale copy for the bucket label (and tolerates renames for
 * free, since the title text *is* the match key).
 *
 * ## Rendering
 *
 * The dot is the real `StateDot` imported from
 * `@deepseek-ai/dsh-client-ui-primitives`. That package is in the client
 * shell's `PLATFORM_MODULES` baseline, so at runtime the import resolves to
 * the app's shared instance — its CSS module (and the global
 * `dsh-state-dot-chase` keyframes) and theme tokens are already loaded, and
 * the animation is pixel-identical to the one on session titles. The dot is
 * mounted with a `react-dom/client` root per decorated row and unmounted
 * whenever the group goes idle, the row leaves the DOM, or the tweak is
 * disabled.
 */

import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
// Type-only imports activate the client-service Context declarations
// (`ctx.get('sessions')` / `ctx.get('workspaces')` keys).
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'

/** Structural view of the app's session-list snapshot store (read face only). */
interface SnapshotStoreLike<S> {
  getSnapshot(): S
  subscribe(listener: () => void): () => void
}

/** Fields of `SessionSummary` the lineage/status walk needs. */
interface SessionSummaryLike {
  readonly id: string
  readonly running: boolean
  readonly blank: boolean
  readonly parentId?: string | undefined
  readonly origin?: 'subagent' | undefined
}

interface SessionListStateLike {
  /** Host-list order; breadcrumb-only subagent rows are excluded. */
  readonly ids: readonly string[]
  readonly byId: Readonly<Record<string, SessionSummaryLike | undefined>>
}

/** Fields of `WorkspaceView` the membership mapping needs. */
interface WorkspaceViewLike {
  readonly workspaceId: string
  readonly title: string
  readonly sessionIds: readonly string[]
}

interface WorkspaceSnapshotLike {
  readonly items: readonly WorkspaceViewLike[]
  readonly archivedSessionIds: readonly string[]
}

/** Which group headers currently show a dot, keyed by visible label. */
interface GroupBusy {
  /** Labels with at least one busy member session. */
  readonly busyTitles: ReadonlySet<string>
  /** Every workspace title, for recognizing the Ungrouped header. */
  readonly knownTitles: ReadonlySet<string>
  readonly ungroupedBusy: boolean
}

const INDICATOR_CSS = `
span[data-cst-proj-indicator] {
  display: inline-flex;
  align-items: center;
  flex: none;
  margin-left: 2px;
  pointer-events: none;
}
`

const INDICATOR_CSS_ID = 'cst-project-running-indicator'
/** Group header rows are the only treeitems with aria-expanded (Rows.tsx:143). */
const HEADER_SELECTOR = '[role="treeitem"][aria-expanded]'

function installIndicatorStyles(): () => void {
  let style = document.querySelector<HTMLStyleElement>(`style[data-tweak-css="${INDICATOR_CSS_ID}"]`)
  if (style === null) {
    style = document.createElement('style')
    style.dataset.tweak = 'cst'
    style.dataset.tweakCss = INDICATOR_CSS_ID
    style.textContent = INDICATOR_CSS
    document.head.appendChild(style)
  }
  return () => { style?.remove() }
}

/**
 * Derive which group labels must show a dot. Mirrors `deriveGroups`
 * membership rules: archived and blank sessions never render as rows, and
 * subagent rows belong to their top-level ancestor's group.
 */
function computeGroupBusy(
  sessions: SnapshotStoreLike<SessionListStateLike>,
  workspaces: SnapshotStoreLike<WorkspaceSnapshotLike>,
): GroupBusy {
  const list = sessions.getSnapshot()
  const snapshot = workspaces.getSnapshot()
  const archived = new Set(snapshot.archivedSessionIds)

  // Running subagents light up their top-level ancestor (Rows.tsx
  // sessionStatuses shows 'ongoing' for runningSubagentCount > 0).
  const busyAncestors = new Set<string>()
  for (const summary of Object.values(list.byId)) {
    if (summary === undefined) continue
    if (!summary.running || summary.origin !== 'subagent') continue
    const seen = new Set<string>()
    let current: SessionSummaryLike | undefined = summary
    while (current?.origin === 'subagent' && current.parentId !== undefined && !seen.has(current.id)) {
      seen.add(current.id)
      current = list.byId[current.parentId]
    }
    if (current !== undefined && current.origin !== 'subagent') busyAncestors.add(current.id)
  }
  const isBusy = (id: string): boolean => {
    const summary = list.byId[id]
    if (summary === undefined) return false
    return summary.running || busyAncestors.has(id)
  }

  const busyTitles = new Set<string>()
  const knownTitles = new Set<string>()
  const grouped = new Set<string>()
  for (const workspace of snapshot.items) {
    knownTitles.add(workspace.title)
    for (const id of workspace.sessionIds) {
      grouped.add(id)
      if (archived.has(id)) continue
      const summary = list.byId[id]
      // Blank sessions are hidden from the browser (tree.ts deriveGroups).
      if (summary === undefined || summary.blank) continue
      if (isBusy(id)) busyTitles.add(workspace.title)
    }
  }

  // Ungrouped bucket: host-list rows in no workspace (ids excludes the
  // breadcrumb-only subagent routes that byId additionally carries).
  let ungroupedBusy = false
  for (const id of list.ids) {
    if (grouped.has(id) || archived.has(id)) continue
    const summary = list.byId[id]
    if (summary === undefined || summary.blank || summary.origin === 'subagent') continue
    if (isBusy(id)) { ungroupedBusy = true; break }
  }

  return { busyTitles, knownTitles, ungroupedBusy }
}

/** Title text of a header row: the only span-in-span with visible text. */
function rowLabel(row: Element): string | undefined {
  for (const span of row.querySelectorAll<HTMLSpanElement>(':scope > span > span')) {
    const label = span.textContent?.trim()
    if (label !== undefined && label.length > 0) return label
  }
  return undefined
}

interface Indicator {
  host: HTMLSpanElement
  root: Root
  shown: boolean
}

/**
 * Mount/unmount the live tweak. Returns the disposer; safe to call when the
 * app stores are absent (unknown host build) — the tweak then stays inert.
 */
export function setupProjectRunningIndicator(ctx: ClientContext): () => void {
  const removeStyles = installIndicatorStyles()

  let sessionList: SnapshotStoreLike<SessionListStateLike>
  let workspaceList: SnapshotStoreLike<WorkspaceSnapshotLike>
  try {
    // The services expose their state as snapshot stores: `sessions.list`
    // (SessionListState) and `workspaces.list` (WorkspaceSnapshot).
    sessionList = (ctx.get('sessions') as { list: unknown }).list as SnapshotStoreLike<SessionListStateLike>
    workspaceList = (ctx.get('workspaces') as { list: unknown }).list as SnapshotStoreLike<WorkspaceSnapshotLike>
    if (typeof sessionList?.subscribe !== 'function' || typeof workspaceList?.subscribe !== 'function') {
      throw new Error('unexpected store shape')
    }
  } catch {
    // Unknown host build without the expected services: keep the CSS inert.
    return () => { removeStyles() }
  }

  const indicators = new Map<Element, Indicator>()

  const removeIndicator = (row: Element): void => {
    const indicator = indicators.get(row)
    if (indicator === undefined) return
    indicators.delete(row)
    indicator.root.unmount()
    indicator.host.remove()
    // After this point the entry is gone from `indicators` and the host is
    // detached, so the React root and DOM node are both GC-eligible. Do not
    // call `indicator.root.render(...)` past here — it's a defunct handle.
  }

  const syncRow = (row: Element, busy: GroupBusy): void => {
    const label = rowLabel(row)
    if (label === undefined) return
    // The Ungrouped bucket is the header whose label matches no workspace
    // title — its label is DSH locale copy, so it is matched negatively.
    const active = busy.busyTitles.has(label)
      || (busy.ungroupedBusy && !busy.knownTitles.has(label))
    let indicator = indicators.get(row)
    if (!active) {
      // Group went idle (or the row lost its label): unmount the dot.
      if (indicator !== undefined) removeIndicator(row)
      return
    }
    if (indicator === undefined) {
      const host = document.createElement('span')
      host.dataset.cstProjIndicator = ''
      row.insertBefore(host, row.lastElementChild)
      indicator = { host, root: createRoot(host), shown: false }
      indicators.set(row, indicator)
    } else if (!indicator.host.isConnected) {
      // Don't re-render on reattach — `shown` stays true and the root keeps
      // its existing vDOM, so the StateDot's animation continues uninterrupted
      // when the row leaves and re-enters the DOM.
      row.insertBefore(indicator.host, row.lastElementChild)
    }
    if (!indicator.shown) {
      indicator.shown = true
      indicator.root.render(createElement(StateDot, { state: 'ongoing' }))
    }
  }

  const sync = (): void => {
    // Rows removed from the document: their entries must go (Map, not
    // WeakMap, because we need isConnected checks + explicit removal).
    for (const row of [...indicators.keys()]) {
      if (!row.isConnected) removeIndicator(row)
    }
    const busy = computeGroupBusy(sessionList, workspaceList)
    for (const row of document.querySelectorAll(HEADER_SELECTOR)) {
      syncRow(row, busy)
    }
  }

  // Coalesce a burst of DOM mutations into one scan per microtask: the
  // observer spans `document.body` and every streaming chunk lights it up
  // for a few ticks, but they all settle before the microtask queue drains.
  let syncScheduled = false
  const scheduleSync = (): void => {
    if (syncScheduled) return
    syncScheduled = true
    queueMicrotask(() => {
      syncScheduled = false
      sync()
    })
  }

  const observer = new MutationObserver(() => { scheduleSync() })
  observer.observe(document.body, { childList: true, subtree: true })

  const unsubscribeSessions = sessionList.subscribe(() => { scheduleSync() })
  const unsubscribeWorkspaces = workspaceList.subscribe(() => { scheduleSync() })
  sync()

  return () => {
    unsubscribeSessions()
    unsubscribeWorkspaces()
    observer.disconnect()
    for (const row of [...indicators.keys()]) removeIndicator(row)
    removeStyles()
  }
}
