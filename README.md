# Data Viz with D3 React

The home page for my data visualization work with D3 and React, focused on clinical trials and real-world evidence.

**Live site:** https://sthakrar.github.io/homepage/

## What's on the page

- **Profile card** with my name, role, a short bio, and links to LinkedIn, GitHub, email and Google Scholar. A faint blue beam travels around its border.
- **Animated chart** that cycles through 28 figures you would find in a clinical study report. Each one starts as a scattered cloud of points (the noise), then a beam sweeps across and pulls the points into the finished figure (the signal). Every figure has a title and x and y axis titles.
- **Figure picker** under the chart: one short line per figure. The highlighted line is the figure on show, and clicking any line jumps to that figure.
- **Projects panel** that slides up from the bottom of the page.

### Figures in the chart

| Area | Figures |
| --- | --- |
| Efficacy | Model fit, Kaplan-Meier, forest plot, ANOVA, waterfall, mean change from baseline, box plot, swimmer plot, individual patient profiles, dose-response (Emax), ROC curve, cumulative enrollment |
| Early phase and clinical pharmacology | Single Ascending Dose, Multiple Ascending Dose, dose proportionality, concentration-time profile, PK/PD hysteresis loop, bioequivalence, concentration-QTc |
| Vaccines and immunogenicity | GMT after prime and boost, reverse cumulative distribution of titres, ADA titres, reactogenicity |
| Safety | eDISH, adverse events volcano plot |
| Real-world evidence | Propensity score overlap, covariate balance before and after matching (Love plot) |
| Meta-analysis | Funnel plot |

All data is simulated and generated fresh on every cycle, so no two rounds look exactly the same.

## How it's built

This page is plain HTML, CSS and JavaScript with no libraries and no build step. The chart is drawn directly as SVG. The D3 and React projects themselves will be linked from the Projects panel.

```
index.html        page content
css/style.css     all styling: layout, card, beam, chart colours
js/signal.js      the animated chart, its 28 figures and the figure picker
js/panels.js      opens and closes the Projects panel
```

## Run it locally

Clone the repo and open `index.html` in a browser:

```bash
git clone https://github.com/sthakrar/homepage.git
cd homepage
open index.html
```

## Customise

- **Add a figure:** write a new function in `js/signal.js` that returns a `label`, `axes`, `points` and `paths`, then add it to the `FIGURES` list. The figure picker updates on its own.
- **Change timing:** `SWEEP_MS` (how long the beam takes to draw) and `HOLD_MS` (how long a finished figure stays) at the top of `js/signal.js`.
- **Change colours or the card beam:** the variables at the top of `css/style.css` and the `.card::before` rule.
- **Add a project:** copy the `<article class="project">` block in `index.html`.

## Accessibility

Visitors who have "reduce motion" turned on see each figure already drawn, with no animation, and the card beam is hidden. The figure picker still switches between figures.

## Contact

Sanchit Thakrar, Clinical Data Scientist

- [LinkedIn](https://www.linkedin.com/in/sanchit-thakrar)
- [GitHub](https://github.com/sthakrar)
- [Google Scholar](https://scholar.google.com/citations?user=k8UYZcMAAAAJ&hl=en)
- [Email](mailto:sanchit.thakrar@gmail.com)
