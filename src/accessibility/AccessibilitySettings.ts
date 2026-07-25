/**
 * Comfort and accessibility settings. The blueprint asks for these to exist
 * from the start rather than being sprinkled on at the end, and for every
 * underlying option to remain individually adjustable even when a preset
 * such as Calm Mode is active.
 */
export interface ComfortSettings {
  cameraBob: boolean;
  cameraRoll: boolean;
  autoLevel: boolean;
  reducedMotion: boolean;
  /** Vertical field of view in degrees. */
  fieldOfView: number;
  /** Look sensitivity multiplier applied on top of raw input. */
  lookSensitivity: number;
  /** Soundscape level, 0 (fully silent) to 1. */
  soundVolume: number;
}

export const DEFAULT_SETTINGS: ComfortSettings = {
  cameraBob: true,
  cameraRoll: true,
  autoLevel: false,
  reducedMotion: false,
  fieldOfView: 70,
  lookSensitivity: 1,
  soundVolume: 0.7,
};

/** A single preset that turns off the motion that most commonly causes discomfort. */
export const CALM_MODE_SETTINGS: ComfortSettings = {
  cameraBob: false,
  cameraRoll: false,
  autoLevel: true,
  reducedMotion: true,
  fieldOfView: 66,
  lookSensitivity: 0.85,
  // Quieter, not silent: the ambience is most of what makes the reef feel
  // calm in the first place, so the preset turns it down rather than off.
  // 0.4 is the nearest step on the panel's slider to six tenths of default —
  // a preset that leaves its own control showing a value it cannot be set to
  // is a preset the player cannot then adjust from.
  soundVolume: 0.4,
};
