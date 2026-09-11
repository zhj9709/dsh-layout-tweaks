/**
 * dsh-style-tweaks — browser half.
 *
 * Owns the runtime CSS that drives two feature areas under one Settings
 * panel:
 *   1. Column-width control (ported from dsh-dialog-width): px stepper,
 *      presets, plugin-vs-native toggle, side margin.
 *   2. Opt-in CSS tweaks: stable-table layout on hover, with more added
 *      over time. Each tweak is a boolean field.
 *
 * Reads and writes the `style-tweaks` settings namespace via
 * the same-origin route served by the server half.
 */

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only imports activate the client-service Context declarations.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { installConversationWidthStyles } from './conversation-width.ts'
import { setupSettingsNavIcon } from './settings-nav-icon.ts'
import {
  DEFAULT_RIGHTBAR_INITIAL_WIDTH,
  DEFAULT_THINK_FIXED_HEIGHT,
  DEFAULT_USE_PLUGIN_WIDTH,
  MAX_DIALOG_WIDTH,
  MAX_RIGHTBAR_WIDTH_PERCENT,
  MAX_THINK_HEIGHT,
  MIN_DIALOG_WIDTH,
  MIN_RIGHTBAR_WIDTH_PERCENT,
  MIN_SIDE_MARGIN,
  MIN_THINK_HEIGHT,
  resolveDialogWidth,
  resolveRightbarPercent,
  resolveSideMargin,
  resolveThinkHeight,
} from './tweak-config.ts'
import { TWEAKS, type TweakDescriptor } from './tweaks/registry.ts'
import { injectStableTableStyles } from './tweaks/stable-table.ts'
import { injectStableTurnRailStyles } from './tweaks/stable-turn-rail.ts'
import { injectCodeBlockFlushTopStyles } from './tweaks/code-block-flush-top.ts'
import { setupProjectRunningIndicator } from './tweaks/project-running-indicator.ts'
import { setupLocateCurrentSession } from './tweaks/locate-current-session.ts'
import { setupSettingsNavScroll } from './tweaks/settings-nav-scroll.ts'
import { setupSidebarMiddleClickClose } from './tweaks/sidebar-middle-click-close.ts'
import { installThinkingScrollStyles } from './tweaks/thinking-scroll.ts'
import { installRightbarInitialWidth } from './tweaks/rightbar-initial-width.ts'
import { setupLegacyStatsLine } from './tweaks/legacy-stats-line.tsx'
import { setupPillsCacheHitDecimals } from './tweaks/pills-cache-hit-decimals.tsx'
import { setupTurnSpeedMetrics } from './tweaks/turn-speed-metrics.tsx'

const NS = 'style-tweaks'
const SETTINGS_ROUTE = '/_dsh/style-tweaks/settings'

/**
 * Maps a tweak id to its mount function. Add new tweaks here. Pure-CSS
 * injectors ignore the context and the resolved values; JS-level tweaks
 * (DOM patching driven by app stores) receive the context to read services
 * like `sessions` / `workspaces`, and tweaks whose render depends on other
 * settings read the resolved snapshot (captured at mount — any settings
 * change remounts every tweak, so the capture never goes stale).
 */
const TWEAK_INJECTORS: Record<string, (ctx: ClientContext, resolved: ResolvedTweaks) => () => void> = {
  'stable-table': () => injectStableTableStyles(),
  'stable-turn-rail': () => injectStableTurnRailStyles(),
  'code-block-flush-top': () => injectCodeBlockFlushTopStyles(),
  'project-running-indicator': setupProjectRunningIndicator,
  'locate-current-session': setupLocateCurrentSession,
  'settings-nav-scroll': setupSettingsNavScroll,
  'sidebar-middle-click-close': setupSidebarMiddleClickClose,
  'legacy-stats-line': (ctx, resolved) => setupLegacyStatsLine(ctx, resolved.pillsCacheHitDecimals),
  'pills-cache-hit-decimals': setupPillsCacheHitDecimals,
  'turn-speed-metrics': setupTurnSpeedMetrics,
}

interface TweaksValue {
  // Column-width control (ported from dsh-dialog-width).
  /** Dialog width in px; clamped to [600, 1600]. */
  dialogWidth?: number
  /** Whether the plugin's width control owns the column (vs. native handles). */
  usePluginWidth?: boolean
  /** Side margin in px; minimum 32. */
  sideMargin?: number
  /** Whether the think (reasoning) body is capped at a fixed height. */
  thinkFixedHeight?: boolean
  /** Think body display height in px; clamped to [120, 1200]. */
  thinkHeight?: number
  // CSS tweaks.
  /** Whether the stable-table tweak is enabled. */
  stableTable?: boolean
  /** Whether the stable-turn-rail tweak is enabled. */
  stableTurnRail?: boolean
  /** Whether the code-block-flush-top tweak is enabled. */
  codeBlockFlushTop?: boolean
  /** Whether the project-running-indicator tweak is enabled. */
  projectRunningIndicator?: boolean
  /** Whether the locate-current-session tweak is enabled. */
  locateCurrentSession?: boolean
  /** Whether the settings-nav-scroll tweak is enabled. */
  settingsNavScroll?: boolean
  /** Whether the sidebar middle-click close tweak is enabled. */
  sidebarMiddleClickClose?: boolean
  /** Whether the legacy-stats-line tweak is enabled. */
  legacyStatsLine?: boolean
  /** Whether the pills-cache-hit-decimals tweak is enabled. */
  pillsCacheHitDecimals?: boolean
  /** Whether the turn-speed-metrics tweak is enabled. */
  turnSpeedMetrics?: boolean
  /** Whether the plugin owns the right Sidebar's first-open width. */
  rightbarInitialWidth?: boolean
  /** Right Sidebar first-open width as a percentage of the frame; clamped to [15, 70]. */
  rightbarWidthPercent?: number
}

interface ResolvedTweaks {
  dialogWidth: number
  usePluginWidth: boolean
  sideMargin: number
  thinkFixedHeight: boolean
  thinkHeight: number
  stableTable: boolean
  stableTurnRail: boolean
  codeBlockFlushTop: boolean
  projectRunningIndicator: boolean
  locateCurrentSession: boolean
  settingsNavScroll: boolean
  sidebarMiddleClickClose: boolean
  legacyStatsLine: boolean
  pillsCacheHitDecimals: boolean
  turnSpeedMetrics: boolean
  rightbarInitialWidth: boolean
  rightbarWidthPercent: number
}

interface Snapshot {
  writable: boolean
  value: TweaksValue
  revision: number
}

interface ApiSuccess<T> { ok: true; value: T }
interface ApiFailure { ok: false; error: { code: string; message: string } }

