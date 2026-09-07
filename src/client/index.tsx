/**
 * dsh-conversation-style-tweaks — browser half.
 *
 * Owns the runtime CSS that drives two feature areas under one Settings
 * panel:
 *   1. Column-width control (ported from dsh-dialog-width): px stepper,
 *      presets, plugin-vs-native toggle, side margin.
 *   2. Opt-in CSS tweaks: stable-table layout on hover, with more added
 *      over time. Each tweak is a boolean field.
 *
 * Reads and writes the `conversation-style-tweaks` settings namespace via
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
import {
  MAX_DIALOG_WIDTH,
  MIN_DIALOG_WIDTH,
  MIN_SIDE_MARGIN,
  resolveDialogWidth,
  resolveSideMargin,
} from './tweak-config.ts'
import { TWEAKS, type TweakDescriptor } from './tweaks/registry.ts'
import { injectStableTableStyles } from './tweaks/stable-table.ts'
import { injectStableTurnRailStyles } from './tweaks/stable-turn-rail.ts'
import { injectCodeBlockFlushTopStyles } from './tweaks/code-block-flush-top.ts'
import { setupProjectRunningIndicator } from './tweaks/project-running-indicator.ts'
import { setupLocateCurrentSession } from './tweaks/locate-current-session.ts'
import { setupSettingsNavScroll } from './tweaks/settings-nav-scroll.ts'

const NS = 'conversation-style-tweaks'
const SETTINGS_ROUTE = '/_dsh/conversation-style-tweaks/settings'

/**
 * Maps a tweak id to its mount function. Add new tweaks here. Pure-CSS
 * injectors ignore the context; JS-level tweaks (DOM patching driven by app
 * stores) receive it to read services like `sessions` / `workspaces`.
 */
const TWEAK_INJECTORS: Record<string, (ctx: ClientContext) => () => void> = {
  'stable-table': () => injectStableTableStyles(),
  'stable-turn-rail': () => injectStableTurnRailStyles(),
  'code-block-flush-top': () => injectCodeBlockFlushTopStyles(),
  'project-running-indicator': setupProjectRunningIndicator,
  'locate-current-session': setupLocateCurrentSession,
  'settings-nav-scroll': setupSettingsNavScroll,
}

interface TweaksValue {
  // Column-width control (ported from dsh-dialog-width).
  /** Dialog width in px; clamped to [600, 1600]. */
  dialogWidth?: number
  /** Whether the plugin's width control owns the column (vs. native handles). */
  usePluginWidth?: boolean
  /** Side margin in px; minimum 32. */
  sideMargin?: number
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
}

interface ResolvedTweaks {
  dialogWidth: number
  usePluginWidth: boolean
  sideMargin: number
  stableTable: boolean
  stableTurnRail: boolean
  codeBlockFlushTop: boolean
  projectRunningIndicator: boolean
  locateCurrentSession: boolean
  settingsNavScroll: boolean
}

interface Snapshot {
  writable: boolean
  value: TweaksValue
  revision: number
}

interface ApiSuccess<T> { ok: true; value: T }
interface ApiFailure { ok: false; error: { code: string; message: string } }

const en = {
  nav: 'Conversation style',
  settingsTitle: 'Conversation style tweaks',
  settingsIntro: 'Opt-in CSS tweaks for the conversation view: a precise column-width control (with presets and side margin) and a collection of small layout fixes. Each setting takes effect immediately and persists to your settings document.',
  sectionLayout: 'Layout',
  sectionTweaks: 'Tweaks',
  dialogWidth: 'Dialog width',
  dialogWidthHint: 'Number between 600 and 1600 px; 748 is DSH\'s default column width, larger values widen it.',
  presetDefault: 'Default',
  presetWide: 'Wide',
  presetWideXl: 'Extra wide',
  usePluginWidth: 'Plugin width control',
  usePluginWidthHint: 'When ON, the width input / presets above drive the column and DSH\'s native drag handles are hidden. When OFF, DSH\'s native handles own the column; the width input mirrors their value.',
  usePluginWidthOn: 'On',
  usePluginWidthOff: 'Off',
  sideMargin: 'Side margin',
  sideMarginHint: 'Whitespace in px kept on each side of the conversation area. The column is clamped to the dialog width and narrows when the sidebar opens or the window shrinks, never hugging the edges. Minimum 32 px.',
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
} as const

