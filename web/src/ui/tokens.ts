/**
 * Єдине джерело неструктурних значень для UI.
 *
 * Правило: у TSX-екранах не має бути ані HEX-кольору, ані власного мапінгу
 * статус -> колір. Усе, що стосується кольору/семантики стану, живе тут і
 * повертає або токен `var(--color-*)`, або варіант Astryx-компонента.
 *
 * Токени взяті з реально наявних у `theme/theme.css` (`--color-text-*`,
 * `--color-background-*`), тому нових значень у тему додавати не треба.
 */

/** Крок вертикального ритму (px) для geometry-пропів Astryx-стеків. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Мінімальна клік-зона за вимогою дизайн-системи. */
export const MIN_TOUCH_TARGET_PX = 44;

/** Мінімальний дозволений розмір тексту — нижче 12px система забороняє. */
export const MIN_FONT_SIZE_PX = 12;

export type SurveyStatus =
  | 'idle'
  | 'waiting_auth'
  | 'running'
  | 'waiting_verification'
  | 'finished'
  | 'error';

/** Варіант `Badge` для статусу прогону опитування. */
export const statusBadgeVariant: Record<SurveyStatus, 'neutral' | 'info' | 'warning' | 'success' | 'error'> = {
  idle: 'neutral',
  waiting_auth: 'warning',
  running: 'info',
  waiting_verification: 'error',
  finished: 'success',
  error: 'error',
};

/** Людські підписи статусів (щоб не показувати оператору snake_case). */
export const statusLabel: Record<SurveyStatus, string> = {
  idle: 'Очікує',
  waiting_auth: 'Потрібен вхід',
  running: 'Виконується',
  waiting_verification: 'Потрібна верифікація',
  finished: 'Завершено',
  error: 'Помилка',
};

/** Токен кольору тексту для акценту на стані (замість HEX). */
export const statusTextColor: Record<SurveyStatus, string> = {
  idle: 'var(--color-text-tertiary)',
  waiting_auth: 'var(--color-text-yellow)',
  running: 'var(--color-text-secondary)',
  waiting_verification: 'var(--color-text-red)',
  finished: 'var(--color-text-green)',
  error: 'var(--color-text-red)',
};

export type RuleStatus = 'shadow' | 'active' | 'retired' | 'candidate';

export const ruleStatusVariant: Record<RuleStatus, 'neutral' | 'info' | 'success' | 'warning'> = {
  candidate: 'info',
  shadow: 'neutral',
  active: 'success',
  retired: 'warning',
};

export type RunOutcome = 'win' | 'loss' | 'partial' | 'unknown';

export const outcomeVariant: Record<RunOutcome, 'success' | 'error' | 'warning' | 'neutral'> = {
  win: 'success',
  loss: 'error',
  partial: 'warning',
  unknown: 'neutral',
};

/** Семантичні токени, що потрібні у geometry-стилях (фон вибраного рядка тощо). */
export const surface = {
  selected: 'var(--color-background-muted)',
  subtle: 'var(--color-background-subtle)',
  none: undefined,
} as const;

/** Ширина деталь-панелі master/detail на широкому екрані. */
export const DETAIL_WIDTH_PX = 420;

/** Breakpoint телефона (portrait 360-430px). */
export const NARROW_MAX_WIDTH_PX = 480;
