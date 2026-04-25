export type CustomNightEnemyId =
  | 'scout'
  | 'soldier'
  | 'demoman'
  | 'heavy'
  | 'sniper'
  | 'spy'
  | 'pyro'
  | 'medic'
  | 'administrator'
  | 'pauling';

export const CUSTOM_NIGHT_ENEMY_ORDER: CustomNightEnemyId[] = [
  'scout',
  'soldier',
  'demoman',
  'heavy',
  'sniper',
  'spy',
  'pyro',
  'medic',
  'administrator',
  'pauling',
];

export function defaultCustomNightEnemies(): Record<CustomNightEnemyId, boolean> {
  return {
    scout: false,
    soldier: false,
    demoman: false,
    heavy: false,
    sniper: false,
    spy: false,
    pyro: false,
    medic: false,
    administrator: false,
    pauling: false,
  };
}

/** Merge saved toggles onto defaults (handles older saves missing keys). */
export function loadCustomNightEnemies(): Record<CustomNightEnemyId, boolean> {
  const base = defaultCustomNightEnemies();
  try {
    const raw = localStorage.getItem('customNightEnemies');
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    for (const id of CUSTOM_NIGHT_ENEMY_ORDER) {
      if (typeof parsed[id] === 'boolean') base[id] = parsed[id];
    }
    return base;
  } catch {
    return base;
  }
}

export function saveCustomNightEnemies(state: Record<CustomNightEnemyId, boolean>): void {
  localStorage.setItem('customNightEnemies', JSON.stringify(state));
}
