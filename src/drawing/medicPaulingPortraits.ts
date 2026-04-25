import Phaser from 'phaser';

/**
 * Medic ghost silhouette for doorway apparitions (Night 6 / endless) and Custom Night portrait.
 * Centered on (0, 0).
 */
export function drawMedicGhostSilhouette(graphics: Phaser.GameObjects.Graphics): void {
  graphics.clear();

  // Ethereal glow background
  graphics.fillStyle(0xcc6666, 0.15);
  graphics.fillCircle(0, 0, 80);
  graphics.fillStyle(0xee8888, 0.1);
  graphics.fillCircle(0, 0, 100);

  // Ghost body - wispy, ethereal (white/red tones)
  // Main body - elongated and ghostly
  graphics.fillStyle(0xffcccc, 0.6);
  graphics.beginPath();
  graphics.moveTo(-25, -30);
  graphics.lineTo(25, -30);
  graphics.lineTo(20, 50);
  graphics.lineTo(-20, 50);
  graphics.closePath();
  graphics.fillPath();

  // LEFT ARM - reaching out slightly
  graphics.fillStyle(0xffcccc, 0.55);
  // Upper arm
  graphics.beginPath();
  graphics.moveTo(-25, -25);
  graphics.lineTo(-30, -20);
  graphics.lineTo(-45, 5);
  graphics.lineTo(-38, 10);
  graphics.closePath();
  graphics.fillPath();
  // Forearm
  graphics.beginPath();
  graphics.moveTo(-45, 5);
  graphics.lineTo(-38, 10);
  graphics.lineTo(-50, 35);
  graphics.lineTo(-58, 30);
  graphics.closePath();
  graphics.fillPath();
  // Hand
  graphics.fillStyle(0xffeedd, 0.6);
  graphics.fillCircle(-54, 35, 8);

  // RIGHT ARM - holding syringe, extended forward
  graphics.fillStyle(0xffcccc, 0.55);
  // Upper arm
  graphics.beginPath();
  graphics.moveTo(25, -25);
  graphics.lineTo(30, -20);
  graphics.lineTo(40, 0);
  graphics.lineTo(33, 5);
  graphics.closePath();
  graphics.fillPath();
  // Forearm - angled toward viewer
  graphics.beginPath();
  graphics.moveTo(40, 0);
  graphics.lineTo(33, 5);
  graphics.lineTo(28, -5);
  graphics.lineTo(35, -10);
  graphics.closePath();
  graphics.fillPath();
  // Hand gripping syringe
  graphics.fillStyle(0xffeedd, 0.6);
  graphics.fillCircle(30, -5, 7);

  // Wispy bottom (ghost trail)
  graphics.fillStyle(0xeebbaa, 0.4);
  graphics.beginPath();
  graphics.moveTo(-20, 50);
  graphics.lineTo(20, 50);
  graphics.lineTo(15, 75);
  graphics.lineTo(5, 65);
  graphics.lineTo(-5, 80);
  graphics.lineTo(-10, 60);
  graphics.lineTo(-18, 70);
  graphics.closePath();
  graphics.fillPath();

  // Head - ghostly
  graphics.fillStyle(0xffeedd, 0.7);
  graphics.fillCircle(0, -45, 20);

  // Medical cross on chest (red, iconic)
  graphics.fillStyle(0xff4444, 0.8);
  graphics.fillRect(-4, -15, 8, 30);
  graphics.fillRect(-12, -3, 24, 8);

  // Eyes - empty, glowing
  graphics.fillStyle(0xff4444, 0.9);
  graphics.fillCircle(-7, -50, 4);
  graphics.fillCircle(7, -50, 4);

  // Syringe in right hand
  graphics.fillStyle(0xcccccc, 0.7);
  graphics.fillRect(32, -10, 25, 5);
  graphics.fillStyle(0xffddaa, 0.5);
  graphics.fillRect(36, -8, 15, 2);
  // Needle tip
  graphics.fillStyle(0x888888, 0.8);
  graphics.fillRect(57, -9, 8, 3);
}

/**
 * Ms. Pauling jumpscare close-up (Custom Night portrait and game-over jumpscare).
 * Centered on (0, 0).
 */
