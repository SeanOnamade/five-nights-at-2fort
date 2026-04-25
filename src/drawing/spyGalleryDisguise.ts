/** Same pool as the extras gallery Spy card — disguise silhouette + team tint. */
export type SpyGalleryDisguise = { name: string; color: number };

const SPY_GALLERY_DISGUISE_POOL: SpyGalleryDisguise[] = [
  { name: 'SCOUT', color: 0x9966cc },
  { name: 'SOLDIER', color: 0xaa5544 },
  { name: 'DEMOMAN', color: 0x44cc44 },
  { name: 'HEAVY', color: 0xaa7744 },
  { name: 'SNIPER', color: 0x5588cc },
];

export function pickRandomSpyDisguise(): SpyGalleryDisguise {
  return SPY_GALLERY_DISGUISE_POOL[Math.floor(Math.random() * SPY_GALLERY_DISGUISE_POOL.length)];
}
