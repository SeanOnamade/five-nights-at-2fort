import Phaser from 'phaser';

/**
 * Draw red Über glow effect for Medic's Übercharge
 * Creates a pulsing red aura around the target position
 */
export function drawUberGlow(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
  graphics.clear();
  graphics.setPosition(x, y);
  
  // Outer glow ring (faint)
  graphics.fillStyle(0xff4444, 0.15);
  graphics.fillCircle(0, 0, 120);
  
  // Middle glow ring
  graphics.fillStyle(0xff4444, 0.25);
  graphics.fillCircle(0, 0, 90);
  
  // Inner glow ring (brightest)
  graphics.fillStyle(0xff6666, 0.35);
  graphics.fillCircle(0, 0, 60);
  
  // Core glow
  graphics.fillStyle(0xff8888, 0.2);
  graphics.fillCircle(0, 0, 40);
  
  // Draw Medic ghost hovering over enemy's shoulder (upper right)
  const ghostX = 50;  // Offset to the right
  const ghostY = -70; // Offset up (above shoulder)
  
  // Ghost outer glow
  graphics.fillStyle(0xff4444, 0.15);
  graphics.fillCircle(ghostX, ghostY, 35);
  
  // Ghost body (translucent red)
  graphics.fillStyle(0xff4444, 0.4);
  // Head
  graphics.fillCircle(ghostX, ghostY - 10, 12);
  // Body (triangle shape)
  graphics.beginPath();
  graphics.moveTo(ghostX - 15, ghostY + 5);
  graphics.lineTo(ghostX + 15, ghostY + 5);
  graphics.lineTo(ghostX + 10, ghostY + 35);
  graphics.lineTo(ghostX - 10, ghostY + 35);
  graphics.closePath();
  graphics.fill();
  
  // Medic cross on chest
  graphics.fillStyle(0xffffff, 0.6);
  graphics.fillRect(ghostX - 2, ghostY + 10, 4, 12);
  graphics.fillRect(ghostX - 5, ghostY + 14, 10, 4);
  
  // Ghost eyes (glowing)
  graphics.fillStyle(0xff8888, 0.8);
  graphics.fillCircle(ghostX - 4, ghostY - 12, 3);
  graphics.fillCircle(ghostX + 4, ghostY - 12, 3);
  
  // Ghostly trail/wisp effect below
  graphics.fillStyle(0xff4444, 0.2);
  graphics.beginPath();
  graphics.moveTo(ghostX - 8, ghostY + 35);
  graphics.lineTo(ghostX + 8, ghostY + 35);
  graphics.lineTo(ghostX + 3, ghostY + 50);
  graphics.lineTo(ghostX - 3, ghostY + 50);
  graphics.closePath();
  graphics.fill();
}

/**
 * Draw enemy silhouette for camera feed
 * @param isUbered - If true, draws a bright red Über glow behind the enemy
 */
