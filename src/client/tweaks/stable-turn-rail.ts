/**
 * dsh-conversation-style-tweaks — stable-turn-rail tweak.
 *
 * Fixes the visual jump of the turn-navigation rail when the reader scrolls
 * the chat upward into the system-prompt area at the very top of the
 * conversation column.
 *
 * ## Symptom
 *
 * The rail (right-side Turn navigator) sits inside the chat scroll container
 * as a `position: sticky; top: 0; height: 0` slot. Its parent has
 * `padding-top: 16px`. With `top: 0` sticky behaviour, the slot's natural
 * flow position is `padding-top` below the scrollport's visible top, so:
 *
 *   • When the chat is scrolled far enough that the slot would naturally
 *     be above the scrollport top (scrollTop > 16px), sticky activates and
 *     pins the slot at scrollport top:0. Rail sits at the expected height.
 *   • When the chat is scrolled all the way up (scrollTop ≤ 16px), the slot
 *     falls back to its natural position — which is 16px below scrollport
 *     top. The rail shifts DOWN by 16px.
 *
 * After clicking the first Turn marker, the chat lands such that the first
 * message sits near the reading line but the chat can still scroll up into
 * the system prompt above it. Scrolling that last bit causes the rail to
 * visibly drop by 16px.
 *
 * ## Fix
 *
 * Move the 16px of top padding from the scroll container down into the
 * chat column (`[data-chat-flow]`). Net effect:
 *
 *   • Container's `padding-top` becomes 0, so the sticky slot's natural
 *     position is at scrollport top:0 even when scrollTop = 0.
 *   • Column picks up `padding-top: 16px`, so the first message still
 *     starts 16px below the scrollport top — identical visual layout to
 *     before, only the source of those 16px has moved.
 *
 * Selectors use stable DSH markers only:
 *
 *   • `[data-chat-flow]` — the chat column (stable attribute, hardcoded in
 *     ChatView.tsx).
 *   • `:has(> * > nav[aria-label="Turn navigation"], > * > nav[aria-label="轮次导航"])`
 *     — the chat scroll container, identified as the only element that has
 *     the rail nav as a grandchild and the chat column as a direct child.
 *     The two aria-label values cover DSH's shipped en / zh dictionaries
 *     (TurnNavigator.tsx → `t('chat.turnNavigation.label')`).
 *
 * No CSS-module class names are referenced, so the fix stays correct across
 * DSH builds that re-hash module class names.
 */

const STABLE_TURN_RAIL_CSS = `
/* The chat scroll container: identifiable as the parent of the chat column
   that also holds the turn-rail slot as a grandchild. Removing its top
   padding keeps the sticky slot's natural position aligned with the
   scrollport's visible top, so the rail never "drops" near scrollTop = 0. */
:has(> * > nav[aria-label="Turn navigation"], > * > nav[aria-label="轮次导航"]):has(> [data-chat-flow]) {
  padding-top: 0 !important;
}
/* Push the 16px that used to live on the container down into the chat
   column, so the first message still starts 16px below the scrollport top
   (identical to the unmodified layout). */
[data-chat-flow] {
  padding-top: 16px !important;
}
`

export const STABLE_TURN_RAIL_CSS_ID = 'cst-stable-turn-rail'

export function injectStableTurnRailStyles(): () => void {
  let style = document.querySelector<HTMLStyleElement>(`style[data-tweak-css="${STABLE_TURN_RAIL_CSS_ID}"]`)
  if (style === null) {
    style = document.createElement('style')
    style.dataset.tweak = 'cst'
    style.dataset.tweakCss = STABLE_TURN_RAIL_CSS_ID
    style.textContent = STABLE_TURN_RAIL_CSS
    document.head.appendChild(style)
  }
  return () => { style?.remove() }
}