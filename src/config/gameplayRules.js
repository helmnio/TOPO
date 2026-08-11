export const GAMEPLAY_RULESETS = {
  COLOR_ONLY: 'color-only-v1',
  ICON_ROTATE: 'icon-rotate-v2',
};

export const GAMEPLAY_RULES = {
  [GAMEPLAY_RULESETS.COLOR_ONLY]: {
    id: GAMEPLAY_RULESETS.COLOR_ONLY,
    label: 'Colour Only',
    symbols: false,
    fragmentRotation: false,
    mapRotation: false,
    northMarker: false,
    hints: false,
  },
  [GAMEPLAY_RULESETS.ICON_ROTATE]: {
    id: GAMEPLAY_RULESETS.ICON_ROTATE,
    label: 'Icons + Rotation',
    symbols: true,
    fragmentRotation: true,
    mapRotation: true,
    northMarker: true,
    hints: true,
  },
};

// Major gameplay version switch. Change this back to COLOR_ONLY to restore the
// preserved original Daily rules without removing either implementation.
export const ACTIVE_DAILY_RULESET = GAMEPLAY_RULESETS.ICON_ROTATE;
export const ACTIVE_DAILY_SESSION_VERSION = 2;

export function getGameplayRules(ruleset = ACTIVE_DAILY_RULESET) {
  return GAMEPLAY_RULES[ruleset] || GAMEPLAY_RULES[ACTIVE_DAILY_RULESET];
}
