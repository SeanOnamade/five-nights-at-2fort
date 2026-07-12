import Phaser from 'phaser';

/**
 * Per-room prop silhouettes shared by the camera feed (green night-vision)
 * and the teleported room view (warm terminal browns). Props are drawn
 * relative to a back-wall bounds rect so the same geometry works in both
 * views; the central third is kept clear for the doorway.
 */

export type RoomPropsPalette = 'feed' | 'warm';

export interface RoomBounds {
  /** Back wall rect */
  x: number;
  y: number;
  w: number;
  h: number;
  /** How far the visible floor extends below the back wall's bottom edge */
  floorDepth: number;
}

interface PropColors {
  dark: number;   // deep shadow fill
  mid: number;    // main prop fill
  line: number;   // outline / detail lines
  accent: number; // wainscot-red or bright-green accent
}

const COLORS: Record<RoomPropsPalette, PropColors> = {
  feed: { dark: 0x02140a, mid: 0x0a2e16, line: 0x1a5a2e, accent: 0x0f4020 },
  warm: { dark: 0x100a05, mid: 0x2a1c0e, line: 0x4a341c, accent: 0x5e2a16 },
};

export function drawRoomProps(
  g: Phaser.GameObjects.Graphics,
  node: string,
  b: RoomBounds,
  palette: RoomPropsPalette
): void {
  const c = COLORS[palette];
  g.clear();

  // Convenience: left/right prop zones flanking the central doorway
  const leftX = b.x + b.w * 0.03;
  const leftW = b.w * 0.26;
  const rightX = b.x + b.w * 0.71;
  const rightW = b.w * 0.26;
  const wallBottom = b.y + b.h;
  const floorY = wallBottom + b.floorDepth * 0.35; // a bit onto the floor

  switch (node) {
    case 'BRIDGE': {
      // Guard rails along both sides of the back wall + plank lines on the floor
      const railY = b.y + b.h * 0.48;
      g.lineStyle(3, c.line, 0.9);
      g.lineBetween(leftX, railY, leftX + leftW, railY);
      g.lineBetween(rightX, railY, rightX + rightW, railY);
      g.lineStyle(2, c.line, 0.7);
      for (let i = 0; i <= 3; i++) {
        const lx = leftX + (leftW / 3) * i;
        const rx = rightX + (rightW / 3) * i;
        g.lineBetween(lx, railY, lx, wallBottom);
        g.lineBetween(rx, railY, rx, wallBottom);
      }
      // Plank seams on the floor
      g.lineStyle(1, c.line, 0.35);
      for (let i = 1; i <= 3; i++) {
        const y = wallBottom + (b.floorDepth * 0.7 * i) / 4;
        g.lineBetween(b.x - b.w * 0.02 * i, y, b.x + b.w + b.w * 0.02 * i, y);
      }
      break;
    }

    case 'COURTYARD': {
      // Crate stack on the left
      const crate = b.w * 0.11;
      g.fillStyle(c.mid, 1);
      g.fillRect(leftX, wallBottom - crate, crate, crate);
      g.fillRect(leftX + crate + 4, wallBottom - crate, crate, crate);
      g.fillRect(leftX + crate * 0.5, wallBottom - crate * 2 - 4, crate, crate);
      g.lineStyle(2, c.line, 0.8);
      g.strokeRect(leftX, wallBottom - crate, crate, crate);
      g.strokeRect(leftX + crate + 4, wallBottom - crate, crate, crate);
      g.strokeRect(leftX + crate * 0.5, wallBottom - crate * 2 - 4, crate, crate);
      // Diagonal cross braces on the crates
      g.lineStyle(1, c.line, 0.6);
      g.lineBetween(leftX, wallBottom - crate, leftX + crate, wallBottom);
      g.lineBetween(leftX + crate * 0.5, wallBottom - crate * 2 - 4, leftX + crate * 1.5, wallBottom - crate - 4);
      // Fence posts + rail on the right
      const postTop = b.y + b.h * 0.42;
      g.lineStyle(3, c.line, 0.8);
      g.lineBetween(rightX, postTop + 6, rightX + rightW, postTop + 6);
      for (let i = 0; i <= 3; i++) {
        const px = rightX + (rightW / 3) * i;
        g.lineBetween(px, postTop, px, wallBottom);
      }
      break;
    }

    case 'GRATE': {
      // Big slatted grate panel on the left wall
      const gw = leftW;
      const gh = b.h * 0.52;
      const gy = b.y + b.h * 0.28;
      g.fillStyle(c.dark, 1);
      g.fillRect(leftX, gy, gw, gh);
      g.lineStyle(2, c.line, 0.9);
      g.strokeRect(leftX, gy, gw, gh);
      g.lineStyle(2, c.line, 0.6);
      for (let i = 1; i <= 4; i++) {
        const y = gy + (gh / 5) * i;
        g.lineBetween(leftX + 3, y, leftX + gw - 3, y);
      }
      // Smaller vent high on the right
      const vw = rightW * 0.6;
      const vh = b.h * 0.2;
      const vy = b.y + b.h * 0.18;
      g.fillStyle(c.dark, 1);
      g.fillRect(rightX + rightW * 0.2, vy, vw, vh);
      g.lineStyle(1, c.line, 0.7);
      g.strokeRect(rightX + rightW * 0.2, vy, vw, vh);
      g.lineBetween(rightX + rightW * 0.2 + 2, vy + vh / 2, rightX + rightW * 0.2 + vw - 2, vy + vh / 2);
      break;
    }

    case 'STAIRCASE': {
      // Steps rising to the right, with a handrail above them
      const steps = 4;
      const stepW = rightW / steps;
      g.fillStyle(c.mid, 1);
      for (let i = 0; i < steps; i++) {
        const sh = (b.h * 0.14) * (i + 1);
        g.fillRect(rightX + stepW * i, wallBottom - sh, stepW, sh);
      }
      g.lineStyle(2, c.line, 0.8);
      for (let i = 0; i < steps; i++) {
        const sh = (b.h * 0.14) * (i + 1);
        g.strokeRect(rightX + stepW * i, wallBottom - sh, stepW, sh);
      }
      // Handrail
      g.lineStyle(3, c.line, 0.9);
      g.lineBetween(rightX, wallBottom - b.h * 0.3, rightX + rightW, wallBottom - b.h * 0.72);
      g.lineStyle(2, c.line, 0.7);
      g.lineBetween(rightX, wallBottom - b.h * 0.3, rightX, wallBottom - b.h * 0.14);
      g.lineBetween(rightX + rightW, wallBottom - b.h * 0.72, rightX + rightW, wallBottom - b.h * 0.56);
      break;
    }

    case 'SPIRAL': {
      // Central support column on the left with curved rail arcs
      const colX = leftX + leftW * 0.45;
      const colW = b.w * 0.045;
      g.fillStyle(c.mid, 1);
      g.fillRect(colX, b.y + b.h * 0.12, colW, b.h * 0.88);
      g.lineStyle(2, c.line, 0.8);
      g.strokeRect(colX, b.y + b.h * 0.12, colW, b.h * 0.88);
      // Spiral rail arcs wrapping the column
      g.lineStyle(2, c.line, 0.7);
      g.strokeEllipse(colX + colW / 2, b.y + b.h * 0.42, leftW * 0.9, b.h * 0.16);
      g.strokeEllipse(colX + colW / 2, b.y + b.h * 0.68, leftW * 1.1, b.h * 0.18);
      // A step edge peeking from behind the column
      g.fillStyle(c.dark, 1);
      g.fillRect(leftX, wallBottom - b.h * 0.16, leftW * 0.7, b.h * 0.16);
      g.lineStyle(1, c.line, 0.6);
      g.strokeRect(leftX, wallBottom - b.h * 0.16, leftW * 0.7, b.h * 0.16);
      break;
    }

    case 'LEFT_HALL':
    case 'RIGHT_HALL': {
      // Receding door frames along one wall (mirrored per hall side)
      const onLeft = node === 'LEFT_HALL';
      const zx = onLeft ? leftX : rightX;
      const zw = onLeft ? leftW : rightW;
      const d1w = zw * 0.5;
      const d2w = zw * 0.34;
      const d1h = b.h * 0.62;
      const d2h = b.h * 0.46;
      const d1x = onLeft ? zx : zx + zw - d1w;
      const d2x = onLeft ? zx + d1w + zw * 0.12 : zx + zw - d1w - zw * 0.12 - d2w;
      g.fillStyle(c.dark, 1);
      g.fillRect(d1x, wallBottom - d1h, d1w, d1h);
      g.fillRect(d2x, wallBottom - d2h, d2w, d2h);
      g.lineStyle(2, c.line, 0.8);
      g.strokeRect(d1x, wallBottom - d1h, d1w, d1h);
      g.strokeRect(d2x, wallBottom - d2h, d2w, d2h);
      // Skirting line running down the hall
      g.lineStyle(2, c.accent, 0.7);
      g.lineBetween(zx, wallBottom - b.h * 0.1, zx + zw, wallBottom - b.h * 0.16);
      break;
    }

    case 'SEWER': {
      // Pipe run along the top of the back wall with joints and a drip pipe
      const pipeY = b.y + b.h * 0.16;
      g.lineStyle(5, c.mid, 1);
      g.lineBetween(b.x, pipeY, b.x + b.w * 0.32, pipeY);
      g.lineBetween(b.x + b.w * 0.68, pipeY, b.x + b.w, pipeY);
      g.fillStyle(c.line, 0.9);
      g.fillRect(b.x + b.w * 0.1 - 3, pipeY - 5, 6, 10);   // joint
      g.fillRect(b.x + b.w * 0.86 - 3, pipeY - 5, 6, 10);  // joint
      // Vertical drip pipe on the right
      g.lineStyle(4, c.mid, 1);
      g.lineBetween(b.x + b.w * 0.86, pipeY, b.x + b.w * 0.86, wallBottom);
      // Water channel on the left floor
      const chY = floorY;
      g.fillStyle(c.dark, 0.9);
      g.fillRect(b.x - b.w * 0.02, chY, b.w * 0.3, b.floorDepth * 0.14);
      g.lineStyle(1, c.line, 0.6);
      g.strokeRect(b.x - b.w * 0.02, chY, b.w * 0.3, b.floorDepth * 0.14);
      // Water glints
      g.lineStyle(1, c.line, 0.4);
      g.lineBetween(b.x + b.w * 0.02, chY + b.floorDepth * 0.07, b.x + b.w * 0.08, chY + b.floorDepth * 0.07);
      g.lineBetween(b.x + b.w * 0.14, chY + b.floorDepth * 0.05, b.x + b.w * 0.2, chY + b.floorDepth * 0.05);
      break;
    }

    default:
      // Unknown node (e.g. INTEL) — no props
      break;
  }
}