export function drawEnemySilhouette(graphics: Phaser.GameObjects.Graphics, type: 'SCOUT' | 'SOLDIER' | 'DEMOMAN_BODY', isUbered: boolean = false): void {
  graphics.clear();
  
  // Shadow
  graphics.fillStyle(0x000000, 0.6);
  graphics.fillEllipse(0, 90, 120, 30);
  
  // Draw Über glow if enemy is Übered by Medic
  if (isUbered) {
    // Outer pulsing red glow
    graphics.fillStyle(0xff4444, 0.3);
    graphics.fillCircle(0, 0, 100);
    // Middle glow
    graphics.fillStyle(0xff4444, 0.4);
    graphics.fillCircle(0, 0, 80);
    // Inner bright glow
    graphics.fillStyle(0xff6666, 0.5);
    graphics.fillCircle(0, 0, 60);
    
    // Draw Medic ghost hovering over enemy's shoulder (upper right)
    const ghostX = 45;  // Offset to the right
    const ghostY = -55; // Offset up (above shoulder)
    
    // Ghost outer glow
    graphics.fillStyle(0xff4444, 0.2);
    graphics.fillCircle(ghostX, ghostY, 30);
    
    // Ghost body (translucent red)
    graphics.fillStyle(0xff4444, 0.5);
    // Head
    graphics.fillCircle(ghostX, ghostY - 8, 10);
    // Body (triangle shape)
    graphics.beginPath();
    graphics.moveTo(ghostX - 12, ghostY + 3);
    graphics.lineTo(ghostX + 12, ghostY + 3);
    graphics.lineTo(ghostX + 8, ghostY + 28);
    graphics.lineTo(ghostX - 8, ghostY + 28);
    graphics.closePath();
    graphics.fill();
    
    // Medic cross on chest
    graphics.fillStyle(0xffffff, 0.7);
    graphics.fillRect(ghostX - 2, ghostY + 8, 4, 10);
    graphics.fillRect(ghostX - 4, ghostY + 11, 8, 4);
    
    // Ghost eyes (glowing)
    graphics.fillStyle(0xff8888, 0.9);
    graphics.fillCircle(ghostX - 3, ghostY - 10, 2);
    graphics.fillCircle(ghostX + 3, ghostY - 10, 2);
    
    // Ghostly trail/wisp effect below
    graphics.fillStyle(0xff4444, 0.25);
    graphics.beginPath();
    graphics.moveTo(ghostX - 6, ghostY + 28);
    graphics.lineTo(ghostX + 6, ghostY + 28);
    graphics.lineTo(ghostX + 2, ghostY + 40);
    graphics.lineTo(ghostX - 2, ghostY + 40);
    graphics.closePath();
    graphics.fill();
  }
  
  if (type === 'SCOUT') {
    // Scout - lean Boston speedster (UPDATED to match gallery)
    
    // Red glow behind (normal - skip if Übered since we drew it above)
    if (!isUbered) {
      graphics.fillStyle(0xCC4444, 0.15);
      graphics.fillCircle(0, 0, 75);
    }
    
    // Legs - khaki pants
    graphics.fillStyle(0x8b7355, 1);
    graphics.fillRect(-15, 15, 13, 40);
    graphics.fillRect(2, 12, 13, 43);
    // Knee wraps
    graphics.fillStyle(0xcccccc, 1);
    graphics.fillRect(-14, 30, 11, 6);
    graphics.fillRect(3, 28, 11, 6);
    
    // Running shoes - red with white stripe
    graphics.fillStyle(0xcc2222, 1);
    graphics.fillRoundedRect(-18, 52, 18, 10, 3);
    graphics.fillRoundedRect(2, 52, 18, 10, 3);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRect(-14, 55, 8, 3);
    graphics.fillRect(6, 55, 8, 3);
    
    // Athletic torso - RED team shirt
    graphics.fillStyle(0xCC4444, 1);
    graphics.beginPath();
    graphics.moveTo(-20, -20);
    graphics.lineTo(18, -20);
    graphics.lineTo(15, 18);
    graphics.lineTo(-17, 18);
    graphics.closePath();
    graphics.fillPath();
    
    // Dog tags
    graphics.fillStyle(0x777777, 1);
    graphics.fillRect(-1, -15, 2, 20);
    graphics.fillStyle(0x999999, 1);
    graphics.fillEllipse(0, 7, 6, 8);
    graphics.fillEllipse(2, 9, 6, 8);
    
    // Bandages on hands/forearms - iconic Scout look
    graphics.fillStyle(0xdddddd, 1);
    graphics.fillRect(-38, 5, 12, 18);
    graphics.fillRect(26, -25, 12, 18);
    // Tape strips
    graphics.fillStyle(0xcccccc, 1);
    for (let i = 0; i < 4; i++) {
      graphics.fillRect(-37, 7 + i * 4, 10, 2);
      graphics.fillRect(27, -23 + i * 4, 10, 2);
    }
    
    // Arms - RED team
    graphics.fillStyle(0xCC4444, 1);
    graphics.fillCircle(-22, -14, 10);
    graphics.fillCircle(20, -14, 10);
    graphics.fillRect(-42, -18, 22, 12);
    graphics.fillRect(18, -35, 12, 25);
    
    // Hands (under bandages)
    graphics.fillStyle(0xd4a574, 1);
    graphics.fillCircle(-35, 20, 8);
    graphics.fillCircle(30, -38, 8);
    
    // Baseball bat - aluminum
    graphics.fillStyle(0xaaaaaa, 1);
    graphics.fillRect(24, -70, 10, 50);
    graphics.fillStyle(0x888888, 1);
    graphics.fillRoundedRect(22, -78, 14, 22, 5);
    // Grip tape
    graphics.fillStyle(0x222222, 1);
    graphics.fillRect(25, -25, 8, 18);
    graphics.fillStyle(0xcc2222, 1);
    graphics.fillCircle(29, -5, 5);
    
    // Head
    graphics.fillStyle(0xd4a574, 1);
    graphics.fillCircle(0, -40, 22);
    graphics.fillEllipse(0, -22, 16, 10);
    
    // Patrol cap - grey military
    graphics.fillStyle(0x4a4a4a, 1);
    graphics.beginPath();
    graphics.arc(0, -48, 24, Math.PI, 0, false);
    graphics.closePath();
    graphics.fillPath();
    // Bill (facing backward/right)
    graphics.fillStyle(0x3a3a3a, 1);
    graphics.beginPath();
    graphics.moveTo(24, -46);
    graphics.lineTo(45, -38);
    graphics.lineTo(40, -44);
    graphics.lineTo(5, -46);
    graphics.closePath();
    graphics.fillPath();
    // Cap button
    graphics.fillStyle(0x555555, 1);
    graphics.fillCircle(0, -62, 4);
    
    // Headset
    graphics.fillStyle(0x333333, 1);
    graphics.fillRect(12, -55, 14, 4);
    graphics.fillCircle(22, -42, 9);
    graphics.fillStyle(0x222222, 1);
    graphics.fillCircle(22, -42, 6);
    // Mic
    graphics.fillStyle(0x444444, 1);
    graphics.fillRect(20, -38, 3, 20);
    graphics.fillCircle(21, -18, 5);
    
    // No mouth - more threatening
    
    // Red eyes
    graphics.fillStyle(0xff0000, 0.4);
    graphics.fillCircle(-8, -40, 8);
    graphics.fillCircle(8, -40, 8);
    graphics.fillStyle(0xff0000, 1);
    graphics.fillCircle(-8, -40, 5);
    graphics.fillCircle(8, -40, 5);
    graphics.fillStyle(0xffffff, 0.9);
    graphics.fillCircle(-10, -42, 2);
    graphics.fillCircle(6, -42, 2);
    
  } else if (type === 'SOLDIER') {
    // Soldier - UPDATED to match gallery sprite
    
    // Red/orange glow behind (skip if Übered - red Über glow drawn above)
    if (!isUbered) {
      graphics.fillStyle(0xcc4422, 0.12);
      graphics.fillCircle(0, 0, 80);
    }
    
    // Legs - wide military stance
    graphics.fillStyle(0x3a3a4a, 1);
    graphics.fillRect(-24, 22, 18, 36);
    graphics.fillRect(6, 22, 18, 36);
    // Knee pads
    graphics.fillStyle(0x2a2a3a, 1);
    graphics.fillEllipse(-15, 32, 10, 8);
    graphics.fillEllipse(15, 32, 10, 8);
    // Combat boots
    graphics.fillStyle(0x1a1a1a, 1);
    graphics.fillRoundedRect(-28, 52, 24, 12, 3);
    graphics.fillRoundedRect(4, 52, 24, 12, 3);
    graphics.fillStyle(0x111111, 1);
    graphics.fillRect(-28, 62, 24, 3);
    graphics.fillRect(4, 62, 24, 3);
    
    // Stocky military torso - RED team
    graphics.fillStyle(0xBD3B3B, 1);
    graphics.fillRoundedRect(-32, -18, 64, 45, 6);
    // Jacket center seam
    graphics.fillStyle(0x9A2A2A, 1);
    graphics.fillRect(-3, -15, 6, 40);
    // Jacket collar
    graphics.fillStyle(0x8B2222, 1);
    graphics.fillRect(-18, -20, 36, 8);
    // Chest pockets
    graphics.fillStyle(0xDD5555, 0.5);
    graphics.fillRect(-26, -8, 14, 12);
    graphics.fillRect(12, -8, 14, 12);
    // Pocket buttons
    graphics.fillStyle(0x888866, 1);
    graphics.fillCircle(-19, -2, 2);
    graphics.fillCircle(19, -2, 2);
    
    // Ammo pouches
    graphics.fillStyle(0x4a4a3a, 1);
    graphics.fillRect(-30, 14, 14, 14);
    graphics.fillRect(16, 14, 14, 14);
    graphics.fillStyle(0x3a3a2a, 1);
    graphics.fillRect(-30, 14, 14, 5);
    graphics.fillRect(16, 14, 14, 5);
    
    // Strong arms - RED team
    graphics.fillStyle(0xBD3B3B, 1);
    graphics.fillCircle(-32, -8, 14);
    graphics.fillCircle(32, -8, 14);
    graphics.fillRect(-44, -10, 16, 40);
    graphics.fillRect(28, -25, 16, 30);
    
    // Hands
    graphics.fillStyle(0xc49a64, 1);
    graphics.fillCircle(-38, 32, 10);
    graphics.fillCircle(36, -28, 10);
    
    // Head (mostly hidden)
    graphics.fillStyle(0x9a8a7a, 1);
    graphics.fillCircle(0, -35, 20);
    graphics.fillStyle(0xaa9a8a, 1);
    graphics.fillEllipse(0, -18, 18, 12);
    // Stubble
    graphics.fillStyle(0x6a5a4a, 0.4);
    graphics.fillEllipse(0, -20, 16, 10);
    
    // Iconic pot helmet
    graphics.fillStyle(0x5a5a4a, 1);
    graphics.fillCircle(0, -44, 28);
    graphics.fillRect(-28, -44, 56, 22);
    // Helmet rim
    graphics.fillStyle(0x4a4a3a, 1);
    graphics.fillRoundedRect(-34, -26, 68, 12, 3);
    // Deep shadow
    graphics.fillStyle(0x1a1a1a, 0.85);
    graphics.fillRect(-28, -20, 56, 12);
    // Battle damage dent
    graphics.fillStyle(0x3a3a2a, 1);
    graphics.fillCircle(12, -48, 6);
    
    // Glowing eyes in shadow
    graphics.fillStyle(0xff0000, 0.5);
    graphics.fillCircle(-11, -16, 10);
    graphics.fillCircle(11, -16, 10);
    graphics.fillStyle(0xff0000, 1);
    graphics.fillCircle(-11, -16, 6);
    graphics.fillCircle(11, -16, 6);
    graphics.fillStyle(0xffaaaa, 1);
    graphics.fillCircle(-11, -16, 3);
    graphics.fillCircle(11, -16, 3);
    
    // ROCKET LAUNCHER - detailed
    graphics.fillStyle(0x5a5a5a, 1);
    graphics.fillRoundedRect(18, -55, 58, 20, 4);
    graphics.fillStyle(0x4a4a4a, 1);
    graphics.fillCircle(76, -45, 14);
    graphics.fillStyle(0x333333, 1);
    graphics.fillCircle(76, -45, 10);
    graphics.fillStyle(0x1a1a1a, 1);
    graphics.fillCircle(76, -45, 6);
    // Sight
    graphics.fillStyle(0x444444, 1);
    graphics.fillRect(35, -62, 18, 8);
    graphics.fillStyle(0x333333, 1);
    graphics.fillRect(38, -66, 4, 6);
    // Handle
    graphics.fillStyle(0x4a3a2a, 1);
    graphics.fillRect(32, -40, 10, 18);
    // Trigger guard
    graphics.fillStyle(0x3a3a3a, 1);
    graphics.fillRect(28, -38, 6, 12);
    
    // Grenades on belt - detailed
    graphics.fillStyle(0x3a4a3a, 1);
    graphics.fillCircle(-22, 30, 8);
    graphics.fillCircle(-6, 30, 8);
    graphics.fillCircle(10, 30, 8);
    graphics.fillStyle(0x2a3a2a, 1);
    graphics.fillRect(-25, 22, 6, 6);
    graphics.fillRect(-9, 22, 6, 6);
    graphics.fillRect(7, 22, 6, 6);
    graphics.fillStyle(0xaaaa88, 1);
    graphics.fillCircle(-22, 23, 3);
    graphics.fillCircle(-6, 23, 3);
    graphics.fillCircle(10, 23, 3);
    
  } else if (type === 'DEMOMAN_BODY') {
    // Demoman - HEADLESS body with Eyelander (matches gallery)
    
    // Ghostly green glow (skip if Übered - red Über glow drawn above)
    if (!isUbered) {
      graphics.fillStyle(0x00ff44, 0.18);
      graphics.fillCircle(0, 10, 95);
    }
    
    // Legs
    graphics.fillStyle(0x2a2a3a, 1);
    graphics.fillRect(-22, 22, 18, 55);
    graphics.fillRect(4, 22, 18, 55);
    // Boots
    graphics.fillStyle(0x1a1a1a, 1);
    graphics.fillRoundedRect(-26, 70, 24, 14, 3);
    graphics.fillRoundedRect(2, 70, 24, 14, 3);
    
    // Stocky torso - RED team
    graphics.fillStyle(0xBD3B3B, 1);
    graphics.fillRoundedRect(-32, -28, 64, 55, 6);
    // Vest/harness
    graphics.fillStyle(0x3a2a1a, 1);
    graphics.fillRect(-28, -22, 12, 45);
    graphics.fillRect(16, -22, 12, 45);
    graphics.fillRect(-28, -5, 56, 10);
    
    // Grenade bandolier
    graphics.fillStyle(0x4a4a3a, 1);
    graphics.beginPath();
    graphics.moveTo(-30, 18);
    graphics.lineTo(30, -16);
    graphics.lineTo(30, -6);
    graphics.lineTo(-30, 28);
    graphics.closePath();
    graphics.fillPath();
    // Stickybombs
    graphics.fillStyle(0x333333, 1);
    for (let i = 0; i < 5; i++) {
      const gx = -24 + i * 12;
      const gy = 12 - i * 6;
      graphics.fillCircle(gx, gy, 7);
      graphics.fillStyle(0xff3300, 1);
      graphics.fillCircle(gx, gy, 4);
      graphics.fillStyle(0x333333, 1);
    }
    
    // Arms - RED team
    graphics.fillStyle(0xBD3B3B, 1);
    graphics.fillCircle(-32, -16, 14);
    graphics.fillCircle(32, -16, 14);
    graphics.fillRect(-44, -18, 16, 48);
    graphics.fillRect(28, -42, 16, 36);
    
    // Hands
    graphics.fillStyle(0x5a4a3a, 1);
    graphics.fillCircle(-40, 32, 12);
    graphics.fillCircle(36, -48, 12);
    
    // NECK STUMP (headless!)
    graphics.fillStyle(0x4a3a2a, 1);
    graphics.fillEllipse(0, -32, 20, 12);
    // Green ectoplasm
    graphics.fillStyle(0x00ff44, 0.7);
    graphics.fillEllipse(-6, -28, 10, 14);
    graphics.fillEllipse(8, -30, 8, 12);
    graphics.fillStyle(0x00ff44, 0.4);
    graphics.fillEllipse(-2, -20, 6, 10);
    
    // EYELANDER SWORD
    graphics.fillStyle(0x00ff44, 0.4);
    graphics.fillRect(30, -100, 14, 65);
    graphics.fillStyle(0x666666, 1);
    graphics.fillRect(32, -98, 10, 60);
    graphics.fillStyle(0x00ff44, 0.9);
    graphics.fillRect(32, -98, 3, 60);
    // Blade tip
    graphics.beginPath();
    graphics.moveTo(32, -98);
    graphics.lineTo(42, -98);
    graphics.lineTo(37, -110);
    graphics.closePath();
    graphics.fillStyle(0x00ff44, 0.7);
    graphics.fillPath();
    // Crossguard
    graphics.fillStyle(0x444444, 1);
    graphics.fillRect(24, -42, 26, 8);
    // Handle
    graphics.fillStyle(0x3a2a1a, 1);
    graphics.fillRect(32, -36, 10, 22);
    // Pommel
    graphics.fillStyle(0x555555, 1);
    graphics.fillCircle(37, -14, 5);
  }
}

