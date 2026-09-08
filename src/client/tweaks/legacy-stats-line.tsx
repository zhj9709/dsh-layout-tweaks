/**
 * dsh-style-tweaks — legacy-stats-line tweak.
 *
 * Restores the composer stats presentation DSH shipped through
 * 0.1.2-rc.1 (`StatsLine`): one centered, pipe-separated text line under the
 * composer card — turn/step counts, LLM and tool wall times, TTFT average,
 * output speed, cache hit, and input/output tokens — truncating with an
 * ellipsis and revealing the full line in a hover tooltip. 0.1.5-alpha.1
 * replaced that line with icon pills that open dialogs (`StatsPills`);
 * this tweak mounts the old presentation back on top of the new one.
 *
 * ## Why slot shadowing
 *
 * Both presentations mount the same way: a `list` entry on the
 * `conversation.composer.dock` slot under the id `stats`. A list cell
 * renders its lowest-priority live entry (see `SlotCore.register`), so
 * re-registering `id: 'stats'` at `priority: -1` shadows the shipped pills
 * for exactly as long as the registration lives; disposing it hands the
 * cell straight back — no CSS hiding, no DOM patching, and a crashed entry
 * retires itself so the pills reappear.
 *
 * ## Data plane
 *
 * The same durable projections the pills read: `sessionStats`
 * (whole-log turn/step counts and wall times) and `tokenUsage` (billing
 * buckets), so every figure matches the new UI. The old component's
 * whole-window fallback fold (`deriveStats`, for assemblies without the
 * session-stats unit) is dropped: without the projection the line renders
 * nothing, matching the old line's "no data, no row" rule.
 *
 * Copy lives in the plugin's own locale namespace (`style-tweaks`,
 * `legacyStats.*` keys) — DSH removed the old `stats.llm` family from its
 * dictionaries in 0.1.5, so the plugin carries its own.
 *
 * @module dsh-style-tweaks/client/tweaks/legacy-stats-line
 */