const en = {
  nav: 'Style tweaks',
  settingsTitle: 'Style tweaks',
  settingsIntro: 'Opt-in style tweaks for DSH: precise conversation column-width control (with presets and side margin), a fixed-height scrolling window for the think (reasoning) body, and a set of small fixes for the sidebar and the settings panel. Each toggle applies immediately and persists to your settings document.',
  sectionLayout: 'Layout',
  sectionTweaks: 'Tweaks',
  dialogWidth: 'Dialog width',
  dialogWidthHint: 'Number between 600 and 1600 px; 748 is DSH\'s default column width, larger values widen it.',
  presetDefault: 'Default',
  presetWide: 'Wide',
  presetWideXl: 'Extra wide',
  usePluginWidth: 'Plugin width control',
  usePluginWidthHint: 'When ON, the width input / presets below drive the column and DSH\'s native drag handles are hidden. When OFF (default), DSH\'s native handles own the column and the width & side-margin settings are hidden; the last values are kept for when you switch back on.',
  usePluginWidthOn: 'On',
  usePluginWidthOff: 'Off',
  sideMargin: 'Side margin',
  sideMarginHint: 'Whitespace in px kept on each side of the conversation area while plugin width control is on. The column is clamped to the dialog width and narrows when the sidebar opens or the window shrinks, never hugging the edges. Minimum 32 px.',
  thinkFixedHeight: 'Fixed think height',
  thinkFixedHeightHint: 'Cap the expanded think (reasoning) body at a fixed height and scroll the overflow, so a long thinking trace stops pushing the rest of the conversation out of view. Folding the row back to one line keeps working as usual. While a trace is still streaming, the window shows its top and you scroll for the tail.',
  thinkHeight: 'Think height',
  thinkHeightHint: 'Height of the fixed think body in px, between 120 and 1200.',
  rightbarInitialWidth: 'Right sidebar initial width',
  rightbarInitialWidthHint: 'Own the right sidebar\'s first-open width. OFF by default, which leaves DSH\'s own 45% in charge. When ON, the plugin writes the width once — the first time the sidebar opens in this page load — as a percentage of the session frame; a manual drag, and every later open, keeps your own width. Reload the page to apply the percentage again.',
  rightbarWidthPercent: 'Right sidebar width',
  rightbarWidthPercentHint: 'First-open width of the right sidebar as a percentage of the session frame, between 15 and 70. DSH clamps the result into its own range (at least 300 px, at most 70% of the frame), so a conversion below 300 px renders 300 px wide.',
  defaultAction: 'Default',
  applied: 'Applied',
  unavailable: 'Settings unavailable.',
  loading: 'Loading…',
  readOnly: 'The active Settings provider is read-only.',
  tweakOn: 'On',
  tweakOff: 'Off',
  'tweak.stableTable.title': 'Stable table layout',
  'tweak.stableTable.description': 'Lock table layout on hover so surrounding content does not reflow ("text jumps when I hover a table").',
  'tweak.stableTurnRail.title': 'Stable turn-navigation rail',
  'tweak.stableTurnRail.description': 'Keep the turn-navigation rail at a stable position when scrolling up past the first message into the system prompt ("the rail jumps down by ~16 px when I scroll up after clicking the first turn").',
  'tweak.codeBlockFlushTop.title': 'Flush code-block top',
  'tweak.codeBlockFlushTop.description': 'Remove the 16 px gap above highlighted code blocks so the code sits flush with the preceding paragraph, list item, or heading.',
  'tweak.projectRunningIndicator.title': 'Project running indicator',
  'tweak.projectRunningIndicator.description': 'Show the conversation title\'s animated running dot on the right side of each project directory in the sidebar, so a running conversation stays visible even when the directory is collapsed.',
  'tweak.locateCurrentSession.title': 'Locate current session',
  'tweak.locateCurrentSession.description': 'Add a "locate" button next to the sidebar search box. Click it to expand the current session\'s workspace and scroll the session into view.',
  'tweak.settingsNavScroll.title': 'Scrollable settings nav',
  'tweak.settingsNavScroll.description': 'Let the settings dialog\'s left menu scroll when its entries outgrow the panel, instead of silently clipping the ones at the bottom.',
  'tweak.sidebarMiddleClickClose.title': 'Middle-click closes sidebar tabs',
  'tweak.sidebarMiddleClickClose.description': 'Since 0.1.5 the right sidebar is a tabbed panel. Close any of its tabs — docked or floating — with a middle mouse click on the tab, the way browser tabs behave. A held middle button can no longer drag or float a tab, and middle-click autoscroll is suppressed over the strips.',
  'tweak.legacyStatsLine.title': 'Legacy stats line',
  'tweak.legacyStatsLine.description': 'Show the composer stats the way DSH did before 0.1.5: one centered text line under the input box (turns/steps, LLM & tool time, TTFT, speed, tokens, cache hit) instead of the new icon pills. Full line on hover.',
  'tweak.pillsCacheHitDecimals.title': 'Cache hit with two decimals',
  'tweak.pillsCacheHitDecimals.description': 'Show the composer stats\' cache-hit share with two decimal places (87.35%) instead of integer rounding — applies to the new icon pills and the legacy text line alike, whichever is showing.',
  'tweak.turnSpeedMetrics.title': 'Turn speed & TTFT',
  'tweak.turnSpeedMetrics.description': 'Since 0.1.5, cold sessions no longer rebuild per-token timing, so the turn-time dialog keeps only the wall-clock duration. Refills that dialog with the output speed and TTFT rows (rebuilt from the model stream embedded in the session log) when you click the time pill.',
  'legacyStats.counts': '{turns} turns · {steps} steps',
  'legacyStats.llm': 'LLM {duration}',
  'legacyStats.toolCall': 'Tool call {duration}',
  'legacyStats.ttftAverage': 'TTFT avg {duration}',
  'legacyStats.tokensPerSecond': '{throughput} tok/s',
  'legacyStats.cacheHit': 'Cache hit {percent}%',
  'legacyStats.tokens': 'Input {input} tok · Output {output} tok',
  'legacyStats.number.thousand': '{value}K',
  'legacyStats.number.million': '{value}M',
  'legacyStats.duration.seconds': '{seconds}s',
  'legacyStats.duration.minutes': '{minutes}m{seconds}s',
  'pills.counts': '{turns} turns {steps} steps',
  'pills.tokensPerSecond': '{tps} tok/s',
  'pills.cacheHit': 'Cache hit {percent}%',
  'pills.dialog.title': 'Session statistics',
  'pills.dialog.usageTitle': 'Token usage',
  'pills.dialog.llmTime': 'LLM time',
  'pills.dialog.toolTime': 'Tool time',
  'pills.dialog.ttft': 'Avg time to first token (TTFT)',
  'pills.dialog.speed': 'Tokens per second (TPS)',
  'pills.turnUsage.count': '{count} tok',
  'pills.turnUsage.cacheHit': 'Cache hit',
  'pills.turnUsage.input': 'Uncached input',
  'pills.turnUsage.cacheRead': 'Cached input',
  'pills.turnUsage.cacheWrite': 'Cache write',
  'pills.turnUsage.output': 'Output',
  'pills.number.thousand': '{value}K',
  'pills.number.million': '{value}M',
  'pills.number.groupSeparator': ',',
  'pills.duration.seconds': '{seconds}s',
  'pills.duration.minutes': '{minutes}m{seconds}s',
} as const

