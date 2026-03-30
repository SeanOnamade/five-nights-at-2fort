# Future Ideas

Design ideas discussed for TwoFort Nights. These are not committed plans — they're directions worth exploring.

---

## New Enemy: Grey Mann — Dispenser Siphon

Grey Mann exploits the chaos of the infection to siphon metal from the dispenser for his robot army. He operates remotely (never physically present) and targets the one system no current enemy threatens: the metal economy.

**Mechanic — MvM Bomb:**
- Grey Mann periodically sends a robot icon that advances along a small progress bar near the dispenser
- If a robot reaches the end, metal regeneration drops one tier: 7.5 -> 5 -> 2.5 -> 0 metal/sec
- Each missed robot drops one tier; stopping a robot bumps back up one tier
- Player clicks the dispenser (a quick "wrench hit") to destroy the incoming robot
- Requires being in Intel, not in cameras, not aiming the wrangler
- Robot send rate increases over the night and with difficulty
- Can't interact with dispenser while teleported — robots advance unopposed

**Sound Design:**
- The existing dispenser hum changes as metal production degrades
- Stuttering, grinding, pitch drops at lower tiers
- Silence at zero production
- The player hears degradation before they see it

**Counterplay differentiation from Spy sap:**
- Spy sap = immediate crisis (sentry HP draining, quick double-Space to remove)
- Grey Mann = slow squeeze (gradual economy strangulation, periodic single clicks to maintain)
- Both active simultaneously forces a prioritization call

**Lore:** Grey Mann is the vulture, not the wolf. He's not behind the infection — he's opportunistically exploiting it to fund his robot army while Engineer's base is weakened.

**Role:** The "music box" of the game — a periodic background task that punishes neglect with escalating consequences.

---

## New Enemy: Merasmus — Teleporter Ward

TF2's chaos wizard places magical wards on the teleporter, forcing the player to complete a brief challenge before teleporting back to Intel.

**Mechanic — Memory Sequence:**
- When active, attempting to teleport triggers a quick memory sequence (e.g., repeat a flashed pattern of 3-5 symbols)
- Completing it correctly lets you teleport; failing wastes time and you must retry
- 3-5 seconds when calm, much longer under panic
- The real threat: burning precious seconds while Soldier sieges, sentry gets sapped, dispenser drains

**Why Merasmus fits:**
- He's TF2's wizard known for annoying, arbitrary magical obstacles
- Fills the "chaos/disruption" niche no current enemy covers
- A skill test, not luck — punishes panic, not randomness
- Thematically perfect as a magical ward on the teleporter

**Avoid:** Rock-paper-scissors (pure luck) or tic-tac-toe (solvable/rote). The challenge should be simple under calm conditions but error-prone under pressure.

---

## Night Reordering (Potential)

Current order introduces two enemies simultaneously on Nights 3 and 4. A smoother curve would introduce one per night:

| Night | Current | Proposed Alternative |
|-------|---------|---------------------|
| 1 | Scout + Soldier | Scout + Soldier (unchanged) |
| 2 | +Demoman | +Demoman (unchanged) |
| 3 | +Heavy + Teleporter | +Spy (non-lethal, soft intro; teleporter debuts here) |
| 4 | +Sniper + Spy | +Heavy (sole focus on lure system, teleporter already known) |
| 5 | +Pyro | +Sniper (camera danger lesson after 2 nights of camera reliance) |
| 6 | Medic, Administrator | +Pyro (instinct-breaker, still late) |

**Trade-off:** Smoother learning curve but pushes the full roster further out. The current order does work — double introductions are common in FNAF (Night 3 of FNAF 1). It's a question of steeper vs. gentler curve.

---

## Audio-as-Information Design Direction

Since Spy makes visual information unreliable (disguises on cameras), audio could serve as the trustworthy counter-channel:

- Enemies could have distinct audio signatures that help verify camera info
- Heavy's footsteps already scale with proximity; other enemies could have similar cues
- Merasmus's chaos would be scarier if he could also disrupt audio
- FNAF 4's listening-at-doors mechanic (detecting breathing via headphones) is one of the most immersive ideas in the franchise — worth studying

---

## Medic's Research Notes (Collectible Logs)

Already outlined in ENGINEER_RECORDINGS.md. Short recordings or text logs found by teleporting to specific rooms:

- Heavy's Room: emotional memory persists despite neural degradation
- Sniper's Position: Patient Zero identified, timeline correlates with Administrator's mission
- Demoman Analysis: the Eyelander exhibits impossible spatial displacement properties

These would add lore depth and reward exploration of the teleporter system.

---

## Ms. Pauling — Vent Infiltrator (Implemented)

Pauling crawls silently through a 6-node U-shaped vent system toward the Intel room. Custom Night only.

**Vent layout:** VENT_ENTRY -> VENT_MID -> VENT_JUNCTION -> (VENT_LEFT -> VENT_LEFT_OPENING) or (VENT_RIGHT -> VENT_RIGHT_OPENING)

**Mechanics:**
- Completely silent — no audio cues. The only way to track her is via the vent camera tab (CAMS/VENTS toggle)
- Moves at Scout-like speed with randomized intervals between nodes
- At the junction, picks left or right randomly
- At an unsealed opening: 1.5-second pry window before dropping in (game over)
- If sealed: reroutes back to junction, picks again (can retry same side)
- Player can only seal one vent at a time; sealing auto-opens the other

**Thermostat system:**
- Single thermostat builds heat while any seal is closed, drains when both are open
- If thermostat maxes out, Pyro instantly appears and kills you
- Independent of Pyro's normal ROOM/INTEL behavior — they're separate threat vectors
- Creates a three-way tension: Pauling forces seals, seals build heat, heat summons Pyro

---

## Mechanics from FNAF Worth Studying

- **Global background resource drain (FNAF 1 power):** Grey Mann's dispenser siphon could serve this role — if he periodically hits the dispenser throughout the night, metal reserves trend downward, creating late-night desperation
- **Non-lethal system disruptions (FNAF 3 phantoms):** Merasmus fits perfectly — curses that cause temporary system malfunctions without being lethal
- **Risk-reward optional actions (Pizzeria Simulator salvage):** Optional high-risk actions like teleporting to a dangerous room for bonus metal, or overclocking the sentry for increased fire rate but noise
- **"Don't forget about me" maintenance tasks (FNAF 2 music box):** Grey Mann as the recurring background drain that punishes neglect

---

*Last updated: March 2026 — Administrator rename, Grey Mann, Merasmus concepts, Pauling vent system implemented*
