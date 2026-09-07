/**
 * dsh-style-tweaks — configuration.
 *
 * Owns the `style-tweaks` settings namespace. Two feature
 * areas:
 *   1. Column-width control (ported from dsh-dialog-width): a px input
 *      (600–1600) with presets, a plugin-vs-native toggle, and side margin.
 *   2. Opt-in CSS tweaks (stable-table layout on hover, with more added
 *      over time). Each tweak is a boolean field.
 * @module dsh-style-tweaks/config
 */

import z from '@deepseek-ai/schemastery'
import type Schema from '@deepseek-ai/schemastery'

/** Settings document namespace owned by this plugin. */
export const STYLE_TWEAKS_SETTINGS_NAMESPACE = 'style-tweaks'

/** Raw user-facing configuration (partial inputs receive schema defaults). */
export interface StyleTweaksConfig {
  // ── Column-width control (ported from dsh-dialog-width) ──────────────
  /**
   * Conversation column width in px. The plugin's own width input / preset
   * row reads & writes this field when "plugin width control" is on (see
   * `usePluginWidth`); when off, the field still mirrors the user's chosen
   * px value to the shared storage slot so flipping the switch never loses
   * it. Clamped to [600, 1600] on read.
   */
  dialogWidth?: number
  /**
   * Whether the plugin's own column-width input owns the conversation width
   * axis. On (default): the plugin writes `--dsh-chat-user-width` directly
   * and hides the native 40 px hover handles. Off: the native drag handles
   * own the axis (clamp(680, col×0.64, 920)) and the plugin's width input
   * mirrors its value to the shared localStorage so flipping the switch back
   * on restores the same px.
   */
  usePluginWidth?: boolean
  /**
   * Whitespace in px kept on each side of the conversation area. The width
   * axis is clamped to min(dialogWidth, liveColumn − 2 × sideMargin), so the
   * content narrows — together with the composer card — when the sidebar
   * opens or the window shrinks, never hugging the edges. Minimum 32 px.
   */
  sideMargin?: number

  // ── CSS tweaks ───────────────────────────────────────────────────────
  /**
   * Lock markdown table layout on hover so the table does not reflow and push
   * surrounding content around. Fixes the "text jumps when I hover a table"
   * layout-shift bug reported against the stock conversation view.
   */
  stableTable?: boolean
  /**
   * Keep the turn-navigation rail at a stable position when scrolling up
   * past the first message into the system-prompt area. Without this fix
   * the rail drops by 16px (the chat scroll container's `padding-top`)
   * because the rail slot is `position: sticky; top: 0` inside that
   * padded container.
   */
  stableTurnRail?: boolean
  /**
   * Remove the 16 px gap above highlighted code blocks so the highlighted
   * box sits flush with the preceding paragraph, list item, or heading.
   * The wrapper (`.md-code-block` in `CodeBlock.module.css`) ships with
   * `margin: 16px 0`; this tweak overrides only the top edge.
   */
  codeBlockFlushTop?: boolean
  /**
   * Show the conversation title's animated running dot on the right side of
   * every project directory header row in the sidebar, so a running
   * conversation stays visible even when its group is collapsed. The dot is
   * DSH's own `StateDot` (shared instance) driven by the app's
   * sessions/workspaces stores — pendingInteraction (amber) needs the
   * ui-session service face and is out of scope; only ongoing shows.
   */
  projectRunningIndicator?: boolean
  /**
   * Add a "locate" button next to the sidebar search box; clicking it
   * expands the current session's workspace and scrolls the session into
   * view. Client-side toggle only: the browser bundle reads this field and
   * mounts / unmounts the button live.
   */
  locateCurrentSession?: boolean
  /**
   * Let the settings dialog's left nav column scroll once its section list
   * outgrows the fixed-height panel, instead of the panel's
   * `overflow: hidden` clipping the bottom entries (unreachable when enough
   * plugins register settings sections).
   */
  settingsNavScroll?: boolean
}

// ── Column-width constants ───────────────────────────────────────────────
/** Dialog width in px. 600 is the chat-column minimum, 1600 the soft cap. */
export const MIN_DIALOG_WIDTH = 600
export const MAX_DIALOG_WIDTH = 1600
/** 748 matches the stock DSH column. */
export const DEFAULT_DIALOG_WIDTH = 748
/**
 * Plugin width control defaults to ON: existing settings documents never had
 * this field, so the default must match what users saw before the native
 * handles shipped — the plugin owning the column.
 */
