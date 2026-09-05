/**
 * dsh-conversation-style-tweaks — tweak registry.
 *
 * Central catalogue of all CSS tweaks the plugin can inject. Each tweak is
 * described once here; the client iterates this list to (a) render Settings
 * panel toggles and (b) mount / unmount the corresponding styles live.
 */

export interface TweakDescriptor {
  /** Unique id, e.g. "stable-table". Doubles as the DOM data-tweak id. */
  readonly id: string
  /** Settings document field name, e.g. "stableTable". */
  readonly settingKey: string
  /** Default value when the field is absent from the settings document. */
  readonly defaultEnabled: boolean
  /** i18n key for the toggle label in the Settings panel. */
  readonly titleKey: string
  /** i18n key for the one-line description shown next to the toggle. */
  readonly descriptionKey: string
}

/** All tweaks, in display order. Add new entries here. */
export const TWEAKS: readonly TweakDescriptor[] = [
  {
    id: 'stable-table',
    settingKey: 'stableTable',
    defaultEnabled: true,
    titleKey: 'tweak.stableTable.title',
    descriptionKey: 'tweak.stableTable.description',
  },
  {
    id: 'stable-turn-rail',
    settingKey: 'stableTurnRail',
    defaultEnabled: true,
    titleKey: 'tweak.stableTurnRail.title',
    descriptionKey: 'tweak.stableTurnRail.description',
  },
  {
    id: 'code-block-flush-top',
    settingKey: 'codeBlockFlushTop',
    defaultEnabled: true,
    titleKey: 'tweak.codeBlockFlushTop.title',
    descriptionKey: 'tweak.codeBlockFlushTop.description',
  },
]
