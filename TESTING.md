# Testing Guide - Five Nights at 2Fort

This document outlines all the testing scenarios for the game.

## Quick Start - Developer Mode

**Type `2FORT` on the main menu** to unlock everything instantly:
- All nights selectable
- Custom Night available
- Night 6 accessible
- Endings preview menu (click "ENDINGS" button)

---

## Core Gameplay Testing

### Night 1: Scout & Soldier
- [ ] Scout appears from LEFT hallway after ~15-20 seconds
- [ ] Soldier appears from RIGHT hallway
- [ ] Wrangler OFF: Sentry auto-defends (destroys itself)
- [ ] Wrangler ON + aim LEFT: Fire to ward off Scout
- [ ] Wrangler ON + aim RIGHT: Fire to ward off Soldier
- [ ] Soldier rockets damage sentry when not wrangled
- [ ] Game Over if enemy reaches Intel with no sentry

### Night 2: + Demoman
- [ ] Demoman head appears on camera
- [ ] Watching head on camera freezes the timer
- [ ] Eye glows red when body is about to charge
- [ ] Body appears at correct doorway (LEFT or RIGHT)
- [ ] Must fire at body to ward off
- [ ] Pyro vacates hallway for Demoman when approaching

### Night 3: + Heavy & Teleporter
- [ ] Teleporter unlocks (TAB to view cameras, click room to teleport)
- [ ] Teleporting costs 50 metal
- [ ] Heavy appears and cannot be damaged by sentry
- [ ] Placing lure in Heavy's current room makes him chase it
- [ ] Heavy kills player if reaches Intel (unstoppable)
- [ ] Dispenser pauses while teleported

### Night 4: + Sniper & Spy
- [ ] Sniper laser visible in hallway (even without wrangler!)
- [ ] Sniper charging shown via screen tint
- [ ] 2 wrangler shots required to repel Sniper
- [ ] Lure can attract Sniper away
- [ ] Spy disguises appear on cameras (different each hour)
- [ ] Spy sapping mode: Teleporting away triggers sapper
- [ ] Sapper drains sentry HP - press SPACE x2 quickly to remove
- [ ] Spy mode alternates hourly (disguise ↔ sapping)

### Night 5: + Pyro
- [ ] Pyro invisible on cameras (crackling sound only)
- [ ] Pyro room mode: Floats between rooms
- [ ] Shining wrangler light in hallway repels Pyro
- [ ] Pyro Intel mode: Match lights = 10 second countdown
- [ ] Must teleport away before match expires
- [ ] Pyro REFLECTS sentry rockets (destroys sentry!)
- [ ] Don't fire while Pyro is in doorway

---

## Progression System Testing

### Sentry Destruction Tracking
- [ ] Sentry destruction counted when HP hits 0
- [ ] Count is PER NIGHT (not cumulative)
- [ ] Replaying a night only saves if fewer destructions (improvement)
- [ ] Total destructions = sum of best runs per night

### Night Unlock Flow
- [ ] New game starts at Night 1 only
- [ ] Beating Night 1 unlocks Night 2, etc.
- [ ] Beating Night 5 unlocks night selection menu
- [ ] Night selection shows destruction-based colors:
  - **Green** = 0 destructions
  - **Red** = 1+ destructions
  - **Gold (pulsing)** = Night 5 when total < 5

### Ending Conditions (After Night 5)
- [ ] Total destructions < 5 → Good Ending triggered
- [ ] Total destructions >= 5 → Bad Ending path (Night 6 unlocks)
- [ ] Can replay nights to reduce destruction count
- [ ] Night 5 button glows gold when good ending becomes available

---

## Endings Testing

### Good Ending
- [ ] Triggers when total destructions < 5 after Night 5
- [ ] Shows celebration scene with all mercs
- [ ] Credits roll
- [ ] Triumphant sound effect plays
- [ ] Game marked as completed
- [ ] Custom Night unlocks

### Bad Ending Intro
- [ ] Triggers when total destructions >= 5 after Night 5
- [ ] Shows "Medic Gone Mad" cinematic
- [ ] Ominous sound effect plays
- [ ] Night 6 unlocks

