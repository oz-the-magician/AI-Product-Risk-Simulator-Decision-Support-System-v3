# AI Risk Simulator v3

A static web application for simulating AI Product Safety decisions over time.

## Features

- **Time-based simulation** — step-by-step day simulation with lag/decay effects
- **Monte Carlo** — 100–2000 runs in a Web Worker with p10/p50/p90 bands
- **Causal graph** — metrics influence each other via configurable edge coefficients
- **4 tabs**: Dashboard / Timeline / Sensitivity / Model
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

/engine/
  state.js           — initial state factory
  transitions.js     — causal graph edges + applyTransitions()
  risk.js            — riskScore, tailRiskProb, guardrail breach detection
  economics.js       — Revenue, Cost, Net per day
  simulator.js       — main runSimulation() function
  montecarlo.worker.js — Web Worker: samples priors, runs N simulations

/ui/
  tabs.js            — tab switching
  render.dashboard.js — metrics table by category
  render.timeline.js  — canvas charts (risk, net, per-metric)
  render.sensitivity.js — OAT curves + tornado chart
  render.model.js    — model transparency (metrics, edges, formulas)
  components.js      — reusable UI helpers
  format.js          — number formatters
```

## Key Design Decisions

- **Multiplicative effects**: `x *= (1 + delta)` not additive
- **Lagged + decaying decisions**: effects activate after `lagDays`, decay with `halfLifeDays` half-life
- **Sigmoid tail risk**: models non-linear probability of SEV events from key safety metrics
- **Monte Carlo in Worker**: never blocks UI thread; cancel-able with progress bar