/**
 * Draw Demoman's severed head for camera feed
 * @param isUbered - If true, draws a bright red Über glow around the head
 * @param chargeBuildup - How close Demo is to charging (0-1), affects aura brightness
 * @param isFakeHead - If true, this is Spy's disguise - shows WRONG eye glowing to reward observant players
 */
export function drawDemomanHead(graphics: Phaser.GameObjects.Graphics, isUbered: boolean = false, chargeBuildup: number = 1, isFakeHead: boolean = false, demoEyeGlowing: boolean = false, realActiveEye: 'LEFT' | 'RIGHT' | 'NONE' = 'NONE'): void {
  graphics.clear();
  
  // Draw ghostly aura based on charge buildup
  // Aura is dim/dull when far from charging, bright and pulsing when close
  // Color: green normally, red when Übered
  const easedBuildup = chargeBuildup * chargeBuildup * chargeBuildup;
  const pulse = chargeBuildup > 0.75 ? Math.sin(Date.now() * 0.01) * 0.15 : 0;
  const auraOpacity = 0.05 + easedBuildup * 0.45 + (pulse * easedBuildup);
  const auraSize = 75 + easedBuildup * 25;
  
  // Choose color based on Über status
  const auraColorOuter = isUbered ? 0xff4444 : 0x00ff44;
  const auraColorInner = isUbered ? 0xff6666 : 0x44ff88;
  
  // Outer ethereal glow
  graphics.fillStyle(auraColorOuter, auraOpacity * 0.4);
  graphics.fillCircle(0, 0, auraSize + 20);
  // Middle glow
  graphics.fillStyle(auraColorOuter, auraOpacity * 0.6);
  graphics.fillCircle(0, 0, auraSize);
  // Inner glow
  graphics.fillStyle(auraColorInner, auraOpacity * 0.8);
  graphics.fillCircle(0, 0, auraSize - 20);
  
  // Draw Medic ghost if Übered (in addition to red charge aura)
  if (isUbered) {
    // Draw Medic ghost hovering near head (upper right)
    const ghostX = 55;
    const ghostY = -40;
    
    // Ghost outer glow
    graphics.fillStyle(0xff4444, 0.2);
    graphics.fillCircle(ghostX, ghostY, 28);
    
    // Ghost body (translucent red)
    graphics.fillStyle(0xff4444, 0.5);
    graphics.fillCircle(ghostX, ghostY - 6, 9);
    graphics.beginPath();
    graphics.moveTo(ghostX - 10, ghostY + 3);
    graphics.lineTo(ghostX + 10, ghostY + 3);
    graphics.lineTo(ghostX + 7, ghostY + 25);
    graphics.lineTo(ghostX - 7, ghostY + 25);
    graphics.closePath();
    graphics.fill();
    
    // Medic cross
    graphics.fillStyle(0xffffff, 0.7);
    graphics.fillRect(ghostX - 2, ghostY + 7, 4, 9);
    graphics.fillRect(ghostX - 4, ghostY + 10, 8, 3);
    
    // Ghost eyes
    graphics.fillStyle(0xff8888, 0.9);
    graphics.fillCircle(ghostX - 3, ghostY - 8, 2);
    graphics.fillCircle(ghostX + 3, ghostY - 8, 2);
  }
  
  // Shadow under head
  graphics.fillStyle(0x000000, 0.4);
  graphics.fillEllipse(0, 55, 80, 20);
  
  // Head - larger for camera view (dark skin)
  graphics.fillStyle(0x3a2a1a, 1);
  graphics.fillCircle(0, 0, 45);
  
  // Beanie (dark blue/black)
  graphics.fillStyle(0x1a1a2a, 1);
  graphics.beginPath();
  graphics.arc(0, -10, 48, Math.PI, 0, false);
  graphics.closePath();
  graphics.fillPath();
  
  // Beanie rim
  graphics.fillStyle(0x2a2a3a, 1);
  graphics.fillRect(-48, -12, 96, 8);
  
  // Beard
  graphics.fillStyle(0x1a1a1a, 1);
  graphics.fillEllipse(0, 35, 55, 35);
  
  // Eyepatch (right eye - covers the missing eye)
  graphics.fillStyle(0x111111, 1);
  graphics.fillCircle(18, -8, 18);
  graphics.fillRect(16, -35, 8, 30);
  
  // Left eye socket - dark void (or glowing if active)
  // Use red glow when Übered, green normally
  const eyeGlowColor = isUbered ? 0xff4444 : 0x00ff44;
  
  // For Spy's fake head: if Demo's eye is glowing, show the WRONG eye!
  // This rewards observant players who notice the discrepancy
  // Spy's fake head shows opposite eye, or no glow if Demo isn't charging
  const showLeftGlow = isFakeHead 
    ? (demoEyeGlowing && realActiveEye === 'RIGHT')  // Fake: glow LEFT when real is RIGHT
    : (demoEyeGlowing && realActiveEye === 'LEFT');  // Real: glow LEFT when LEFT
  const showRightGlow = isFakeHead
    ? (demoEyeGlowing && realActiveEye === 'LEFT')   // Fake: glow RIGHT when real is LEFT  
    : (demoEyeGlowing && realActiveEye === 'RIGHT'); // Real: glow RIGHT when RIGHT
  
  if (showLeftGlow) {
    graphics.fillStyle(eyeGlowColor, 0.6);
    graphics.fillCircle(-18, -8, 25);
    graphics.fillStyle(eyeGlowColor, 1);
    graphics.fillCircle(-18, -8, 15);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(-22, -12, 4);
  } else if (isUbered) {
    // Even when eye not glowing, show red aura in socket when Übered
    graphics.fillStyle(0xff4444, 0.4);
    graphics.fillCircle(-18, -8, 18);
    graphics.fillStyle(0x000000, 1);
    graphics.fillCircle(-18, -8, 12);
  } else {
    graphics.fillStyle(0x000000, 1);
    graphics.fillCircle(-18, -8, 15);
  }
  
  // Right eye (under patch) glows through if active
  if (showRightGlow) {
    graphics.fillStyle(eyeGlowColor, 0.8);
    graphics.fillCircle(18, -8, 20);
  } else if (isUbered) {
    // Red glow visible through eyepatch when Übered
    graphics.fillStyle(0xff4444, 0.3);
    graphics.fillCircle(18, -8, 15);
  }
}

