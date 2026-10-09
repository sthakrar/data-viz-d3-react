// =====================================================================
// signal.js — the chart on the right of the home screen
//
// A rotating gallery of figures you'd find in a clinical study report
// (the "F" in TFLs: Tables, Figures and Listings). Each round:
//   1. The data points scatter into a loose cloud (the "noise").
//   2. When the beam around your name card passes the card's right or
//      left edge (twice per lap), a beam sweeps across the chart, drawing
//      the figure's lines. Each point eases into place just as the beam
//      reaches it (the "signal").
//   3. Next half lap, the next figure. There are 24, mixing late-phase
//      figures (Kaplan–Meier, forest plot, waterfall...) with early-phase
//      ones (SAD, MAD, PK/PD, bioequivalence, vaccine titres, ADA,
//      reactogenicity, eDISH...). See the FIGURES list for the order.
//
// All the data is made up fresh each time, so every round looks a bit
// different.
//
// Drawing uses SVG. Colours and sizes live in
// css/style.css, section 6.
// =====================================================================

(function () {
  const svg = document.getElementById("signal");
  if (!svg) return;   // no chart on the page? Then do nothing.

  // ---------------------------------------------------------------
  // Settings — try changing these!
  // The drawing's own coordinates (see viewBox in index.html) are
  // 440 wide by 300 tall. SVG's y axis points DOWN, so y = 0 is the top.
  // ---------------------------------------------------------------
  const W = 440;
  const LEFT = 30, RIGHT = 420;   // the plotting area, left to right...
  const TOP = 30, BOTTOM = 260;   // ...and top to bottom
  const COUNT = 38;               // how many data points
  const NOISE = 45;               // how scattered the "noise" cloud is
  const SWEEP_MS = 1500;          // how long the beam takes to draw a figure

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------

  // Create an SVG element, set its attributes, and add it to `parent`
  function el(tag, attrs, parent) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const name in attrs) node.setAttribute(name, attrs[name]);
    parent.appendChild(node);
    return node;
  }

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const random = (min, max) => min + Math.random() * (max - min);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;   // the value t of the way from a to b (t = 0..1)
  const f1 = (n) => n.toFixed(1);              // 1 decimal place, for SVG coordinates

  // A random number from a bell curve (most values near 0, a few further
  // out). This makes scatter look like real measurement noise.
  function bellCurve() {
    const u = 1 - Math.random(), v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // Animate an element between styles; finishes when done
  const animate = (node, frames, ms, options = {}) =>
    node.animate(frames, { duration: ms, easing: "ease-in-out", fill: "forwards", ...options }).finished;

  // A point that this figure doesn't use: it fades out somewhere random
  const unused = () => ({ x: random(LEFT, RIGHT), y: random(TOP, BOTTOM), o: 0 });

  // Evenly spread x positions with a little randomness
  const spreadX = (n) => Array.from({ length: n }, (_, i) => LEFT + (i + random(0.2, 0.8)) * ((RIGHT - LEFT) / n));

  // ---------------------------------------------------------------
  // The figures
  //
  // Each figure is a function that returns:
  //   label  — the caption shown above the chart
  //   points — where each of the COUNT points should end up:
  //            { x, y, o (opacity, optional), arm ("b" for the second
  //              colour, optional), t (0–1: when the beam reaches it,
  //              optional — defaults to left-to-right) }
  //   paths  — lines for the beam to draw: { d, cls } where d is an SVG
  //            path and cls is an extra CSS class ("arm-b" or "ref")
  // ---------------------------------------------------------------

  // 1. MODEL FIT — a smooth curve through noisy measurements
  function modelFit() {
    const wave = random(30, 55), length = random(260, 460), shift = random(0, 2 * Math.PI), slope = random(-0.12, 0.12);
    const curve = (x) => clamp(145 + wave * Math.sin((2 * Math.PI * x) / length + shift) + slope * (x - W / 2), TOP + 20, BOTTOM - 20);

    let d = "";
    for (let x = LEFT; x <= RIGHT; x += 6) d += (x === LEFT ? "M" : " L") + x + "," + f1(curve(x));

    return {
      label: "Model fit",
      points: spreadX(COUNT).map((x) => ({ x, y: curve(x) + bellCurve() * 7 })),
      paths: [{ d }],
    };
  }

  // 2. KAPLAN–MEIER — survival over time for two treatment arms.
  //    Each curve steps down whenever a patient has an event. Points sit
  //    on the curve at each patient's follow-up time.
  function kaplanMeier() {
    const xOf = (t) => LEFT + t * (RIGHT - LEFT);           // time 0..1 → across the chart
    const yOf = (s) => TOP + (1 - s) * (BOTTOM - TOP);      // survival 1..0 → top to bottom

    function arm(rate, armName, n) {
      // Each patient: a follow-up time, and whether they had an event
      // (or were "censored": still event-free when we stopped watching)
      const patients = Array.from({ length: n }, () => {
        let t = -Math.log(1 - Math.random()) / rate;        // random time to event
        let event = Math.random() > 0.25;                   // ~25% censored
        if (t > 1) { t = random(0.8, 1); event = false; }   // still going at the end of the study
        return { t, event };
      }).sort((a, b) => a.t - b.t);

      let s = 1, atRisk = n, d = `M${xOf(0)},${yOf(1)}`;
      const points = patients.map((p) => {
        d += ` L${f1(xOf(p.t))},${f1(yOf(s))}`;             // flat line until this patient's time
        if (p.event) s *= (atRisk - 1) / atRisk;            // an event: survival steps down
        atRisk--;
        d += ` L${f1(xOf(p.t))},${f1(yOf(s))}`;
        return { x: xOf(p.t), y: yOf(s), arm: armName };
      });
      d += ` L${xOf(1)},${f1(yOf(s))}`;
      return { points, path: { d, cls: armName === "b" ? "arm-b" : "" } };
    }

    const a = arm(0.9, "a", 19), b = arm(1.9, "b", 19);   // arm A does better (fewer events)
    return {
      label: "Kaplan–Meier estimate",
      points: [...a.points, ...b.points],
      paths: [a.path, b.path],
    };
  }

  // 3. FOREST PLOT — hazard ratio (with 95% confidence interval) for each
  //    subgroup, plus the overall result as a diamond. Left of the
  //    vertical line (HR = 1) favours treatment.
  function forestPlot() {
    const lo = Math.log(0.25), hi = Math.log(2);
    const xOf = (hr) => LEFT + ((Math.log(hr) - lo) / (hi - lo)) * (RIGHT - LEFT);   // log scale
    const rows = 7;
    const yOf = (r) => lerp(TOP + 15, BOTTOM - 15, r / (rows - 1));

    const overall = Math.exp(random(-0.5, -0.25));
    const points = [], ci = [];
    for (let r = 0; r < rows - 1; r++) {
      const hr = overall * Math.exp(bellCurve() * 0.18);
      const half = random(0.2, 0.45);                       // width of the confidence interval (log scale)
      ci.push(`M${f1(xOf(hr / Math.exp(half)))},${f1(yOf(r))} L${f1(xOf(hr * Math.exp(half)))},${f1(yOf(r))}`);
      points.push({ x: xOf(hr), y: yOf(r), t: r / rows });
    }

    // The overall result: a diamond as wide as its confidence interval
    const y = yOf(rows - 1), half = 0.12;
    const diamond = `M${f1(xOf(overall / Math.exp(half)))},${f1(y)} L${f1(xOf(overall))},${f1(y - 6)} L${f1(xOf(overall * Math.exp(half)))},${f1(y)} L${f1(xOf(overall))},${f1(y + 6)} Z`;

    while (points.length < COUNT) points.push(unused());
    return {
      label: "Hazard ratios by subgroup",
      points,
      paths: [
        { d: `M${f1(xOf(1))},${TOP} L${f1(xOf(1))},${BOTTOM}`, cls: "ref" },   // HR = 1: no difference
        { d: ci.join(" ") + " " + diamond },
      ],
    };
  }

  // 4. ANOVA — response in three dose groups (placebo, low, high).
  //    Points cluster by group; the beam joins the group means.
  function anova() {
    const groupX = [0.2, 0.5, 0.8].map((f) => lerp(LEFT, RIGHT, f));
    const lift = random(30, 45);
    const means = [195, 195 - lift, 195 - lift * 2.2].map((m) => m + random(-8, 8));   // higher dose, better response

    const points = Array.from({ length: COUNT }, (_, i) => {
      const g = i % 3;
      return { x: groupX[g] + random(-18, 18), y: clamp(means[g] + bellCurve() * 18, TOP, BOTTOM), arm: g === 0 ? "b" : "a" };
    });

    // A short line at each group's mean, joined into one path
    const d = groupX.map((x, g) => `${g === 0 ? "M" : "L"}${f1(x - 26)},${f1(means[g])} L${f1(x + 26)},${f1(means[g])}`).join(" ");
    return { label: "ANOVA: response by dose", points, paths: [{ d }] };
  }

  // 5. WATERFALL — each patient's best % change in tumour size, sorted
  //    from most growth (left) to most shrinkage (right). Bars below the
  //    zero line shrank; the darker ones shrank by 30% or more.
  function waterfall() {
    const zeroY = lerp(TOP, BOTTOM, 0.35);
    const yOf = (pct) => zeroY - pct * ((BOTTOM - zeroY) / 100);
    const changes = Array.from({ length: COUNT }, () => clamp(bellCurve() * 35 - 15, -100, 50)).sort((a, b) => b - a);
    const xs = changes.map((_, i) => lerp(LEFT + 5, RIGHT - 5, i / (COUNT - 1)));

    return {
      label: "Waterfall: best % change",
      points: changes.map((pct, i) => ({ x: xs[i], y: yOf(pct), arm: pct <= -30 ? "a" : "b" })),
      paths: [
        { d: `M${LEFT},${f1(zeroY)} L${RIGHT},${f1(zeroY)}`, cls: "ref" },
        { d: changes.map((pct, i) => `M${f1(xs[i])},${f1(zeroY)} L${f1(xs[i])},${f1(yOf(pct))}`).join(" ") },
      ],
    };
  }

  // 6. MEAN CHANGE FROM BASELINE — average change at each visit for two
  //    arms. Points are individual patients around each visit's mean.
  function meanChange() {
    const visits = 6;
    const xOf = (v) => lerp(LEFT + 15, RIGHT - 15, v / (visits - 1));
    const yOf = (change) => TOP + 25 + change * 7;           // change of 0 near the top, improvement goes down
    const curve = (v, size) => size * (1 - Math.exp(-v / 1.6));
    const sizeA = random(22, 28), sizeB = random(6, 10);     // arm A improves more

    const points = [];
    for (let v = 0; v < visits; v++) {
      for (let k = 0; k < 3; k++) {
        points.push({ x: xOf(v) - 5 + random(-3, 3), y: yOf(curve(v, sizeA)) + bellCurve() * 9, arm: "a" });
        points.push({ x: xOf(v) + 5 + random(-3, 3), y: yOf(curve(v, sizeB)) + bellCurve() * 9, arm: "b" });
      }
    }
    while (points.length < COUNT) points.push(unused());

    const line = (size) => Array.from({ length: visits }, (_, v) => `${v === 0 ? "M" : "L"}${f1(xOf(v))},${f1(yOf(curve(v, size)))}`).join(" ");
    return {
      label: "Mean change from baseline",
      points,
      paths: [{ d: line(sizeA) }, { d: line(sizeB), cls: "arm-b" }],
    };
  }

  // 7. BOX PLOT — distribution of a measurement in two arms. The box
  //    spans the middle 50% of patients, the line inside is the median,
  //    and the whiskers reach the lowest and highest values.
  function boxPlot() {
    const armX = { a: lerp(LEFT, RIGHT, 0.32), b: lerp(LEFT, RIGHT, 0.7) };
    const centre = { a: random(110, 140), b: random(160, 190) };   // arm A scores better (higher up)
    const points = [], paths = [];

    ["a", "b"].forEach((arm) => {
      const ys = Array.from({ length: COUNT / 2 }, () => clamp(centre[arm] + bellCurve() * 28, TOP, BOTTOM)).sort((p, q) => p - q);
      const at = (f) => ys[Math.round(f * (ys.length - 1))];        // value a fraction f of the way through the sorted list
      const [min, q1, med, q3, max] = [0, 0.25, 0.5, 0.75, 1].map(at);
      const x = armX[arm];
      ys.forEach((y) => points.push({ x: x + random(-22, 22), y, arm }));
      paths.push({
        cls: arm === "b" ? "arm-b" : "",
        d: `M${f1(x - 30)},${f1(q1)} L${f1(x + 30)},${f1(q1)} L${f1(x + 30)},${f1(q3)} L${f1(x - 30)},${f1(q3)} Z` +   // the box
           ` M${f1(x - 30)},${f1(med)} L${f1(x + 30)},${f1(med)}` +                                                  // median
           ` M${f1(x)},${f1(q1)} L${f1(x)},${f1(min)} M${f1(x - 10)},${f1(min)} L${f1(x + 10)},${f1(min)}` +         // upper whisker
           ` M${f1(x)},${f1(q3)} L${f1(x)},${f1(max)} M${f1(x - 10)},${f1(max)} L${f1(x + 10)},${f1(max)}`,          // lower whisker
      });
    });
    return { label: "Box plot by treatment arm", points, paths };
  }

  // 8. PK CONCENTRATION–TIME — how much drug is in the blood after a
  //    dose: it rises as the drug is absorbed, then falls as it's cleared.
  //    Points are individual blood samples at each sampling time.
  function pkCurve() {
    const times = [0.5, 1, 2, 3, 4, 6, 8, 12, 16];                  // hours after the dose
    const ka = random(1.2, 2), ke = random(0.15, 0.25);             // absorption and elimination rates
    const conc = (t) => Math.exp(-ke * t) - Math.exp(-ka * t);
    let peak = 0;
    for (let t = 0; t <= 16; t += 0.1) peak = Math.max(peak, conc(t));

    const xOf = (t) => lerp(LEFT, RIGHT, t / 16);
    const yOf = (c) => BOTTOM - (c / peak) * (BOTTOM - TOP) * 0.85;

    const points = [];
    times.forEach((t) => {
      for (let k = 0; k < 4; k++) points.push({ x: xOf(t) + random(-3, 3), y: clamp(yOf(conc(t) * Math.exp(bellCurve() * 0.18)), TOP, BOTTOM) });
    });

    let d = "";
    for (let t = 0; t <= 16; t += 0.25) d += (t === 0 ? "M" : " L") + f1(xOf(t)) + "," + f1(yOf(conc(t)));
    return { label: "Concentration–time profile", points, paths: [{ d }] };
  }

  // 9. SWIMMER PLOT — one lane per patient showing how long they stayed
  //    on treatment (longest at the top). Dark dots mark the end of
  //    treatment; light dots mark when a response was first seen.
  function swimmer() {
    const rows = 14;
    const yOf = (r) => lerp(TOP + 5, BOTTOM - 5, r / (rows - 1));
    const lengths = Array.from({ length: rows }, () => random(0.25, 1)).sort((p, q) => q - p);
    const points = [], lanes = [];

    lengths.forEach((len, r) => {
      const end = lerp(LEFT, RIGHT, len);
      lanes.push(`M${LEFT},${f1(yOf(r))} L${f1(end)},${f1(yOf(r))}`);
      points.push({ x: end, y: yOf(r), t: r / rows });                                          // end of treatment
      if (Math.random() < 0.7) points.push({ x: lerp(LEFT, end, random(0.2, 0.6)), y: yOf(r), arm: "b", t: r / rows });   // response
    });
    return { label: "Swimmer plot: time on treatment", points, paths: [{ d: lanes.join(" ") }] };
  }

  // 10. SPAGHETTI PLOT — every patient's own measurements over the
  //     visits, one line each, to show how individuals vary.
  function spaghetti() {
    const visits = 5, patients = 7;
    const xOf = (v) => lerp(LEFT + 10, RIGHT - 10, v / (visits - 1));
    const points = [], paths = [];

    for (let p = 0; p < patients; p++) {
      let y = random(70, 210);
      const trend = random(-18, 12);                                // each patient has their own direction
      const arm = p % 2 ? "b" : "a";
      let d = "";
      for (let v = 0; v < visits; v++) {
        if (v > 0) y = clamp(y + trend + bellCurve() * 12, TOP, BOTTOM);
        d += (v === 0 ? "M" : " L") + f1(xOf(v)) + "," + f1(y);
        points.push({ x: xOf(v), y, arm });
      }
      paths.push({ d, cls: arm === "b" ? "arm-b" : "" });
    }
    return { label: "Individual patient profiles", points, paths };
  }

  // 11. DOSE–RESPONSE (Emax) — the effect rises with dose, then levels
  //     off at a maximum. Dose is on a log scale (each step ~doubles).
  function doseResponse() {
    const doses = 6;
    const xOf = (k) => lerp(LEFT + 15, RIGHT - 15, k / (doses - 1));
    const mid = random(1.8, 3.2), steep = random(1.4, 2.2);         // dose at half the max effect, and how steep the rise is
    const effect = (k) => 1 / (1 + Math.exp(-steep * (k - mid)));    // an S-shaped curve
    const yOf = (e) => BOTTOM - 15 - e * (BOTTOM - TOP - 40);

    const points = [];
    for (let k = 0; k < doses; k++) {
      for (let n = 0; n < 6; n++) points.push({ x: xOf(k) + random(-6, 6), y: clamp(yOf(effect(k)) + bellCurve() * 14, TOP, BOTTOM) });
    }

    let d = "";
    for (let k = 0; k <= doses - 1 + 0.001; k += 0.1) d += (k === 0 ? "M" : " L") + f1(xOf(k)) + "," + f1(yOf(effect(k)));
    return { label: "Dose–response (Emax model)", points, paths: [{ d }] };
  }

  // 12. ROC CURVE — how well a biomarker separates patients who respond
  //     from those who don't. The further the curve bows toward the top
  //     left, the better; the diagonal is a coin toss.
  function roc() {
    const bow = random(2.2, 4);
    const xOf = (fpr) => lerp(LEFT, RIGHT, fpr);                     // false positive rate, 0..1
    const yOf = (tpr) => lerp(BOTTOM, TOP, tpr);                     // true positive rate, 0..1
    const curve = (f) => Math.pow(f, 1 / bow);

    const points = Array.from({ length: COUNT }, (_, i) => {
      const f = Math.pow((i + 0.5) / COUNT, 1.6);                    // more thresholds near the steep start
      return { x: xOf(f), y: yOf(curve(f)) };
    });

    let d = "";
    for (let f = 0; f <= 1.0001; f += 0.02) d += (f === 0 ? "M" : " L") + f1(xOf(f)) + "," + f1(yOf(curve(Math.min(f, 1))));
    return {
      label: "ROC curve for biomarker",
      points,
      paths: [{ d: `M${LEFT},${BOTTOM} L${RIGHT},${TOP}`, cls: "ref" }, { d }],
    };
  }

  // 13. CUMULATIVE ENROLLMENT — patients joining the study over time.
  //     The faint line is the plan; the stepped line is what happened
  //     (slow start, then sites ramp up).
  function enrollment() {
    const times = Array.from({ length: COUNT }, () => Math.pow(Math.random(), 0.7)).sort((p, q) => p - q);
    const xOf = (t) => lerp(LEFT, RIGHT, t);
    const yOf = (n) => lerp(BOTTOM, TOP + 10, n / COUNT);

    let d = `M${LEFT},${BOTTOM}`;
    const points = times.map((t, i) => {
      d += ` L${f1(xOf(t))},${f1(yOf(i))} L${f1(xOf(t))},${f1(yOf(i + 1))}`;
      return { x: xOf(t), y: yOf(i + 1) };
    });
    return {
      label: "Cumulative enrollment vs plan",
      points,
      paths: [{ d: `M${LEFT},${BOTTOM} L${RIGHT},${TOP + 10}`, cls: "ref" }, { d }],
    };
  }

  // ===============================================================
  // Early-phase figures (first-in-human, clinical pharmacology,
  // immunogenicity and vaccines, early safety)
  // ===============================================================

  // 14. SAD — single ascending dose. Each cohort gets a higher dose than
  //     the last (the beam draws the escalation "staircase"). Dark points
  //     are active-dose subjects' exposure; light points at the bottom
  //     are the placebo subject in each cohort.
  function sadEscalation() {
    const cohorts = 5;
    const xOf = (k) => lerp(LEFT + 35, RIGHT - 35, k / (cohorts - 1));
    const levelY = (k) => lerp(BOTTOM - 25, TOP + 15, k / (cohorts - 1));
    const half = (RIGHT - LEFT - 70) / (cohorts - 1) / 2;   // half the gap between cohorts

    const points = [];
    let d = `M${LEFT},${f1(levelY(0))}`;
    for (let k = 0; k < cohorts; k++) {
      for (let n = 0; n < 6; n++) points.push({ x: xOf(k) + random(-14, 14), y: clamp(levelY(k) + bellCurve() * 9, TOP, BOTTOM) });
      points.push({ x: xOf(k) + random(-6, 6), y: BOTTOM - random(0, 6), arm: "b" });   // placebo
      const edge = k < cohorts - 1 ? xOf(k) + half : RIGHT;
      d += ` L${f1(edge)},${f1(levelY(k))}`;
      if (k < cohorts - 1) d += ` L${f1(edge)},${f1(levelY(k + 1))}`;
    }
    return { label: "SAD: dose escalation by cohort", points, paths: [{ d }] };
  }

  // 15. MAD — multiple ascending dose. With a dose every day, drug builds
  //     up (each dose lands on what's left of the last) until it levels
  //     off at "steady state": the sawtooth pattern. Points are peak and
  //     trough samples.
  function madAccumulation() {
    const doses = 7, ka = 6, ke = random(0.5, 0.75);
    const single = (s) => (s < 0 ? 0 : Math.exp(-ke * s) - Math.exp(-ka * s));
    const conc = (t) => { let c = 0; for (let n = 0; n < doses; n++) c += single(t - n); return c; };
    const end = doses + 0.6;

    let top = 0;
    for (let t = 0; t <= end; t += 0.02) top = Math.max(top, conc(t));
    const xOf = (t) => lerp(LEFT, RIGHT, t / end);
    const yOf = (c) => BOTTOM - (c / top) * (BOTTOM - TOP) * 0.9;

    let d = "";
    for (let t = 0; t <= end; t += 0.02) d += (t === 0 ? "M" : " L") + f1(xOf(t)) + "," + f1(yOf(conc(t)));

    const tPeak = Math.log(ka / ke) / (ka - ke);   // time of the peak after each dose
    const points = [];
    for (let n = 0; n < doses; n++) {
      for (let k = 0; k < 3; k++) points.push({ x: xOf(n + tPeak) + random(-3, 3), y: clamp(yOf(conc(n + tPeak) * Math.exp(bellCurve() * 0.1)), TOP, BOTTOM) });
      if (n > 0) for (let k = 0; k < 2; k++) points.push({ x: xOf(n - 0.01) + random(-3, 3), y: clamp(yOf(conc(n - 0.01) * Math.exp(bellCurve() * 0.12)), TOP, BOTTOM), arm: "b" });
    }
    return { label: "MAD: accumulation to steady state", points, paths: [{ d }] };
  }

  // 16. DOSE PROPORTIONALITY — on log scales, if exposure (Cmax) rises
  //     in proportion to dose, the points follow a slope of 1 (the faint
  //     line). The beam draws the fitted slope.
  function doseProportionality() {
    const levels = 5, slope = random(0.85, 1.12);
    const xOf = (k) => lerp(LEFT + 15, RIGHT - 15, k / (levels - 1));   // each step doubles the dose
    const lo = -0.7, hi = (levels - 1) * 1.15 + 0.7;
    const yOf = (v) => lerp(BOTTOM - 10, TOP + 10, (v - lo) / (hi - lo));

    const points = [];
    for (let k = 0; k < levels; k++) {
      for (let n = 0; n < 7; n++) points.push({ x: xOf(k) + random(-7, 7), y: yOf(slope * k + bellCurve() * 0.28) });
    }
    const line = (b) => `M${f1(xOf(0))},${f1(yOf(0))} L${f1(xOf(levels - 1))},${f1(yOf(b * (levels - 1)))}`;
    return { label: "Dose proportionality: Cmax vs dose (log–log)", points, paths: [{ d: line(1), cls: "ref" }, { d: line(slope) }] };
  }

  // 17. PK/PD HYSTERESIS — plotting effect against concentration over
  //     time. The effect lags behind the drug level, so rising and
  //     falling take different paths and draw a loop.
  function hysteresis() {
    const ka = 1.6, ke = random(0.25, 0.35), keo = random(0.3, 0.5);
    const samples = [];
    let ce = 0;
    for (let t = 0; t <= 14; t += 0.02) {
      const c = Math.exp(-ke * t) - Math.exp(-ka * t);
      ce += keo * (c - ce) * 0.02;                      // the effect site slowly catches up with the blood level
      samples.push({ c, e: ce / (0.15 + ce) });         // effect levels off as it approaches its maximum
    }
    const maxC = Math.max(...samples.map((p) => p.c)), maxE = Math.max(...samples.map((p) => p.e));
    const xOf = (c) => lerp(LEFT + 5, RIGHT - 10, c / maxC);
    const yOf = (e) => lerp(BOTTOM - 5, TOP + 10, e / maxE);

    const d = samples.filter((_, i) => i % 5 === 0).map((p, i) => (i === 0 ? "M" : "L") + f1(xOf(p.c)) + "," + f1(yOf(p.e))).join(" ");
    const points = Array.from({ length: COUNT }, (_, i) => {
      const p = samples[Math.round(Math.pow(i / (COUNT - 1), 1.4) * (samples.length - 1))];
      return { x: xOf(p.c), y: yOf(p.e), t: i / COUNT };   // the beam follows the loop, not left-to-right
    });
    return { label: "PK/PD: hysteresis loop", points, paths: [{ d }] };
  }

  // 18. BIOEQUIVALENCE — the ratio of test to reference (geometric mean
  //     ratio) for each PK measure, with its 90% confidence interval. If
  //     the interval sits inside 80–125% (the faint lines), they're
  //     considered equivalent.
  function bioequivalence() {
    const lo = Math.log(0.7), hi = Math.log(1.4);
    const xOf = (r) => lerp(LEFT, RIGHT, (Math.log(r) - lo) / (hi - lo));
    const rows = 6;
    const yOf = (r) => lerp(TOP + 20, BOTTOM - 20, r / (rows - 1));
    const points = [], ci = [];
    for (let r = 0; r < rows; r++) {
      const gmr = Math.exp(bellCurve() * 0.05);
      const half = random(0.06, 0.12);
      ci.push(`M${f1(xOf(gmr / Math.exp(half)))},${f1(yOf(r))} L${f1(xOf(gmr * Math.exp(half)))},${f1(yOf(r))}`);
      points.push({ x: xOf(gmr), y: yOf(r), t: r / rows });
    }
    const vline = (r) => ({ d: `M${f1(xOf(r))},${TOP} L${f1(xOf(r))},${BOTTOM}`, cls: "ref" });
    return { label: "Bioequivalence: 90% CI of GMR", points, paths: [vline(0.8), vline(1), vline(1.25), { d: ci.join(" ") }] };
  }

  // 19. CONCENTRATION–QTc — does more drug lengthen the heart's QT
  //     interval? Points are ΔΔQTc readings by concentration. The upper
  //     confidence bound (light line) should stay below 10 ms (faint line).
  function concentrationQTc() {
    const xOf = (c) => lerp(LEFT, RIGHT, c);
    const yOf = (ms) => lerp(BOTTOM, TOP, (ms + 10) / 25);   // −10 ms at the bottom, +15 ms at the top
    const slope = random(2, 5), start = random(-1.5, 1);
    const points = Array.from({ length: COUNT }, () => {
      const c = Math.pow(Math.random(), 1.3);
      return { x: xOf(c), y: yOf(start + slope * c + bellCurve() * 3.5) };
    });
    const line = (a, b) => `M${f1(xOf(0))},${f1(yOf(a))} L${f1(xOf(1))},${f1(yOf(a + b))}`;
    return {
      label: "Concentration–QTc analysis",
      points,
      paths: [{ d: `M${LEFT},${f1(yOf(10))} L${RIGHT},${f1(yOf(10))}`, cls: "ref" }, { d: line(start, slope) }, { d: line(start + 1.5, slope + 1.5), cls: "arm-b" }],
    };
  }

  // 20. VACCINE GMT — geometric mean antibody titre at each visit. It
  //     rises after the first (prime) dose, jumps after the booster,
  //     then slowly wanes. The faint line is the protective threshold.
  //     Light = placebo, staying flat.
  function vaccineGMT() {
    const profile = [0, 1.1, 2.2, 1.8, 3.5, 3.7, 3.3, 2.8, 2.4].map((v, i) => (i === 0 ? v : v + random(-0.2, 0.2)));   // log titre
    const xOf = (i) => lerp(LEFT + 10, RIGHT - 10, i / (profile.length - 1));
    const yOf = (v) => lerp(BOTTOM - 10, TOP + 10, (v + 0.4) / 4.6);
    const points = [];
    profile.forEach((v, i) => {
      for (let k = 0; k < 2; k++) points.push({ x: xOf(i) - 4 + random(-2, 2), y: yOf(v + bellCurve() * 0.25) });
      for (let k = 0; k < 2; k++) points.push({ x: xOf(i) + 4 + random(-2, 2), y: yOf(bellCurve() * 0.2), arm: "b" });
    });
    const line = (vals) => vals.map((v, i) => (i === 0 ? "M" : "L") + f1(xOf(i)) + "," + f1(yOf(v))).join(" ");
    return {
      label: "Vaccine: GMT after prime and boost",
      points,
      paths: [{ d: `M${LEFT},${f1(yOf(1.6))} L${RIGHT},${f1(yOf(1.6))}`, cls: "ref" }, { d: line(profile) }, { d: line(profile.map(() => 0)), cls: "arm-b" }],
    };
  }

  // 21. RCDC — reverse cumulative distribution curve. For each titre
  //     level (left to right), the share of subjects at or above it. The
  //     further right a curve reaches, the stronger the immune response.
  function rcdc() {
    const xOf = (v) => lerp(LEFT, RIGHT, v / 5);           // log titre 0..5
    const yOf = (share) => lerp(BOTTOM, TOP, share);       // 0%..100%
    function arm(mean, armName) {
      const n = COUNT / 2;
      const titres = Array.from({ length: n }, () => clamp(mean + bellCurve() * 0.7, 0.05, 4.95)).sort((p, q) => p - q);
      let d = `M${LEFT},${f1(yOf(1))}`;
      const points = titres.map((v, i) => {
        d += ` L${f1(xOf(v))},${f1(yOf((n - i) / n))} L${f1(xOf(v))},${f1(yOf((n - i - 1) / n))}`;
        return { x: xOf(v), y: yOf((n - i - 1) / n), arm: armName };
      });
      return { points, path: { d, cls: armName === "b" ? "arm-b" : "" } };
    }
    const a = arm(random(2.8, 3.4), "a"), b = arm(random(1.2, 1.8), "b");
    return { label: "Reverse cumulative distribution of titres", points: [...a.points, ...b.points], paths: [a.path, b.path] };
  }

  // 22. ADA TITRES — anti-drug antibodies: some subjects' immune systems
  //     react to the drug. Each line is one subject over time; above the
  //     faint cut-point line counts as ADA-positive (dark points).
  function adaTitres() {
    const visits = 5, subjects = 7;
    const xOf = (v) => lerp(LEFT + 10, RIGHT - 10, v / (visits - 1));
    const yOf = (v) => lerp(BOTTOM - 10, TOP + 10, v / 4);   // log titre 0..4
    const cut = 1.5;
    const points = [], paths = [];
    for (let s = 0; s < subjects; s++) {
      const responder = s < 2 || Math.random() < 0.15;       // a couple of subjects develop ADA
      const peak = responder ? random(2.3, 3.6) : random(0.4, 1.1);
      const peakAt = random(1.5, 3);
      let d = "";
      for (let v = 0; v < visits; v++) {
        const level = clamp(v === 0 ? random(0.2, 0.6) : peak * Math.exp(-Math.pow(v - peakAt, 2) / 3) + random(0, 0.3), 0, 4);
        d += (v === 0 ? "M" : " L") + f1(xOf(v)) + "," + f1(yOf(level));
        points.push({ x: xOf(v), y: yOf(level), arm: level > cut ? "a" : "b" });
      }
      paths.push({ d, cls: responder ? "" : "arm-b" });
    }
    return { label: "ADA titres vs cut-point", points, paths: [{ d: `M${LEFT},${f1(yOf(cut))} L${RIGHT},${f1(yOf(cut))}`, cls: "ref" }, ...paths] };
  }

  // 23. REACTOGENICITY — share of vaccine recipients with any solicited
  //     reaction on days 1–7 after a dose, stacked by severity: mild
  //     (palest), moderate, severe (darkest). Reactions fade over days.
  function reactogenicity() {
    const days = 7;
    const xOf = (d) => lerp(LEFT + 25, RIGHT - 25, d / (days - 1));
    const yOf = (pct) => BOTTOM - (pct / 80) * (BOTTOM - TOP);
    const bars = [[], [], []];   // one path per severity
    const points = [];
    for (let d = 0; d < days; d++) {
      const total = clamp(70 * Math.exp(-0.55 * d) + random(2, 6), 0, 80);
      const parts = [total * 0.6, total * 0.3, total * 0.1];   // mild, moderate, severe
      let base = 0;
      parts.forEach((part, sev) => {
        bars[sev].push(`M${f1(xOf(d))},${f1(yOf(base))} L${f1(xOf(d))},${f1(yOf(base + part))}`);
        base += part;
      });
      points.push({ x: xOf(d), y: yOf(total) - 7 });
    }
    return {
      label: "Reactogenicity: solicited reactions, days 1–7",
      points,
      paths: bars.map((segments, sev) => ({ d: segments.join(" "), cls: `bar sev-${sev + 1}` })),
    };
  }

  // 24. eDISH — a liver-safety screen. Each point is one subject's peak
  //     ALT (liver enzyme) against peak bilirubin, both as multiples of
  //     the upper limit of normal, on log scales. The lines split the
  //     plot at 3× ALT and 2× bilirubin; the top-right corner ("Hy's
  //     law") is the one to worry about.
  function edish() {
    const xOf = (v) => lerp(LEFT, RIGHT, (Math.log10(v) + 1) / 2.3);   // 0.1× to 20× ULN
    const yOf = (v) => lerp(BOTTOM, TOP, (Math.log10(v) + 1) / 2);     // 0.1× to 10× ULN
    const points = Array.from({ length: COUNT }, (_, i) => {
      if (i < 2) return { x: xOf(random(4, 12)), y: yOf(i === 0 ? random(2.5, 5) : random(0.6, 1.5)) };   // a couple of outliers
      return { x: xOf(Math.exp(bellCurve() * 0.45 - 0.2)), y: yOf(Math.exp(bellCurve() * 0.4 - 0.5)), arm: "b" };
    });
    return {
      label: "eDISH: peak ALT vs peak bilirubin",
      points,
      paths: [{ d: `M${f1(xOf(3))},${TOP} L${f1(xOf(3))},${BOTTOM}` }, { d: `M${LEFT},${f1(yOf(2))} L${RIGHT},${f1(yOf(2))}` }],
    };
  }

  // The order they appear in (edit this list to add, remove or reorder)
  const FIGURES = [
    modelFit, sadEscalation, kaplanMeier, madAccumulation, forestPlot, hysteresis,
    boxPlot, bioequivalence, waterfall, pkCurve, vaccineGMT, meanChange, adaTitres,
    swimmer, doseProportionality, anova, rcdc, spaghetti, concentrationQTc,
    doseResponse, reactogenicity, roc, edish, enrollment,
  ];

  // Make the next figure, padding with unused (faded-out) points so
  // every figure has exactly COUNT points
  function makeFigure(index) {
    const figure = FIGURES[index]();
    while (figure.points.length < COUNT) figure.points.push(unused());
    figure.points.length = COUNT;
    return figure;
  }

  // ---------------------------------------------------------------
  // Build the chart
  // ---------------------------------------------------------------

  // Shared colours: a left-to-right blue gradient and a soft blur for
  // the beam's glow. "userSpaceOnUse" makes the gradient span the whole
  // chart, so it works even on perfectly flat lines.
  const defs = el("defs", {}, svg);
  const grad = el("linearGradient", { id: "signal-grad", gradientUnits: "userSpaceOnUse", x1: LEFT, y1: 0, x2: RIGHT, y2: 0 }, defs);
  el("stop", { offset: 0, "stop-color": "#7cc4ff" }, grad);
  el("stop", { offset: 1, "stop-color": "#1d6fd8" }, grad);
  const blur = el("filter", { id: "signal-blur", x: "-10%", y: "-50%", width: "120%", height: "200%" }, defs);
  el("feGaussianBlur", { stdDeviation: 4 }, blur);

  // Two faint axis lines, so it reads as a chart
  el("path", { class: "axis", d: `M${LEFT - 10},${TOP - 10} L${LEFT - 10},${BOTTOM + 10} L${RIGHT + 10},${BOTTOM + 10}` }, svg);

  // The caption above the chart, e.g. "Kaplan–Meier estimate"
  const caption = el("text", { class: "caption", x: LEFT - 10, y: 8 }, svg);

  // A group for the figure's lines, drawn underneath the points
  const lines = el("g", {}, svg);

  // The data points. Each <circle> sits at 0,0 and we move it with a CSS
  // transform (translate), which animates smoothly in every browser.
  const points = Array.from({ length: COUNT }, () => el("circle", { class: "point", r: 3.2 }, svg));
  const pos = points.map(() => ({ x: (LEFT + RIGHT) / 2, y: (TOP + BOTTOM) / 2, o: 0 }));   // where each point is now

  // Move point i to { x, y, o } over `ms` milliseconds, after `delay` ms
  function movePoint(i, to, ms, delay = 0) {
    const from = pos[i];
    pos[i] = to;
    return animate(points[i], [
      { transform: `translate(${from.x}px, ${from.y}px)`, opacity: from.o },
      { transform: `translate(${to.x}px, ${to.y}px)`, opacity: to.o },
    ], ms, { delay });
  }

  // A noisy version of a target: same rough area, but scattered.
  // This is the "noise" the beam turns into a figure.
  const noisy = (p) => ({
    x: clamp(p.x + bellCurve() * 25, LEFT, RIGHT),
    y: clamp(p.y + bellCurve() * NOISE, TOP, BOTTOM),
    o: 0.6,
  });

  // When the beam reaches a point (0 = start of the sweep, 1 = end)
  const reachedAt = (p) => (p.t !== undefined ? p.t : (p.x - LEFT) / (RIGHT - LEFT));

  // ---------------------------------------------------------------
  // The main sequence
  // ---------------------------------------------------------------
  async function run() {
    let figureIndex = 0;
    let figure = makeFigure(0);
    let drawn = [];   // the lines currently on the chart

    const setArms = () => points.forEach((c, i) => c.classList.toggle("arm-b", figure.points[i].arm === "b"));

    // Reduce motion: show the first figure, finished, with no animation
    if (reduceMotion) {
      setArms();
      caption.textContent = figure.label;
      figure.points.forEach((p, i) => {
        points[i].style.transform = `translate(${p.x}px, ${p.y}px)`;
        points[i].style.opacity = p.o ?? 0.85;
      });
      figure.paths.forEach((p) => el("path", { class: "fit line " + (p.cls || ""), d: p.d }, lines).style.strokeDashoffset = 0);
      return;
    }

    // Start: points drift out from the middle into a noisy cloud
    setArms();
    await Promise.all(figure.points.map((p, i) => movePoint(i, noisy(p), 1200, i * 15)));

    for (;;) {
      // 1. Wait for the card's beam to pass its right edge or its left
      //    edge, so a new figure every half lap (js/beam-sync.js)
      await BeamSync.nextPass(svg, 2);

      // 2. If a figure is showing: fade it, move to the next figure, and
      //    scatter the points into a new noisy cloud
      if (drawn.length) {
        // (Giving just the end state fades from wherever each one is now)
        drawn.forEach((path) => animate(path, [{ opacity: 0 }], 500).then(() => path.remove()));
        animate(caption, [{ opacity: 0 }], 400);
        figureIndex = (figureIndex + 1) % FIGURES.length;
        figure = makeFigure(figureIndex);
        setArms();
        await Promise.all(figure.points.map((p, i) => movePoint(i, noisy(p), 600)));
      }

      // 3. Show the caption, then the beam sweeps and draws the figure.
      //    Each point eases into place as the beam reaches it.
      caption.textContent = figure.label;
      animate(caption, [{ opacity: 0 }, { opacity: 1 }], 600);

      drawn = [];
      figure.paths.forEach((p) => {
        const noGlow = /\b(ref|bar)\b/.test(p.cls || "");               // reference lines and bars don't glow
        const kinds = noGlow ? ["line"] : ["glow", "line"];
        kinds.forEach((kind) => {
          const path = el("path", { class: `fit ${kind} ${p.cls || ""}`, d: p.d, pathLength: 100 }, lines);
          animate(path, [{ strokeDashoffset: 100 }, { strokeDashoffset: 0 }], SWEEP_MS, { easing: "linear" });
          drawn.push(path);
        });
      });

      figure.points.forEach((p, i) => movePoint(i, { x: p.x, y: p.y, o: p.o ?? 0.85 }, 600, reachedAt(p) * SWEEP_MS));

      // 4. Once drawn, the glow fades and the thin lines stay
      await wait(SWEEP_MS);
      drawn.filter((path) => path.classList.contains("glow")).forEach((path) => animate(path, [{ opacity: 0 }], 800));
    }
  }

  run();
})();
