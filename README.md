# Five Nights at 2Fort

A TF2-inspired FNAF-style horror/strategy game built with Phaser 3 and TypeScript.

Survive five nights as an Engineer defending the Intel Room from zombified TF2 mercenaries. Use your sentry, wrangler, cameras, and wits to make it to 6 AM!

## Play Now

https://five-nights-at-2fort.vercel.app/

OR

```bash
npm install
npm run dev
```

Then open http://localhost:3000 in your browser.

## How to Play

### Objective
Survive from 12:00 AM to 6:00 AM (6 real-time minutes per night). Defend the Intel Room from enemies approaching through two hallways.

### Controls

**Desktop:**
| Key | Action |
|-----|--------|
| F | Toggle Wrangler ON/OFF |
| A / D | Aim sentry LEFT / RIGHT (hold) |
| SPACE | Fire wrangled sentry (50 metal) |
| TAB | Toggle camera view |
| R | Build / Repair / Upgrade sentry |

**Mobile:**
- Hold left/right edges to aim
- Tap sentry to fire
- Use on-screen buttons for cameras and actions

### Mechanics

**Sentry:**
- Wrangler ON → You manually aim and fire
- Wrangler OFF → Auto-defends but is destroyed in the process
- No sentry = instant death if an enemy reaches you

**Dispenser:**
- Generates 7.5 metal per second (max 200)
- Paused while wrangler is aimed or when teleported

**Star Rating:**
| Stars | Condition |
|-------|-----------|
| ★☆☆ | Win with Level 1 sentry |
| ★★☆ | Win with Level 2 sentry |
| ★★★ | Win with Level 3 sentry |

## Night Progression

### Night 1: Scout & Soldier
- **Scout** - Fast attacker from the LEFT hallway
- **Soldier** - Slow siege attacker from the RIGHT (fires rockets at your sentry)

### Night 2: + Demoman
- **Demoman** - Ghostly head appears on cameras. Watch it to freeze the timer! When the eye glows, the body charges. Fire at the correct door.

### Night 3: + Heavy & Teleporter
- **Heavy** - Unstoppable tank. Cannot be warded off with sentry - must be LURED away!
- **Teleporter** - Travel to distant rooms to place lures (50 metal)
- **Lures** - Attract Heavy (and later Sniper) away from Intel

### Night 4: + Sniper & Spy
- **Sniper** - Long-range threat with charging headshot. 2 wrangler shots to repel, or use lures
- **Spy** - Two modes that alternate by the hour:
  - *Disguise*: Appears as other enemies on cameras (harmless)
  - *Sapping*: Saps your sentry when you teleport away (press SPACE x2 to remove)

### Night 5: + Pyro
- **Pyro** - Invisible on cameras (listen for crackling). 
  - *Room mode*: Floats between rooms. Shine light in hallway to repel
  - *Intel mode*: Match ignites = 10 seconds to teleport away!
  - WARNING: Pyro reflects rockets fired by the sentry, destroying it!

## Two Endings

Your performance across all five nights determines your fate:

### Good Ending
If your sentry is destroyed **fewer than 5 times** across Nights 1-5:
- Peaceful ending with all mercs celebrating together
- The nightmare is over. You held the line.

### Bad Ending
If your sentry is destroyed **5 or more times** across Nights 1-5:
- The constant destruction has driven Medic mad
- He's become one of the monsters
- You must survive **Night 6** against ALL enemies + Medic
- A darker conclusion awaits...

## Post-Game Content

### Night Selection & Replay
After beating Night 5, all nights become selectable:
- **Green** nights = 0 sentry destructions (perfect!)
- **Red** nights = 1+ sentry destructions (can replay to improve)
- **Gold** Night 5 = Total destructions < 5, good ending available!

Replay red nights to lower your destruction count and unlock the good ending.

### Custom Night
After completing the game (either ending), Custom Night unlocks:
- Toggle any combination of enemies
- **Medic** - Übercharges Scout/Soldier/Demoman, making them immune to sentry fire

## Developer Mode

Type `2FORT` on the main menu to unlock everything:
- All nights selectable
- Custom Night available
- Night 6 (bad ending path) accessible
- Endings preview menu

## Enemies at a Glance

| Enemy | Night | Threat | Counter |
|-------|-------|--------|---------|
| Scout | 1 | Fast left approach | Wrangler left / auto-defense |
| Soldier | 1 | Rockets from right | Wrangler right / auto-defense |
| Demoman | 2 | Charging ghost | Watch head, fire when eye glows |
| Heavy | 3 | Unstoppable tank | Lure only (no sentry damage) |
| Sniper | 4 | Headshot charger | 2 shots or lure |
| Spy | 4 | Saboteur | Remove sappers (SPACE x2) |
| Pyro | 5 | Invisible stalker | Light/teleport (don't shoot!) |
| Medic | C | Übercharges others | Teleport before Übered attack |

## Tech Stack

- **Phaser 3** - Game framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast development server and bundler

## Project Structure

```
src/
├── main.ts           # Entry point, game config
├── scenes/
│   ├── BootScene.ts  # Main menu, night selection, save/load
│   └── GameScene.ts  # Core gameplay, endings
├── entities/
│   ├── EnemyBase.ts  # Abstract enemy class
│   ├── ScoutEnemy.ts
│   ├── SoldierEnemy.ts
│   ├── DemomanEnemy.ts
│   ├── HeavyEnemy.ts
│   ├── SniperEnemy.ts
│   ├── SpyEnemy.ts
│   ├── PyroEnemy.ts
│   └── MedicEnemy.ts
├── types/
│   └── index.ts      # Type definitions, constants
├── utils/
│   ├── mobile.ts     # Mobile detection utilities
│   └── saveData.ts   # Save/load, progression tracking
└── docs/
    └── AI_REFERENCE.md  # Detailed enemy parameters
```

## Building for Production

```bash
npm run build
npm run preview
```

The production build outputs to `dist/`.

## Credits

Inspired by:
- **Five Nights at Freddy's** by Scott Cawthon
- **Team Fortress 2** by Valve

---

*Good luck, Engineer. Keep that sentry standing. The fate of 2Fort depends on it.*