/**
 * Draw Heavy silhouette for camera feed - massive, intimidating
 */
export function drawHeavySilhouette(graphics: Phaser.GameObjects.Graphics, isLured: boolean): void {
  graphics.clear();
  
  // Shadow
  graphics.fillStyle(0x000000, 0.6);
  graphics.fillEllipse(0, 90, 130, 35);
  
  // Glow effect (yellow when lured, red normally)
  graphics.fillStyle(isLured ? 0xccaa00 : 0xCC4444, 0.12);
  graphics.fillCircle(0, 0, 90);
  
  // Thick powerful legs
  const bodyColor = 0xBD3B3B;  // RED team color (doesn't change when lured)
  graphics.fillStyle(0x4a4a5a, 1);
  graphics.fillRect(-30, 25, 26, 38);
  graphics.fillRect(4, 25, 26, 38);
  // Knee pads
  graphics.fillStyle(0x3a3a4a, 1);
  graphics.fillEllipse(-17, 35, 14, 10);
  graphics.fillEllipse(17, 35, 14, 10);
  // Combat boots
  graphics.fillStyle(0x1a1a1a, 1);
  graphics.fillRoundedRect(-34, 58, 32, 12, 3);
  graphics.fillRoundedRect(2, 58, 32, 12, 3);
  // Boot laces
  graphics.fillStyle(0x444444, 1);
  graphics.fillRect(-22, 60, 10, 2);
  graphics.fillRect(12, 60, 10, 2);
  
  // MASSIVE barrel chest
  graphics.fillStyle(bodyColor, 1);
  graphics.fillRoundedRect(-50, -30, 100, 60, 12);
  // Pec definition
  graphics.fillStyle(0x9A2A2A, 0.4);
  graphics.fillEllipse(-22, -5, 22, 28);
  graphics.fillEllipse(22, -5, 22, 28);
  
  // Vest with buckles
  graphics.fillStyle(0x8B2222, 1);
  graphics.fillRect(-6, -25, 12, 55);
  graphics.fillStyle(0xaa9944, 1);
  graphics.fillRect(-8, -15, 16, 6);
  graphics.fillRect(-8, 5, 16, 6);
  graphics.fillRect(-8, 20, 16, 6);
  
  // Ammo belt - THICK diagonal
  graphics.fillStyle(0x6a5a3a, 1);
  graphics.beginPath();
  graphics.moveTo(-48, 15);
  graphics.lineTo(48, -18);
  graphics.lineTo(48, -5);
  graphics.lineTo(-48, 28);
  graphics.closePath();
  graphics.fillPath();
  // Brass bullets
  graphics.fillStyle(0xccaa33, 1);
  for (let i = 0; i < 9; i++) {
    const bx = -42 + i * 11;
    const by = 13 - i * 3.8;
    graphics.fillRect(bx, by, 6, 10);
    graphics.fillStyle(0xdd6633, 1);
    graphics.fillRect(bx, by + 6, 6, 4);
    graphics.fillStyle(0xccaa33, 1);
  }
  
  // HUGE arms
  graphics.fillStyle(bodyColor, 1);
  graphics.fillCircle(-50, -15, 22);
  graphics.fillRect(-70, -20, 28, 55);
  graphics.fillCircle(50, -15, 22);
  graphics.fillRect(42, -20, 28, 50);
  
  // Meaty hands
  graphics.fillStyle(0xd4a574, 1);
  graphics.fillCircle(-60, 38, 16);
  graphics.fillCircle(55, 32, 16);
  // Thick fingers
  graphics.fillStyle(0xc49a64, 1);
  graphics.fillCircle(-70, 35, 7);
  graphics.fillCircle(-52, 48, 6);
  graphics.fillCircle(65, 28, 7);
  graphics.fillCircle(48, 42, 6);
  
  // Big bald head
  graphics.fillStyle(0x8a7a6a, 1);
  graphics.fillCircle(0, -52, 36);
  graphics.fillStyle(0x9a8a7a, 1);
  graphics.fillCircle(0, -48, 30);
  // Ears
  graphics.fillStyle(0x8a7a6a, 1);
  graphics.fillCircle(-34, -50, 12);
  graphics.fillCircle(34, -50, 12);
  
  // 5 o'clock shadow
  graphics.fillStyle(0x5a4a3a, 0.4);
  graphics.fillEllipse(0, -32, 26, 18);
  
  // Heavy brow
  graphics.fillStyle(0x6a5a4a, 1);
  graphics.fillRect(-26, -62, 52, 12);
  
  // Angry eyebrows - thick
  graphics.fillStyle(0x3a2a1a, 1);
  graphics.beginPath();
  graphics.moveTo(-26, -58);
  graphics.lineTo(-6, -52);
  graphics.lineTo(-26, -52);
  graphics.closePath();
  graphics.fillPath();
  graphics.beginPath();
  graphics.moveTo(26, -58);
  graphics.lineTo(6, -52);
  graphics.lineTo(26, -52);
  graphics.closePath();
  graphics.fillPath();
  
  // Eyes (yellow when lured, red normally)
  const eyeColor = isLured ? 0xffcc00 : 0xff0000;
  graphics.fillStyle(eyeColor, 0.6);
  graphics.fillCircle(-14, -50, 14);
  graphics.fillCircle(14, -50, 14);
  graphics.fillStyle(eyeColor, 1);
  graphics.fillCircle(-14, -50, 9);
  graphics.fillCircle(14, -50, 9);
  graphics.fillStyle(isLured ? 0xffffaa : 0xffaaaa, 1);
  graphics.fillCircle(-14, -50, 4);
  graphics.fillCircle(14, -50, 4);
  // Eye glints
  graphics.fillStyle(0xffffff, 0.8);
  graphics.fillCircle(-18, -54, 3);
  graphics.fillCircle(10, -54, 3);
  
  // Wide nose
  graphics.fillStyle(0x7a6a5a, 1);
  graphics.fillEllipse(0, -40, 14, 10);
  
  // No mouth - more menacing
  
  // MINIGUN "SASHA" - massive and iconic
  graphics.fillStyle(0x555555, 1);
  graphics.fillRoundedRect(-72, 30, 135, 26, 4);
  // Barrel shroud
  graphics.fillStyle(0x666666, 1);
  graphics.fillRoundedRect(-80, 32, 25, 22, 3);
  // Rotating barrel cluster
  graphics.fillStyle(0x4a4a4a, 1);
  graphics.fillCircle(-85, 43, 20);
  graphics.fillStyle(0x3a3a3a, 1);
  graphics.fillCircle(-85, 43, 16);
  // Individual barrels with depth
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const bx = -85 + Math.cos(angle) * 10;
    const by = 43 + Math.sin(angle) * 10;
    graphics.fillStyle(0x222222, 1);
    graphics.fillCircle(bx, by, 4);
    graphics.fillStyle(0x111111, 1);
    graphics.fillCircle(bx, by, 2);
  }
  // Center spindle
  graphics.fillStyle(0x333333, 1);
  graphics.fillCircle(-85, 43, 5);
  
  // Handle grips
  graphics.fillStyle(0x4a3a2a, 1);
  graphics.fillRect(0, 16, 16, 22);
  graphics.fillRect(35, 20, 12, 18);
  // Grip texture
  graphics.fillStyle(0x3a2a1a, 1);
  for (let i = 0; i < 4; i++) {
    graphics.fillRect(2, 18 + i * 5, 12, 2);
  }
}