export const DEFAULT_USE_PLUGIN_WIDTH = true
/** Default side margin in px — 50 gives a comfortable gap on each side. */
export const DEFAULT_SIDE_MARGIN = 50
/** Minimum side margin in px — below 32 the gap becomes too tight. */
export const MIN_SIDE_MARGIN = 32
/**
 * localStorage slot the native WidthHandle reads/writes; kept here so a
 * future rename of the host key only needs touching one place. We mirror
 * the plugin's chosen px value here too so toggling plugin-width off
 * surfaces the user's last choice in the native handle.
 */
export const CONVERSATION_WIDTH_STORAGE_KEY = 'dsh.conversation.contentWidth'

// ── CSS tweak constants ─────────────────────────────────────────────────
/** Default: every shipped tweak is on. */
export const DEFAULT_STABLE_TABLE = true
/** Default: every shipped tweak is on. */
export const DEFAULT_STABLE_TURN_RAIL = true
/** Default: every shipped tweak is on. */
export const DEFAULT_CODE_BLOCK_FLUSH_TOP = true
/** Default: every shipped tweak is on. */
export const DEFAULT_PROJECT_RUNNING_INDICATOR = true
/** Default: every shipped tweak is on. */
export const DEFAULT_LOCATE_CURRENT_SESSION = true
/** Default: every shipped tweak is on. */
export const DEFAULT_SETTINGS_NAV_SCROLL = true

/** Configuration schema with documented defaults. */
export const Config: Schema<StyleTweaksConfig> = z.object({
  dialogWidth: z.number().min(MIN_DIALOG_WIDTH).max(MAX_DIALOG_WIDTH).default(DEFAULT_DIALOG_WIDTH),
  usePluginWidth: z.boolean().default(DEFAULT_USE_PLUGIN_WIDTH),
  sideMargin: z.number().min(MIN_SIDE_MARGIN).default(DEFAULT_SIDE_MARGIN),
  stableTable: z.boolean().default(DEFAULT_STABLE_TABLE),
  stableTurnRail: z.boolean().default(DEFAULT_STABLE_TURN_RAIL),
  codeBlockFlushTop: z.boolean().default(DEFAULT_CODE_BLOCK_FLUSH_TOP),
  projectRunningIndicator: z.boolean().default(DEFAULT_PROJECT_RUNNING_INDICATOR),
  locateCurrentSession: z.boolean().default(DEFAULT_LOCATE_CURRENT_SESSION),
  settingsNavScroll: z.boolean().default(DEFAULT_SETTINGS_NAV_SCROLL),
})

/** Configuration after static validation, with every default materialized. */
export interface ResolvedStyleTweaksConfig {
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

/** Resolve a partial config into a fully defaulted value. */
export function resolveConfig(config: StyleTweaksConfig = {}): ResolvedStyleTweaksConfig {
  return {
    dialogWidth: resolveDialogWidth(config.dialogWidth),
    usePluginWidth: config.usePluginWidth ?? DEFAULT_USE_PLUGIN_WIDTH,
    sideMargin: config.sideMargin ?? DEFAULT_SIDE_MARGIN,
    stableTable: config.stableTable ?? DEFAULT_STABLE_TABLE,
    stableTurnRail: config.stableTurnRail ?? DEFAULT_STABLE_TURN_RAIL,
    codeBlockFlushTop: config.codeBlockFlushTop ?? DEFAULT_CODE_BLOCK_FLUSH_TOP,
    projectRunningIndicator: config.projectRunningIndicator ?? DEFAULT_PROJECT_RUNNING_INDICATOR,
    locateCurrentSession: config.locateCurrentSession ?? DEFAULT_LOCATE_CURRENT_SESSION,
    settingsNavScroll: config.settingsNavScroll ?? DEFAULT_SETTINGS_NAV_SCROLL,
  }
}

/** Normalize a dialog width value (legacy strings included) to px. */
export function resolveDialogWidth(value: number | undefined): number {
  if (typeof value === 'number') {
    return Math.min(MAX_DIALOG_WIDTH, Math.max(MIN_DIALOG_WIDTH, Math.round(value)))
  }
  return DEFAULT_DIALOG_WIDTH
}

/** Normalize a side-margin value (legacy strings included) to px. */
export function resolveSideMargin(value: number | undefined): number {
  if (typeof value === 'number') return Math.max(MIN_SIDE_MARGIN, Math.round(value))
  return DEFAULT_SIDE_MARGIN
}
