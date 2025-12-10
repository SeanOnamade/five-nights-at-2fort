# Five Nights at 2Fort - AI Reference Guide

This document contains all enemy AI parameters and behaviors. **Keep this updated when changing game balance.**

---

## Night 1 Enemies

### 🔵 SCOUT
Fast attacker, LEFT door.

| Parameter | Value |
|-----------|-------|
| Path | Lobby → Staircase → Left Hall → Intel |
| Move Interval | 12 sec |
| Wait at Door | 5 sec |
| Respawn Delay | 10 sec |

**At door:**
- Wrangled sentry aimed LEFT → Repels (50 metal)
- Unwrangled sentry → Auto-defense (sentry destroyed, Scout repelled)
- No sentry → Death

---

### 🟤 SOLDIER
Slow siege attacker, RIGHT door. Fires rockets from doorway.

| Parameter | Value |
|-----------|-------|
| Path | Grate → Spiral → Right Hall → Intel |
| Move Interval | 15 sec |
| Rocket Interval | 3 sec |
| Rocket Damage | 60 HP |
| Breach Delay | 3 sec (after sentry destroyed) |
| Respawn Delay | 10 sec |

**At door:**
- With sentry: Fires rockets until destroyed, then 3 sec delay before attacking
- Without sentry: 3 sec delay, then attacks
- Can be repelled by wrangled sentry aimed RIGHT

---

## Night 2 Enemy

### 🟢 DEMOMAN
Ghostly threat with unique head/body mechanics.

| Parameter | Value |
|-----------|-------|
| Dormant Time | 20-40 sec (random) |
| Eye Warning | 3 sec |
| Charge Speed | 0.6 sec/node |
| Attack Window | 1.5 sec (1.25s glow + 0.25s body) |
| Teleport Delay | **INSTANT** after deterred |

**Path:** LOBBY → STAIRCASE → LEFT_HALL or RIGHT_HALL (based on eye)

**Head Mechanics:**
- Head appears on random camera OR in Intel room
- **Dormant:** Eyes dark, timer counting. **Watching FREEZES timer!**
- **Destroyed cameras don't count as watching!**
- **Eye glows:** Body spawns and rushes (watching does NOT stop)

**At door (1.5s window):**
- First 1.25s: Green glow approaching (visible with wrangler light)
- Last 0.25s: Body visible
- Must fire wrangled sentry at correct door or unwrangled auto-defense

---

## Night 3 Enemy

### 🔴 HEAVY
Unstoppable tank. **IMMUNE to all sentries - must be LURED!**

| Parameter | Value |
|-----------|-------|
| Spawn | 50% Bridge (left), 50% Sewer (right) |
| Move Interval | 18 sec (normal), **6 sec when LURED (3x faster!)** |
| Camera Watch | **4.5 sec** (2.25s if both Heavy+Sniper on camera) |
| Footstep Volume | 5-80% based on distance |

**Behavior:**
- Patrols slowly with audible footsteps (louder when closer)
- Cannot be stopped by any sentry - player MUST use lures
- If watched on camera too long → Destroys camera
- **Visual:** Yellow glow + eyes when lured
- Reaches Intel without lure → Death

---

## Night 3 Mechanics

### Teleporter
| Action | Effect |
|--------|--------|
| TAB on camera | Show TELEPORT button |
| Teleport | 1 sec animation, arrive in room |
| Enemy in room | Unique jumpscare death |
| Enemy approaching | 5 sec warning with growl |
| Away from Intel | **Dispenser stops generating metal!** |

### Lures
| Parameter | Value |
|-----------|-------|
| Cost | **50 metal** |
| Duration | 15 seconds |
| Max Active | 1 |
| Range | **Unlimited** (enemies hear from anywhere) |

**Usage:**
1. Teleport to distant room (Bridge, Sewer)
2. Place lure (50 metal)
3. Return to Intel
4. Play lure from camera view
5. Heavy/Sniper move toward lure at **3x speed**
6. Lure auto-consumed after 15 sec