/**
 * Draw Heavy as a massive shadow in the hallway — dark mass with glowing eyes.
 * Shown behind Scout/Soldier when wrangler light hits the doorway.
 */
export function drawHeavyDoorwayShadow(graphics: Phaser.GameObjects.Graphics, isLured: boolean): void {
  graphics.clear();

  const auraColor = isLured ? 0xccaa00 : 0x441111;
  graphics.fillStyle(auraColor, isLured ? 0.08 : 0.05);
  graphics.fillCircle(0, -10, 110);
  graphics.fillStyle(auraColor, isLured ? 0.06 : 0.04);
  graphics.fillCircle(0, -20, 85);

  // Ground shadow — very wide
  graphics.fillStyle(0x000000, 0.75);
  graphics.fillEllipse(0, 95, 150, 28);

  // Massive dark body — shoulders wider than Scout in front
  graphics.fillStyle(0x080808, 0.95);
  graphics.fillRoundedRect(-72, -35, 144, 75, 14);
  graphics.fillStyle(0x050505, 0.9);
  graphics.fillRoundedRect(-65, -28, 130, 65, 12);

  // Thick leg masses at sides (visible past Scout)
  graphics.fillStyle(0x0a0a0a, 0.92);
  graphics.fillRect(-58, 30, 32, 48);
  graphics.fillRect(26, 30, 32, 48);

  // Huge arm bulges framing the doorway
  graphics.fillStyle(0x0c0c0c, 0.9);
  graphics.fillCircle(-68, -10, 28);
  graphics.fillCircle(68, -10, 28);
  graphics.fillRect(-88, -18, 36, 58);
  graphics.fillRect(52, -18, 36, 58);

  // Big bald head mass looming above Scout
  graphics.fillStyle(0x0a0a0a, 0.95);
  graphics.fillCircle(0, -58, 42);
  graphics.fillStyle(0x060606, 0.9);
  graphics.fillCircle(0, -54, 36);

  // Brow ridge — menacing silhouette
  graphics.fillStyle(0x111111, 1);
  graphics.fillRect(-30, -72, 60, 14);

  // Glowing eyes piercing the shadow
  const eyeColor = isLured ? 0xffcc00 : 0xff0000;
  const eyeGlow = isLured ? 0xffffaa : 0xffaaaa;
  graphics.fillStyle(eyeColor, 0.35);
  graphics.fillCircle(-16, -52, 18);
  graphics.fillCircle(16, -52, 18);
  graphics.fillStyle(eyeColor, 0.85);
  graphics.fillCircle(-16, -52, 11);
  graphics.fillCircle(16, -52, 11);
  graphics.fillStyle(eyeGlow, 1);
  graphics.fillCircle(-16, -52, 5);
  graphics.fillCircle(16, -52, 5);
  graphics.fillStyle(0xffffff, 0.9);
  graphics.fillCircle(-19, -55, 2.5);
  graphics.fillCircle(13, -55, 2.5);

  // Minigun silhouette hint at bottom edge
  graphics.fillStyle(0x111111, 0.85);
  graphics.fillRoundedRect(-78, 38, 150, 22, 4);
  graphics.fillCircle(-88, 48, 18);
}