type LocaleKey = keyof typeof en

const zh: Record<LocaleKey, string> = {
  nav: '样式调整',
  settingsTitle: '样式调整',
  settingsIntro: 'DSH 界面的可选样式调整：对话列宽精确控制（含预设与两侧边距）、思考内容固定高度滚动，以及侧边栏与设置面板的一组小幅修复。每个开关立即生效并持久化到设置文档。',
  sectionLayout: '布局',
  sectionTweaks: '调整项',
  dialogWidth: '对话框宽度',
  dialogWidthHint: '取值 600–1600 px；748 为 DSH 默认列宽，数字越大越宽。',
  presetDefault: '默认',
  presetWide: '稍宽',
  presetWideXl: '更宽',
  usePluginWidth: '插件宽度控制',
  usePluginWidthHint: '开启时，下方宽度输入 / 预设驱动列宽，并隐藏 DSH 原生的拖拽手柄；关闭时（默认），DSH 原生手柄接管列宽，宽度与两侧边距设置一并隐藏，已设置的值会保留，重新开启即恢复。',
  usePluginWidthOn: '开启',
  usePluginWidthOff: '关闭',
  sideMargin: '两侧边距',
  sideMarginHint: '插件宽度控制开启时，对话区域两侧保留的空白（px）。列宽被钳制为对话框宽度，侧边栏打开或窗口缩小时内容会收窄，不会贴住边缘。最低 32 px；关闭插件宽度控制后边距不生效，保持 DSH 原生行为。',
  thinkFixedHeight: '思考内容固定高度',
  thinkFixedHeightHint: '展开"深度思考"正文时限制为固定高度，超出部分滚动查看，很长的思考不再把后面的回复顶出视野；收起后照旧恢复为一行摘要。思考仍在生成时窗口显示开头，可滚动查看后续内容。',
  thinkHeight: '思考内容高度',
  thinkHeightHint: '思考内容的显示高度（px，120–1200）。',
  rightbarInitialWidth: '右侧边栏初始宽度',
  rightbarInitialWidthHint: '接管右侧边栏首次打开时的宽度。默认关闭，此时保持 DSH 自身的 45% 不变；开启后仅在本次页面加载后的第一次打开时按会话窗口的百分比写入一次，之后手动拖拽、关闭再打开都保留你自己拖出来的宽度，刷新页面后该百分比会重新生效。',
  rightbarWidthPercent: '右侧边栏宽度',
  rightbarWidthPercentHint: '右侧边栏首次打开时占会话窗口宽度的百分比，取值 15–70。DSH 会把结果钳制到它自己的范围内（最小 300 px、最大窗口的 70%），因此换算结果不足 300 px 时会按 300 px 显示。',
  defaultAction: '默认',
  applied: '已应用',
  unavailable: '设置暂不可用。',
  loading: '加载中…',
  readOnly: '当前设置提供方为只读。',
  tweakOn: '开启',
  tweakOff: '关闭',
  'tweak.stableTable.title': '表格布局稳定',
  'tweak.stableTable.description': '锁住表格 hover 时的布局，避免周围内容发生回流（"鼠标移到表格上时下方文本会跳动"）。',
  'tweak.stableTurnRail.title': '轮次导航栏稳定',
  'tweak.stableTurnRail.description': '向上滚动到第一条消息上方的系统提示词区域时，让右侧轮次导航栏保持在原位（不再下移约 16 像素）。',
  'tweak.codeBlockFlushTop.title': '代码块顶部贴齐',
  'tweak.codeBlockFlushTop.description': '去掉高亮代码块上方的 16 px 空白，让代码块紧贴在前面的段落、列表项或标题下方。',
  'tweak.projectRunningIndicator.title': '项目目录运行指示',
  'tweak.projectRunningIndicator.description': '在侧边栏项目目录右侧显示与对话标题一致的运行动画圆点，目录收起时也能一眼看出里面有对话正在进行。',
  'tweak.locateCurrentSession.title': '定位当前会话',
  'tweak.locateCurrentSession.description': '在侧边栏搜索框旁边添加一个"定位"按钮。点击后展开当前会话所属的工作区目录，并将该会话滚动到侧边栏视口内。',
  'tweak.settingsNavScroll.title': '设置菜单可滚动',
  'tweak.settingsNavScroll.description': '设置项较多时，让设置面板左侧菜单可以上下滚动，而不是把放不下的项直接裁掉。',
  'tweak.sidebarMiddleClickClose.title': '中键关闭侧边栏标签页',
  'tweak.sidebarMiddleClickClose.description': '0.1.5 起新增的右侧边栏是标签页面板。开启后，鼠标中键点击任一标签页即可关闭它（浮动面板的标签页同样适用），与浏览器标签页的习惯一致；中键按住时也不会再意外拖动 / 浮出标签，条上的中键自动滚动一并抑制。',
  'tweak.legacyStatsLine.title': '经典统计行',
  'tweak.legacyStatsLine.description': '以 0.1.5 之前的样式，在输入框下方显示一行居中的文本统计（轮数/步数、模型与工具耗时、首字延迟、输出速度、Token 用量、缓存命中），替代新版图标胶囊；悬停可查看完整内容。',
  'tweak.pillsCacheHitDecimals.title': '缓存命中两位小数',
  'tweak.pillsCacheHitDecimals.description': '缓存命中率按两位小数显示（如 87.35%），不再取整；无论统计信息以新版图标胶囊还是经典文本行展示，均适用。',
  'tweak.turnSpeedMetrics.title': '轮次速度与首 token 用时',
  'tweak.turnSpeedMetrics.description': '0.1.5 起冷会话不再重建逐 token 时序，"本轮用时和速度"弹窗只剩总用时。开启后点击用时胶囊时，弹窗会回填输出速度与首 token 用时两行（由会话日志内嵌的模型流重建，历史会话同样生效）。',
  'legacyStats.counts': '{turns} 轮 · {steps} 步',
  'legacyStats.llm': 'LLM {duration}',
  'legacyStats.toolCall': '工具调用 {duration}',
  'legacyStats.ttftAverage': '首 token 平均 {duration}',
  'legacyStats.tokensPerSecond': '{throughput} tok/s',
  'legacyStats.cacheHit': '缓存命中 {percent}%',
  'legacyStats.tokens': '输入 {input} tok · 输出 {output} tok',
  'legacyStats.number.thousand': '{value}K',
  'legacyStats.number.million': '{value}M',
  'legacyStats.duration.seconds': '{seconds}秒',
  'legacyStats.duration.minutes': '{minutes}分{seconds}秒',
  'pills.counts': '{turns} 轮 {steps} 步',
  'pills.tokensPerSecond': '{tps} tok/s',
  'pills.cacheHit': '缓存命中 {percent}%',
  'pills.dialog.title': '会话统计',
  'pills.dialog.usageTitle': 'Token 用量',
  'pills.dialog.llmTime': '模型用时',
  'pills.dialog.toolTime': '工具调用用时',
  'pills.dialog.ttft': '首 token 平均（TTFT）',
  'pills.dialog.speed': '输出速度（TPS）',
  'pills.turnUsage.count': '{count} tok',
  'pills.turnUsage.cacheHit': '缓存命中',
  'pills.turnUsage.input': '未缓存输入',
  'pills.turnUsage.cacheRead': '缓存读取',
  'pills.turnUsage.cacheWrite': '缓存写入',
  'pills.turnUsage.output': '输出',
  'pills.number.thousand': '{value}K',
  'pills.number.million': '{value}M',
  'pills.number.groupSeparator': ',',
  'pills.duration.seconds': '{seconds}秒',
  'pills.duration.minutes': '{minutes}分{seconds}秒',
}

