import Phaser from 'phaser';
import { TerminalOverlay } from './kit/overlay';
import { PALETTE, terminalStyle, osdStyle } from './kit/theme';
import { getSettings, updateSettings } from '../utils/settings';
import { playMenuToggleOffSound, playMenuToggleOnSound } from '../utils/menuSounds';

/**
 * Settings overlay: music/SFX volume sliders, audio logs toggle, fullscreen.
 * Opened from the home screen and the pause menu.
 */
export class SettingsOverlay extends TerminalOverlay {
  constructor(scene: Phaser.Scene, onClose?: () => void) {
    super(scene, 'SYSTEM CONFIG', onClose);
  }

  create(): void {
    super.create(560, 500, 300);
  }

  protected buildContent(): void {
    const s = getSettings();
    const leftX = this.panelX - this.panelWidth / 2 + 40;
    let y = this.panelY - this.panelHeight / 2 + 100;

    this.addSlider(leftX, y, 'MUSIC VOLUME', s.musicVolume, (v) => updateSettings({ musicVolume: v }));
    y += 60;
    this.addToggle(leftX, y, 'MUTE MUSIC', () => getSettings().musicMuted, (on) => updateSettings({ musicMuted: on }));
    y += 70;
    this.addSlider(leftX, y, 'SFX VOLUME', s.sfxVolume, (v) => updateSettings({ sfxVolume: v }));
    y += 80;
    this.addToggle(leftX, y, 'AUDIO LOGS', () => getSettings().audioLogs, (on) => updateSettings({ audioLogs: on }));
    y += 60;
    this.addToggle(
      leftX,
      y,
      'FULLSCREEN',
      () => this.scene.scale.isFullscreen,
      (on) => {
        if (on) {
          // Fullscreen the whole container (not just the canvas) so DOM
          // overlays like the dev input stay visible in fullscreen.
          const container = document.getElementById('game-container');
          if (container) this.scene.scale.fullscreenTarget = container;
          this.scene.scale.startFullscreen();
        } else {
          this.scene.scale.stopFullscreen();
        }
      }
    );
    y += 50;

    const note = this.scene.add.text(
      leftX,
      y,
      'Audio logs: Engineer voice recordings at the start of each night.',
      osdStyle(15, PALETTE.amberFaintCss)
    );
    this.add(note);
  }

  private addSlider(
    x: number,
    y: number,
    label: string,
    initial: number,
    onChange: (v: number) => void
  ): void {
    const trackX = x + 230;
    const trackW = 200;

    const labelText = this.scene.add.text(x, y, label, terminalStyle(24, PALETTE.amberDimCss)).setOrigin(0, 0.5);
    this.add(labelText);

    const track = this.scene.add.rectangle(trackX + trackW / 2, y, trackW, 6, PALETTE.amberFaint);
    this.add(track);

    const fill = this.scene.add
      .rectangle(trackX, y, trackW * initial, 6, PALETTE.amber)
      .setOrigin(0, 0.5);
    this.add(fill);

    const handle = this.scene.add.rectangle(trackX + trackW * initial, y, 10, 22, PALETTE.cream);
    this.add(handle);

    const valueText = this.scene.add
      .text(trackX + trackW + 20, y, `${Math.round(initial * 100)}%`, terminalStyle(22, PALETTE.creamCss))
      .setOrigin(0, 0.5);
    this.add(valueText);

    const applyFromPointer = (pointerX: number) => {
      const v = Phaser.Math.Clamp((pointerX - trackX) / trackW, 0, 1);
      fill.width = trackW * v;
      handle.x = trackX + trackW * v;
      valueText.setText(`${Math.round(v * 100)}%`);
      onChange(v);
    };

    // Wide invisible hit zone covering track + handle
    const hit = this.scene.add.rectangle(trackX + trackW / 2, y, trackW + 24, 34, 0x000000, 0.001);
    hit.setInteractive({ useHandCursor: true, draggable: true });
    hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => applyFromPointer(pointer.x));
    hit.on('drag', (pointer: Phaser.Input.Pointer) => applyFromPointer(pointer.x));
    this.add(hit);
  }

  private addToggle(
    x: number,
    y: number,
    label: string,
    getValue: () => boolean,
    onChange: (on: boolean) => void
  ): void {
    const labelText = this.scene.add.text(x, y, label, terminalStyle(24, PALETTE.amberDimCss)).setOrigin(0, 0.5);
    this.add(labelText);

    const valueText = this.scene.add
      .text(x + 230, y, getValue() ? '[ ON ]' : '[ OFF ]', terminalStyle(24, getValue() ? PALETTE.creamCss : PALETTE.amberFaintCss))
      .setOrigin(0, 0.5);
    valueText.setInteractive({ useHandCursor: true });
    valueText.on('pointerover', () => valueText.setColor(PALETTE.amberCss));
    valueText.on('pointerout', () => {
      valueText.setColor(getValue() ? PALETTE.creamCss : PALETTE.amberFaintCss);
    });
    valueText.on('pointerdown', () => {
      const next = !getValue();
      if (next) playMenuToggleOnSound();
      else playMenuToggleOffSound();
      onChange(next);
      valueText.setText(next ? '[ ON ]' : '[ OFF ]');
      valueText.setColor(next ? PALETTE.creamCss : PALETTE.amberFaintCss);
    });
    this.add(valueText);
  }
}