/**
 * Draw Sniper silhouette for camera feed - tall, lean, rifle
 */
export function drawSniperSilhouette(graphics: Phaser.GameObjects.Graphics, isLured: boolean): void {
  graphics.clear();
  
  // Shadow
  graphics.fillStyle(0x000000, 0.5);
  graphics.fillEllipse(0, 90, 80, 18);
  
  // Eerie red glow (yellow when lured)
  graphics.fillStyle(isLured ? 0xffcc00 : 0xff4444, 0.25);
  graphics.fillCircle(0, -10, 95);
  graphics.fillStyle(isLured ? 0xccaa00 : 0xCC3333, 0.2);
  graphics.fillCircle(0, -30, 60);
  
  // Tall lean legs - crouched aiming stance
  graphics.fillStyle(0x4a4a3a, 1);
  graphics.fillRect(-16, 20, 14, 55);
  graphics.fillRect(2, 18, 14, 58);
  // Knee details
  graphics.fillStyle(0x3a3a2a, 1);
  graphics.fillEllipse(-9, 35, 9, 7);
  graphics.fillEllipse(9, 33, 9, 7);
  // Boots
  graphics.fillStyle(0x2a2a1a, 1);
  graphics.fillRoundedRect(-18, 70, 16, 16, 2);
  graphics.fillRoundedRect(2, 72, 16, 16, 2);
  
  // Lean vest (always red - only visor/scope change when lured)
  const bodyColor = 0xBD3B3B;  // RED team color (doesn't change when lured)
  graphics.fillStyle(bodyColor, 1);
  graphics.beginPath();
  graphics.moveTo(-26, -32);
  graphics.lineTo(24, -32);
  graphics.lineTo(20, 25);
  graphics.lineTo(-22, 25);
  graphics.closePath();
  graphics.fillPath();
  // Vest details
  graphics.fillStyle(0x9A2A2A, 1);
  graphics.fillRect(-3, -28, 4, 50);
  // Shirt collar
  graphics.fillStyle(0xaa9988, 1);
  graphics.fillRect(-14, -36, 28, 6);
  
  // Arms in aiming position
  graphics.fillStyle(bodyColor, 1);
  graphics.fillCircle(-26, -24, 12);
  graphics.fillCircle(24, -24, 12);
  graphics.fillRect(-34, -30, 14, 16);
  graphics.fillRect(18, -30, 14, 16);
  
  // Hands gripping rifle
  graphics.fillStyle(0xc49a64, 1);
  graphics.fillCircle(-10, -18, 10);
  graphics.fillCircle(14, -15, 10);
  
  // Head tilted, looking down scope
  graphics.fillStyle(0xb49a7a, 1);
  graphics.fillCircle(6, -58, 22);
  graphics.fillEllipse(6, -40, 16, 12);
  // Stubble
  graphics.fillStyle(0x5a4a3a, 0.5);
  graphics.fillEllipse(6, -42, 14, 10);
  
  // Slouch hat
  graphics.fillStyle(0x5a4a3a, 1);
  graphics.fillEllipse(6, -66, 40, 12);
  graphics.fillStyle(0x4a3a2a, 1);
  graphics.fillRoundedRect(-12, -88, 36, 24, 4);
  // Hat band
  graphics.fillStyle(0x3a2a1a, 1);
  graphics.fillRect(-12, -68, 36, 5);
  // Hat dent
  graphics.fillStyle(0x3a2a1a, 1);
  graphics.fillRect(-2, -88, 16, 6);
  
  // Red visor (glowing) - spans across both eyes
  const visorColor = isLured ? 0xffcc00 : 0xff4444;
  // Visor frame
  graphics.fillStyle(0x222222, 1);
  graphics.fillRoundedRect(-14, -66, 40, 14, 4);
  // Visor glass - glowing red
  graphics.fillStyle(visorColor, 0.3);
  graphics.fillRoundedRect(-12, -64, 36, 10, 3);
  graphics.fillStyle(visorColor, 0.7);
  graphics.fillRoundedRect(-10, -62, 32, 6, 2);
  // Bright center glow
  graphics.fillStyle(visorColor, 1);
  graphics.fillRoundedRect(-6, -61, 24, 4, 2);
  // Outer glow effect
  graphics.fillStyle(visorColor, 0.2);
  graphics.fillRoundedRect(-16, -68, 44, 18, 5);
  
  // SNIPER RIFLE - aimed at viewer (foreshortened)
  graphics.fillStyle(0x3a3a3a, 1);
  graphics.fillRoundedRect(-20, -12, 42, 24, 4);
  // Stock
  graphics.fillStyle(0x5a4a3a, 1);
  graphics.fillRoundedRect(18, -8, 24, 16, 3);
  
  // SCOPE facing viewer - prominent
  graphics.fillStyle(0x2a2a2a, 1);
  graphics.fillCircle(-8, -28, 20);
  graphics.fillStyle(0x222222, 1);
  graphics.fillCircle(-8, -28, 16);
  // Scope lens - GLOWING (aimed at you!)
  graphics.fillStyle(0x1a1a1a, 1);
  graphics.fillCircle(-8, -28, 12);
  graphics.fillStyle(isLured ? 0xffcc00 : 0xff4444, 0.5);
  graphics.fillCircle(-8, -28, 12);
  graphics.fillStyle(isLured ? 0xffcc00 : 0xff4444, 1);
  graphics.fillCircle(-8, -28, 7);
  graphics.fillStyle(isLured ? 0xffffcc : 0xff8888, 1);
  graphics.fillCircle(-10, -30, 3);
  // Crosshair in scope
  graphics.fillStyle(0x000000, 0.6);
  graphics.fillRect(-9, -36, 2, 16);
  graphics.fillRect(-16, -29, 16, 2);
  
  // Barrel toward viewer
  graphics.fillStyle(0x2a2a2a, 1);
  graphics.fillCircle(-8, 8, 10);
  graphics.fillStyle(0x1a1a1a, 1);
  graphics.fillCircle(-8, 8, 7);
  graphics.fillStyle(0x000000, 1);
  graphics.fillCircle(-8, 8, 4);
  
  // Kukri on belt
  graphics.fillStyle(0x888888, 1);
  graphics.fillRect(-28, 12, 18, 4);
  graphics.fillStyle(0x4a3a2a, 1);
  graphics.fillRect(-32, 10, 6, 8);
}

