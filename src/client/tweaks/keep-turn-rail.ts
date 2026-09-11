/**
 * dsh-style-tweaks — keep-turn-rail tweak.
 *
 * Keeps DSH's turn-navigation rail (the right-side Turn navigator) visible
 * after the right Sidebar is widened far enough to hide it.
 *
 * ## Symptom
 *
 * Dragging the right Sidebar wider makes the turn-navigation rail disappear,
 * and it never comes back for the rest of the panel's usable range (it returns
 * only after closing the sidebar or collapsing the left one).
 *
 * ## Cause (a host container query, not a bug)
 *
 * `TurnNavigator.module.css` ships exactly one container query:
 *
 *   @container (max-width: 900px) { .slot { display: none } }
 *
 * The query container is the chat scrollport: `ChatView.module.css` `.scroll`
 * declares `container-type: inline-size`, and TurnNavigator renders the rail
 * as that element's direct child:
 *
 *   <div class="scroll">            ← container-type: inline-size
 *     <div class="slot">            ← the rule hides this
 *       <nav class="frame" …>       ← the rail itself
 *     <div data-chat-flow>…         ← the chat column
 *
 * A `width` condition in a container query is evaluated against the query
 * container's CONTENT box, so the trigger is:
 *
 *   scrollport content box = column width − 2 × (16px + --dsh-composer-side-clearance)
 *                          ≤ 900px
 *
 * With DSH's stock 16px clearance that is a 64px inset; a measured build also
 * loses ~10px to the conversation scroller's own gutter, so the rail vanishes
 * once the CENTER COLUMN reaches ≈974px. Because `ui-layout`'s column solve
 * reserves only 400px for the center while the right panel is open
 * (`computeColumns`), a widened right panel hides the rail over almost its
 * whole usable range.
 *
 * ## Fix
 *
 * Restore the slot's `display`. The slot is the scrollport's direct child that
 * holds the rail `<nav>`, and the scrollport is the only element that has the
 * chat column as a DIRECT child — `[data-chat-flow]` is a hand-written, stable
 * attribute in `ChatView.tsx` (`<div className={css.column} data-chat-flow="">`).
 * That gives a selector with no CSS-Modules hash and no translated string:
 *
 *   :has(> [data-chat-flow]) > *:has(> nav):not([data-chat-flow])
 *
 * Stable markers only:
 *
 *   • `[data-chat-flow]` — the chat column, hardcoded in ChatView.tsx (the
 *     same marker `stable-turn-rail.ts` anchors on).
 *   • the `nav` element — `TurnNavigator.tsx` renders `<div className={css.slot}>
 *     <nav className={css.frame} …>`; the only other direct child of the
 *     scrollport that is not the column is the back-to-bottom slot, which
 *     holds a `<button>`, never a `<nav>`.
 *
 * Deliberately NOT used: `nav[aria-label="Turn navigation"]` (the label comes
 * from `t('chat.turnNavigation.label')`, so its value differs per locale and a
 * selector pinning en/zh would silently stop matching on any other language)
 * and the CSS-Modules class names (re-hashed on every DSH build).
 *
 * `display: block !important` is the whole override: the shipped declaration
 * is a plain (non-important) `display: none` inside a container query, so an
 * important declaration wins regardless of order or of the hash in use.
 *
 * ## Known trade-offs
 *
 * The rail is 28px wide, absolutely positioned in the scrollport's right
 * gutter (`right: calc(12px - (--dsh-composer-side-clearance + 16px))`), and
 * its hover preview is `min(300px, 100cqw - 120px)` wide and opens to the LEFT
 * of the rail. At very narrow columns (down to the host's 400px center floor)
 * the rail can overlap the last few pixels of the transcript, and hovering it
 * covers part of the transcript with the preview card. That preview is the
 * likely reason the host hides the whole rail below 900px in the first place —
 * this tweak trades that behaviour for keeping the navigation affordance.
 */

const KEEP_TURN_RAIL_CSS = `
/* The chat scrollport: the only element that holds the chat column as a
   direct child. Its rail slot is the other direct child that wraps a <nav>
   (the chat column itself is excluded in case a future build nests a <nav>
   right under it). Restores the slot the host's
   \`@container (max-width:900px){ .slot{display:none} }\` hides away. */
:has(> [data-chat-flow]) > *:has(> nav):not([data-chat-flow]) {
  display: block !important;
}
`

export const KEEP_TURN_RAIL_CSS_ID = 'cst-keep-turn-rail'

export function injectKeepTurnRailStyles(): () => void {
  let style = document.querySelector<HTMLStyleElement>(`style[data-tweak-css="${KEEP_TURN_RAIL_CSS_ID}"]`)
  if (style === null) {
    style = document.createElement('style')
    style.dataset.tweak = 'cst'
    style.dataset.tweakCss = KEEP_TURN_RAIL_CSS_ID
    style.textContent = KEEP_TURN_RAIL_CSS
    document.head.appendChild(style)
  }
  return () => { style?.remove() }
}
