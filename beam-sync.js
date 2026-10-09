// =====================================================================
// beam-sync.js — lets other animations keep time with the card's beam
//
// The blue beam around your name card is a CSS animation (named "spin"
// in style.css). This file looks up that animation and works out when
// the beam's bright head will next pass the side of the card that faces
// a given element. Other scripts use it like this:
//
//     await BeamSync.nextPass(someElement);
//     // ...the beam head is now passing the side facing someElement
//
// js/signal.js (the chart on the right) uses it, so the chart moves in
// rhythm with the card.
// =====================================================================

window.BeamSync = (function () {
  const card = document.querySelector(".card");

  // Where the bright head of the card's beam sits, as a fraction of the
  // way round its colour circle. In style.css the beam's colours are:
  // transparent until 35%, light blue at 60%, dark blue at 85%, then
  // fading out. The brightest, leading part is around 87%.
  const BEAM_HEAD = 0.87;

  // Pause for `ms` milliseconds (1000 ms = 1 second)
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Find the card's "spin" animation (it runs on the card's ::before layer)
  function findCardBeam() {
    return document.getAnimations().find((a) => a.animationName === "spin");
  }

  // The direction from the card's centre to `element`, as an angle round
  // the card. Angles go clockwise from the top: 0° = top, 90° = right,
  // 180° = bottom, 270° = left.
  function angleTo(element) {
    const c = card.getBoundingClientRect();
    const e = element.getBoundingClientRect();
    const dx = (e.left + e.width / 2) - (c.left + c.width / 2);
    const dy = (e.top + e.height / 2) - (c.top + c.height / 2);
    return ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  }

  // How many milliseconds until the beam head reaches `angle`
  function msUntil(angle, cardBeam) {
    const lapMs = cardBeam.effect.getTiming().duration;   // 9000 for a 9s lap
    const now = cardBeam.currentTime % lapMs;             // how far into this lap we are
    // The head sits at (start angle + 87% of a circle). Find the lap
    // time at which that equals the angle we want.
    const at = ((((angle - BEAM_HEAD * 360) % 360) + 360) % 360 / 360) * lapMs;
    let ms = at - now;
    if (ms < 50) ms += lapMs;   // already passed (or about to)? Use the next lap.
    return ms;
  }

  // Wait until the beam head next passes the side of the card facing
  // `element`. Pass timesPerLap = 2 to also fire on the opposite side
  // (so twice per lap), 3 for three evenly spaced spots, and so on.
  function nextPass(element, timesPerLap = 1) {
    const cardBeam = findCardBeam();
    const running = cardBeam && cardBeam.currentTime !== null;
    if (!card || !running) return wait(3000);   // no beam (e.g. reduced motion)? Just wait a bit.

    // Check each evenly spaced spot round the card and use the soonest
    const start = angleTo(element);
    let soonest = Infinity;
    for (let k = 0; k < timesPerLap; k++) {
      soonest = Math.min(soonest, msUntil(start + (k * 360) / timesPerLap, cardBeam));
    }
    return wait(soonest);
  }

  return { nextPass };
})();
