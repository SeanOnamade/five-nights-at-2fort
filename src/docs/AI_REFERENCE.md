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
| Sap Chance | **100%** when player teleports |
| Sap Damage | 30 HP/sec |
| Sap Removal | **SPACE x2** (free!) |

**DISGUISE Mode:**
- Appears on cameras as another enemy (identical!)
- Fake watch bar for Heavy/Sniper disguise (does nothing)
- Never in doorways, never kills player

**SAPPING Mode:**
- **Always** saps sentry when player teleports away (if in SAPPING state)
- Red device with sparks on sentry
- Press SPACE twice to remove (free, no wrangler needed)

---

## Custom Night Enemy

### 🔥 PYRO
Ghostly, invisible menace. **CUSTOM NIGHT ONLY - Very difficult!**

| Parameter | Value |
|-----------|-------|
| Mode Toggle | 45 sec |
| Room Teleport | 7 sec |
| Intel Escape Time | **10 sec** |
| Intel Spawn Chance | 30% per check |
| Always starts in | ROOM mode |

**Two modes (alternates every 45 sec):**

**ROOM Mode:**
- Teleports rapidly between all rooms (including hallways)
- **Invisible on cameras** - only heard as crackling/burning sound!
- Teleporting to Pyro's room = **instant death**
- In hallways: **floating Pyro mask** visible with wrangler light
- **Firing sentry at Pyro = SENTRY DESTROYED** (reflected attack!)

**INTEL Mode:**
- Has 30% chance to appear in Intel room (when player is there)
- **Match igniting sound** warns player
- Player has **10 seconds** to teleport away or die
- After escaping, Pyro despawns and mode continues
- Cannot appear if player is already teleported away

**Counters:**
- Listen for burning sound on cameras to track Pyro's room
- Check hallways with wrangler light before firing
- Be ready to teleport immediately when match lights
- **Lures have NO EFFECT** on Pyro

**Repel Reward:**
- Driving Pyro away with wrangler light gives **+20 metal**
- (Compensates for 1.5s of lost dispenser time + 10 bonus)

---

### 💉 MEDIC
Support enemy that makes others invincible via Übercharge. **CUSTOM NIGHT ONLY**

| Parameter | Value |
|-----------|-------|
| Target Selection | Every 60 sec (1 in-game hour) |
| Valid Targets | Scout, Soldier, Demoman only |
| Visibility | **NEVER visible** - only Übered enemy has blue glow |

**LORE:**
- Medic worked with Engineer on a cure for the zombified mercenaries
- Engineer watched at night while Medic slept (and vice versa during the day)
- When Medic turned, his Übercharge now makes enemies unstoppable

**Mechanics:**
- Picks a random target (Scout, Soldier, or Demoman) at night start
- Target has **blue glow** on cameras and in doorways
- Demoman's head also has blue glow when Übered
- Stays with target until their first attack resolves
- After attack, waits 60 sec then picks new target

**Übered Enemy Behavior:**
| Enemy | Normal | Übered |
|-------|--------|--------|
| Scout | Repelled by sentry | **CANNOT BE REPELLED** |
| Soldier | Repelled by sentry | **CANNOT BE REPELLED** (still fires rockets) |
| Demoman | Watching freezes, repelled by sentry | Watching freezes, **CANNOT BE REPELLED** |

**When Übered enemy reaches door:**
- **Player in Intel:** DEATH (cannot repel with sentry!)
- **Player teleported away:** Enemy retreats, sentry destroyed, Medic picks new target next hour

**Escape mechanic:**
- If Übered enemy is waiting at door and player teleports away → Enemy immediately leaves
- Soldier stops rockets and leaves immediately when Übered and player teleports

**Visual indicators:**
- Blue glow around Übered enemy on cameras
- Blue door highlighting when Übered enemy at door
- Demoman's eye glows **blue** instead of green when Übered
- Enemy label shows "(Ü)" on camera (e.g., "SCOUT(Ü)")

**Counters:**
- Watch for blue glow on cameras to identify Übered enemy
- Teleport away BEFORE Übered enemy reaches door
- You will lose your sentry, but survive
- Medic requires Scout, Soldier, or Demoman to be enabled to function

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

| Enemy | Unwrangled | Wrangled L1 | Wrangled L2+ | Lure | Übered |
|-------|------------|-------------|--------------|------|--------|
| Scout | Sentry dies, repels | 1 shot | 1 shot | — | **IMMUNE** |
| Soldier | Sentry dies, repels | 1 shot | 1 shot | — | **IMMUNE** |
| Demoman | Sentry dies, repels | 1 shot | 1 shot | — | **IMMUNE** |
| Heavy | **NO EFFECT** | **NO EFFECT** | **NO EFFECT** | ✓ Redirects | N/A |
| Sniper | **NO EFFECT** | **2 shots** | **2 shots** | ✓ Stops charge | N/A |
| Pyro | **N/A** | **SENTRY DESTROYED** | **SENTRY DESTROYED** | **NO EFFECT** | N/A |
| Spy | **N/A** | **N/A** | **N/A** | **NO EFFECT** | N/A |
| Medic | *Support only - never attacks* | — | — | — | — |

---

## Victory & Rating

| Stars | Sentry Level |
|-------|--------------|
| ★☆☆ | L1 |
| ★★☆ | L2 |
| ★★★ | L3 |

---

*Last updated: Spy sap 100%, Pyro repel +20 metal*
