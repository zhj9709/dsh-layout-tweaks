/**
 * dsh-conversation-style-tweaks — server half.
 *
 * Registers the `conversation-style-tweaks` settings namespace so users can
 * toggle conversation-view CSS tweaks either from the Settings panel or by
 * editing the settings document directly (settings.yaml
 * `conversation-style-tweaks:` section). All rendering work happens in the
 * browser bundle (`src/client`), which reads and writes this namespace
 * through the same-origin route mounted here — the Web settings RPC only
 * exposes a fixed allowlist of namespaces since rc.6, so a custom route is
 * the supported way for a plugin to own a configuration page.
 * @module dsh-conversation-style-tweaks
 */

import type { Context } from '@deepseek-ai/cordis'
import {
  CONVERSATION_STYLE_TWEAKS_SETTINGS_NAMESPACE,
  Config,
} from './config.ts'
import { ConversationStyleTweaksWebBackend, installConversationStyleTweaksWeb } from './web.ts'

export const name = 'dsh-conversation-style-tweaks'

/** Required services: the settings seam is the whole server-side surface. */
export const inject = ['settings', 'web']

export function apply(ctx: Context): void {
  ctx.settings.register(CONVERSATION_STYLE_TWEAKS_SETTINGS_NAMESPACE, Config, {
    applies: 'live',
  })

  // The browser Settings panel talks to the namespace through this same-origin
  // route (the Web settings RPC only exposes a fixed allowlist since rc.6).
  installConversationStyleTweaksWeb(ctx, new ConversationStyleTweaksWebBackend(ctx))

  ctx.logger.info('[dsh-conversation-style-tweaks] settings namespace registered and Web routes mounted')
}
