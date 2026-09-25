/**
 * Shared timeline for the "Coming soon" reel. scene.js (visuals) and
 * audio.js (sound effects) both read these numbers so every paper tap,
 * sheet slide and chime lines up with what's on screen.
 * All times are in seconds. Plate-relative times are offsets from that
 * plate's start.
 */
(function (root) {
  const TIMELINE = {
    duration: 21,
    fps: 30,        // output frame rate (what Instagram gets)
    stepFps: 12,    // stop-motion rate: the picture only changes 12×/s ("on twos")

    // Plates I–IV, each a sheet of paper.
    plateStarts: [0.2, 3.2, 6.2, 9.2],
    plate: {
      stamp: 0.05,            // "PL." sticker thumps down
      assemble: [0.25, 1.75], // cut-paper pieces placed one by one
      tag: 1.45,              // name tag flips over
      exit: [2.45, 3.1]       // sheet lifts and slides off
    },

    // PL. V — the sunflower that becomes the logo (relative to sun.start).
    sun: {
      start: 12.2,
      assemble: [0.25, 1.95],
      tag: 1.6,
      unlabel: [2.1, 2.5],    // sticker + tag lifted away
      flip: [2.15, 2.95],     // pieces flip over to their gold side
      press: [2.8, 3.2],      // shadows flatten: pressed into the page
      crossfade: [3.0, 3.5],  // paper sunflower → the real logo artwork
      move: [2.95, 3.75]      // settles into logo position
    },

    // Absolute times for the lock-up.
    sparkles: [15.9, 16.7],
    shimmer: [16.5, 17.5],
    lockup: { letters: [15.95, 16.75], tagline: 16.6, comingSoon: 16.9, handle: 17.15 },

    // A blank PL. I sheet slides back over everything: the loop closes.
    cover: [20.2, 20.8],

    // Paper butterfly visits (absolute); flight paths live in scene.js.
    butterfly: [[3.45, 6.3], [17.7, 20.3]],

    // Loose pieces tumbling as a sheet is pulled away: [plate index, start].
    falls: [[0, 2.7], [2, 8.7], [3, 11.7]]
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = TIMELINE;
  else root.TIMELINE = TIMELINE;
})(this);
