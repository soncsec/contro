import type Phaser from 'phaser';
import type { MusicKey, SoundKey } from '../assets/manifest';
import { SOUNDS } from '../assets/manifest';
import { SOUND } from '../config/tuning';
import { SaveStore } from './SaveStore';

let manager: Phaser.Sound.BaseSoundManager | null = null;
let current: { key: MusicKey; track: Phaser.Sound.BaseSound } | null = null;
let wanted: MusicKey | null = null;
/** Recent sounds, newest last (for tests). */
const recent: SoundKey[] = [];

const loaded = (key: SoundKey): boolean => manager?.game.cache.audio.exists(key) ?? false;

function remember(key: SoundKey): void {
  recent.push(key);
  if (recent.length > SOUND.recent) recent.shift();
}

/**
 * The game's sound (M3.6): effects, one music loop at a time that carries across scenes, and
 * the saved sound on/off setting. Browsers keep audio locked until the first key or tap; the
 * music starts then.
 */
export const GameSound = {
  /** Call once the game exists. */
  install(sound: Phaser.Sound.BaseSoundManager): void {
    manager = sound;
    // Music that finishes loading in the background starts at once if it is wanted.
    sound.game.cache.audio.events.on('add', (_cache: unknown, key: string) => {
      if (key === wanted && current?.key !== key) {
        const k = wanted;
        wanted = null;
        GameSound.music(k);
      }
    });
    sound.mute = !SaveStore.load().soundOn;
    sound.once('unlocked', () => {
      const key = wanted;
      wanted = null;
      GameSound.music(key);
    });
  },

  get on(): boolean {
    return SaveStore.load().soundOn;
  },

  /** Turns sound on or off, and remembers it. */
  setOn(on: boolean): void {
    SaveStore.update((save) => ({ ...save, soundOn: on }));
    if (manager) manager.mute = !on;
  },

  /**
   * Starts loading any music loop not loaded yet, in the background on `scene`'s loader
   * (M3.6). Called by the title and every level, so a loader cut short by a scene change is
   * simply started again by the next scene.
   */
  loadMusic(scene: Phaser.Scene): void {
    const missing = SOUNDS.filter((s) => s.music && !scene.cache.audio.exists(s.key));
    if (missing.length === 0) return;
    for (const s of missing) scene.load.audio(s.key, [...s.paths]);
    scene.load.start();
  },

  /** Plays a sound effect. */
  play(key: SoundKey): void {
    remember(key);
    if (!manager || manager.locked || !loaded(key)) return;
    manager.play(key, { volume: SOUND.sfxVolume });
  },

  /** Plays a music loop, unless it is already playing; null stops the music. */
  music(key: MusicKey | null): void {
    if (wanted === key && (current?.key === key || key === null)) return;
    wanted = key;
    current?.track.stop();
    current?.track.destroy();
    current = null;
    if (!key) return;
    remember(key);
    if (!manager || manager.locked || !loaded(key)) return;
    const track = manager.add(key, { loop: true, volume: SOUND.musicVolume });
    track.play();
    current = { key, track };
  },

  /**
   * Sound on or off, the music that should be playing (null for none), the music actually
   * playing (null until the browser unlocks audio), and recent sounds.
   */
  snapshot(): {
    on: boolean;
    music: MusicKey | null;
    playing: MusicKey | null;
    locked: boolean;
    loaded: SoundKey[];
    recent: SoundKey[];
  } {
    const playing = current?.track.isPlaying ? current.key : null;
    const keys = manager ? (manager.game.cache.audio.getKeys() as SoundKey[]) : [];
    return {
      on: GameSound.on,
      music: wanted,
      playing,
      locked: manager?.locked ?? true,
      loaded: keys,
      recent: [...recent],
    };
  },
};
