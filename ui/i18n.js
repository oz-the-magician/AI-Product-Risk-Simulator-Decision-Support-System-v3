// Interface language: English (source) and Russian.
// L(en, ru) picks a phrase for the current language; t(text) translates fixed names from the data files.

const KEY = 'aiRiskLang';
let lang = (() => {
  try { const s = localStorage.getItem(KEY); if (s === 'ru' || s === 'en') return s; } catch (e) {}
  return /^(ru|uk|be)/i.test(navigator.language || '') ? 'ru' : 'en';
})();

export const getLang = () => lang;
export const L = (en, ru) => (lang === 'ru' ? ru : en);

export function setLang(next) {
  if (next !== 'ru' && next !== 'en') return;
  lang = next;
  try { localStorage.setItem(KEY, next); } catch (e) {}
  applyStatic();
}

const RU = {
  // scenarios
  'Balanced Launch': 'Спокойный запуск',
  'Growth Push': 'Рывок роста',
  'Crisis Mode': 'Кризис',
  // decision categories
  'Policy': 'Правила', 'Tooling': 'Инструменты', 'Moderation': 'Модерация', 'Evals': 'Проверки', 'Rollout': 'Выкатка', 'Growth': 'Рост',
  // metric categories
  'Hard': 'Жёсткие', 'Balance': 'Баланс',
  // decisions
  'Tighten Policy Enforcement': 'Ужесточить правила',
  'Relax Policy Enforcement': 'Смягчить правила',
  'Deploy ML Classifier': 'Запустить ML-классификатор',
  'Expand Human Review': 'Расширить ручную модерацию',
  'Enhanced Rate Limiting': 'Строже лимиты запросов',
  'Red Team Evaluation Sprint': 'Спринт ред-тиминга',
  'Canary Rollout (10%)': 'Канареечная выкатка (10%)',
  'Shadow Mode Testing': 'Тест в теневом режиме',
  'User Reporting System': 'Жалобы от пользователей',
  'Latency Optimization Sprint': 'Спринт по задержкам',
  'Growth Marketing Campaign': 'Маркетинговая кампания',
  'Safety Transparency Report': 'Публичный отчёт о безопасности',
  'Automated Safety Testing': 'Автотесты безопасности',
  'Incident Response Protocol': 'Протокол реагирования на инциденты',
  'Feature Flag Governance': 'Управление фича-флагами',
  // metrics
  'Safety Incident Rate': 'Доля инцидентов безопасности',
  'Abuse Rate': 'Доля злоупотреблений',
  'Jailbreak Attempt Rate': 'Попытки джейлбрейка',
  'False Positive Rate': 'Ложные срабатывания',
  'P95 Latency': 'Задержка P95',
  'Policy Coverage': 'Покрытие правилами',
  'False Negative Rate': 'Пропуски вредного',
  'Moderation Lag': 'Задержка модерации',
  'User Appeal Rate': 'Доля апелляций',
  'Safety Eval Pass Rate': 'Проходимость тестов безопасности',
  '7-Day Retention': 'Удержание за 7 дней',
  'Daily Active Users': 'Активные пользователи в день',
  'ARPU': 'ARPU',
  'Net Promoter Score': 'NPS',
  'API Traffic': 'Трафик API',
  'Compute Cost': 'Стоимость вычислений',
  // metric descriptions
  'Percentage of interactions resulting in safety incidents': 'Доля взаимодействий, закончившихся инцидентом',
  'Percentage of users engaging in policy-violating behavior': 'Доля пользователей, нарушающих правила',
  'Rate of attempts to circumvent safety guardrails': 'Частота попыток обойти защиту',
  'Rate of legitimate content incorrectly flagged as harmful': 'Нормальный контент, ошибочно помеченный как вредный',
  '95th percentile response latency': 'Время ответа, 95-й перцентиль',
  'Percentage of edge cases covered by current policy rules': 'Доля пограничных случаев, которые покрывают правила',
  'Rate of harmful content incorrectly passing safety filters': 'Вредный контент, прошедший фильтры',
  'Average time added by content moderation pipeline': 'Сколько в среднем добавляет модерация',
  'Percentage of users who appeal moderation decisions': 'Доля пользователей, оспаривающих решения модерации',
  'Percentage of automated safety evaluations passing': 'Доля пройденных автоматических проверок',
  'Percentage of users returning within 7 days': 'Доля вернувшихся в течение 7 дней',
  'Daily active users in thousands': 'Активные пользователи в день, тыс.',
  'Average revenue per user per day': 'Средняя выручка с пользователя в день',
  'Net Promoter Score (-100 to 100)': 'Индекс лояльности (от -100 до 100)',
  'API requests per second': 'Запросов к API в секунду',
  'Daily compute infrastructure cost': 'Расходы на вычисления в день',
  // presets
  'Safety first': 'Безопасность прежде всего',
  'Lean guardrails': 'Лёгкая защита',
  'Growth with guardrails': 'Рост под защитой',
  'Crisis containment': 'Сдержать кризис',
  'Rebuild trust': 'Вернуть доверие',
  'Human review, red-teaming and incident response at full strength. Lowest risk, highest cost.': 'Ручная модерация, ред-тиминг и реагирование на инциденты на полную. Минимальный риск, максимальная цена.',
  'Cheap, fast levers: rate limiting, feature flags, canary rollout, automated tests.': 'Дешёвые и быстрые рычаги: лимиты, фича-флаги, канареечная выкатка, автотесты.',
  'A growth campaign, backed by the ML classifier and rate limits to absorb the extra abuse.': 'Кампания роста, а ML-классификатор и лимиты гасят прирост злоупотреблений.',
  'Stop the bleeding: incident response, stricter policy, human review, public transparency.': 'Остановить ущерб: реагирование на инциденты, строже правила, ручная модерация, открытость.',
  'Fix false positives and talk openly: ML classifier, user reporting, transparency report.': 'Убрать ложные срабатывания и говорить открыто: ML-классификатор, жалобы, публичный отчёт.',
  // cost types
  'opex': 'опекс', 'capex': 'капекс'
};

export const t = s => (lang === 'ru' && RU[s] != null ? RU[s] : s);

// Static markup: elements carry data-i18n="English text" and data-i18n-ru="Русский текст".
export function applyStatic() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = lang === 'ru' ? el.dataset.i18nRu : el.dataset.i18n;
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = lang === 'ru' ? el.dataset.i18nTitleRu : el.dataset.i18nTitle;
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    el.setAttribute('aria-label', lang === 'ru' ? el.dataset.i18nAriaRu : el.dataset.i18nAria);
  });
  document.querySelectorAll('.lang-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
}
