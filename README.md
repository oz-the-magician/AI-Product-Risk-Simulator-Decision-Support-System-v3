# AI Risk Simulator v3

A static web application for simulating AI Product Safety decisions over time.

**[Open the simulator →](https://oz-the-magician.github.io/AI-Product-Risk-Simulator-Decision-Support-System-v3/)**

> The model is illustrative: metrics, guardrails and coefficients are made-up but plausible
> numbers for a consumer AI product. It shows how safety, product and money trade off —
> it is not calibrated on real data.

## Features

- **Time-based simulation** — step-by-step day simulation with lag/decay effects
- **Monte Carlo** — 100–2000 runs in a Web Worker with p10/p50/p90 bands (cancellable)
- **Causal graph** — metrics influence each other via configurable edge coefficients
- **Two bundles, A and B** — build two alternative decision bundles; the sidebar switch picks which one you edit
- **Compare A/B** — side-by-side outcomes over the horizon (average risk, P(SEV), red-metric days, total net, cost),
  a plain-language verdict with the price of each risk point, overlaid risk and net charts, metrics that end differently
- **What moved the risk** — a waterfall on the dashboard: quiet product → scenario events → each decision's
  share (Shapley values, so the steps add up exactly), with the metrics that carry each effect
- **Trade-off map** — average risk vs total net for every preset, every single decision and bundles A/B,
  with the Pareto frontier; click any dot to load it into A or B
- **Guided tour** — 11 steps with the rest of the screen dimmed and the current control spotlighted; starts on the
  first visit, replay from **? Tour** in the header (keyboard: → next, ← back, Esc to leave)
- **Presets** — ready-made bundles per scenario in the empty sidebar
- **6 tabs**: Dashboard / Compare A/B / Trade-offs / Timeline / Sensitivity / Model
- **Decision Bundle** — add/remove decisions, set intensity sliders
- **Export/Import** — JSON config persistence via localStorage + download

## How to Run

### Locally (with any static server)

```bash
# Python 3
python -m http.server 8080

# Node (npx)
npx serve .

# VS Code Live Server extension also works
```

Then open `http://localhost:8080`.

> ⚠️ **Must use a server** (not `file://`) because ES Modules require HTTP.

### Tests

```bash
npm test        # Node 18+, no dependencies — runs tests/*.test.mjs
```

The tests check that the model behaves sensibly: no drift without decisions, decisions move
metrics the documented way and fade out, NPS effects are points, decisions cost money,
no scenario saturates, and the Monte Carlo median matches the deterministic run.

### GitHub Pages

1. Push the entire folder to a GitHub repo (no build step needed)
2. Go to **Settings → Pages → Source: Deploy from branch (main)**
3. The site will be live at `https://<username>.github.io/<repo>/`

## Project Structure

```
/index.html          — main HTML shell
/styles.css          — dark industrial theme
/app.js              — app bootstrap, state management, event wiring

/data/
  metrics.js         — 16 metric definitions
  decisions.js       — 15 decision definitions  
  scenarios.js       — 3 scenarios (Balanced, Growth Push, Crisis)
  priors.js          — uncertainty distributions for Monte Carlo
  presets.js         — ready-made decision bundles per scenario

/engine/
  state.js           — initial state factory
  transitions.js     — causal graph edges + applyTransitions()
  risk.js            — riskScore, tailRiskProb, guardrail breach detection
  economics.js       — Revenue, Cost (incl. decision costs), Net per day
  simulator.js       — main runSimulation() function
  montecarlo.js      — Monte Carlo core: samples uncertainty, aggregates bands
  montecarlo.worker.js — Web Worker: runs Monte Carlo in chunks, supports Cancel
  rng.js             — seedable RNG and samplers (normal, lognormal, triangular)
  units.js           — relative vs absolute effects, metric bounds
  analysis.js        — summaries, risk explanation (Shapley), Pareto frontier, trade-off points

/tests/
  engine.test.mjs    — model sanity tests (node --test)
  analysis.test.mjs  — explanation adds up, frontier is correct, presets are valid

/ui/
  tabs.js            — tab switching
  render.dashboard.js — metrics table by category
  render.timeline.js  — canvas charts (risk, net, per-metric)
  render.sensitivity.js — OAT curves + tornado chart
  render.model.js    — model transparency (metrics, edges, formulas)
  render.explain.js  — "What moved the risk" waterfall
  render.compare.js  — Compare A/B tab
  render.tradeoffs.js — Trade-offs tab (scatter + frontier)
  viz.js             — small SVG chart kit with hover tooltips
  tour.js            — step-by-step guided tour with spotlight
  components.js      — reusable UI helpers
  format.js          — number formatters
```

## Key Design Decisions

- **Levels, not daily multipliers.** A decision shifts the *target level* of a metric, and the metric
  moves toward it (35 % of the gap per day). Effects start after `lagDays` and fade with a
  `halfLifeDays` half-life. With no decisions and no shocks every metric stays exactly at baseline.
- **Relative and absolute effects.** `+0.18` on a rate means +18 %; NPS levers are points
  (`kind: "abs"`), so −4 means minus four NPS points.
- **Causal graph as elasticities.** If a parent metric is 10 % above its reference, the child's
  target shifts by `k × 10 %`. The system settles at an equilibrium instead of drifting.
- **Risk from guardrails.** Each metric gets a stress from 0 (green threshold) to 1 (red threshold).
  A power mean makes the worst metrics dominate; red breaches add a penalty. Baseline ≈ 25,
  every metric on its yellow line ≈ 58, everything red = 100.
- **SEV probability.** A sigmoid of the weighted stress of incident, abuse, jailbreak and
  false-negative rates; scenario `riskSensitivity` multiplies the odds.
- **Decisions cost money.** Each decision's `amountPerDay × intensity` is subtracted from Net.
- **Monte Carlo on consequences.** Each run samples today's metric values, edge strengths,
  decision effectiveness and shock sizes. Risk is scored on the change since day 0 of the run,
  so the p50 line matches the deterministic simulation and the band shows how uncertain the
  outcome of the chosen decisions is.
- **Monte Carlo in a Worker**, processed in chunks so the UI stays responsive and Cancel works.

The **Model** tab in the app lists every metric, edge and formula.