type Translate = (key: LocaleKey) => string

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** dsh-style-tweaks Settings copy. */
    'style-tweaks': LocaleKey
  }
}

function resolveValue(value: TweaksValue | undefined): ResolvedTweaks {
  return {
    dialogWidth: resolveDialogWidth(value?.dialogWidth),
    usePluginWidth: value?.usePluginWidth ?? DEFAULT_USE_PLUGIN_WIDTH,
    sideMargin: resolveSideMargin(value?.sideMargin),
    thinkFixedHeight: value?.thinkFixedHeight ?? DEFAULT_THINK_FIXED_HEIGHT,
    thinkHeight: resolveThinkHeight(value?.thinkHeight),
    stableTable: value?.stableTable ?? true,
    stableTurnRail: value?.stableTurnRail ?? true,
    codeBlockFlushTop: value?.codeBlockFlushTop ?? true,
    projectRunningIndicator: value?.projectRunningIndicator ?? true,
    locateCurrentSession: value?.locateCurrentSession ?? true,
    settingsNavScroll: value?.settingsNavScroll ?? true,
    sidebarMiddleClickClose: value?.sidebarMiddleClickClose ?? true,
    legacyStatsLine: value?.legacyStatsLine ?? false,
    pillsCacheHitDecimals: value?.pillsCacheHitDecimals ?? false,
    turnSpeedMetrics: value?.turnSpeedMetrics ?? false,
    rightbarInitialWidth: value?.rightbarInitialWidth ?? DEFAULT_RIGHTBAR_INITIAL_WIDTH,
    rightbarWidthPercent: resolveRightbarPercent(value?.rightbarWidthPercent),
  }
}

const BASE_CSS = `
.cst-settings{display:grid;gap:8px;max-width:680px;padding:4px 2px 24px;color:var(--dsw-alias-label-primary)}
.cst-settings-header{display:flex;align-items:flex-start;gap:10px;padding:2px 2px 0}
.cst-logo{flex:none;display:grid;place-items:center;width:30px;height:30px;border-radius:9px;border:1px solid var(--dsw-alias-border-l1);background:linear-gradient(135deg,color-mix(in srgb,var(--dsw-alias-state-business-primary) 16%,transparent),transparent);font-size:15px;line-height:1}
.cst-settings-header h2{font-size:16px;letter-spacing:-.01em;margin:0 0 2px}
.cst-settings-header p{max-width:600px;margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.45}
.cst-panel{display:grid;gap:0;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-layer-1);box-shadow:var(--dsw-shadow-lv1);overflow:hidden}
.cst-panel+.cst-panel{margin-top:10px}
.cst-section-label{font-size:10.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary);padding:9px 16px 4px}
.cst-field{display:grid;gap:6px;padding:7px 16px 10px}
.cst-field+.cst-field{border-top:1px solid var(--dsw-alias-border-l1)}
.cst-field-top{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.cst-field-top>span{font-size:13.5px;font-weight:600}
.cst-label{display:inline-flex;align-items:center;gap:6px}
.cst-hint{flex:none;display:inline-grid;place-items:center;width:15px;height:15px;border-radius:50%;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-tertiary);font-size:9.5px;font-weight:600;font-style:normal;line-height:1;cursor:help;user-select:none;transition:color .15s ease,border-color .15s ease}
.cst-hint:hover,.cst-hint:focus-visible{color:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary)}
.cst-hint-pop{position:fixed;z-index:9999;width:max-content;max-width:300px;padding:8px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:11.5px;line-height:1.5;box-shadow:0 4px 16px rgba(0,0,0,.14);pointer-events:none}
.cst-controls{display:flex;align-items:center;gap:8px}
.cst-stepper{display:inline-flex;align-items:center;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-2);overflow:hidden}
.cst-stepper button{width:28px;height:28px;border:none;background:transparent;color:inherit;font-size:15px;font-weight:500;line-height:1;cursor:pointer;display:grid;place-items:center;transition:background .15s ease}
.cst-stepper button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.cst-stepper button:disabled{opacity:.35;cursor:default}
.cst-stepper input{box-sizing:border-box;width:60px;height:28px;border:none;border-left:1px solid var(--dsw-alias-border-l1);border-right:1px solid var(--dsw-alias-border-l1);background:transparent;color:inherit;font:inherit;font-size:13px;text-align:center;-moz-appearance:textfield}
.cst-stepper input::-webkit-outer-spin-button,.cst-stepper input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.cst-stepper input:focus{outline:none}
.cst-seg{display:inline-flex;padding:3px;gap:3px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-2)}
.cst-seg button{border:none;border-radius:7px;padding:5px 12px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12.5px;cursor:pointer;transition:background .15s ease,color .15s ease}
.cst-seg button:hover:not(:disabled){color:var(--dsw-alias-label-primary)}
.cst-seg button.cst-seg-active{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 12%,transparent);color:var(--dsw-alias-state-business-primary);font-weight:600;box-shadow:none}
.cst-seg button.cst-seg-active:hover:not(:disabled){color:var(--dsw-alias-state-business-primary)}
.cst-seg button:disabled{opacity:.45;cursor:default}
.cst-presets{display:inline-flex;flex-wrap:wrap;margin-top:2px}
.cst-toast-wrap{display:flex;justify-content:flex-end;margin-top:8px;margin-right:18px}
.cst-toast{display:inline-flex;align-items:center;gap:7px;font-size:11.5px;font-weight:500;line-height:1;padding:6px 11px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 12%,transparent);color:var(--dsw-alias-state-success-primary);animation:cst-toast-in .22s cubic-bezier(.2,.7,.3,1)}
.cst-toast.error{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent)}
.cst-toast-dot{flex:none;width:5px;height:5px;border-radius:50%;background:currentColor}
@keyframes cst-toast-in{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}
.cst-loading{padding:16px;border-radius:12px;background:var(--dsw-alias-bg-layer-2);font-size:12px;color:var(--dsw-alias-label-secondary)}
.cst-alert{padding:10px 12px;border-radius:10px;font-size:12px;line-height:1.5}
.cst-alert.warning{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 12%,transparent);color:var(--dsw-alias-state-warn-label)}
.cst-alert.error{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent);color:var(--dsw-alias-state-error-primary)}
`

