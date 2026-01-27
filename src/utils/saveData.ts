/**
 * Save Data Management for Five Nights at 2Fort
 * 
 * Handles persistent game progress including:
 * - Night progression (sequential unlocking)
 * - Sentry destruction tracking
 * - Ending unlocks (good/bad)
 * - Custom Night access
 */

const SAVE_KEY = 'fn2f_save';

/**
 * Game save data structure (simplified)
 * 
 * hasBeatenNight5 unlocks: post-game menu, Night 6, Custom Night, ENDINGS preview
 * goodEndingAchieved: tracks if player got the good ending
 * badEndingAchieved: tracks if player completed Night 6 (gave up or died)
 */
export interface SaveData {
  currentNight: number;           // 1-6, highest unlocked night
  nightDestructions: { [night: number]: number };  // per-night best destruction counts
  hasBeatenNight5: boolean;       // true after first Night 5 win, unlocks post-game content
  goodEndingAchieved: boolean;    // true after getting the good ending
  badEndingAchieved: boolean;     // true after completing Night 6
}

/**
 * Default save data for new games
 */
const DEFAULT_SAVE: SaveData = {
  currentNight: 1,
  nightDestructions: {},
  hasBeatenNight5: false,
  goodEndingAchieved: false,
  badEndingAchieved: false,
};

/**
 * Load save data from localStorage
 * Returns null if no save exists
 */
export function loadSave(): SaveData | null {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (!saved) return null;
    
    const data = JSON.parse(saved) as Partial<SaveData>;
    
    // Merge with defaults to handle missing fields from older saves
    return {
      ...DEFAULT_SAVE,
      ...data,
    };
  } catch (e) {
    console.error('Failed to load save:', e);
    return null;
  }
}

/**
 * Save game data to localStorage
 */
export function saveSave(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save game:', e);
  }
}

/**
 * Create a new save (New Game)
 */
export function createNewSave(): SaveData {
  const newSave = { ...DEFAULT_SAVE };
  saveSave(newSave);
  return newSave;
}

/**
 * Delete save data (used when starting New Game over existing save)
 */
export function deleteSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    console.error('Failed to delete save:', e);
  }
}

/**
 * Check if a save exists
 */
export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

/**
 * Calculate total destructions from per-night data
 */
export function calculateTotalDestructions(nightDestructions: { [night: number]: number }): number {
  return Object.values(nightDestructions).reduce((sum, count) => sum + count, 0);
}

/**
 * Update save after winning a night
 * @param nightWon - The night that was just completed (1-5)
 * @param sessionDestructions - How many times sentry was destroyed this night
 * @returns Updated save data and whether bad ending was triggered
 */
export function updateSaveOnVictory(
  nightWon: number,
  sessionDestructions: number
): { save: SaveData; triggeredBadEnding: boolean; triggeredGoodEnding: boolean } {
  let save = loadSave() || createNewSave();
  
  // Ensure nightDestructions exists (for older saves)
  if (!save.nightDestructions) {
    save.nightDestructions = {};
  }
  
  // Only update this night's count if it's better (lower) than before, or first time
  const previousCount = save.nightDestructions[nightWon];
  if (previousCount === undefined || sessionDestructions < previousCount) {
    save.nightDestructions[nightWon] = sessionDestructions;
  }
  
  // Calculate total destructions
  const totalDestructions = calculateTotalDestructions(save.nightDestructions);
  
  // Unlock next night (if not already higher) - only for first playthrough
  if (nightWon < 6 && nightWon >= save.currentNight) {
    save.currentNight = nightWon + 1;
  }
  
  let triggeredBadEnding = false;
  let triggeredGoodEnding = false;
  
  // Mark Night 5 as beaten (unlocks all post-game content)
  if (nightWon === 5) {
    save.hasBeatenNight5 = true;
    
    // Check ending conditions after Night 5 (only trigger endings the first time)
    if (totalDestructions >= 5 && !save.goodEndingAchieved) {
      // Bad ending path - go to Night 6 (only if never got good ending)
      save.currentNight = 6;
      triggeredBadEnding = true;
    } else if (totalDestructions < 5 && !save.goodEndingAchieved) {
      // Good ending path (first time achieving it)
      triggeredGoodEnding = true;
      save.goodEndingAchieved = true;
    }
    // else: already got good ending, just normal victory
  }
  
  saveSave(save);
  return { save, triggeredBadEnding, triggeredGoodEnding };
}

/**
 * Update save after completing Night 6 (bad ending - gave up or died)
 */
export function updateSaveOnNight6Complete(): SaveData {
  let save = loadSave() || createNewSave();
  
  save.badEndingAchieved = true;
  
  saveSave(save);
  return save;
}

/**
 * Unlock everything via developer password
 */
export function unlockEverything(): SaveData {
  let save = loadSave() || createNewSave();
  
  save.hasBeatenNight5 = true;  // Unlocks post-game menu, Night 6, Custom Night
  save.currentNight = 6;
  save.goodEndingAchieved = true;  // Mark both endings as complete for dev mode
  save.badEndingAchieved = true;
  
  saveSave(save);
  return save;
}

