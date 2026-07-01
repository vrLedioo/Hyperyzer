/**
 * Global timing for the Hyperyzer ad.
 *
 * Ported 1:1 from the design handoff (`animations.jsx`): a 30.0s vertical ad,
 * choreographed at 1080×1920. The whole piece is a deterministic function of
 * one input — `time` in seconds — so the frame rate is purely a render choice.
 * We render at 30fps (900 frames); every animation is time-based (seconds), so
 * motion stays smooth and the cut is identical regardless of fps.
 */

export const FPS = 30;
export const DURATION_SECONDS = 30;
export const DURATION = FPS * DURATION_SECONDS; // 900 frames

// Design canvas (the hero 9:16 format everything is choreographed against).
export const DESIGN_WIDTH = 1080;
export const DESIGN_HEIGHT = 1920;

/**
 * Scene windows in seconds on the master 0–30 timeline. Overlapping ends/starts
 * produce cross-fades (each scene's Pop wrapper handles its own in/out). These
 * are the authoritative `<Sprite start end>` bounds used in HyperyzerAd.tsx.
 */
export const SCENES = {
  hook: { start: 0, end: 3.7 },
  problem: { start: 3.5, end: 6.15 },
  reveal: { start: 5.9, end: 8.25 },
  demo: { start: 8.0, end: 16.3 },
  studio: { start: 16.1, end: 22.25 },
  pricing: { start: 22.0, end: 26.15 },
  cta: { start: 25.9, end: 30 },
} as const;

export type SceneName = keyof typeof SCENES;