function installBaseStyles(): () => void {
  const id = 'dsh-style-tweaks-base'
  let style = document.querySelector<HTMLStyleElement>(`style[data-plugin-css="${id}"]`)
  if (style === null) {
    style = document.createElement('style')
    style.dataset.plugin = 'dsh-style-tweaks'
    style.dataset.pluginCss = id
    style.textContent = BASE_CSS
    document.head.appendChild(style)
  }
  return () => { style?.remove() }
}

/**
 * Settings requests retry briefly on 502/503: writing the profile patch
 * hot-reloads the `web` node and restarts this plugin for a moment (it
 * injects `web`), so a toggle click can land inside that window. The retry
 * rides it out instead of surfacing "settings unavailable".
 */
async function apiRequest<T>(init?: RequestInit): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const response = await fetch(SETTINGS_ROUTE, { credentials: 'same-origin', ...init })
      const body = await response.json() as ApiSuccess<T> | ApiFailure
      if (response.ok && body.ok) return body.value
      const failure = body as ApiFailure
      const retryable = response.status === 502 || response.status === 503
      lastError = new Error(failure.error?.message ?? `Style tweaks request failed with HTTP ${response.status}`)
      if (!retryable) throw lastError
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 250))
  }
  throw lastError ?? new Error('Style tweaks request failed')
}

/** Client-side snapshot store fed by the same-origin Settings route. */
interface SettingsState {
  status: 'loading' | 'ready' | 'error'
  writable: boolean
  value: TweaksValue | undefined
  revision: number | undefined
  error?: string
}

/** Small external store shared by the Settings route and the CSS engine. */
export class SettingsClient {
  private state: SettingsState = { status: 'loading', writable: false, value: undefined, revision: undefined }
  private listeners = new Set<() => void>()
  private generation = 0

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  getSnapshot = (): SettingsState => this.state

  private publish(next: SettingsState): void {
    this.state = next
    for (const listener of this.listeners) listener()
  }

  async load(): Promise<void> {
    const generation = ++this.generation
    if (this.state.status === 'loading') this.publish({ ...this.state, status: 'loading' })
    try {
      const snapshot = await apiRequest<Snapshot>()
      if (generation !== this.generation) return
      this.publish({
        status: 'ready',
        writable: snapshot.writable,
        value: snapshot.value,
        revision: snapshot.revision,
      })
    } catch (error) {
      if (generation !== this.generation) return
      this.publish({ ...this.state, status: 'error', error: error instanceof Error ? error.message : String(error) })
    }
  }

  private async post(payload: unknown): Promise<void> {
    const generation = ++this.generation
    const snapshot = await apiRequest<Snapshot>({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (generation !== this.generation) return
    this.publish({
      status: 'ready',
      writable: snapshot.writable,
      value: snapshot.value,
      revision: snapshot.revision,
    })
  }

  async set(field: string, value: unknown): Promise<void> {
    await this.post({ action: 'set', field, value, expectedRevision: this.state.revision ?? 0 })
  }

  async unset(field: string): Promise<void> {
    await this.post({ action: 'unset', field, expectedRevision: this.state.revision ?? 0 })
  }
}

/** Required client services: slots (settings.section), locale, and the app stores the JS-level tweaks read. */
export const inject = ['slots', 'locale', 'sessions', 'workspaces']

/**
 * Hover/focus hint: a small ⓘ next to the field label; the hint text renders
 * in a fixed-position bubble portaled to <body> (so panel `overflow:hidden`
 * can never clip it), measured in a layout effect to prefer the space above
 * the anchor and flip below near the viewport top. No layout shift: hints
 * never occupy flow height.
 */
function Hint({ text }: { text: string }) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 })
  useLayoutEffect(() => {
    if (!open) return
    const anchor = anchorRef.current?.getBoundingClientRect()
    const pop = popRef.current
    if (anchor === undefined || pop === null) return
    let left = Math.min(Math.max(8, anchor.left), window.innerWidth - pop.offsetWidth - 8)
    let top = anchor.top - pop.offsetHeight - 8
    if (top < 8) top = anchor.bottom + 8
    setPos({ top, left })
  }, [open])
  return (
    <>
      <span
        ref={anchorRef}
        className="cst-hint"
        role="note"
        aria-label={text}
        tabIndex={0}
        onMouseEnter={() => { setOpen(true) }}
        onMouseLeave={() => { setOpen(false) }}
        onFocus={() => { setOpen(true) }}
        onBlur={() => { setOpen(false) }}
      >i</span>
      {open && createPortal(
        <div ref={popRef} className="cst-hint-pop" style={{ top: pos.top, left: pos.left }}>{text}</div>,
        document.body,
      )}
    </>
  )
}

type SettingsSectionProps = PropsRuntime<'settings.section'> & PropsLocale<'style-tweaks'> & {
  controller: SettingsClient
  t: Translate
}

