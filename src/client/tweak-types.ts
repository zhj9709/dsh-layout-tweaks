/**
 * dsh-conversation-style-tweaks — client-side type mirror.
 *
 * Mirror of the type definitions in `src/config.ts`. Duplicated because the
 * client tsconfig has `rootDir: src/client`, so even `import type` from a
 * parent directory is rejected by TS6059 ("file is not under rootDir").
 * Keep these in lock-step with `src/config.ts`.
 *
 * The runtime values (constants, resolvers) live in `tweak-config.ts`.
 */

/** Configuration after static validation, with every default materialized. */
export interface ResolvedConversationStyleTweaksConfig {
  /** Dialog width in px (748 = the stock DSH column). */
  dialogWidth: number
  /** Whether the plugin's width control owns the column (vs. native handles). */
  usePluginWidth: boolean
  /** Side margin in px applied to both sides of the conversation column. */
  sideMargin: number
  /** Whether the stable-table tweak is enabled. */
  stableTable: boolean
  /** Whether the stable-turn-rail tweak is enabled. */
  stableTurnRail: boolean
  /** Whether the code-block-flush-top tweak is enabled. */
  codeBlockFlushTop: boolean
  /** Whether the project-running-indicator tweak is enabled. */
  projectRunningIndicator: boolean
  /** Whether the locate-current-session tweak is enabled. */
  locateCurrentSession: boolean
  /** Whether the settings-nav-scroll tweak is enabled. */
  settingsNavScroll: boolean
}