export function drawPaulingJumpscarePortrait(graphics: Phaser.GameObjects.Graphics): void {
  graphics.clear();

  // Outer purple aura (menacing glow)
  graphics.fillStyle(0x440066, 0.12);
  graphics.fillCircle(0, 0, 140);
  graphics.fillStyle(0x6622aa, 0.18);
  graphics.fillCircle(0, 0, 110);
  graphics.fillStyle(0x7733aa, 0.25);
  graphics.fillCircle(0, -10, 85);

  // Hair back volume (dark, swept back into a bun/ponytail)
  graphics.fillStyle(0x0e0e18, 1);
  graphics.fillEllipse(0, -30, 130, 110);

  // Hair side strands framing face
  graphics.fillStyle(0x0e0e18, 1);
  graphics.beginPath();
  graphics.moveTo(-52, -65);
  graphics.lineTo(-58, 10);
  graphics.lineTo(-42, 15);
  graphics.lineTo(-38, -55);
  graphics.closePath();
  graphics.fillPath();
  graphics.beginPath();
  graphics.moveTo(52, -65);
  graphics.lineTo(58, 10);
  graphics.lineTo(42, 15);
  graphics.lineTo(38, -55);
  graphics.closePath();
  graphics.fillPath();

  // Hair bun (back of head, visible at top)
  graphics.fillStyle(0x121220, 1);
  graphics.fillCircle(0, -75, 22);
  graphics.fillStyle(0x0e0e18, 1);
  graphics.fillCircle(0, -72, 18);

  // Face shape (slightly angular jaw — Pauling's sharp features)
  graphics.fillStyle(0xe8c8a0, 1);
  graphics.beginPath();
  graphics.moveTo(-38, -55);
  graphics.lineTo(-44, -20);
  graphics.lineTo(-36, 10);
  graphics.lineTo(-18, 22);
  graphics.lineTo(0, 26);
  graphics.lineTo(18, 22);
  graphics.lineTo(36, 10);
  graphics.lineTo(44, -20);
  graphics.lineTo(38, -55);
  graphics.lineTo(-20, -65);
  graphics.lineTo(0, -68);
  graphics.lineTo(20, -65);
  graphics.closePath();
  graphics.fillPath();

  // Forehead highlight
  graphics.fillStyle(0xf0d0aa, 0.4);
  graphics.fillEllipse(0, -48, 40, 16);

  // Cat-eye glasses frames (angular, swept-up outer corners)
  graphics.lineStyle(3.5, 0x333340, 1);
  // Left lens frame
  graphics.beginPath();
  graphics.moveTo(-6, -28);
  graphics.lineTo(-10, -36);
  graphics.lineTo(-20, -38);
  graphics.lineTo(-32, -36);
  graphics.lineTo(-36, -30);
  graphics.lineTo(-34, -22);
  graphics.lineTo(-22, -18);
  graphics.lineTo(-10, -20);
  graphics.lineTo(-6, -28);
  graphics.strokePath();
  // Right lens frame
  graphics.beginPath();
  graphics.moveTo(6, -28);
  graphics.lineTo(10, -36);
  graphics.lineTo(20, -38);
  graphics.lineTo(32, -36);
  graphics.lineTo(36, -30);
  graphics.lineTo(34, -22);
  graphics.lineTo(22, -18);
  graphics.lineTo(10, -20);
  graphics.lineTo(6, -28);
  graphics.strokePath();
  // Nose bridge
  graphics.lineStyle(2.5, 0x333340, 1);
  graphics.lineBetween(-6, -28, 6, -28);
  // Temple arms (going to ears)
  graphics.lineStyle(2.5, 0x333340, 0.8);
  graphics.lineBetween(-36, -32, -54, -38);
  graphics.lineBetween(36, -32, 54, -38);

  // Lens fill (slight purple tint — her signature)
  graphics.fillStyle(0xccbbdd, 0.15);
  graphics.fillEllipse(-21, -28, 26, 18);
  graphics.fillEllipse(21, -28, 26, 18);

  // Lens glare
  graphics.fillStyle(0xffffff, 0.2);
  graphics.fillCircle(-26, -32, 4);
  graphics.fillCircle(16, -32, 4);

  // Eyes — sharp, focused, slightly narrowed
  graphics.fillStyle(0xfafafa, 1);
  graphics.fillEllipse(-21, -28, 16, 11);
  graphics.fillEllipse(21, -28, 16, 11);

  // Iris (green-hazel, Pauling's eye color)
  graphics.fillStyle(0x446633, 1);
  graphics.fillCircle(-20, -28, 6);
  graphics.fillCircle(20, -28, 6);

  // Pupil
  graphics.fillStyle(0x111111, 1);
  graphics.fillCircle(-20, -28, 3);
  graphics.fillCircle(20, -28, 3);

  // Eye highlight
  graphics.fillStyle(0xffffff, 0.9);
  graphics.fillCircle(-18, -30, 1.5);
  graphics.fillCircle(22, -30, 1.5);

  // Eyelids (upper) — gives a determined/intense look
  graphics.lineStyle(2, 0x0e0e18, 0.6);
  graphics.beginPath();
  graphics.moveTo(-30, -32);
  graphics.lineTo(-21, -35);
  graphics.lineTo(-12, -32);
  graphics.strokePath();
  graphics.beginPath();
  graphics.moveTo(12, -32);
  graphics.lineTo(21, -35);
  graphics.lineTo(30, -32);
  graphics.strokePath();

  // Eyebrows (strong, angular — she means business)
  graphics.lineStyle(3, 0x0e0e18, 1);
  graphics.beginPath();
  graphics.moveTo(-34, -42);
  graphics.lineTo(-21, -47);
  graphics.lineTo(-10, -42);
  graphics.strokePath();
  graphics.beginPath();
  graphics.moveTo(10, -42);
  graphics.lineTo(21, -47);
  graphics.lineTo(34, -42);
  graphics.strokePath();

  // Nose (subtle, angled)
  graphics.lineStyle(1.5, 0xd4a880, 0.6);
  graphics.beginPath();
  graphics.moveTo(0, -18);
  graphics.lineTo(-4, -6);
  graphics.lineTo(0, -4);
  graphics.strokePath();

  // Mouth — thin, pressed together, no-nonsense expression
  graphics.lineStyle(2, 0xbb8877, 1);
  graphics.beginPath();
  graphics.moveTo(-14, 6);
  graphics.lineTo(-4, 4);
  graphics.lineTo(4, 4);
  graphics.lineTo(14, 6);
  graphics.strokePath();
  // Slight frown line
  graphics.lineStyle(1, 0xcc9988, 0.5);
  graphics.lineBetween(-10, 8, 10, 8);

  // Chin definition
  graphics.lineStyle(1, 0xd4a880, 0.3);
  graphics.beginPath();
  graphics.moveTo(-12, 18);
  graphics.lineTo(0, 22);
  graphics.lineTo(12, 18);
  graphics.strokePath();

  // Neck
  graphics.fillStyle(0xe0c098, 1);
  graphics.fillRect(-14, 24, 28, 22);

  // Purple dress shirt — her signature outfit
  graphics.fillStyle(0x5a1e8a, 1);
  graphics.beginPath();
  graphics.moveTo(-50, 42);
  graphics.lineTo(-55, 95);
  graphics.lineTo(55, 95);
  graphics.lineTo(50, 42);
  graphics.lineTo(30, 39);
  graphics.lineTo(14, 42);
  graphics.lineTo(0, 50);
  graphics.lineTo(-14, 42);
  graphics.lineTo(-30, 39);
  graphics.lineTo(-50, 42);
  graphics.closePath();
  graphics.fillPath();

  // Shirt collar / V-neckline
  graphics.fillStyle(0x6b28a8, 1);
  graphics.beginPath();
  graphics.moveTo(-14, 42);
  graphics.lineTo(0, 56);
  graphics.lineTo(14, 42);
  graphics.lineTo(10, 38);
  graphics.lineTo(0, 48);
  graphics.lineTo(-10, 38);
  graphics.closePath();
  graphics.fillPath();

  // Collar points
  graphics.fillStyle(0xe0c098, 1);
  graphics.beginPath();
  graphics.moveTo(-14, 42);
  graphics.lineTo(0, 50);
  graphics.lineTo(14, 42);
  graphics.lineTo(8, 36);
  graphics.lineTo(0, 42);
  graphics.lineTo(-8, 36);
  graphics.closePath();
  graphics.fillPath();

  // Shoulders
  graphics.fillStyle(0x5a1e8a, 1);
  graphics.fillRoundedRect(-65, 44, 22, 45, 6);
  graphics.fillRoundedRect(43, 44, 22, 45, 6);

  // Shirt wrinkle details
  graphics.lineStyle(1, 0x4a1878, 0.4);
  graphics.lineBetween(-20, 55, -8, 70);
  graphics.lineBetween(20, 55, 8, 70);
  graphics.lineBetween(-5, 60, 5, 75);

  // Derringer pistol in hand
  // Barrel
  graphics.fillStyle(0x333333, 1);
  graphics.fillRect(42, 58, 28, 6);
  graphics.fillRect(42, 56, 28, 2);
  // Barrel tip
  graphics.fillStyle(0x222222, 1);
  graphics.fillRect(68, 56, 4, 10);
  // Receiver body
  graphics.fillStyle(0x3a3a3a, 1);
  graphics.fillRoundedRect(34, 56, 14, 14, 2);
  // Grip (dark wood)
  graphics.fillStyle(0x442200, 1);
  graphics.beginPath();
  graphics.moveTo(36, 68);
  graphics.lineTo(32, 88);
  graphics.lineTo(42, 90);
  graphics.lineTo(46, 70);
  graphics.closePath();
  graphics.fillPath();
  // Grip texture lines
  graphics.lineStyle(1, 0x331a00, 0.6);
  graphics.lineBetween(35, 74, 43, 75);
  graphics.lineBetween(34, 80, 42, 81);
  graphics.lineBetween(33, 86, 41, 87);
  // Trigger guard
  graphics.lineStyle(1.5, 0x444444, 1);
  graphics.beginPath();
  graphics.moveTo(40, 68);
  graphics.lineTo(38, 76);
  graphics.lineTo(44, 76);
  graphics.lineTo(46, 68);
  graphics.strokePath();
  // Trigger
  graphics.lineStyle(1, 0x555555, 1);
  graphics.lineBetween(42, 70, 41, 74);
  // Barrel highlight
  graphics.lineStyle(0.5, 0x555555, 0.4);
  graphics.lineBetween(44, 58, 68, 58);
}