/**
 * Draw a smaller version of Demoman's head for secondary display
 * @param isUbered - If true, draws a bright red Über glow around the head
 * @param chargeBuildup - How close Demo is to charging (0-1), affects aura brightness
 * @param isFakeHead - If true, this is Spy's disguise - shows WRONG eye glowing
 */
export function drawDemomanHeadSmall(graphics: Phaser.GameObjects.Graphics, isUbered: boolean = false, chargeBuildup: number = 1, isFakeHead: boolean = false, demoEyeGlowing: boolean = false, realActiveEye: 'LEFT' | 'RIGHT' | 'NONE' = 'NONE'): void {
  graphics.clear();
  
  // Draw ghostly aura based on charge buildup (red when Übered, green normally)
  const easedBuildup = chargeBuildup * chargeBuildup * chargeBuildup;
  const pulse = chargeBuildup > 0.75 ? Math.sin(Date.now() * 0.01) * 0.15 : 0;
  const auraOpacity = 0.05 + easedBuildup * 0.45 + (pulse * easedBuildup);
  const auraSize = 50 + easedBuildup * 18;
  
  const auraColorOuter = isUbered ? 0xff4444 : 0x00ff44;
  const auraColorInner = isUbered ? 0xff6666 : 0x44ff88;
  
  graphics.fillStyle(auraColorOuter, auraOpacity * 0.4);
  graphics.fillCircle(0, 0, auraSize + 15);
  graphics.fillStyle(auraColorOuter, auraOpacity * 0.6);
  graphics.fillCircle(0, 0, auraSize);
  graphics.fillStyle(auraColorInner, auraOpacity * 0.8);
  graphics.fillCircle(0, 0, auraSize - 12);
  
  // Draw Medic ghost if Übered (in addition to red charge aura)
  if (isUbered) {
    // Draw small Medic ghost hovering near head
    const ghostX = 38;
    const ghostY = -25;
    
    // Ghost outer glow
    graphics.fillStyle(0xff4444, 0.2);
    graphics.fillCircle(ghostX, ghostY, 18);
    
    // Ghost body (translucent red)
    graphics.fillStyle(0xff4444, 0.5);
    graphics.fillCircle(ghostX, ghostY - 4, 6);
    graphics.beginPath();
    graphics.moveTo(ghostX - 6, ghostY + 2);
    graphics.lineTo(ghostX + 6, ghostY + 2);
    graphics.lineTo(ghostX + 4, ghostY + 15);
    graphics.lineTo(ghostX - 4, ghostY + 15);
    graphics.closePath();
    graphics.fill();
    
    // Medic cross (small)
    graphics.fillStyle(0xffffff, 0.7);
    graphics.fillRect(ghostX - 1, ghostY + 4, 2, 6);
    graphics.fillRect(ghostX - 2, ghostY + 6, 4, 2);
    
    // Ghost eyes
    graphics.fillStyle(0xff8888, 0.9);
    graphics.fillCircle(ghostX - 2, ghostY - 5, 1.5);
    graphics.fillCircle(ghostX + 2, ghostY - 5, 1.5);
  }
  
  // Shadow
  graphics.fillStyle(0x000000, 0.3);
  graphics.fillEllipse(0, 35, 50, 15);
  
  // Head - smaller
  graphics.fillStyle(0x3a2a1a, 1);
  graphics.fillCircle(0, 0, 30);
  
  // Beanie (dark blue/black)
  graphics.fillStyle(0x1a1a2a, 1);
  graphics.beginPath();
  graphics.arc(0, -5, 32, Math.PI, 0, false);
  graphics.closePath();
  graphics.fillPath();
  
  // Beanie rim
  graphics.fillStyle(0x2a2a3a, 1);
  graphics.fillRect(-32, -7, 64, 5);
  
  // Beard
  graphics.fillStyle(0x1a1a1a, 1);
  graphics.fillEllipse(0, 22, 35, 22);
  
  // Eyepatch
  graphics.fillStyle(0x111111, 1);
  graphics.fillCircle(12, -5, 12);
  graphics.fillRect(10, -22, 6, 18);
  
  // Eye socket / glow - use red when Übered
  const eyeGlowColor = isUbered ? 0xff4444 : 0x00ff44;
  
  // For Spy's fake head: show the WRONG eye glowing!
  const showLeftGlow = isFakeHead 
    ? (demoEyeGlowing && realActiveEye === 'RIGHT')
    : (demoEyeGlowing && realActiveEye === 'LEFT');
  const showRightGlow = isFakeHead
    ? (demoEyeGlowing && realActiveEye === 'LEFT')
    : (demoEyeGlowing && realActiveEye === 'RIGHT');
  
  if (showLeftGlow) {
    graphics.fillStyle(eyeGlowColor, 0.8);
    graphics.fillCircle(-12, -5, 15);
    graphics.fillStyle(eyeGlowColor, 1);
    graphics.fillCircle(-12, -5, 8);
  } else if (isUbered) {
    // Red aura in socket when Übered
    graphics.fillStyle(0xff4444, 0.4);
    graphics.fillCircle(-12, -5, 12);
    graphics.fillStyle(0x000000, 1);
    graphics.fillCircle(-12, -5, 8);
  } else {
    graphics.fillStyle(0x000000, 1);
    graphics.fillCircle(-12, -5, 10);
  }
  
  if (showRightGlow) {
    graphics.fillStyle(eyeGlowColor, 0.6);
    graphics.fillCircle(12, -5, 14);
  } else if (isUbered) {
    // Red glow visible through eyepatch when Übered
    graphics.fillStyle(0xff4444, 0.3);
    graphics.fillCircle(12, -5, 10);
  }
}

