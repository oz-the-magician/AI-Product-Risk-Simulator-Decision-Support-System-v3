# Design

The simulator is a sealed instrument you look into: data on smoked glass over a slow field of light. The only shape that changes is risk itself.

## Tokens (styles.css :root)

| Role | Value |
| --- | --- |
| Ground | `--c-bg #07090F` with two aurora fields, `--aurora-1 #0E5A5A`, `--aurora-2 #23306E`, at 0.7 opacity |
| Glass | `--glass rgba(17,22,36,.58)`, `backdrop-filter: blur(22px) saturate(140%)`, 1px inset top highlight; solid fallback for no-blur and reduced transparency |
| Ink | `--c-white #F4F7FD`, `--c-text #DDE3F0`, `--c-text-2 #A3ADC2`, `--c-muted #8792AA` |
| UI accent | `--c-accent #A9C7FF` (focus, links, progress only; never data) |
| Series | A `#3987e5`, B `#d95926` (fixed, CVD-validated). `--slot` follows the bundle being edited |
| State | green `#4BD08E` (OK, dot), amber `#F2B640` (Watch, diamond), red `#F0595B` (Breach, square); shape differs per state |
| Radii | panels 14px, controls 10px, toggles and tabs full pill |
| Type | Sora (UI), Martian Mono at `font-stretch: 87.5%` for numbers only; both self-hosted in `fonts/` (OFL) |
| Motion | `--ease-out cubic-bezier(.23,1,.32,1)`, `--ease-io cubic-bezier(.77,0,.175,1)`; UI transitions 140-280ms; presses scale to 0.97 |

## Components

- Primary action: frosted white pill with ink text (Run MC, Next). Ghost: hairline pill.
- Tabs: one glass pill slides to the active tab; on narrow screens the bar scrolls and fades only the edge with more tabs.
- Status: `statusEmoji(status, withLabel)` in `ui/format.js` draws a shape plus label; never emoji.
- Icons: Phosphor regular, inlined via `ui/icons.js`.
- Timeline metric picker: toggle pills with a check when on.

## Signature move

The risk orb (`#risk-orb`): a gradient-lit blob whose outline keeps re-forming. `data-band` low / mid / high (thresholds 30 and 60, same as the risk chip) sets hue and speed; `--risk` sets size; the rounded risk value sits inside. Compare cards carry a faint morphing field in their series colour.

## Rules

- Dark only. No uppercase tracked labels, no eyebrows, no glow halos on components, no em-dashes in copy.
- Reduced motion stops the aurora, orb and card fields and replaces pane entry with a fade.