### Night 6 (Bad Ending - Endless Survival)
- [ ] All enemies active + Medic force-enabled
- [ ] Night does NOT end at 6 AM
- [ ] Bell chimes at 6 AM but night continues
- [ ] HUD shows "DAY 7 - 6 AM" format after first 6 AM
- [ ] Day counter increments at each midnight
- [ ] Difficulty increases each hour after 6 AM:
  - Scout/Soldier faster spawn/move timers
  - Demoman timer multiplier increases
  - Pyro teleports more frequently
  - Heavy/Sniper move faster
- [ ] Medic ghost apparition appears randomly in doorways
- [ ] Ghost scream plays when apparition appears
- [ ] Shining light on ghost makes it vanish (scream stops)
- [ ] Ghost is translucent, harmless, just psychological

### Night 6 - Give Up & Dark Ending
- [ ] Pause menu has "GIVE UP" button
- [ ] Give up sound plays (melancholic)
- [ ] Dark ending screen shows:
  - "THE END"
  - Survival time (days, hours, minutes)
  - "but at what cost?"
  - Engineer silhouette
- [ ] Dark ending sound plays (unless gave up)
- [ ] Game marked as completed

---

## Endings Preview (Dev Tool)

After completing game OR using dev password:
- [ ] "ENDINGS" button appears on main menu
- [ ] Good Ending preview plays sound + shows celebration
- [ ] Bad Ending Intro preview plays sound + shows cinematic
- [ ] Dark Ending preview shows survival stats screen
- [ ] Close button returns to menu

---

## Custom Night Testing

- [ ] Available after any ending OR dev password
- [ ] All enemy toggles work (on/off)
- [ ] Medic toggle enables Übercharge mechanic
- [ ] Start button begins custom configuration
- [ ] Übered enemies glow blue and are immune to sentry

---

## Save System Testing

### New Game
- [ ] "NEW GAME" clears existing save
- [ ] Confirmation prompt if save exists
- [ ] Starts fresh at Night 1

### Continue
- [ ] "CONTINUE" loads saved progress
- [ ] Shows correct night number
- [ ] Preserves destruction counts per night

### Post-Night 5 Menu
- [ ] Night selection visible after beating Night 5
- [ ] Shows status: "Total destructions: X/5"
- [ ] Indicates if good ending is available

### Dev Password
- [ ] Type `2FORT` on main menu
- [ ] Confirmation sound/visual
- [ ] All nights unlocked
- [ ] Custom Night unlocked
- [ ] Night 6 accessible
- [ ] Endings menu available

---

## Audio Testing

- [ ] Background static/ambient sound
- [ ] Enemy approach sounds
- [ ] Sentry firing sound
- [ ] Victory chime (6 AM)
- [ ] 6 AM bell chimes (Night 6 endless)
- [ ] Medic ghost scream (jarring, lasts full duration)
- [ ] Ghost scream stops when light hits ghost
- [ ] Give up sound (melancholic minor progression)
- [ ] Good ending sound (triumphant fanfare)
- [ ] Bad ending intro sound (ominous drone)
- [ ] Dark ending sound (melancholic melody)

---

## UI/UX Testing

### HUD Elements
- [ ] Time display (12 AM - 6 AM)
- [ ] Night 6 endless: "DAY X - Y AM" format
- [ ] Metal counter
- [ ] Sentry HP bar
- [ ] Sentry level indicator
- [ ] Wrangler status

### Pause Menu
- [ ] ESC or pause button opens menu
- [ ] Resume works
- [ ] Quit returns to main menu
- [ ] Night 6 shows "GIVE UP" button

### Mobile Support
- [ ] Touch controls work
- [ ] Aim by holding edges
- [ ] Tap sentry to fire
- [ ] On-screen buttons functional

---

## Edge Cases

- [ ] Lose on Night 1 - proper game over
- [ ] Win Night 5 with exactly 5 destructions → Bad ending
- [ ] Win Night 5 with exactly 4 destructions → Good ending
- [ ] Replay night and do WORSE - count should NOT update
- [ ] Replay night and do BETTER - count SHOULD update
- [ ] Browser refresh maintains save
- [ ] Clear localStorage removes save

---

## Performance

- [ ] Stable 60 FPS on desktop
- [ ] No memory leaks after multiple nights
- [ ] Smooth transitions between scenes
- [ ] Audio doesn't overlap incorrectly

---

## Regression Checklist

After any code change, verify:
1. [ ] Can start new game
2. [ ] Can beat Night 1
3. [ ] Save persists across refresh
4. [ ] All enemy types spawn correctly
5. [ ] Both endings are reachable
6. [ ] Dev password still works