/**
 * Draw character model for jumpscare - reuses camera/gallery poses exactly
 */
export function drawJumpscareSilhouette(
  graphics: Phaser.GameObjects.Graphics,
  isScout: boolean,
  isSoldier: boolean,
  isDemoman: boolean,
  isHeavy: boolean,
  isSniper: boolean,
  isPyro: boolean = false
): void {
  graphics.clear();
  
  // Use the exact same drawing functions as camera/gallery - no extra overlays
  if (isPyro) {
    // Pyro floating mask - eerie gas mask with glowing eyes
    drawPyroMaskJumpscare(graphics);
  } else if (isScout) {
    drawEnemySilhouette(graphics, 'SCOUT');
  } else if (isSoldier) {
    drawEnemySilhouette(graphics, 'SOLDIER');
  } else if (isDemoman) {
    drawEnemySilhouette(graphics, 'DEMOMAN_BODY');
  } else if (isHeavy) {
    drawHeavySilhouette(graphics, false);
  } else if (isSniper) {
    drawSniperSilhouette(graphics, false);
  } else {
    // Default - generic figure
    graphics.fillStyle(0x444444, 1);
    graphics.fillCircle(0, -50, 30);
    graphics.fillStyle(0xff0000, 1);
    graphics.fillCircle(-10, -55, 8);
    graphics.fillCircle(10, -55, 8);
    graphics.fillStyle(0x444444, 1);
    graphics.fillRect(-35, -20, 70, 90);
  }
}

/**
 * Draw Pyro's floating mask for jumpscare - larger and more menacing
 */
export function drawPyroMaskJumpscare(graphics: Phaser.GameObjects.Graphics): void {
  // Dark background glow (fire aura)
  graphics.fillStyle(0xff4400, 0.3);
  graphics.fillCircle(0, 0, 80);
  graphics.fillStyle(0xff6600, 0.2);
  graphics.fillCircle(0, 0, 100);
  
  // Mask base - dark rubber/leather look
  graphics.fillStyle(0x222222, 1);
  graphics.fillEllipse(0, 0, 100, 120);
  
  // Mask shape - rounded bottom for filter area
  graphics.fillStyle(0x1a1a1a, 1);
  graphics.fillEllipse(0, 30, 80, 60);
  
  // Eye lenses - large circular with eerie white glow
  graphics.fillStyle(0x111111, 1);
  graphics.fillCircle(-25, -15, 22);
  graphics.fillCircle(25, -15, 22);
  
  // Eye lens rims
  graphics.lineStyle(3, 0x333333, 1);
  graphics.strokeCircle(-25, -15, 22);
  graphics.strokeCircle(25, -15, 22);
  
  // Glowing white eyes - the signature Pyro stare
  graphics.fillStyle(0xffffff, 1);
  graphics.fillCircle(-25, -15, 12);
  graphics.fillCircle(25, -15, 12);
  
  // Inner eye glow
  graphics.fillStyle(0xffeecc, 0.8);
  graphics.fillCircle(-25, -15, 8);
  graphics.fillCircle(25, -15, 8);
  
  // Filter canister (center bottom of mask)
  graphics.fillStyle(0x2a2a2a, 1);
  graphics.fillCircle(0, 35, 25);
  graphics.lineStyle(2, 0x444444, 1);
  graphics.strokeCircle(0, 35, 25);
  
  // Filter ridges
  graphics.lineStyle(2, 0x333333, 1);
  for (let i = -15; i <= 15; i += 6) {
    graphics.beginPath();
    graphics.arc(0, 35, 20, 
      Phaser.Math.DegToRad(180 + i * 3), 
      Phaser.Math.DegToRad(180 + i * 3 + 30), false);
    graphics.strokePath();
  }
  
  // Straps (side of head)
  graphics.lineStyle(4, 0x333333, 1);
  graphics.beginPath();
  graphics.moveTo(-50, -10);
  graphics.lineTo(-60, -30);
  graphics.strokePath();
  graphics.beginPath();
  graphics.moveTo(50, -10);
  graphics.lineTo(60, -30);
  graphics.strokePath();
}

/**
 * Draw celebrating mercs for good ending
 */
export function drawCelebratingMercs(graphics: Phaser.GameObjects.Graphics): void {
  const baseY = 380;
  const spacing = 120;
  const startX = 640 - (spacing * 4);
  
  // Simple celebratory silhouettes for each merc
  const mercColors = [
    0x9966cc, // Scout
    0xaa5544, // Soldier  
    0x44cc44, // Demoman
    0xaa7744, // Heavy
    0xff4444, // Sniper
    0x666677, // Spy
    0xff6622, // Pyro
    0xff4444, // Medic
    0xff6600, // Engineer (center, golden)
  ];
  
  mercColors.forEach((color, i) => {
    const x = startX + i * spacing;
    const isEngineer = i === 8;
    
    // Glow behind
    graphics.fillStyle(color, 0.2);
    graphics.fillCircle(x, baseY - 20, 50);
    
    // Body silhouette
    graphics.fillStyle(color, 0.8);
    graphics.fillCircle(x, baseY - 40, 25); // Head
    graphics.fillRoundedRect(x - 20, baseY - 10, 40, 50, 8); // Body
    
    // Arms up in celebration
    graphics.fillRect(x - 35, baseY - 30, 15, 35); // Left arm
    graphics.fillRect(x + 20, baseY - 30, 15, 35); // Right arm
    
    // Engineer gets special treatment
    if (isEngineer) {
      graphics.fillStyle(0xffcc00, 0.5);
      graphics.fillCircle(x, baseY - 20, 60);
    }
  });
}

