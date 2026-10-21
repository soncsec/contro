import type Phaser from 'phaser';
import type { MusicKey, SoundKey } from '../assets/manifest';
import { SOUNDS } from '../assets/manifest';
import { SOUND } from '../config/tuning';
import { volumeFactor } from '../logic/volume';
import { SaveStore } from './SaveStore';

let manager: Phaser.Sound.BaseSoundManager | null = null;
let current: { key: MusicKey; track: Phaser.Sound.BaseSound } | null = null;
let wanted: MusicKey | null = null;
/** Recent sounds, newest last (for tests). */
const recent: SoundKey[] = [];

const loaded = (key: SoundKey): boolean => manager?.game.cache.audio.exists(key) ?? false;

const musicVolume = (): number => SOUND.musicVolume * volumeFactor(SaveStore.load().musicLevel);
const sfxVolume = (): number => SOUND.sfxVolume * volumeFactor(SaveStore.load().sfxLevel);

/** A playing track's volume (Web Audio and HTML5 audio sounds both have setVolume). */
function setTrackVolume(track: Phaser.Sound.BaseSound, volume: number): void {
  const t = track as Phaser.Sound.BaseSound & { setVolume?: (v: number) => unknown };
  t.setVolume?.(volume);
}

function remember(key: SoundKey): void {
  recent.push(key);
  if (recent.length > SOUND.recent) recent.shift();
}

/**
 * The game's sound (M3.6): effects, one music loop at a time that carries across scenes, and
 * the saved music and effects volume (M6.2: OFF/LOW/MID/HIGH). Browsers keep audio locked until
 * the first key or tap; the music starts then.
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
    sound.once('unlocked', () => {
      const key = wanted;
      wanted = null;
      GameSound.music(key);
    });
  },

  /** True if any sound plays: music or effects above OFF. */
  get on(): boolean {
    const save = SaveStore.load();
    return save.musicLevel > 0 || save.sfxLevel > 0;
  },

  get musicLevel(): number {
    return SaveStore.load().musicLevel;
  },

  get sfxLevel(): number {
    return SaveStore.load().sfxLevel;
  },

  /** Sets the music volume level, remembers it, and applies it to the music playing now. */
  setMusicLevel(level: number): void {
    SaveStore.update((save) => ({ ...save, musicLevel: level }));
    if (current) setTrackVolume(current.track, musicVolume());
  },

  /** Sets the effects volume level and remembers it. */
  setSfxLevel(level: number): void {
    SaveStore.update((save) => ({ ...save, sfxLevel: level }));
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
    const volume = sfxVolume();
    if (!manager || manager.locked || !loaded(key) || volume <= 0) return;
    manager.play(key, { volume });
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
    // A silent loop still plays, so turning the music back up resumes it where it is.
    const track = manager.add(key, { loop: true, volume: musicVolume() });
    track.play();
    current = { key, track };
  },

  /**
   * Sound on (any volume above OFF), the volume levels, the music that should be playing (null for none), the music actually
   * playing (null until the browser unlocks audio), and recent sounds.
   */
  snapshot(): {
    on: boolean;
    musicLevel: number;
    sfxLevel: number;
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
      musicLevel: GameSound.musicLevel,
      sfxLevel: GameSound.sfxLevel,
      music: wanted,
      playing,
      locked: manager?.locked ?? true,
      loaded: keys,
      recent: [...recent],
    };
  },
};
