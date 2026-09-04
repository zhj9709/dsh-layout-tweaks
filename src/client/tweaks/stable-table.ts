/**
 * dsh-conversation-style-tweaks — stable-table tweak.
 *
 * Locks markdown-table layout on hover so surrounding content does not
 * reflow ("text jumps when I hover a table").
 *
 * DSH web renders markdown tables inside a `.md-table-wide` scroll wrapper.
 * On hover, DSH's own stylesheet sets `padding-bottom: 0` on that wrapper
 * to expand the scroll viewport — but the resulting height delta (~8 px)
 * pushes every sibling below the table, which is the user-visible "jump".
 * DSH does not change the inner cells' geometry on hover.
 *
 * Diagnosed against DSH's own stylesheet (verified in a live browser):
 *   ._tableScroll_*.md-table-wide:hover { padding-bottom: 0; }
 *
 * Fix: pin the wrapper's padding-bottom to its base value (8 px) across
 * base + hover + focus-visible states, so the table's outer height never
 * changes. As belt-and-braces, also suppress non-background transitions in
 * case future DSH versions add inner-cell hover effects.
 *
 * Selectors use stable hooks only — `.md-table-wide` is a hand-written
 * class DSH reserves for plugins/extensions; CSS Modules-generated names
 * like `_tableScroll_177e0_174` are intentionally avoided.
 */
const STABLE_TABLE_CSS = `
/* Pin the wrapper's padding-bottom to its base value across every state, so
 * the wrapper's height never changes on hover. 8 px is the DSH baseline
 * (verified in a live browser via getComputedStyle on .md-table-wide).
 *
 * Specificity note: DSH's own rule is something like
 *   .[css-modules].md-table-wide:hover, ...:focus-visible { padding-bottom: 0 }
 * which has specificity (0, 0, 3, 0). A plain .md-table-wide:hover would only
 * be (0, 0, 2, 0), so even with !important DSH wins on the specificity
 * tiebreak. We double-up the .md-table-wide class to match (and exceed) DSH's
 * specificity. */
.md-table-wide,
.md-table-wide.md-table-wide:hover,
.md-table-wide.md-table-wide:focus,
.md-table-wide.md-table-wide:focus-visible,
.md-table-wide.md-table-wide:focus-within {
  padding-bottom: 8px !important;
}

/* Belt-and-braces: no animated transitions on geometry properties — even
 * if DSH sets transition: all 0.15s, the value oscillates within a zero
 * range so the user never sees motion. Background-color / color keep
 * transitioning for any highlight effect. */
.md-table-wide table * {
  transition-property: background-color, color !important;
}
`

export const STABLE_TABLE_CSS_ID = 'cst-stable-table'

export function injectStableTableStyles(): () => void {
  let style = document.querySelector<HTMLStyleElement>(`style[data-tweak-css="${STABLE_TABLE_CSS_ID}"]`)
  if (style === null) {
    style = document.createElement('style')
    style.dataset.tweak = 'cst'
    style.dataset.tweakCss = STABLE_TABLE_CSS_ID
    style.textContent = STABLE_TABLE_CSS
    document.head.appendChild(style)
  }
  return () => { style?.remove() }
}