import { Fragment, memo, useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only imports activate the client-service Context declarations and the
// slot/projection declaration merges this file reads through.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-session-stats/client'
import type { TokenUsageProjection } from '@deepseek-ai/dsh-token-meter/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

/** The slot machinery's translate seat for the plugin namespace. */
type LegacyTranslate = PropsLocale<'style-tweaks'>['t']

/** The three disjoint prompt-side billing buckets. */
function billedInputTokens(usage: TokenUsageProjection): number {
  return usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
}

/**
 * Compact token count: 517 / 12.2K / 1.2M — the shared `number.*` templates,
 * carried in the plugin namespace so the line does not lean on the host's
 * common vocabulary.
 */
function formatTokens(value: number, t: LegacyTranslate): string {
  const scaled = (candidate: number): string => candidate >= 100
    ? String(Math.round(candidate))
    : String(Math.round(candidate * 10) / 10)
  if (value < 1_000) return String(value)
  if (value < 1_000_000) return t('legacyStats.number.thousand', { value: scaled(value / 1_000) })
  return t('legacyStats.number.million', { value: scaled(value / 1_000_000) })
}

/** Compact duration: 45.2s under a minute, 2m42s from there on. */
function formatDuration(ms: number, t: LegacyTranslate): string {
  const s = ms / 1_000
  if (s < 60) return t('legacyStats.duration.seconds', { seconds: Math.round(s * 10) / 10 })
  const whole = Math.round(s)
  return t('legacyStats.duration.minutes', { minutes: Math.floor(whole / 60), seconds: whole % 60 })
}

/** Tokens per second without the unit: one decimal below 10, integral above. */
function formatTokensPerSecond(tps: number): string {
  const clamped = Math.max(0, tps)
  return clamped >= 10 ? String(Math.round(clamped)) : String(Math.round(clamped * 10) / 10)
}

/**
 * Display-ready cache-hit share without rounding a partial hit to 100%:
 * integer percentage while it stays below 100, otherwise the minimum
 * decimal precision that still rounds below 100 (a 99.99…% hit keeps its
 * honest `99.9…` tail). Ported verbatim from dsh-client-ui-chat's
 * `token-format.ts` (0.1.2-rc.1); no billed input returns null.
 */
function formatCacheHitPercent(cacheReadTokens: number, promptTokens: number): string | null {
  if (promptTokens === 0) return null
  const missedInputTokens = promptTokens - cacheReadTokens
  if (missedInputTokens === 0) return '100'

  // Round the read ratio to integer percent units with positive ties up:
  // binary-search the largest candidate whose (2c-1)-scaled half-open
  // threshold the numerator reaches.
  const denominatorQuotient = Math.floor(promptTokens / 200)
  const denominatorRemainder = promptTokens % 200
  let lower = 0
  let upper = 100
  while (lower < upper) {
    const candidate = Math.floor((lower + upper + 1) / 2)
    const factor = candidate * 2 - 1
    const threshold = factor * denominatorQuotient
      + Math.ceil(factor * denominatorRemainder / 200)
    if (cacheReadTokens >= threshold) lower = candidate
    else upper = candidate - 1
  }
  if (lower < 100) return String(lower)

  // The integer rounding would read 100: widen precision until one unit of
  // the last shown place exceeds the miss, then keep the tail honest.
  let distinguishingPlaces = 1
  let scaledDoubleGap = missedInputTokens * 200
  const denominatorTens = Math.floor(promptTokens / 10)
  while (scaledDoubleGap <= denominatorTens) {
    scaledDoubleGap *= 10
    distinguishingPlaces += 1
  }
  const denominatorOnes = promptTokens % 10
  let roundedLoss = 5
  for (let loss = 1; loss < 5; loss += 1) {
    const factor = loss * 2 + 1
    const threshold = factor * denominatorTens + Math.floor(factor * denominatorOnes / 10)
    if (scaledDoubleGap <= threshold) {
      roundedLoss = loss
      break
    }
  }
  return `99.${'9'.repeat(distinguishingPlaces - 1)}${10 - roundedLoss}`
}

/** Truncating stats row: the pipe-separated line, with the full text as a hover tooltip. */
const StatsRow = memo(function StatsRow({ groups, line }: {
  readonly groups: readonly string[]
  readonly line: string
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [truncated, setTruncated] = useState(false)
  const measure = useCallback(() => {
    const el = rootRef.current
    if (el === null) return
    const next = el.scrollWidth > el.clientWidth
    setTruncated(current => current === next ? current : next)
  }, [])
  useLayoutEffect(() => {
    const el = rootRef.current
    if (el === null || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => { observer.disconnect() }
  }, [measure])
  useLayoutEffect(measure, [line, measure])
  return (
    <Tooltip label={line} side="top" delayMs={500} disabled={!truncated}>
      {/* data-composer-stats: the host InputBar tightens its own 8px bottom
          clearance to 4px around any mounted stats row
          (`.root:has([data-composer-stats])`) — without the marker the
          composer keeps 8px and toggling the tweak shifts the column by 2px.
          The row pads 2px at the bottom so its total matches the pills row's
          22px pill box (26px row + 4px host clearance on both sides of the
          toggle): text sits exactly where 0.1.2 put it, and switching the
          tweak no longer moves the conversation. */}
      <div ref={rootRef} className="cst-legacy-stats" data-composer-stats>
        {groups.map((group, i) => (
          <Fragment key={group}>
            {i > 0 && <><span className="cst-legacy-stats-sep" aria-hidden>|</span>{' '}</>}
            <span>{group}</span>
          </Fragment>
        ))}
      </div>
    </Tooltip>
  )
})

/** Full props of the shadowing dock entry (standard kit + plugin locale seat). */
type LegacyStatsLineProps = PropsRuntime<'conversation.composer.dock'> & PropsLocale<'style-tweaks'>

/**
 * The 0.1.2-rc.1 stats line over the durable projections. Renders nothing
 * until a figure exists, and drops a group whole when its data is absent.
 */
export const LegacyStatsLine = memo(function LegacyStatsLine({ useProjection, t }: LegacyStatsLineProps) {
  const stats = useProjection('sessionStats')
  const usage = useProjection('tokenUsage')

  // Pipe-separated groups (figma stats strip); a group with no data drops out whole.
  const groups: string[] = []
  if (stats !== undefined && stats.steps > 0) {
    groups.push(t('legacyStats.counts', { turns: stats.turns, steps: stats.steps }))
    const durations: string[] = []
    if (stats.llmMs > 0) durations.push(t('legacyStats.llm', { duration: formatDuration(stats.llmMs, t) }))
    if (stats.toolMs > 0) durations.push(t('legacyStats.toolCall', { duration: formatDuration(stats.toolMs, t) }))
    if (durations.length > 0) groups.push(durations.join(' · '))
    const speeds: string[] = []
    if (stats.ttftSteps > 0) {
      speeds.push(t('legacyStats.ttftAverage', { duration: formatDuration(stats.ttftMs / stats.ttftSteps, t) }))
    }
    if (stats.decodeMs > 0) {
      speeds.push(t('legacyStats.tokensPerSecond', {
        throughput: formatTokensPerSecond(stats.decodeTokens / (stats.decodeMs / 1_000)),
      }))
    }
    if (speeds.length > 0) groups.push(speeds.join(' · '))
  }
  // Billing rides the durable projection, so these survive paging and
  // compaction. Gated on actual token activity: a session whose steps all
  // settled without billing (e.g. every request failed) shows its counts
  // without a zero-token group.
  if (usage !== undefined && (billedInputTokens(usage) > 0 || usage.outputTokens > 0)) {
    const cacheHit = formatCacheHitPercent(usage.cacheReadTokens, billedInputTokens(usage))
    if (cacheHit !== null) groups.push(t('legacyStats.cacheHit', { percent: cacheHit }))
    groups.push(t('legacyStats.tokens', {
      input: formatTokens(billedInputTokens(usage), t),
      output: formatTokens(usage.outputTokens, t),
    }))
  }
  if (groups.length === 0) return null
  return <StatsRow groups={groups} line={groups.join(' | ')} />
})

/**
 * Row skin, ported from 0.1.2-rc.1's `StatsLine.module.css`: 13/20 tertiary
 * text under the composer, aligned to the shared message column axis. Two
 * deviations from the verbatim port, both for toggle-height parity with the
 * shipped pills row (see the StatsRow marker comment): the bottom padding is
 * 2px instead of 0, and the token fallbacks keep the row readable if a host
 * build renames a token.
 */
const LEGACY_STATS_CSS = `
.cst-legacy-stats{display:block;text-align:center;max-width:var(--dsh-chat-content-width,748px);width:100%;margin:0 auto;box-sizing:border-box;padding:4px calc(var(--dsh-composer-side-clearance,16px) + 16px) 2px;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cst-legacy-stats-sep{color:var(--dsw-alias-separator-primary);margin:0 10px}
`

function installLegacyStatsStyles(): () => void {
  const id = 'dsh-style-tweaks-legacy-stats'
  let style = document.querySelector<HTMLStyleElement>(`style[data-plugin-css="${id}"]`)
  if (style === null) {
    style = document.createElement('style')
    style.dataset.plugin = 'dsh-style-tweaks'
    style.dataset.pluginCss = id
    style.textContent = LEGACY_STATS_CSS
    document.head.appendChild(style)
  }
  return () => { style?.remove() }
}

/**
 * Mount the legacy line: inject the row skin, then shadow the shipped
 * `stats` dock entry (same id, lower priority wins the list cell). The
 * `slots.inject` controller re-registers across slot re-declarations
 * (composer remounts, HMR) and its disposer restores the shipped pills.
 */
export function setupLegacyStatsLine(ctx: ClientContext): () => void {
  const disposeStyles = installLegacyStatsStyles()
  const disposeShadow = ctx.slots.inject('conversation.composer.dock', () =>
    ctx.slots.register({
      name: 'conversation.composer.dock',
      id: 'stats',
      priority: -1,
      locale: 'style-tweaks',
    }, LegacyStatsLine))
  return () => {
    disposeShadow()
    disposeStyles()
  }
}