function SettingsSection({ controller, t }: SettingsSectionProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  const resolved = resolveValue(state.value)
  const writable = state.writable
  const [status, setStatus] = useState<LocaleKey | undefined>(undefined)

  useEffect(() => { if (state.status === 'loading' && state.value === undefined) void controller.load() }, [controller, state.status, state.value])
  useEffect(() => {
    if (status === undefined) return
    const timer = setTimeout(() => { setStatus(undefined) }, 1800)
    return () => { clearTimeout(timer) }
  }, [status])

  const [widthDraft, setWidthDraft] = useState<string>(String(resolved.dialogWidth))
  const [marginDraft, setMarginDraft] = useState<string>(String(resolved.sideMargin))
  const [thinkHeightDraft, setThinkHeightDraft] = useState<string>(String(resolved.thinkHeight))
  const [rightbarWidthDraft, setRightbarWidthDraft] = useState<string>(String(resolved.rightbarWidthPercent))

  useEffect(() => { setWidthDraft(String(resolved.dialogWidth)) }, [resolved.dialogWidth])
  useEffect(() => { setMarginDraft(String(resolved.sideMargin)) }, [resolved.sideMargin])
  useEffect(() => { setThinkHeightDraft(String(resolved.thinkHeight)) }, [resolved.thinkHeight])
  useEffect(() => { setRightbarWidthDraft(String(resolved.rightbarWidthPercent)) }, [resolved.rightbarWidthPercent])

  const commitDialogWidth = (raw: string): void => {
    setWidthDraft(raw)
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return
    const clamped = Math.min(MAX_DIALOG_WIDTH, Math.max(MIN_DIALOG_WIDTH, Math.round(parsed)))
    setWidthDraft(String(clamped))
    void controller.set('dialogWidth', clamped).then(() => { setStatus('applied') }).catch(() => { setStatus('unavailable') })
  }

  const stepDialogWidth = (delta: number): void => {
    const next = Math.min(MAX_DIALOG_WIDTH, Math.max(MIN_DIALOG_WIDTH, resolved.dialogWidth + delta))
    setWidthDraft(String(next))
    void controller.set('dialogWidth', next).then(() => { setStatus('applied') }).catch(() => { setStatus('unavailable') })
  }

  const applyWidthPreset = (width: number): void => {
    setWidthDraft(String(width))
    void controller.set('dialogWidth', width).then(() => { setStatus('applied') }).catch(() => { setStatus('unavailable') })
  }

  const setUsePluginWidth = (value: boolean): void => {
    void controller.set('usePluginWidth', value).then(() => { setStatus('applied') }).catch(() => { setStatus('unavailable') })
  }

  const commitSideMargin = (raw: string): void => {
    setMarginDraft(raw)
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return
    const clamped = Math.max(MIN_SIDE_MARGIN, Math.round(parsed))
    setMarginDraft(String(clamped))
    void controller.set('sideMargin', clamped).then(() => { setStatus('applied') }).catch(() => { setStatus('unavailable') })
  }

  const stepSideMargin = (delta: number): void => {
    const next = Math.max(MIN_SIDE_MARGIN, resolved.sideMargin + delta)
    setMarginDraft(String(next))
    void controller.set('sideMargin', next).then(() => { setStatus('applied') }).catch(() => { setStatus('unavailable') })
  }

  const setThinkFixedHeight = (value: boolean): void => {
    void controller.set('thinkFixedHeight', value).then(() => { setStatus('applied') }).catch(() => { setStatus('unavailable') })
  }

  const commitThinkHeight = (raw: string): void => {
    setThinkHeightDraft(raw)
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return
    const clamped = Math.min(MAX_THINK_HEIGHT, Math.max(MIN_THINK_HEIGHT, Math.round(parsed)))
    setThinkHeightDraft(String(clamped))
    void controller.set('thinkHeight', clamped).then(() => { setStatus('applied') }).catch(() => { setStatus('unavailable') })
  }

  const stepThinkHeight = (delta: number): void => {
    const next = Math.min(MAX_THINK_HEIGHT, Math.max(MIN_THINK_HEIGHT, resolved.thinkHeight + delta))
    setThinkHeightDraft(String(next))
    void controller.set('thinkHeight', next).then(() => { setStatus('applied') }).catch(() => { setStatus('unavailable') })
  }

  const setRightbarInitialWidth = (value: boolean): void => {
    void controller.set('rightbarInitialWidth', value).then(() => { setStatus('applied') }).catch(() => { setStatus('unavailable') })
  }

  const commitRightbarWidth = (raw: string): void => {
    setRightbarWidthDraft(raw)
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return
    const clamped = Math.min(MAX_RIGHTBAR_WIDTH_PERCENT, Math.max(MIN_RIGHTBAR_WIDTH_PERCENT, Math.round(parsed)))
    setRightbarWidthDraft(String(clamped))
    void controller.set('rightbarWidthPercent', clamped).then(() => { setStatus('applied') }).catch(() => { setStatus('unavailable') })
  }

  const stepRightbarWidth = (delta: number): void => {
    const next = Math.min(MAX_RIGHTBAR_WIDTH_PERCENT, Math.max(MIN_RIGHTBAR_WIDTH_PERCENT, resolved.rightbarWidthPercent + delta))
    setRightbarWidthDraft(String(next))
    void controller.set('rightbarWidthPercent', next).then(() => { setStatus('applied') }).catch(() => { setStatus('unavailable') })
  }

  const applyRightbarWidthPreset = (percent: number): void => {
    setRightbarWidthDraft(String(percent))
    void controller.set('rightbarWidthPercent', percent).then(() => { setStatus('applied') }).catch(() => { setStatus('unavailable') })
  }

  const setTweak = (tweak: TweakDescriptor, value: boolean): void => {
    void controller.set(tweak.settingKey, value).then(() => { setStatus('applied') }).catch(() => { setStatus('unavailable') })
  }

  if (state.status === 'loading' && state.value === undefined) {
    return <div className="cst-settings"><div className="cst-loading">{t('loading')}</div></div>
  }
  if (state.status === 'error') {
    return <div className="cst-settings"><div className="cst-alert error">{t('unavailable')}</div></div>
  }

  return (
    <div className="cst-settings">
      <header className="cst-settings-header">
        <div className="cst-logo">🎨</div>
        <div>
          <h2>{t('settingsTitle')}</h2>
          <p>{t('settingsIntro')}</p>
        </div>
      </header>
      {!writable ? <div className="cst-alert warning">{t('readOnly')}</div> : null}

      <section className="cst-panel">
        <div className="cst-section-label">{t('sectionLayout')}</div>
        <div className="cst-field">
          <div className="cst-field-top">
            <span className="cst-label">{t('usePluginWidth')}<Hint text={t('usePluginWidthHint')} /></span>
            <div className="cst-controls">
              <div className="cst-seg">
                <button type="button" className={resolved.usePluginWidth ? 'cst-seg-active' : ''} disabled={!writable} onClick={() => { setUsePluginWidth(true) }}>{t('usePluginWidthOn')}</button>
                <button type="button" className={!resolved.usePluginWidth ? 'cst-seg-active' : ''} disabled={!writable} onClick={() => { setUsePluginWidth(false) }}>{t('usePluginWidthOff')}</button>
              </div>
            </div>
          </div>
        </div>
        {resolved.usePluginWidth ? (
          <div className="cst-field">
            <div className="cst-field-top">
              <span className="cst-label">{t('dialogWidth')}<Hint text={t('dialogWidthHint')} /></span>
              <div className="cst-controls">
                <div className="cst-stepper">
                  <button type="button" aria-label="−" disabled={!writable || resolved.dialogWidth <= MIN_DIALOG_WIDTH} onClick={() => { stepDialogWidth(-20) }}>−</button>
                  <input
                    type="number"
                    min={MIN_DIALOG_WIDTH}
                    max={MAX_DIALOG_WIDTH}
                    step={20}
                    value={widthDraft}
                    disabled={!writable}
                    onChange={(event) => { setWidthDraft(event.target.value) }}
                    onBlur={(event) => { commitDialogWidth(event.target.value) }}
                    onKeyDown={(event) => { if (event.key === 'Enter') commitDialogWidth((event.target as HTMLInputElement).value) }}
                  />
                  <button type="button" aria-label="+" disabled={!writable || resolved.dialogWidth >= MAX_DIALOG_WIDTH} onClick={() => { stepDialogWidth(20) }}>+</button>
                </div>
              </div>
            </div>
            <div className="cst-presets">
              <div className="cst-seg">
                <button type="button" className={resolved.dialogWidth === 880 ? 'cst-seg-active' : ''} disabled={!writable} onClick={() => { applyWidthPreset(880) }}>{t('presetWide')} · 880</button>
                <button type="button" className={resolved.dialogWidth === 1024 ? 'cst-seg-active' : ''} disabled={!writable} onClick={() => { applyWidthPreset(1024) }}>{t('presetWideXl')} · 1024</button>
                <button type="button" className={resolved.dialogWidth === 748 ? 'cst-seg-active' : ''} disabled={!writable} onClick={() => { applyWidthPreset(748) }}>{t('presetDefault')} · 748</button>
              </div>
            </div>
          </div>
        ) : null}
        {resolved.usePluginWidth ? (
          <div className="cst-field">
            <div className="cst-field-top">
              <span className="cst-label">{t('sideMargin')}<Hint text={t('sideMarginHint')} /></span>
              <div className="cst-controls">
                <div className="cst-stepper">
                  <button type="button" aria-label="−" disabled={!writable || resolved.sideMargin <= MIN_SIDE_MARGIN} onClick={() => { stepSideMargin(-4) }}>−</button>
                  <input
                    type="number"
                    min={MIN_SIDE_MARGIN}
                    step={4}
                    value={marginDraft}
                    disabled={!writable}
                    onChange={(event) => { setMarginDraft(event.target.value) }}
                    onBlur={(event) => { commitSideMargin(event.target.value) }}
                    onKeyDown={(event) => { if (event.key === 'Enter') commitSideMargin((event.target as HTMLInputElement).value) }}
                  />
                  <button type="button" aria-label="+" disabled={!writable} onClick={() => { stepSideMargin(4) }}>+</button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        <div className="cst-field">
          <div className="cst-field-top">
            <span className="cst-label">{t('thinkFixedHeight')}<Hint text={t('thinkFixedHeightHint')} /></span>
            <div className="cst-controls">
              <div className="cst-seg">
                <button type="button" className={resolved.thinkFixedHeight ? 'cst-seg-active' : ''} disabled={!writable} onClick={() => { setThinkFixedHeight(true) }}>{t('tweakOn')}</button>
                <button type="button" className={!resolved.thinkFixedHeight ? 'cst-seg-active' : ''} disabled={!writable} onClick={() => { setThinkFixedHeight(false) }}>{t('tweakOff')}</button>
              </div>
            </div>
          </div>
        </div>
        {resolved.thinkFixedHeight ? (
          <div className="cst-field">
            <div className="cst-field-top">
              <span className="cst-label">{t('thinkHeight')}<Hint text={t('thinkHeightHint')} /></span>
              <div className="cst-controls">
                <div className="cst-stepper">
                  <button type="button" aria-label="−" disabled={!writable || resolved.thinkHeight <= MIN_THINK_HEIGHT} onClick={() => { stepThinkHeight(-20) }}>−</button>
                  <input
                    type="number"
                    min={MIN_THINK_HEIGHT}
                    max={MAX_THINK_HEIGHT}
                    step={20}
                    value={thinkHeightDraft}
                    disabled={!writable}
                    onChange={(event) => { setThinkHeightDraft(event.target.value) }}
                    onBlur={(event) => { commitThinkHeight(event.target.value) }}
                    onKeyDown={(event) => { if (event.key === 'Enter') commitThinkHeight((event.target as HTMLInputElement).value) }}
                  />
                  <button type="button" aria-label="+" disabled={!writable || resolved.thinkHeight >= MAX_THINK_HEIGHT} onClick={() => { stepThinkHeight(20) }}>+</button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        <div className="cst-field">
          <div className="cst-field-top">
            <span className="cst-label">{t('rightbarInitialWidth')}<Hint text={t('rightbarInitialWidthHint')} /></span>
            <div className="cst-controls">
              <div className="cst-seg">
                <button type="button" className={resolved.rightbarInitialWidth ? 'cst-seg-active' : ''} disabled={!writable} onClick={() => { setRightbarInitialWidth(true) }}>{t('tweakOn')}</button>
                <button type="button" className={!resolved.rightbarInitialWidth ? 'cst-seg-active' : ''} disabled={!writable} onClick={() => { setRightbarInitialWidth(false) }}>{t('tweakOff')}</button>
              </div>
            </div>
          </div>
        </div>
        {resolved.rightbarInitialWidth ? (
          <div className="cst-field">
            <div className="cst-field-top">
              <span className="cst-label">{t('rightbarWidthPercent')}<Hint text={t('rightbarWidthPercentHint')} /></span>
              <div className="cst-controls">
                <div className="cst-stepper">
                  <button type="button" aria-label="−" disabled={!writable || resolved.rightbarWidthPercent <= MIN_RIGHTBAR_WIDTH_PERCENT} onClick={() => { stepRightbarWidth(-5) }}>−</button>
                  <input
                    type="number"
                    min={MIN_RIGHTBAR_WIDTH_PERCENT}
                    max={MAX_RIGHTBAR_WIDTH_PERCENT}
                    step={5}
                    value={rightbarWidthDraft}
                    disabled={!writable}
                    onChange={(event) => { setRightbarWidthDraft(event.target.value) }}
                    onBlur={(event) => { commitRightbarWidth(event.target.value) }}
                    onKeyDown={(event) => { if (event.key === 'Enter') commitRightbarWidth((event.target as HTMLInputElement).value) }}
                  />
                  <button type="button" aria-label="+" disabled={!writable || resolved.rightbarWidthPercent >= MAX_RIGHTBAR_WIDTH_PERCENT} onClick={() => { stepRightbarWidth(5) }}>+</button>
                </div>
              </div>
            </div>
            <div className="cst-presets">
              <div className="cst-seg">
                <button type="button" className={resolved.rightbarWidthPercent === 30 ? 'cst-seg-active' : ''} disabled={!writable} onClick={() => { applyRightbarWidthPreset(30) }}>30%</button>
                <button type="button" className={resolved.rightbarWidthPercent === 40 ? 'cst-seg-active' : ''} disabled={!writable} onClick={() => { applyRightbarWidthPreset(40) }}>40%</button>
                <button type="button" className={resolved.rightbarWidthPercent === 45 ? 'cst-seg-active' : ''} disabled={!writable} onClick={() => { applyRightbarWidthPreset(45) }}>{t('presetDefault')} · 45%</button>
                <button type="button" className={resolved.rightbarWidthPercent === 55 ? 'cst-seg-active' : ''} disabled={!writable} onClick={() => { applyRightbarWidthPreset(55) }}>55%</button>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="cst-panel">
        <div className="cst-section-label">{t('sectionTweaks')}</div>
        {TWEAKS.map(tweak => {
          const enabled = (resolved as unknown as Record<string, boolean>)[tweak.settingKey] ?? tweak.defaultEnabled
          return (
            <div className="cst-field" key={tweak.id}>
              <div className="cst-field-top">
                <span className="cst-label">{t(tweak.titleKey as LocaleKey)}<Hint text={t(tweak.descriptionKey as LocaleKey)} /></span>
                <div className="cst-controls">
                  <div className="cst-seg">
                    <button type="button" className={enabled ? 'cst-seg-active' : ''} disabled={!writable} onClick={() => { setTweak(tweak, true) }}>{t('tweakOn')}</button>
                    <button type="button" className={!enabled ? 'cst-seg-active' : ''} disabled={!writable} onClick={() => { setTweak(tweak, false) }}>{t('tweakOff')}</button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </section>
      {status === undefined ? null : (
        <div className="cst-toast-wrap">
          <div className={'cst-toast' + (status === 'unavailable' ? ' error' : '')} role="status" aria-live="polite">
            <span className="cst-toast-dot" aria-hidden="true" />
            <span>{t(status)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Sanity-check that every tweak in the registry has matching `titleKey` /
 * `descriptionKey` strings in both `en` and `zh`. Catches "added a tweak
 * but forgot the i18n strings" at apply time instead of as an untranslated
 * label visible to users.
 */
function assertTweakI18nComplete(): void {
  const missing = (locale: 'en' | 'zh', table: Record<LocaleKey, string>): string[] => {
    const out: string[] = []
    for (const tweak of TWEAKS) {
      if (table[tweak.titleKey as LocaleKey] === undefined) out.push(`${locale}:${tweak.titleKey}`)
      if (table[tweak.descriptionKey as LocaleKey] === undefined) out.push(`${locale}:${tweak.descriptionKey}`)
    }
    return out
  }
  const problems = [...missing('en', en), ...missing('zh', zh)]
  if (problems.length > 0) {
    console.error('[dsh-style-tweaks] missing i18n keys:', problems)
  }
}

export function apply(ctx: ClientContext): void {
  assertTweakI18nComplete()
  ctx.effect(installBaseStyles, 'dsh-style-tweaks: base styles')
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'dsh-style-tweaks: locale')
  const t = ctx.locale.bind(NS)

  // Permanent chrome for this plugin's OWN Settings entry — not a tweak, so
  // it lives outside the TWEAKS loop and has no setting: DSH picks the rail
  // glyph from a hard-coded table that special-cases only `models` /
  // `agent-presets` / `plugins`, and the `settings.section` registration
  // options carry no icon field, so every other section (this one included)
  // is drawn with the same settings gear. The glyph is therefore swapped in
  // the DOM for as long as the plugin is loaded; see `settings-nav-icon.ts`.
  ctx.effect(
    () => setupSettingsNavIcon(() => t('nav')),
    'dsh-style-tweaks: settings nav icon',
  )

  const controller = new SettingsClient()

  // Width-axis override: when plugin-width is on, install the handle-hiding
  // + user-width-clamp CSS once and keep the same controller alive; on
  // every settings change, mutate it in place via `setWidth` (no reinstall,
  // no flicker — DSH's own `publishWidths` races the install on every
  // ResizeObserver tick and would otherwise drop the first frame). When the
  // user toggles plugin-width off, dispose the controller so DSH's native
  // handles take back over.
  ctx.effect(() => {
    let widthController: ReturnType<typeof installConversationWidthStyles> | undefined
    const sync = (): void => {
      const value = controller.getSnapshot().value
      const usePlugin = value?.usePluginWidth ?? DEFAULT_USE_PLUGIN_WIDTH
      const width = resolveDialogWidth(value?.dialogWidth)
      const sideMargin = resolveSideMargin(value?.sideMargin)
      if (usePlugin) {
        if (widthController === undefined) {
          widthController = installConversationWidthStyles(width, sideMargin)
        } else {
          widthController.setWidth(width, sideMargin)
        }
      } else if (widthController !== undefined) {
        widthController.dispose()
        widthController = undefined
      }
    }
    sync()
    void controller.load()
    return controller.subscribe(sync)
  }, 'dsh-style-tweaks: conversation width')

  // Mount / unmount tweak styles live as settings change. The subscribe
  // callback re-runs on every settings change, so all toggles apply live.
  // (Without `controller.subscribe(sync)` returning, sync only runs once at
  // boot — a regression that would let tweak toggles never take effect after
  // the first paint.)
  ctx.effect(() => {
    const cleanups: Array<() => void> = []
    const sync = (): void => {
      const value = controller.getSnapshot().value
      const resolved = resolveValue(value)
      // Full remount: simplest + tweak count is small (< 10).
      while (cleanups.length > 0) cleanups.pop()!()
      for (const tweak of TWEAKS) {
        const enabled = (resolved as unknown as Record<string, boolean>)[tweak.settingKey] ?? tweak.defaultEnabled
        if (!enabled) continue
        const injector = TWEAK_INJECTORS[tweak.id]
        if (injector === undefined) continue
        cleanups.push(injector(ctx, resolved))
      }
      // Layout-section feature with a numeric parameter (like the width axis
      // above): not a registry boolean, so it mounts outside the TWEAKS loop.
      if (resolved.thinkFixedHeight) {
        cleanups.push(installThinkingScrollStyles(resolved.thinkHeight))
      }
      // Right Sidebar initial width: a layout feature with a numeric
      // parameter, mounted outside the TWEAKS loop for the same reason as the
      // think cap above. Re-mounted on every settings change, which is also
      // what makes the live preview work while the sidebar is open.
      if (resolved.rightbarInitialWidth) {
        cleanups.push(installRightbarInitialWidth(ctx, resolved.rightbarWidthPercent))
      }
    }
    sync()
    return controller.subscribe(sync)
  }, 'dsh-style-tweaks: live tweak styles')

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: NS,
    order: 90,
    label: () => t('nav'),
    inject: () => ({ controller, t }),
  }, SettingsSection))
}