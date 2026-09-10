/**
 * dsh-style-tweaks — thinking-scroll tweak.
 *
 * Caps the expanded think (reasoning) body — the text under the 深度思考
 * disclosure row — at a configured height and scrolls the overflow, so a
 * long thinking trace stops pushing the rest of the conversation out of
 * view. Off: the body keeps growing with its content, as shipped.
 *
 * DOM shape (ui-chat ReasoningRow / DisclosureRow, stable hooks only):
 *
 *   div[data-variant="think"][data-expanded]     ← ReasoningRow root
 *     div[data-open]                             ← DisclosureRow root
 *       div[data-disclosure-row]                 ← 24px header row
 *       div (thinkBody)                          ← expanded text, plain node
 *
 * The body is a CSS-Modules class (hashed), so the selector walks the
 * structure instead: the element right after the header row. `thinkBody` is
 * the only node DisclosureRow renders after the header, and
 * `data-variant="think"` is set by ReasoningRow alone (tool-call and other
 * disclosure variants ship different values), so the selector cannot leak
 * onto other disclosures.
 */
const THINK_BODY_SELECTOR = 'div[data-variant="think"][data-expanded] [data-disclosure-row] + div'

/** Build the stylesheet for one cap height. The height is baked into the
 * text so a settings change is a pure textContent swap (same element, no
 * flicker) — same upgrade as settings-nav-scroll. */
function buildThinkingScrollCss(heightPx: number): string {
  return `
/* Expanded think body: cap the window at the configured height and scroll
 * the overflow. scrollbar-gutter reserves the bar's lane up front so the
 * text never reflows when the content first crosses the cap. */
${THINK_BODY_SELECTOR} {
  /* border-box so the configured px is the visible window height, not the
   * content box plus the body's own 8px vertical padding (verified live:
   * content-box capped a 360 setting at 368 visible). */
  box-sizing: border-box;
  max-height: ${heightPx}px;
  overflow-y: auto;
  scrollbar-gutter: stable;
  /* The body ships with no right padding, so its text would sit flush
   * against the reserved scrollbar lane — keep a breathing gap. */
  padding-right: 12px;
}

/* Thin 4px bar (same as the settings-nav tweak) with DSH's own thumb
 * tokens, always visible — this is a reading pane, not a transient list.
 * No overscroll-behavior: contain here on purpose — a capped body whose
 * content fits (or that has hit its top/bottom edge) must hand the wheel
 * back to the conversation; contain turns the body into a wheel black
 * hole instead (verified live: hovering a short think body froze the
 * conversation scroll). */
${THINK_BODY_SELECTOR}::-webkit-scrollbar {
  width: 4px;
}
${THINK_BODY_SELECTOR}::-webkit-scrollbar-thumb {
  background: var(--dsh-scrollbar-thumb);
  border-radius: 2px;
}
${THINK_BODY_SELECTOR}::-webkit-scrollbar-thumb:hover {
  background: var(--dsh-scrollbar-thumb-hover);
}
${THINK_BODY_SELECTOR}::-webkit-scrollbar-track {
  background: transparent;
}
`
}

export const THINKING_SCROLL_CSS_ID = 'cst-thinking-scroll'

/** Idempotent style install for one cap height; returns the removal fn. */
export function installThinkingScrollStyles(heightPx: number): () => void {
  let style = document.querySelector<HTMLStyleElement>(`style[data-tweak-css="${THINKING_SCROLL_CSS_ID}"]`)
  if (style === null) {
    style = document.createElement('style')
    style.dataset.tweak = 'cst'
    style.dataset.tweakCss = THINKING_SCROLL_CSS_ID
    document.head.appendChild(style)
  }
  const css = buildThinkingScrollCss(heightPx)
  if (style.textContent !== css) style.textContent = css
  return () => { style?.remove() }
}
