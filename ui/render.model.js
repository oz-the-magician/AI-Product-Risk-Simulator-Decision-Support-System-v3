import { L, t } from './i18n.js';
import { icon } from './icons.js';
import { METRICS } from '../data/metrics.js';
import { CAUSAL_EDGES } from '../engine/transitions.js';
import { ADJUST_SPEED } from '../engine/simulator.js';
import { RISK_CAL, TAIL_CAL, TAIL_WEIGHTS } from '../engine/risk.js';
import { EFFECT_UNCERTAINTY, SHOCK_UNCERTAINTY } from '../data/priors.js';

export function renderModel(container) {
  const categories = ['Hard', 'Balance', 'Growth'];

  const metricRows = METRICS.map(m => `
    <tr>
      <td><code>${m.id}</code></td>
      <td>${t(m.name)}</td>
      <td><span class="badge badge-${m.category.toLowerCase()}">${t(m.category)}</span></td>
      <td>${m.better === 'low' ? icon('arrowDown', 'ic-sm') + L(' Lower', ' Ниже') : icon('arrowUp', 'ic-sm') + L(' Higher', ' Выше')}</td>
      <td>${m.baseline} ${m.unit}</td>
      <td>${L('watch', 'внимание')} ${m.guardrails.yellow} · ${L('breach', 'нарушение')} ${m.guardrails.red ?? '—'}</td>
      <td>${m.severity}/5</td>
    </tr>
  `).join('');

  const edgeRows = CAUSAL_EDGES.map(e => `
    <tr>
      <td><code>${e.from}</code></td>
      <td aria-label="${L('drives', 'влияет на')}">${icon('arrowRight', 'ic-sm')}</td>
      <td><code>${e.to}</code></td>
      <td class="${e.k > 0 ? 'pos-k' : 'neg-k'}">${e.k > 0 ? '+' : ''}${e.k}</td>
    </tr>
  `).join('');

  container.innerHTML = `
        <div class="model-section">
      <h3>${L('Metrics', 'Метрики')} (${METRICS.length})</h3>
      <table class="model-table">
        <thead><tr>
          <th>ID</th><th>${L('Name', 'Название')}</th><th>${L('Category', 'Группа')}</th><th>${L('Better', 'Лучше')}</th><th>${L('Baseline', 'База')}</th><th>${L('Guardrails', 'Пороги')}</th><th>${L('Severity', 'Тяжесть')}</th>
        </tr></thead>
        <tbody>${metricRows}</tbody>
      </table>
    </div>

    <div class="model-section">
      <h3>${L('Causal links', 'Причинные связи')} (${CAUSAL_EDGES.length})</h3>
      <p class="model-note">${L('Level relationship, not a daily multiplier: if <code>from</code> sits 10 % above its reference, the target level of <code>to</code> moves by <code>k × 10 %</code>. Deviations are clamped to ±100 %, so the system settles at an equilibrium.', 'Связь уровней, а не ежедневный множитель: если <code>from</code> на 10 % выше своей нормы, целевой уровень <code>to</code> сдвигается на <code>k × 10 %</code>. Отклонения ограничены ±100 %, поэтому система приходит к равновесию.')}</p>
      <table class="model-table edges-table">
        <thead><tr><th>${L('From', 'Откуда')}</th><th></th><th>${L('To', 'Куда')}</th><th>k</th></tr></thead>
        <tbody>${edgeRows}</tbody>
      </table>
    </div>

    <div class="model-section">
      <h3>${L('Daily dynamics', 'Динамика по дням')}</h3>
      <pre class="formula">${L(`target(m, t) = ref(m) × (1 + shocks) × (1 + Σ relative decision effects + Σ k × deviation(parent))
               + Σ absolute decision effects          (e.g. NPS points)
x(m, t) = x(m, t−1) + ${ADJUST_SPEED} × (target(m, t) − x(m, t−1))
Scenario shocks land at once and stay in the target from that day on.
No decisions and no shocks ⇒ every metric stays exactly at its baseline.`,
`цель(m, t) = норма(m) × (1 + шоки) × (1 + Σ относительных эффектов решений + Σ k × отклонение(родителя))
              + Σ абсолютных эффектов решений          (например, пункты NPS)
x(m, t) = x(m, t−1) + ${ADJUST_SPEED} × (цель(m, t) − x(m, t−1))
Шоки сценария срабатывают сразу и остаются в цели с этого дня.
Нет решений и нет шоков ⇒ каждая метрика остаётся ровно на базовом уровне.`)}</pre>
    </div>

    <div class="model-section">
      <h3>${L('Decision effects', 'Эффект решений')}</h3>
      <pre class="formula">${L(`effect(day) = lever.effect × intensity × exp(−ln2 × (day − lagDays) / halfLifeDays)   [0 before lagDays]
relative levers (kind "pct", e.g. +0.18 = +18 %) shift the target proportionally;
absolute levers (kind "abs", e.g. NPS −4) shift it by points.
Each decision costs amountPerDay × intensity, subtracted from Net every day.`,
`эффект(день) = рычаг.эффект × интенсивность × exp(−ln2 × (день − задержка) / полураспад)   [0 до задержки]
относительные рычаги (тип "pct", например +0.18 = +18 %) сдвигают цель пропорционально;
абсолютные рычаги (тип "abs", например NPS −4) сдвигают её на пункты.
Каждое решение стоит цена_в_день × интенсивность и каждый день вычитается из чистой прибыли.`)}</pre>
    </div>

    <div class="model-section">
      <h3>${L('Risk score formula', 'Формула оценки риска')}</h3>
      <pre class="formula">${L(`stress(m) = 0 at the green threshold … 1 at the red threshold (capped at 1.5)
StressIndex = ( Σ severity × stress³ / Σ severity )^(1/3)       (the worst metrics dominate)
RedPenalty  = Σ over red metrics of ${RISK_CAL.redPenalty} × severity/5 × riskSensitivity
RiskScore   = clamp(100 × (StressIndex − ${RISK_CAL.floor}) / ${RISK_CAL.span} + RedPenalty, 0, 100)
Calibration: baseline ≈ 25 · every metric on its yellow line ≈ 58 · everything at red = 100`,
`стресс(m) = 0 на зелёном пороге … 1 на красном (не больше 1.5)
ИндексСтресса = ( Σ тяжесть × стресс³ / Σ тяжесть )^(1/3)       (худшие метрики перевешивают)
ШтрафКрасных  = Σ по красным метрикам ${RISK_CAL.redPenalty} × тяжесть/5 × чувствительность
ОценкаРиска   = clamp(100 × (ИндексСтресса − ${RISK_CAL.floor}) / ${RISK_CAL.span} + ШтрафКрасных, 0, 100)
Калибровка: базовый уровень ≈ 25 · все метрики на жёлтой линии ≈ 58 · всё в красной зоне = 100`)}</pre>
    </div>

    <div class="model-section">
      <h3>${L('Tail risk (SEV event probability)', 'Хвостовой риск (вероятность SEV-события)')}</h3>
      <pre class="formula">${L(`HardStress   = weighted mean stress of ${Object.entries(TAIL_WEIGHTS).map(([k, w]) => `${w}×${k}`).join(' + ')}
tailRiskProb = sigmoid(${TAIL_CAL.slope} × (HardStress − ${TAIL_CAL.midpoint}) + ln(riskSensitivity))
riskSensitivity multiplies the odds of a SEV event (2 = twice the odds).`,
`ЖёсткийСтресс = взвешенный средний стресс: ${Object.entries(TAIL_WEIGHTS).map(([k, w]) => `${w}×${k}`).join(' + ')}
P(SEV)        = sigmoid(${TAIL_CAL.slope} × (ЖёсткийСтресс − ${TAIL_CAL.midpoint}) + ln(чувствительность))
чувствительность умножает шансы SEV-события (2 = вдвое большие шансы).`)}</pre>
    </div>

    <div class="model-section">
      <h3>${L('Economics', 'Экономика')}</h3>
      <pre class="formula">${L(`Revenue(t)      = DAU(t) × 1000 × ARPU(t)
IncidentCost(t) = incident_rate(t)/100 × DAU(t)×1000 × $5 × costMultiplier
Cost(t)         = moderation + compute × costMultiplier + IncidentCost(t) + decision costs
Net(t)          = Revenue(t) − Cost(t)`,
`Выручка(t)     = DAU(t) × 1000 × ARPU(t)
ЦенаИнцид.(t)  = incident_rate(t)/100 × DAU(t)×1000 × $5 × множитель_затрат
Затраты(t)     = модерация + вычисления × множитель_затрат + ЦенаИнцид.(t) + цена решений
Чистыми(t)     = Выручка(t) − Затраты(t)`)}</pre>
    </div>

    <div class="model-section">
      <h3>${L('Monte Carlo', 'Монте-Карло')}</h3>
      <pre class="formula">${L(`Each run samples:
  • today's metric values: priors centred on the baselines (lognormal for rates)
  • causal edge strengths: normal priors, direction never flips
  • how well each decision works: ×lognormal(σ = ${EFFECT_UNCERTAINTY})
  • size of scenario shocks: ×lognormal(σ = ${SHOCK_UNCERTAINTY})
Risk is scored on the change since day 0 of the run, so the band shows how uncertain the
consequences of the decisions are; money uses the actual sampled values.
The p50 line therefore matches the deterministic simulation.
Outputs: p10/p50/p90 bands on risk, SEV probability and net; P(yellow), P(red) per metric.`,
`Каждый прогон случайно выбирает:
  • текущие значения метрик: априорные распределения вокруг базовых (логнормальные для долей)
  • силу причинных связей: нормальные распределения, знак никогда не меняется
  • насколько хорошо работает каждое решение: ×lognormal(σ = ${EFFECT_UNCERTAINTY})
  • силу шоков сценария: ×lognormal(σ = ${SHOCK_UNCERTAINTY})
Риск считается по изменению с нулевого дня прогона, поэтому полоса показывает, насколько
неопределённы последствия решений; деньги считаются по фактическим значениям.
Поэтому линия p50 совпадает с детерминированной симуляцией.
Результат: полосы p10/p50/p90 для риска, P(SEV) и чистой прибыли; P(жёлт.), P(красн.) по метрикам.`)}</pre>
    </div>
  `;
}
