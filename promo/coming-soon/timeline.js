/**
 * Shared timeline for the "Coming soon" reel. scene.js (visuals) and
 * audio.js (sound effects) both read these numbers so the pen scratches,
 * page rustles and the chime always line up with what's on screen.
 * All times are in seconds.
 */
(function (root) {
  const TIMELINE = {
    duration: 18,
    fps: 30,

    // The four herbarium plates that turn past before the logo.
    plateStarts: [0.3, 2.9, 5.5, 8.1],
    plateDraw: 1.35,        // ink lines draw in over this long
    plateWashIn: [0.9, 1.9], // watercolour bloom (relative to plate start)
    plateOut: [2.3, 2.75],  // plate fades as the next one starts drawing

    // PL. V — the sunflower that becomes the logo.
    sun: {
      start: 10.7,
      draw: 1.55,
      washIn: [1.1, 1.9],
      drain: [2.1, 2.9],    // wash drains, ink turns gold, label leaves
      move: [2.6, 3.5],     // plate drawing settles into logo position
      crossfade: [2.45, 3.2], // hand-drawn sketch → the real logo artwork
      sparkles: [13.9, 14.8],   // pop-in window (staggered per sparkle)
      shimmer: [14.0, 15.3],
      fadeOut: [17.0, 17.8]
    },

    // Logo lock-up text, absolute times [in, fully in].
    text: {
      wordmark: [14.2, 15.0],
      taglineId: [14.6, 15.3],
      taglineEn: [14.8, 15.5],
      ornament: [15.0, 15.6],
      comingSoon: [15.2, 15.9],
      handle: [15.5, 16.2]
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = TIMELINE;
  else root.TIMELINE = TIMELINE;
})(this);
