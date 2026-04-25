import Phaser from 'phaser';

/**
 * Full-body gallery silhouettes (extras gallery mercs).
 * Custom Night uses dedicated art for Spy (disguise), Medic (ghost), and Pauling (jumpscare portrait).
 */
export function drawCharacterSilhouette(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  name: string,
  _color: number
): void {
    graphics.clear();
    
    switch (name) {
      case 'SCOUT':
        // Scout - lean Boston speedster with iconic look
        
        // Glow effect behind
        graphics.fillStyle(0xCC4444, 0.15);
        graphics.fillCircle(x, y, 75);
        
        // Ground shadow
        graphics.fillStyle(0x000000, 0.5);
        graphics.fillEllipse(x, y + 60, 55, 12);
        
        // Legs - athletic runner stance
        graphics.fillStyle(0x8b7355, 1); // Khaki pants
        graphics.fillRect(x - 15, y + 15, 13, 40);
        graphics.fillRect(x + 2, y + 12, 13, 43);
        // Knee wraps/tape
        graphics.fillStyle(0xcccccc, 1);
        graphics.fillRect(x - 14, y + 30, 11, 6);
        graphics.fillRect(x + 3, y + 28, 11, 6);
        
        // Running shoes - red with white
        graphics.fillStyle(0xcc2222, 1);
        graphics.fillRoundedRect(x - 18, y + 52, 18, 10, 3);
        graphics.fillRoundedRect(x + 2, y + 52, 18, 10, 3);
        graphics.fillStyle(0xffffff, 1);
        graphics.fillRect(x - 14, y + 55, 8, 3);
        graphics.fillRect(x + 6, y + 55, 8, 3);
        
        // Lean athletic torso - RED team t-shirt
        graphics.fillStyle(0xCC4444, 1);
        graphics.beginPath();
        graphics.moveTo(x - 20, y - 20);
        graphics.lineTo(x + 18, y - 20);
        graphics.lineTo(x + 15, y + 18);
        graphics.lineTo(x - 17, y + 18);
        graphics.closePath();
        graphics.fillPath();
        
        // Dog tags
        graphics.fillStyle(0x777777, 1);
        graphics.fillRect(x - 1, y - 15, 2, 20);
        graphics.fillStyle(0x999999, 1);
        graphics.fillEllipse(x, y + 7, 6, 8);
        graphics.fillEllipse(x + 2, y + 9, 6, 8);
        
        // Bandages on hands/forearms - iconic Scout look
        graphics.fillStyle(0xdddddd, 1);
        graphics.fillRect(x - 38, y + 5, 12, 18);
        graphics.fillRect(x + 26, y - 25, 12, 18);
        // Tape strips
        graphics.fillStyle(0xcccccc, 1);
        for (let i = 0; i < 4; i++) {
          graphics.fillRect(x - 37, y + 7 + i * 4, 10, 2);
          graphics.fillRect(x + 27, y - 23 + i * 4, 10, 2);
        }
        
        // Arms - RED team
        graphics.fillStyle(0xCC4444, 1);
        graphics.fillCircle(x - 22, y - 14, 10);
        graphics.fillCircle(x + 20, y - 14, 10);
        graphics.fillRect(x - 42, y - 18, 22, 12);
        graphics.fillRect(x + 18, y - 35, 12, 25);
        
        // Hands (under bandages)
        graphics.fillStyle(0xd4a574, 1);
        graphics.fillCircle(x - 35, y + 20, 8);
        graphics.fillCircle(x + 30, y - 38, 8);
        
        // Baseball bat - aluminum
        graphics.fillStyle(0xaaaaaa, 1);
        graphics.fillRect(x + 24, y - 70, 10, 50);
        graphics.fillStyle(0x888888, 1);
        graphics.fillRoundedRect(x + 22, y - 78, 14, 22, 5);
        // Grip tape
        graphics.fillStyle(0x222222, 1);
        graphics.fillRect(x + 25, y - 25, 8, 18);
        graphics.fillStyle(0xcc2222, 1);
        graphics.fillCircle(x + 29, y - 5, 5);
        
        // Head
        graphics.fillStyle(0xd4a574, 1);
        graphics.fillCircle(x, y - 40, 22);
        graphics.fillEllipse(x, y - 22, 16, 10);
        
        // Patrol cap - grey military style
        graphics.fillStyle(0x4a4a4a, 1);
        graphics.beginPath();
        graphics.arc(x, y - 48, 24, Math.PI, 0, false);
        graphics.closePath();
        graphics.fillPath();
        // Bill (facing backward/right)
        graphics.fillStyle(0x3a3a3a, 1);
        graphics.beginPath();
        graphics.moveTo(x + 24, y - 46);
        graphics.lineTo(x + 45, y - 38);
        graphics.lineTo(x + 40, y - 44);
        graphics.lineTo(x + 5, y - 46);
        graphics.closePath();
        graphics.fillPath();
        // Cap button
        graphics.fillStyle(0x555555, 1);
        graphics.fillCircle(x, y - 62, 4);
        
        // Headset
        graphics.fillStyle(0x333333, 1);
        graphics.fillRect(x + 12, y - 55, 14, 4);
        graphics.fillCircle(x + 22, y - 42, 9);
        graphics.fillStyle(0x222222, 1);
        graphics.fillCircle(x + 22, y - 42, 6);
        // Mic
        graphics.fillStyle(0x444444, 1);
        graphics.fillRect(x + 20, y - 38, 3, 20);
        graphics.fillCircle(x + 21, y - 18, 5);
        
        // No mouth - more mysterious/threatening
        
        // Intense eyes - lower on face
        graphics.fillStyle(0xff0000, 0.4);
        graphics.fillCircle(x - 8, y - 40, 8);
        graphics.fillCircle(x + 8, y - 40, 8);
        graphics.fillStyle(0xff0000, 1);
        graphics.fillCircle(x - 8, y - 40, 5);
        graphics.fillCircle(x + 8, y - 40, 5);
        graphics.fillStyle(0xffffff, 0.9);
        graphics.fillCircle(x - 10, y - 42, 2);
        graphics.fillCircle(x + 6, y - 42, 2);
        break;
        
      case 'SOLDIER':
        // Soldier - stocky American patriot with helmet and rocket launcher
        
        // Red/orange glow behind
        graphics.fillStyle(0xcc4422, 0.12);
        graphics.fillCircle(x, y, 80);
        
        // Ground shadow
        graphics.fillStyle(0x000000, 0.5);
        graphics.fillEllipse(x, y + 60, 75, 15);
        
        // Legs - wide military stance
        graphics.fillStyle(0x3a3a4a, 1);
        graphics.fillRect(x - 24, y + 22, 18, 36);
        graphics.fillRect(x + 6, y + 22, 18, 36);
        // Knee pads
        graphics.fillStyle(0x2a2a3a, 1);
        graphics.fillEllipse(x - 15, y + 32, 10, 8);
        graphics.fillEllipse(x + 15, y + 32, 10, 8);
        // Combat boots - chunky
        graphics.fillStyle(0x1a1a1a, 1);
        graphics.fillRoundedRect(x - 28, y + 52, 24, 12, 3);
        graphics.fillRoundedRect(x + 4, y + 52, 24, 12, 3);
        // Boot soles
        graphics.fillStyle(0x111111, 1);
        graphics.fillRect(x - 28, y + 62, 24, 3);
        graphics.fillRect(x + 4, y + 62, 24, 3);
        
        // Stocky military torso - RED team
        graphics.fillStyle(0xBD3B3B, 1);
        graphics.fillRoundedRect(x - 32, y - 18, 64, 45, 6);
        // Jacket center seam
        graphics.fillStyle(0x9A2A2A, 1);
        graphics.fillRect(x - 3, y - 15, 6, 40);
        // Jacket collar
        graphics.fillStyle(0x8B2222, 1);
        graphics.fillRect(x - 18, y - 20, 36, 8);
        // Chest pockets
        graphics.fillStyle(0xDD5555, 0.5);
        graphics.fillRect(x - 26, y - 8, 14, 12);
        graphics.fillRect(x + 12, y - 8, 14, 12);
        // Pocket buttons
        graphics.fillStyle(0x888866, 1);
        graphics.fillCircle(x - 19, y - 2, 2);
        graphics.fillCircle(x + 19, y - 2, 2);
        
        // Ammo pouches on belt
        graphics.fillStyle(0x4a4a3a, 1);
        graphics.fillRect(x - 30, y + 14, 14, 14);
        graphics.fillRect(x + 16, y + 14, 14, 14);
        // Pouch flaps
        graphics.fillStyle(0x3a3a2a, 1);
        graphics.fillRect(x - 30, y + 14, 14, 5);
        graphics.fillRect(x + 16, y + 14, 14, 5);
        
        // Strong arms - RED team
        graphics.fillStyle(0xBD3B3B, 1);
        graphics.fillCircle(x - 32, y - 8, 14);
        graphics.fillCircle(x + 32, y - 8, 14);
        // Left arm down at side
        graphics.fillRect(x - 44, y - 10, 16, 40);
        // Right arm up holding launcher
        graphics.fillRect(x + 28, y - 25, 16, 30);
        
        // Hands - rough military
        graphics.fillStyle(0xc49a64, 1);
        graphics.fillCircle(x - 38, y + 32, 10);
        graphics.fillCircle(x + 36, y - 28, 10);
        
        // Head (mostly hidden under helmet)
        graphics.fillStyle(0x9a8a7a, 1);
        graphics.fillCircle(x, y - 35, 20);
        // Strong jaw/chin visible
        graphics.fillStyle(0xaa9a8a, 1);
        graphics.fillEllipse(x, y - 18, 18, 12);
        // Stubble
        graphics.fillStyle(0x6a5a4a, 0.4);
        graphics.fillEllipse(x, y - 20, 16, 10);
        
        // Iconic pot helmet - covering eyes completely
        graphics.fillStyle(0x5a5a4a, 1);
        graphics.fillCircle(x, y - 44, 28);
        graphics.fillRect(x - 28, y - 44, 56, 22);
        // Helmet rim (wide brim casting shadow)
        graphics.fillStyle(0x4a4a3a, 1);
        graphics.fillRoundedRect(x - 34, y - 26, 68, 12, 3);
        // Deep shadow under helmet
        graphics.fillStyle(0x1a1a1a, 0.85);
        graphics.fillRect(x - 28, y - 20, 56, 12);
        // Helmet dent/battle damage
        graphics.fillStyle(0x3a3a2a, 1);
        graphics.fillCircle(x + 12, y - 48, 6);
        
        // Glowing menacing eyes in shadow
        graphics.fillStyle(0xff0000, 0.5);
        graphics.fillCircle(x - 11, y - 16, 10);
        graphics.fillCircle(x + 11, y - 16, 10);
        graphics.fillStyle(0xff0000, 1);
        graphics.fillCircle(x - 11, y - 16, 6);
        graphics.fillCircle(x + 11, y - 16, 6);
        graphics.fillStyle(0xffaaaa, 1);
        graphics.fillCircle(x - 11, y - 16, 3);
        graphics.fillCircle(x + 11, y - 16, 3);
        
        // ROCKET LAUNCHER - detailed
        graphics.fillStyle(0x5a5a5a, 1);
        graphics.fillRoundedRect(x + 18, y - 55, 58, 20, 4);
        // Launcher tube opening
        graphics.fillStyle(0x4a4a4a, 1);
        graphics.fillCircle(x + 76, y - 45, 14);
        graphics.fillStyle(0x333333, 1);
        graphics.fillCircle(x + 76, y - 45, 10);
        graphics.fillStyle(0x1a1a1a, 1);
        graphics.fillCircle(x + 76, y - 45, 6);
        // Sight on top
        graphics.fillStyle(0x444444, 1);
        graphics.fillRect(x + 35, y - 62, 18, 8);
        graphics.fillStyle(0x333333, 1);
        graphics.fillRect(x + 38, y - 66, 4, 6);
        // Handle grip
        graphics.fillStyle(0x4a3a2a, 1);
        graphics.fillRect(x + 32, y - 40, 10, 18);
        // Trigger guard
        graphics.fillStyle(0x3a3a3a, 1);
        graphics.fillRect(x + 28, y - 38, 6, 12);
        
        // Grenades on belt - detailed
        graphics.fillStyle(0x3a4a3a, 1);
        graphics.fillCircle(x - 22, y + 30, 8);
        graphics.fillCircle(x - 6, y + 30, 8);
        graphics.fillCircle(x + 10, y + 30, 8);
        // Grenade tops/fuses
        graphics.fillStyle(0x2a3a2a, 1);
        graphics.fillRect(x - 25, y + 22, 6, 6);
        graphics.fillRect(x - 9, y + 22, 6, 6);
        graphics.fillRect(x + 7, y + 22, 6, 6);
        // Pins
        graphics.fillStyle(0xaaaa88, 1);
        graphics.fillCircle(x - 22, y + 23, 3);
        graphics.fillCircle(x - 6, y + 23, 3);
        graphics.fillCircle(x + 10, y + 23, 3);
        graphics.fillCircle(x - 6, y + 23, 2);
        graphics.fillCircle(x + 8, y + 23, 2);
        break;
        
      case 'DEMOMAN':
        // Demoman - headless body with Eyelander + floating head
        
        // Ghostly green glow behind
        graphics.fillStyle(0x00ff44, 0.15);
        graphics.fillCircle(x, y, 90);
        graphics.fillStyle(0x00aa33, 0.1);
        graphics.fillCircle(x - 10, y + 10, 70);
        
        // Ground shadow
        graphics.fillStyle(0x000000, 0.5);
        graphics.fillEllipse(x, y + 65, 70, 14);
        
        // === HEADLESS BODY ===
        // Legs - sturdy stance
        graphics.fillStyle(0x2a2a3a, 1);
        graphics.fillRect(x - 20, y + 18, 16, 44);
        graphics.fillRect(x + 4, y + 18, 16, 44);
        // Boots
        graphics.fillStyle(0x1a1a1a, 1);
        graphics.fillRoundedRect(x - 24, y + 56, 22, 12, 3);
        graphics.fillRoundedRect(x + 2, y + 56, 22, 12, 3);
        
        // Torso - sturdy Scottish build - RED team
        graphics.fillStyle(0xBD3B3B, 1);
        graphics.fillRoundedRect(x - 28, y - 20, 56, 42, 6);
        // Vest/harness
        graphics.fillStyle(0x3a2a1a, 1);
        graphics.fillRect(x - 24, y - 15, 10, 35);
        graphics.fillRect(x + 14, y - 15, 10, 35);
        graphics.fillRect(x - 24, y - 5, 48, 8);
        // Grenade bandolier
        graphics.fillStyle(0x4a4a3a, 1);
        graphics.beginPath();
        graphics.moveTo(x - 26, y + 15);
        graphics.lineTo(x + 26, y - 12);
        graphics.lineTo(x + 26, y - 4);
        graphics.lineTo(x - 26, y + 22);
        graphics.closePath();
        graphics.fillPath();
        // Grenades/stickybombs on bandolier
        graphics.fillStyle(0x333333, 1);
        for (let i = 0; i < 5; i++) {
          const gx = x - 20 + i * 10;
          const gy = y + 10 - i * 5;
          graphics.fillCircle(gx, gy, 6);
          graphics.fillStyle(0xff3300, 1);
          graphics.fillCircle(gx, gy, 3);
          graphics.fillStyle(0x333333, 1);
        }
        
        // Arms - RED team
        graphics.fillStyle(0xBD3B3B, 1);
        graphics.fillCircle(x - 28, y - 10, 12);
        graphics.fillCircle(x + 28, y - 10, 12);
        // Left arm down
        graphics.fillRect(x - 38, y - 12, 14, 38);
        // Right arm up holding Eyelander
        graphics.fillRect(x + 24, y - 30, 14, 28);
        
        // Hands
        graphics.fillStyle(0x5a4a3a, 1);
        graphics.fillCircle(x - 34, y + 28, 10);
        graphics.fillCircle(x + 30, y - 35, 10);
        
        // === NECK STUMP (headless!) ===
        graphics.fillStyle(0x3a2a1a, 1);
        graphics.fillEllipse(x, y - 25, 18, 10);
        // Ghostly green ectoplasm dripping
        graphics.fillStyle(0x00ff44, 0.6);
        graphics.fillEllipse(x - 5, y - 22, 8, 12);
        graphics.fillEllipse(x + 6, y - 24, 6, 10);
        graphics.fillStyle(0x00ff44, 0.4);
        graphics.fillEllipse(x - 3, y - 15, 5, 8);
        
        // === EYELANDER SWORD ===
        // Blade - long and glowing
        graphics.fillStyle(0x00ff44, 0.3);
        graphics.fillRect(x + 26, y - 80, 12, 55);
        graphics.fillStyle(0x666666, 1);
        graphics.fillRect(x + 28, y - 78, 8, 50);
        // Blade edge gleam
        graphics.fillStyle(0x00ff44, 0.8);
        graphics.fillRect(x + 28, y - 78, 2, 50);
        // Blade tip
        graphics.beginPath();
        graphics.moveTo(x + 28, y - 78);
        graphics.lineTo(x + 36, y - 78);
        graphics.lineTo(x + 32, y - 88);
        graphics.closePath();
        graphics.fillStyle(0x00ff44, 0.6);
        graphics.fillPath();
        // Crossguard
        graphics.fillStyle(0x444444, 1);
        graphics.fillRect(x + 22, y - 30, 20, 6);
        // Handle
        graphics.fillStyle(0x3a2a1a, 1);
        graphics.fillRect(x + 28, y - 25, 8, 18);
        // Pommel
        graphics.fillStyle(0x555555, 1);
        graphics.fillCircle(x + 32, y - 5, 5);
        
        // === FLOATING HEAD (to the side) ===
        // Head position
        const headX = x - 45;
        const headY = y - 40;
        
        // Head (dark skin) - no green glow to avoid looking like a neck
        graphics.fillStyle(0x3a2a1a, 1);
        graphics.fillCircle(headX, headY, 26);
        // Beanie
        graphics.fillStyle(0x1a1a2a, 1);
        graphics.beginPath();
        graphics.arc(headX, headY - 6, 28, Math.PI, 0, false);
        graphics.closePath();
        graphics.fillPath();
        // Beanie fold
        graphics.fillStyle(0x2a2a3a, 1);
        graphics.fillRect(headX - 28, headY - 8, 56, 6);
        // Beard
        graphics.fillStyle(0x1a1a1a, 1);
        graphics.fillEllipse(headX, headY + 18, 28, 16);
        // Eyepatch
        graphics.fillStyle(0x111111, 1);
        graphics.fillCircle(headX + 10, headY - 2, 10);
        graphics.fillRect(headX + 8, headY - 28, 4, 26);
        // Glowing green eye
        graphics.fillStyle(0x00ff44, 0.6);
        graphics.fillCircle(headX - 10, headY - 2, 12);
        graphics.fillStyle(0x00ff44, 1);
        graphics.fillCircle(headX - 10, headY - 2, 8);
        // Eye glint
        graphics.fillStyle(0xaaffaa, 1);
        graphics.fillCircle(headX - 12, headY - 4, 3);
        break;
        
      case 'HEAVY':
        // Heavy - massive Russian weapons guy with Sasha
        
        // Red glow behind
        graphics.fillStyle(0xCC4444, 0.12);
        graphics.fillCircle(x, y, 90);
        
        // Ground shadow - very large
        graphics.fillStyle(0x000000, 0.6);
        graphics.fillEllipse(x, y + 65, 100, 20);
        
        // Thick powerful legs
        graphics.fillStyle(0x4a4a5a, 1);
        graphics.fillRect(x - 30, y + 25, 26, 38);
        graphics.fillRect(x + 4, y + 25, 26, 38);
        // Knee pads
        graphics.fillStyle(0x3a3a4a, 1);
        graphics.fillEllipse(x - 17, y + 35, 14, 10);
        graphics.fillEllipse(x + 17, y + 35, 14, 10);
        // Combat boots
        graphics.fillStyle(0x1a1a1a, 1);
        graphics.fillRoundedRect(x - 34, y + 58, 32, 12, 3);
        graphics.fillRoundedRect(x + 2, y + 58, 32, 12, 3);
        // Boot laces
        graphics.fillStyle(0x444444, 1);
        graphics.fillRect(x - 22, y + 60, 10, 2);
        graphics.fillRect(x + 12, y + 60, 10, 2);
        
        // MASSIVE barrel chest - RED team
        graphics.fillStyle(0xBD3B3B, 1);
        graphics.fillRoundedRect(x - 50, y - 30, 100, 60, 12);
        // Pec muscle definition
        graphics.fillStyle(0x9A2A2A, 0.4);
        graphics.fillEllipse(x - 22, y - 5, 22, 28);
        graphics.fillEllipse(x + 22, y - 5, 22, 28);
        
        // Vest with buckles
        graphics.fillStyle(0x8B2222, 1);
        graphics.fillRect(x - 6, y - 25, 12, 55);
        // Buckles
        graphics.fillStyle(0xaa9944, 1);
        graphics.fillRect(x - 8, y - 15, 16, 6);
        graphics.fillRect(x - 8, y + 5, 16, 6);
        graphics.fillRect(x - 8, y + 20, 16, 6);
        
        // Ammo belt - THICK diagonal
        graphics.fillStyle(0x6a5a3a, 1);
        graphics.beginPath();
        graphics.moveTo(x - 48, y + 15);
        graphics.lineTo(x + 48, y - 18);
        graphics.lineTo(x + 48, y - 5);
        graphics.lineTo(x - 48, y + 28);
        graphics.closePath();
        graphics.fillPath();
        // Brass bullets
        graphics.fillStyle(0xccaa33, 1);
        for (let i = 0; i < 9; i++) {
          const bx = x - 42 + i * 11;
          const by = y + 13 - i * 3.8;
          graphics.fillRect(bx, by, 6, 10);
          graphics.fillStyle(0xdd6633, 1);
          graphics.fillRect(bx, by + 6, 6, 4);
          graphics.fillStyle(0xccaa33, 1);
        }
        
        // HUGE arms - RED team
        graphics.fillStyle(0xBD3B3B, 1);
        // Left arm - massive bicep
        graphics.fillCircle(x - 50, y - 15, 22);
        graphics.fillRect(x - 70, y - 20, 28, 55);
        // Right arm
        graphics.fillCircle(x + 50, y - 15, 22);
        graphics.fillRect(x + 42, y - 20, 28, 50);
        
        // Meaty hands
        graphics.fillStyle(0xd4a574, 1);
        graphics.fillCircle(x - 60, y + 38, 16);
        graphics.fillCircle(x + 55, y + 32, 16);
        // Thick fingers
        graphics.fillStyle(0xc49a64, 1);
        graphics.fillCircle(x - 70, y + 35, 7);
        graphics.fillCircle(x - 52, y + 48, 6);
        graphics.fillCircle(x + 65, y + 28, 7);
        graphics.fillCircle(x + 48, y + 42, 6);
        
        // Big bald head
        graphics.fillStyle(0x8a7a6a, 1);
        graphics.fillCircle(x, y - 52, 36);
        // Face
        graphics.fillStyle(0x9a8a7a, 1);
        graphics.fillCircle(x, y - 48, 30);
        // Ears
        graphics.fillStyle(0x8a7a6a, 1);
        graphics.fillCircle(x - 34, y - 50, 12);
        graphics.fillCircle(x + 34, y - 50, 12);
        
        // 5 o'clock shadow/stubble
        graphics.fillStyle(0x5a4a3a, 0.4);
        graphics.fillEllipse(x, y - 32, 26, 18);
        
        // Heavy brow ridge
        graphics.fillStyle(0x6a5a4a, 1);
        graphics.fillRect(x - 26, y - 62, 52, 12);
        
        // Angry eyebrows - thick and furrowed
        graphics.fillStyle(0x3a2a1a, 1);
        graphics.beginPath();
        graphics.moveTo(x - 26, y - 58);
        graphics.lineTo(x - 6, y - 52);
        graphics.lineTo(x - 26, y - 52);
        graphics.closePath();
        graphics.fillPath();
        graphics.beginPath();
        graphics.moveTo(x + 26, y - 58);
        graphics.lineTo(x + 6, y - 52);
        graphics.lineTo(x + 26, y - 52);
        graphics.closePath();
        graphics.fillPath();
        
        // Glowing ANGRY red eyes
        graphics.fillStyle(0xff0000, 0.6);
        graphics.fillCircle(x - 14, y - 50, 14);
        graphics.fillCircle(x + 14, y - 50, 14);
        graphics.fillStyle(0xff0000, 1);
        graphics.fillCircle(x - 14, y - 50, 9);
        graphics.fillCircle(x + 14, y - 50, 9);
        graphics.fillStyle(0xffaaaa, 1);
        graphics.fillCircle(x - 14, y - 50, 4);
        graphics.fillCircle(x + 14, y - 50, 4);
        // Eye glints
        graphics.fillStyle(0xffffff, 0.8);
        graphics.fillCircle(x - 18, y - 54, 3);
        graphics.fillCircle(x + 10, y - 54, 3);
        
        // Wide nose
        graphics.fillStyle(0x7a6a5a, 1);
        graphics.fillEllipse(x, y - 40, 14, 10);
        
        // No mouth - more menacing
        
        // MINIGUN "SASHA" - massive and iconic
        // Main body - gunmetal grey
        graphics.fillStyle(0x555555, 1);
        graphics.fillRoundedRect(x - 72, y + 30, 135, 26, 4);
        // Barrel shroud housing
        graphics.fillStyle(0x666666, 1);
        graphics.fillRoundedRect(x - 80, y + 32, 25, 22, 3);
        // Rotating barrel cluster - 6 barrels
        graphics.fillStyle(0x4a4a4a, 1);
        graphics.fillCircle(x - 85, y + 43, 20);
        graphics.fillStyle(0x3a3a3a, 1);
        graphics.fillCircle(x - 85, y + 43, 16);
        // Individual barrels with depth
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const bx = x - 85 + Math.cos(angle) * 10;
          const by = y + 43 + Math.sin(angle) * 10;
          graphics.fillStyle(0x222222, 1);
          graphics.fillCircle(bx, by, 4);
          graphics.fillStyle(0x111111, 1);
          graphics.fillCircle(bx, by, 2);
        }
        // Center spindle
        graphics.fillStyle(0x333333, 1);
        graphics.fillCircle(x - 85, y + 43, 5);
        
        // Handle grips - ergonomic
        graphics.fillStyle(0x4a3a2a, 1);
        graphics.fillRect(x, y + 16, 16, 22);
        graphics.fillRect(x + 35, y + 20, 12, 18);
        // Grip texture lines
        graphics.fillStyle(0x3a2a1a, 1);
        for (let i = 0; i < 4; i++) {
          graphics.fillRect(x + 2, y + 18 + i * 5, 12, 2);
        }
        
        // Ammo drum/box - big and boxy
        graphics.fillStyle(0x4a4a4a, 1);
        graphics.fillRoundedRect(x + 40, y + 28, 30, 28, 5);
        graphics.fillStyle(0x3a3a3a, 1);
        graphics.fillRect(x + 45, y + 32, 20, 20);
        // Ammo belt feeding
        graphics.fillStyle(0x8b7355, 1);
        graphics.fillRect(x + 55, y + 38, 8, 4);
        graphics.fillRect(x + 60, y + 40, 4, 8);
        break;
        
      case 'SNIPER':
        // Sniper - aiming pose, rifle pointed at viewer
        
        // Eerie red glow behind - signature Sniper look
        graphics.fillStyle(0xff4444, 0.25);
        graphics.fillCircle(x, y - 10, 90);
        graphics.fillStyle(0xCC3333, 0.2);
        graphics.fillCircle(x, y - 30, 50);
        
        // Ground shadow
        graphics.fillStyle(0x000000, 0.4);
        graphics.fillEllipse(x, y + 65, 50, 10);
        
        // Tall lean legs - slightly crouched aiming stance
        graphics.fillStyle(0x4a4a3a, 1);
        graphics.fillRect(x - 16, y + 12, 14, 50);
        graphics.fillRect(x + 2, y + 12, 14, 50);
        // Knee details
        graphics.fillStyle(0x3a3a2a, 1);
        graphics.fillEllipse(x - 9, y + 26, 9, 7);
        graphics.fillEllipse(x + 9, y + 26, 9, 7);
        // Tall boots
        graphics.fillStyle(0x2a2a1a, 1);
        graphics.fillRoundedRect(x - 18, y + 54, 16, 14, 2);
        graphics.fillRoundedRect(x + 2, y + 54, 16, 14, 2);
        
        // Lean vest - body angled slightly - RED team
        graphics.fillStyle(0xBD3B3B, 1);
        graphics.beginPath();
        graphics.moveTo(x - 24, y - 28);
        graphics.lineTo(x + 20, y - 28);
        graphics.lineTo(x + 16, y + 16);
        graphics.lineTo(x - 20, y + 16);
        graphics.closePath();
        graphics.fillPath();
        // Vest details
        graphics.fillStyle(0x9A2A2A, 1);
        graphics.fillRect(x - 3, y - 25, 4, 40);
        // Shirt collar
        graphics.fillStyle(0xaa9988, 1);
        graphics.fillRect(x - 14, y - 32, 26, 6);
        
        // Arms in aiming position - both forward - RED team
        graphics.fillStyle(0xBD3B3B, 1);
        // Shoulders
        graphics.fillCircle(x - 24, y - 20, 12);
        graphics.fillCircle(x + 20, y - 20, 12);
        // Left arm - forward supporting rifle
        graphics.fillRect(x - 30, y - 24, 12, 14);
        // Right arm - back on trigger
        graphics.fillRect(x + 14, y - 24, 12, 14);
        
        // Hands gripping rifle (in front of body)
        graphics.fillStyle(0xc49a64, 1);
        graphics.fillCircle(x - 8, y - 15, 9);  // Left hand forward
        graphics.fillCircle(x + 12, y - 12, 9); // Right hand on trigger
        
        // Tall head - tilted slightly, looking down scope
        graphics.fillStyle(0xb49a7a, 1);
        graphics.fillCircle(x + 5, y - 50, 20);
        // Angular jaw
        graphics.fillStyle(0xc4aa8a, 1);
        graphics.fillEllipse(x + 5, y - 34, 15, 11);
        // Stubble
        graphics.fillStyle(0x5a4a3a, 0.5);
        graphics.fillEllipse(x + 5, y - 36, 13, 9);
        
        // SLOUCH HAT - iconic Australian style
        graphics.fillStyle(0x5a4a3a, 1);
        // Hat brim
        graphics.fillEllipse(x + 5, y - 58, 38, 10);
        // Hat crown
        graphics.fillStyle(0x4a3a2a, 1);
        graphics.fillRoundedRect(x - 12, y - 78, 34, 22, 4);
        // Hat band
        graphics.fillStyle(0x3a2a1a, 1);
        graphics.fillRect(x - 12, y - 60, 34, 5);
        // Hat dent
        graphics.fillStyle(0x3a2a1a, 1);
        graphics.fillRect(x - 3, y - 78, 16, 6);
        
        // Red visor (glowing) - spans across both eyes
        // Visor frame
        graphics.fillStyle(0x222222, 1);
        graphics.fillRoundedRect(x - 14, y - 58, 38, 14, 4);
        // Visor glass - glowing red
        graphics.fillStyle(0xff4444, 0.3);
        graphics.fillRoundedRect(x - 12, y - 56, 34, 10, 3);
        graphics.fillStyle(0xff4444, 0.7);
        graphics.fillRoundedRect(x - 10, y - 54, 30, 6, 2);
        // Bright center glow
        graphics.fillStyle(0xff4444, 1);
        graphics.fillRoundedRect(x - 6, y - 53, 22, 4, 2);
        // Outer glow effect
        graphics.fillStyle(0xff4444, 0.2);
        graphics.fillRoundedRect(x - 16, y - 60, 42, 18, 5);
        
        // Slight focused expression
        graphics.fillStyle(0x8a6a5a, 1);
        graphics.fillRect(x - 2, y - 38, 14, 2);
        
        // SNIPER RIFLE - AIMED AT VIEWER (foreshortened perspective)
        // Rifle body (short from this angle)
        graphics.fillStyle(0x3a3a3a, 1);
        graphics.fillRoundedRect(x - 18, y - 8, 36, 20, 4);
        // Stock behind (visible part)
        graphics.fillStyle(0x5a4a3a, 1);
        graphics.fillRoundedRect(x + 14, y - 4, 20, 14, 3);
        graphics.fillStyle(0x4a3a2a, 1);
        graphics.fillRect(x + 30, y - 2, 8, 10);
        
        // SCOPE - prominent, aimed at viewer
        graphics.fillStyle(0x2a2a2a, 1);
        graphics.fillCircle(x - 5, y - 22, 18);
        graphics.fillStyle(0x222222, 1);
        graphics.fillCircle(x - 5, y - 22, 14);
        // Scope lens - GLOWING RED (aimed at you!)
        graphics.fillStyle(0x1a1a1a, 1);
        graphics.fillCircle(x - 5, y - 22, 10);
        graphics.fillStyle(0xff4444, 0.4);
        graphics.fillCircle(x - 5, y - 22, 10);
        graphics.fillStyle(0xff4444, 1);
        graphics.fillCircle(x - 5, y - 22, 6);
        graphics.fillStyle(0xff8888, 1);
        graphics.fillCircle(x - 7, y - 24, 3);
        // Scope crosshair hint
        graphics.fillStyle(0x000000, 0.5);
        graphics.fillRect(x - 6, y - 28, 2, 12);
        graphics.fillRect(x - 11, y - 23, 12, 2);
        
        // Barrel - coming toward viewer (foreshortened)
        graphics.fillStyle(0x2a2a2a, 1);
        graphics.fillCircle(x - 5, y + 8, 8);
        graphics.fillStyle(0x1a1a1a, 1);
        graphics.fillCircle(x - 5, y + 8, 5);
        // Muzzle hole (dark, ominous)
        graphics.fillStyle(0x000000, 1);
        graphics.fillCircle(x - 5, y + 8, 3);
        
        // Trigger guard visible
        graphics.fillStyle(0x333333, 1);
        graphics.fillRect(x + 5, y, 8, 10);
        
        // Kukri knife on belt (iconic accessory)
        graphics.fillStyle(0x888888, 1);
        graphics.fillRect(x - 25, y + 8, 16, 4);
        graphics.fillStyle(0x4a3a2a, 1);
        graphics.fillRect(x - 28, y + 6, 5, 8);
        break;
        
      case 'PYRO':
        // Pyro - Ghostly floating gas mask with eerie fire glow
        
        // Intense fire glow behind (larger, more dramatic)
        graphics.fillStyle(0xff2200, 0.08);
        graphics.fillCircle(x, y, 90);
        graphics.fillStyle(0xff4400, 0.12);
        graphics.fillCircle(x, y, 70);
        graphics.fillStyle(0xff6600, 0.18);
        graphics.fillCircle(x, y, 50);
        graphics.fillStyle(0xff8800, 0.25);
        graphics.fillCircle(x, y, 35);
        
        // Ghostly wisps rising (fire-like)
        graphics.fillStyle(0xff6600, 0.15);
        graphics.fillEllipse(x - 25, y - 45, 12, 30);
        graphics.fillEllipse(x + 30, y - 50, 10, 25);
        graphics.fillEllipse(x + 5, y - 55, 8, 20);
        graphics.fillStyle(0xff4400, 0.1);
        graphics.fillEllipse(x - 35, y - 30, 15, 40);
        graphics.fillEllipse(x + 40, y - 35, 12, 35);
        
        // Main gas mask shape - dark silhouette
        graphics.fillStyle(0x1a1a1a, 0.95);
        graphics.fillEllipse(x, y, 55, 65);
        
        // Mask details - filter/muzzle area
        graphics.fillStyle(0x222222, 1);
        graphics.fillRoundedRect(x - 18, y + 8, 36, 28, 8);
        
        // Eye holes - glowing white with orange inner
        graphics.fillStyle(0xffffff, 0.3);
        graphics.fillCircle(x - 15, y - 12, 16);
        graphics.fillCircle(x + 15, y - 12, 16);
        graphics.fillStyle(0xffffff, 0.9);
        graphics.fillCircle(x - 15, y - 12, 12);
        graphics.fillCircle(x + 15, y - 12, 12);
        graphics.fillStyle(0xff6600, 0.9);
        graphics.fillCircle(x - 15, y - 12, 7);
        graphics.fillCircle(x + 15, y - 12, 7);
        graphics.fillStyle(0xff2200, 1);
        graphics.fillCircle(x - 15, y - 12, 4);
        graphics.fillCircle(x + 15, y - 12, 4);
        
        // Filter canister details
        graphics.fillStyle(0x333333, 1);
        graphics.fillCircle(x, y + 22, 12);
        graphics.fillStyle(0x444444, 1);
        graphics.fillCircle(x, y + 22, 8);
        // Vent lines on filter
        graphics.lineStyle(2, 0x555555, 1);
        graphics.lineBetween(x - 6, y + 18, x - 6, y + 26);
        graphics.lineBetween(x, y + 16, x, y + 28);
        graphics.lineBetween(x + 6, y + 18, x + 6, y + 26);
        
        // Straps going back (ghostly fade)
        graphics.lineStyle(4, 0x333333, 0.6);
        graphics.lineBetween(x - 28, y - 5, x - 45, y - 20);
        graphics.lineBetween(x + 28, y - 5, x + 45, y - 20);
        
        // Hood outline (very faint)
        graphics.lineStyle(2, 0x222222, 0.5);
        graphics.beginPath();
        graphics.arc(x, y - 20, 45, Math.PI + 0.3, -0.3, false);
        graphics.strokePath();
        break;

      case 'ADMINISTRATOR': {
        // TF2 Administrator (Helen): 1940s coif with center silver streak, gaunt face,
        // padded purple suit, pencil skirt, red lipstick & earrings, cigarette.
        const suitDark = 0x3a1648;
        const suitMid = 0x4e205c;
        const suitHi = 0x6b2e78;
        const hairDark = 0x100c14;
        const hairStreak = 0xd8dce8;
        const skin = 0xcab6aa;
        const skinShadow = 0x8f7d72;
        const blouse = 0xf0eaf4;

        graphics.fillStyle(_color, 0.16);
        graphics.fillCircle(x, y - 6, 80);
        graphics.fillStyle(_color, 0.08);
        graphics.fillCircle(x, y - 6, 96);

        graphics.fillStyle(0x000000, 0.45);
        graphics.fillEllipse(x, y + 58, 34, 8);

        // Pencil skirt
        graphics.fillStyle(suitDark, 1);
        graphics.beginPath();
        graphics.moveTo(x - 11, y + 6);
        graphics.lineTo(x + 11, y + 6);
        graphics.lineTo(x + 17, y + 48);
        graphics.lineTo(x - 17, y + 48);
        graphics.closePath();
        graphics.fillPath();
        graphics.fillStyle(suitMid, 0.55);
        graphics.fillRect(x - 3, y + 8, 6, 38);

        // Blazer (strong shoulders, nipped waist)
        graphics.fillStyle(suitMid, 1);
        graphics.beginPath();
        graphics.moveTo(x - 14, y + 6);
        graphics.lineTo(x - 34, y - 22);
        graphics.lineTo(x - 38, y - 32);
        graphics.lineTo(x - 30, y - 36);
        graphics.lineTo(x - 12, y - 10);
        graphics.lineTo(x - 10, y + 4);
        graphics.closePath();
        graphics.fillPath();
        graphics.beginPath();
        graphics.moveTo(x + 14, y + 6);
        graphics.lineTo(x + 34, y - 22);
        graphics.lineTo(x + 38, y - 32);
        graphics.lineTo(x + 30, y - 36);
        graphics.lineTo(x + 12, y - 10);
        graphics.lineTo(x + 10, y + 4);
        graphics.closePath();
        graphics.fillPath();
        graphics.fillStyle(suitMid, 1);
        graphics.beginPath();
        graphics.moveTo(x - 12, y + 4);
        graphics.lineTo(x - 30, y - 34);
        graphics.lineTo(x - 26, y - 40);
        graphics.lineTo(x + 26, y - 40);
        graphics.lineTo(x + 30, y - 34);
        graphics.lineTo(x + 12, y + 4);
        graphics.closePath();
        graphics.fillPath();
        graphics.fillStyle(suitHi, 0.35);
        graphics.beginPath();
        graphics.moveTo(x - 8, y - 2);
        graphics.lineTo(x - 22, y - 30);
        graphics.lineTo(x + 22, y - 30);
        graphics.lineTo(x + 8, y - 2);
        graphics.closePath();
        graphics.fillPath();

        // Blouse / collar at neckline
        graphics.fillStyle(blouse, 1);
        graphics.beginPath();
        graphics.moveTo(x - 8, y - 12);
        graphics.lineTo(x, y - 4);
        graphics.lineTo(x + 8, y - 12);
        graphics.lineTo(x + 5, y - 18);
        graphics.lineTo(x - 5, y - 18);
        graphics.closePath();
        graphics.fillPath();
        graphics.lineStyle(1.2, 0xc8c0d0, 0.9);
        graphics.beginPath();
        graphics.moveTo(x - 8, y - 12);
        graphics.lineTo(x, y - 4);
        graphics.lineTo(x + 8, y - 12);
        graphics.strokePath();

        // Gaunt face (angular jaw, high cheekbones)
        graphics.lineStyle(0, 0x000000, 0);
        graphics.fillStyle(skin, 1);
        graphics.beginPath();
        graphics.moveTo(x, y - 46);
        graphics.lineTo(x + 14, y - 40);
        graphics.lineTo(x + 16, y - 22);
        graphics.lineTo(x + 10, y - 6);
        graphics.lineTo(x + 4, y + 2);
        graphics.lineTo(x - 4, y + 2);
        graphics.lineTo(x - 10, y - 6);
        graphics.lineTo(x - 16, y - 22);
        graphics.lineTo(x - 14, y - 40);
        graphics.closePath();
        graphics.fillPath();
        graphics.fillStyle(skinShadow, 0.45);
        graphics.beginPath();
        graphics.moveTo(x - 10, y - 18);
        graphics.lineTo(x - 4, y - 8);
        graphics.lineTo(x - 12, y - 6);
        graphics.closePath();
        graphics.fillPath();
        graphics.beginPath();
        graphics.moveTo(x + 10, y - 18);
        graphics.lineTo(x + 4, y - 8);
        graphics.lineTo(x + 12, y - 6);
        graphics.closePath();
        graphics.fillPath();

        // 1940s hair volume + center silver streak (signature)
        graphics.fillStyle(hairDark, 1);
        graphics.fillEllipse(x, y - 58, 52, 36);
        graphics.fillEllipse(x - 22, y - 52, 28, 32);
        graphics.fillEllipse(x + 22, y - 52, 28, 32);
        graphics.fillEllipse(x, y - 68, 38, 22);
        graphics.fillStyle(hairStreak, 0.95);
        graphics.fillRoundedRect(x - 4, y - 72, 8, 44, 2);

        // Arched brows, narrow stern eyes
        graphics.lineStyle(2.2, hairDark, 1);
        graphics.beginPath();
        graphics.moveTo(x - 14, y - 34);
        graphics.lineTo(x - 8, y - 38);
        graphics.lineTo(x - 2, y - 34);
        graphics.strokePath();
        graphics.beginPath();
        graphics.moveTo(x + 14, y - 34);
        graphics.lineTo(x + 8, y - 38);
        graphics.lineTo(x + 2, y - 34);
        graphics.strokePath();
        graphics.fillStyle(0x1a1418, 1);
        graphics.fillEllipse(x - 8, y - 28, 9, 4);
        graphics.fillEllipse(x + 8, y - 28, 9, 4);
        graphics.fillStyle(0x2a2228, 0.85);
        graphics.fillCircle(x - 8, y - 28, 2.5);
        graphics.fillCircle(x + 8, y - 28, 2.5);

        // Red lipstick (thin, severe)
        graphics.lineStyle(0, 0x000000, 0);
        graphics.fillStyle(0x991122, 1);
        graphics.fillRect(x - 7, y - 12, 14, 3);
        graphics.fillStyle(0xcc2233, 0.85);
        graphics.fillRect(x - 5, y - 13, 10, 2);

        // Round red earrings
        graphics.fillStyle(0xb01028, 1);
        graphics.fillCircle(x - 18, y - 26, 4);
        graphics.fillCircle(x + 18, y - 26, 4);
        graphics.fillStyle(0xff3355, 0.5);
        graphics.fillCircle(x - 18, y - 26, 2);
        graphics.fillCircle(x + 18, y - 26, 2);

        // Cigarette + ember + faint smoke
        graphics.fillStyle(0xdddddd, 1);
        graphics.fillRoundedRect(x + 10, y - 22, 22, 3, 1);
        graphics.fillStyle(0xff6622, 1);
        graphics.fillCircle(x + 32, y - 21, 2);
        graphics.lineStyle(1.2, 0x888899, 0.35);
        graphics.beginPath();
        graphics.moveTo(x + 34, y - 24);
        graphics.lineTo(x + 42, y - 36);
        graphics.lineTo(x + 38, y - 44);
        graphics.strokePath();
        graphics.beginPath();
        graphics.moveTo(x + 30, y - 25);
        graphics.lineTo(x + 36, y - 34);
        graphics.lineTo(x + 32, y - 42);
        graphics.strokePath();

        graphics.lineStyle(0, 0x000000, 0);
        break;
      }

      case 'MERASMUS': {
        // TF2 Merasmus read: ram/goat skull headdress, heavy cowl, floor robes, crooked staff, sickly green magic
        const magic = 0x44ff66;
        const magicDim = 0x22aa44;
        const robe = 0x121018;
        const robeMid = 0x1c1828;
        const horn = 0x2a2420;
        const hornHi = 0x3d3834;
        const staff = 0x4a3528;
        const staffHi = 0x6a5040;

        graphics.fillStyle(magic, 0.14);
        graphics.fillCircle(x, y - 20, 88);
        graphics.fillStyle(magic, 0.08);
        graphics.fillEllipse(x, y + 10, 100, 120);

        graphics.fillStyle(0x000000, 0.45);
        graphics.fillEllipse(x, y + 62, 48, 12);

        // Robes (wide, heavy drape)
        graphics.fillStyle(robe, 1);
        graphics.beginPath();
        graphics.moveTo(x, y - 18);
        graphics.lineTo(x - 46, y + 58);
        graphics.lineTo(x + 46, y + 58);
        graphics.closePath();
        graphics.fillPath();
        graphics.fillStyle(robeMid, 0.55);
        graphics.beginPath();
        graphics.moveTo(x, y - 12);
        graphics.lineTo(x - 14, y + 50);
        graphics.lineTo(x + 14, y + 50);
        graphics.closePath();
        graphics.fillPath();

        // Cowl / shoulders hump under skull
        graphics.fillStyle(0x0e0c14, 1);
        graphics.beginPath();
        graphics.moveTo(x - 34, y - 8);
        graphics.lineTo(x - 28, y - 28);
        graphics.lineTo(x + 28, y - 28);
        graphics.lineTo(x + 34, y - 8);
        graphics.lineTo(x + 22, y + 6);
        graphics.lineTo(x - 22, y + 6);
        graphics.closePath();
        graphics.fillPath();

        // Crooked wooden staff (left of body)
        graphics.lineStyle(7, staff, 1);
        graphics.beginPath();
        graphics.moveTo(x - 52, y + 48);
        graphics.lineTo(x - 44, y + 8);
        graphics.lineTo(x - 40, y - 18);
        graphics.lineTo(x - 36, y - 48);
        graphics.strokePath();
        graphics.lineStyle(2, staffHi, 0.7);
        graphics.beginPath();
        graphics.moveTo(x - 49, y + 40);
        graphics.lineTo(x - 42, y - 5);
        graphics.lineTo(x - 38, y - 44);
        graphics.strokePath();
        graphics.lineStyle(0, 0x000000, 0);
        graphics.fillStyle(0x553322, 1);
        graphics.fillCircle(x - 36, y - 52, 5);

        // Skull base (weathered bone mass under horns)
        graphics.fillStyle(0x353028, 1);
        graphics.beginPath();
        graphics.moveTo(x - 20, y - 58);
        graphics.lineTo(x + 20, y - 58);
        graphics.lineTo(x + 22, y - 38);
        graphics.lineTo(x + 14, y - 28);
        graphics.lineTo(x - 14, y - 28);
        graphics.lineTo(x - 22, y - 38);
        graphics.closePath();
        graphics.fillPath();

        // Snout / jaw wedge
        graphics.fillStyle(0x2a2520, 1);
        graphics.beginPath();
        graphics.moveTo(x - 12, y - 32);
        graphics.lineTo(x + 12, y - 32);
        graphics.lineTo(x + 8, y - 18);
        graphics.lineTo(x, y - 14);
        graphics.lineTo(x - 8, y - 18);
        graphics.closePath();
        graphics.fillPath();

        // Large backward-curving horns (iconic TF2 read)
        graphics.fillStyle(horn, 1);
        graphics.beginPath();
        graphics.moveTo(x - 14, y - 62);
        graphics.lineTo(x - 52, y - 88);
        graphics.lineTo(x - 46, y - 94);
        graphics.lineTo(x - 10, y - 70);
        graphics.closePath();
        graphics.fillPath();
        graphics.beginPath();
        graphics.moveTo(x + 14, y - 62);
        graphics.lineTo(x + 52, y - 88);
        graphics.lineTo(x + 46, y - 94);
        graphics.lineTo(x + 10, y - 70);
        graphics.closePath();
        graphics.fillPath();
        graphics.fillStyle(hornHi, 0.35);
        graphics.beginPath();
        graphics.moveTo(x - 18, y - 64);
        graphics.lineTo(x - 44, y - 82);
        graphics.lineTo(x - 38, y - 86);
        graphics.lineTo(x - 12, y - 68);
        graphics.closePath();
        graphics.fillPath();
        graphics.beginPath();
        graphics.moveTo(x + 18, y - 64);
        graphics.lineTo(x + 44, y - 82);
        graphics.lineTo(x + 38, y - 86);
        graphics.lineTo(x + 12, y - 68);
        graphics.closePath();
        graphics.fillPath();

        // Horn ridges (segmented look)
        graphics.lineStyle(2, 0x1a1814, 0.6);
        graphics.beginPath();
        graphics.moveTo(x - 32, y - 80);
        graphics.lineTo(x - 40, y - 86);
        graphics.strokePath();
        graphics.beginPath();
        graphics.moveTo(x + 32, y - 80);
        graphics.lineTo(x + 40, y - 86);
        graphics.strokePath();
        graphics.lineStyle(0, 0x000000, 0);

        // Gaunt eye sockets / magic glow
        graphics.fillStyle(magicDim, 0.55);
        graphics.fillEllipse(x - 9, y - 44, 10, 8);
        graphics.fillEllipse(x + 9, y - 44, 10, 8);
        graphics.fillStyle(magic, 0.75);
        graphics.fillEllipse(x - 9, y - 44, 5, 4);
        graphics.fillEllipse(x + 9, y - 44, 5, 4);

        // Raised hand casting (simple claw + spark)
        graphics.fillStyle(robeMid, 1);
        graphics.fillEllipse(x + 28, y - 12, 14, 22);
        graphics.fillStyle(magic, 0.35);
        graphics.fillCircle(x + 38, y - 22, 10);
        graphics.fillStyle(magic, 0.55);
        graphics.fillCircle(x + 42, y - 26, 4);

        // Bombinomicon hint (small tome at side)
        graphics.fillStyle(0x1a1018, 1);
        graphics.fillRoundedRect(x + 24, y + 8, 14, 18, 2);
        graphics.fillStyle(0xeeddcc, 0.25);
        graphics.fillEllipse(x + 31, y + 14, 6, 5);

        graphics.fillStyle(_color, 0.1);
        graphics.fillCircle(x, y - 36, 48);
        break;
      }
    }
}
