# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences, weighted equally (confirmed by the author):
- Hiring managers and reviewers opening the author's portfolio for a few minutes. They need a strong first impression and to grasp what the tool does quickly; the guided tour serves them.
- Product people who actually run the numbers and stay a while. They need data density, readable charts and fast interaction.

## Product Purpose

A decision simulator for AI product safety. The user builds two bundles of safety measures (A and B), sees how each changes risk, users and money over a 30 to 180 day horizon, and how much each decision contributed. Success: a visitor can compare two strategies and explain the trade-off in a sentence.

## Positioning

Not a dashboard of fake KPIs: a working causal model with Monte Carlo uncertainty, exact Shapley attribution of each decision's effect, and a risk-versus-money Pareto frontier, all running in the browser with no backend.

## Operating Context

Static site on GitHub Pages, opened from the author's playground page. Vanilla HTML, CSS and ES modules, no build step. Desktop first, must stay usable on a phone.

## Capabilities and Constraints

- Tabs: Dashboard (what moved the risk, metric tables), Compare A/B, Trade-offs, Timeline, Sensitivity, Model.
- Header controls: scenario, horizon, Monte Carlo runs, Run MC, Tour, Export, Import. Summary chips: risk score, P(SEV), net per day, P(red) max.
- Sidebar: decision library by category, bundle editor with A/B slot switch, intensity sliders, presets.
- Guided tour with spotlight overlay, 11 steps.
- The meaning, order and function of every element stays as is; this pass changes the visual layer only.
- Series colours are fixed: A #3987e5, B #d95926 (validated for colour-vision deficiency on a dark surface).
- Theme: dark only.

## Brand Commitments

- Visual direction requested by the author: futuristic, glass panels combined with morphing forms.
- Interface copy is English.

## Evidence on Hand

- All numbers are illustrative model output, labelled as such in the tour. No real customers, benchmarks or incident data; do not invent any.

## Product Principles

- The model is the product: every visual must read as data first.
- Two bundles, one comparison: A and B stay recognisable everywhere.
- Explain, don't decorate: attribution and trade-offs are stated in plain sentences.

## Accessibility & Inclusion

- Keyboard-operable tour and controls, visible focus, reduced-motion support, WCAG AA contrast on text.