**Note:** LOBBY and GRATE are connected - enemies can cross paths when lured!

### Camera Destruction
| Parameter | Value |
|-----------|-------|
| Watch threshold | **4.5 sec** (base) |
| Both enemies | **2.25 sec** (halved!) |
| Watch decay | 0.5x when looking away |
| Auto repair | 30 sec |
| Remote repair | 50 metal |

**Timer behavior:**
- Builds up while watching Heavy/Sniper
- **Slowly decays** when not watching (doesn't reset!)
- Quick camera flips are dangerous!

---

## Night 4 Enemy

### 🔵 SNIPER
Silent, long-range threat with laser sight.

| Parameter | Value |
|-----------|-------|
| Movement | Random teleport (no fixed path) |
| Teleport Interval | 15 sec |
| Headshot Charge | 4 sec |
| Camera Watch | **4.5 sec** |
| Respawn Delay | 10 sec |

**Shots to Repel:**
| Sentry Level | Shots Needed |
|--------------|--------------|
| L1 | **2 shots** |
| L2 | **2 shots** |
| L3 | **2 shots** |

**Never spawns in hallways** (safe spawn: Lobby, Grate, Staircase, Spiral, Bridge)

**In Hallway:**
- Bright **blue scope glow** at eye level, visible **without wrangler!**
- 4 sec to charge headshot
- First shot: Resets charge, **stays in hallway**
- Second shot: Driven away (ALL sentry levels require 2 shots)

**Lure interaction:**
- Attracted from anywhere like Heavy
- **Lure cancels charging!** Great counter.
- **Visual:** Yellow glow when lured

---

## Night 5 Enemy

### 🟤 SPY
Non-lethal saboteur. **Two modes (not both at once!):**

| Parameter | Value |
|-----------|-------|
| State Toggle | 60 sec |
| Teleport (disguise) | 8 sec |
| Sap Chance | 40% when player teleports |
| Sap Damage | 30 HP/sec |
| Sap Removal | **SPACE x2** (free!) |

**DISGUISE Mode:**
- Appears on cameras as another enemy (identical!)
- Fake watch bar for Heavy/Sniper disguise (does nothing)
- Never in doorways, never kills player

**SAPPING Mode:**
- 40% chance to sap sentry when player teleports away
- Red device with sparks on sentry
- Press SPACE twice to remove (free, no wrangler needed)

---

## Defense Mechanics

### Sentry
| Level | HP | Upgrade Cost | Sniper Repel |
|-------|-----|--------------|--------------|
| L1 | 150 | — | 2 shots |
| L2 | 180 | 200 | 2 shots |
| L3 | 216 | 200 | 2 shots |

- Build: 100 metal
- Repair: 1 metal = 1 HP (only what's needed)
- Fire: 50 metal (even with no enemy)
- Upgrade requires full HP

### Dispenser
- **7.5 metal/sec**
- Paused while: wrangler active, teleported away
- Max: 200 metal

---

## Enemy Interaction Matrix

| Enemy | Unwrangled | Wrangled L1 | Wrangled L2+ | Lure |
|-------|------------|-------------|--------------|------|
| Scout | Sentry dies, repels | 1 shot | 1 shot | — |
| Soldier | Sentry dies, repels | 1 shot | 1 shot | — |
| Demoman | Sentry dies, repels | 1 shot | 1 shot | — |
| Heavy | **NO EFFECT** | **NO EFFECT** | **NO EFFECT** | ✓ Redirects |
| Sniper | **NO EFFECT** | **2 shots** | **2 shots** | ✓ Stops charge |

---

## Victory & Rating

| Stars | Sentry Level |
|-------|--------------|
| ★☆☆ | L1 |
| ★★☆ | L2 |
| ★★★ | L3 |

---

*Last updated: Night 5 complete*