type LocaleKey = keyof typeof en

const zh: Record<LocaleKey, string> = {
  nav: '对话样式',
  settingsTitle: '对话样式调整',
  settingsIntro: '对话视图的可选 CSS 调整：精确的列宽控制（含预设与两侧边距）以及一组小幅布局修复。每个开关都会立即生效并持久化到设置文档。',
  sectionLayout: '布局',
  sectionTweaks: '调整项',
  dialogWidth: '对话框宽度',
  dialogWidthHint: '取值 600–1600 px；748 为 DSH 默认列宽，数字越大越宽。',
  presetDefault: '默认',
  presetWide: '稍宽',
  presetWideXl: '更宽',
  usePluginWidth: '插件宽度控制',
  usePluginWidthHint: '开启时，上方宽度输入 / 预设驱动列宽，并隐藏 DSH 原生的拖拽手柄；关闭时，DSH 原生手柄接管列宽，宽度输入同步显示当前值。',
  usePluginWidthOn: '开启',
  usePluginWidthOff: '关闭',
  sideMargin: '两侧边距',
  sideMarginHint: '对话区域两侧保留的空白（px）。列宽被钳制为对话框宽度，侧边栏打开或窗口缩小时内容会收窄，不会贴住边缘。最低 32 px。',
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
}

type Translate = (key: LocaleKey) => string

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** dsh-conversation-style-tweaks Settings copy. */
    'conversation-style-tweaks': LocaleKey
  }
}

function resolveValue(value: TweaksValue | undefined): ResolvedTweaks {
  return {
    dialogWidth: resolveDialogWidth(value?.dialogWidth),
    usePluginWidth: value?.usePluginWidth ?? true,
    sideMargin: resolveSideMargin(value?.sideMargin),
    stableTable: value?.stableTable ?? true,
    stableTurnRail: value?.stableTurnRail ?? true,
    codeBlockFlushTop: value?.codeBlockFlushTop ?? true,
    projectRunningIndicator: value?.projectRunningIndicator ?? true,
    locateCurrentSession: value?.locateCurrentSession ?? true,
    settingsNavScroll: value?.settingsNavScroll ?? true,
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
  const id = 'dsh-conversation-style-tweaks-base'
  let style = document.querySelector<HTMLStyleElement>(`style[data-plugin-css="${id}"]`)
  if (style === null) {
    style = document.createElement('style')
    style.dataset.plugin = 'dsh-conversation-style-tweaks'
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
      lastError = new Error(failure.error?.message ?? `Conversation style request failed with HTTP ${response.status}`)
      if (!retryable) throw lastError
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 250))
  }
  throw lastError ?? new Error('Conversation style request failed')
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

type SettingsSectionProps = PropsRuntime<'settings.section'> & PropsLocale<'conversation-style-tweaks'> & {
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

  useEffect(() => { setWidthDraft(String(resolved.dialogWidth)) }, [resolved.dialogWidth])
  useEffect(() => { setMarginDraft(String(resolved.sideMargin)) }, [resolved.sideMargin])

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
    console.error('[dsh-conversation-style-tweaks] missing i18n keys:', problems)
  }
}

export function apply(ctx: ClientContext): void {
  assertTweakI18nComplete()
  ctx.effect(installBaseStyles, 'dsh-conversation-style-tweaks: base styles')
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'dsh-conversation-style-tweaks: locale')
  const t = ctx.locale.bind(NS)

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
      const usePlugin = value?.usePluginWidth ?? true
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
  }, 'dsh-conversation-style-tweaks: conversation width')

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
        cleanups.push(injector(ctx))
      }
    }
    sync()
    return controller.subscribe(sync)
  }, 'dsh-conversation-style-tweaks: live tweak styles')

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: NS,
    order: 90,
    label: () => t('nav'),
    inject: () => ({ controller, t }),
  }, SettingsSection))
}