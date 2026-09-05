/**
 * dsh-conversation-style-tweaks — client-side constants & resolvers.
 *
 * Mirror of the runtime values in `src/config.ts`. Duplicated because the
 * client tsconfig has `rootDir: src/client` (and explicitly excludes parent
 * dirs), so a runtime `import` from `../config` is a compile-time error.
 * Keep these in lock-step with `src/config.ts` — the server's schemastery
 * `Config` object is the source of truth for defaults / clamps.
 *
 * Types are still pulled from `src/config.ts` via `import type`, which the
 * rootDir restriction allows (no runtime reference is emitted).
 */

import type { ResolvedConversationStyleTweaksConfig } from './tweak-types.ts'

// ── Column-width constants (mirror src/config.ts) ───────────────────────
/** Dialog width min px. */
export const MIN_DIALOG_WIDTH = 600
/** Dialog width max px. */
export const MAX_DIALOG_WIDTH = 1600
/** Stock DSH column width. */
export const DEFAULT_DIALOG_WIDTH = 748
/** Plugin width control default (must match server; see config.ts). */
export const DEFAULT_USE_PLUGIN_WIDTH = true
/** Default side margin in px. */
export const DEFAULT_SIDE_MARGIN = 50
/** Minimum side margin in px. */
export const MIN_SIDE_MARGIN = 32
/** localStorage slot the native handle reads. */
export const CONVERSATION_WIDTH_STORAGE_KEY = 'dsh.conversation.contentWidth'

// ── CSS tweak constants (mirror src/config.ts) ──────────────────────────
/** Default state of the stable-table tweak. */
export const DEFAULT_STABLE_TABLE = true
/** Default state of the stable-turn-rail tweak. */
export const DEFAULT_STABLE_TURN_RAIL = true
/** Default state of the code-block-flush-top tweak. */
export const DEFAULT_CODE_BLOCK_FLUSH_TOP = true

/**
 * Normalize a dialog width value (legacy strings included) to px.
 * Must match `resolveDialogWidth` in src/config.ts.
 */
export function resolveDialogWidth(value: number | undefined): number {
  if (typeof value === 'number') {
    return Math.min(MAX_DIALOG_WIDTH, Math.max(MIN_DIALOG_WIDTH, Math.round(value)))
  }
  return DEFAULT_DIALOG_WIDTH
}

/**
 * Normalize a side-margin value (legacy strings included) to px.
 * Must match `resolveSideMargin` in src/config.ts.
 */
export function resolveSideMargin(value: number | undefined): number {
  if (typeof value === 'number') return Math.max(MIN_SIDE_MARGIN, Math.round(value))
  return DEFAULT_SIDE_MARGIN
}

/**
 * Build a fully-defaulted ResolvedConversationStyleTweaksConfig from any
 * partial input. Mirror of `resolveConfig` in src/config.ts.
 */
export function resolveClientConfig(
  value: Partial<ResolvedConversationStyleTweaksConfig> | undefined,
): ResolvedConversationStyleTweaksConfig {
  return {
    dialogWidth: resolveDialogWidth(value?.dialogWidth),
    usePluginWidth: value?.usePluginWidth ?? DEFAULT_USE_PLUGIN_WIDTH,
    sideMargin: resolveSideMargin(value?.sideMargin),
    stableTable: value?.stableTable ?? DEFAULT_STABLE_TABLE,
    stableTurnRail: value?.stableTurnRail ?? DEFAULT_STABLE_TURN_RAIL,
    codeBlockFlushTop: value?.codeBlockFlushTop ?? DEFAULT_CODE_BLOCK_FLUSH_TOP,
  }
}