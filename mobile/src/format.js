import { MONTHS_FULL, MONTHS_SHORT, daysWord } from './theme';

const pad = (n) => String(n).padStart(2, '0');

export const parseISO = (iso) => {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0);
};

export const toISO = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const todayISO = () => toISO(new Date());

export const dayNumber = (iso) => String(iso || '').slice(8, 10) || '—';
export const monthShort = (iso) => {
  const date = parseISO(iso);
  return date ? MONTHS_SHORT[date.getMonth()] : '';
};

export function dateRangeLabel(from, to) {
  if (!from) return 'Дата уточняется';
  const start = parseISO(from);
  const end = parseISO(to || from);
  if (!start || !end) return 'Дата уточняется';
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (from === (to || from)) return `${start.getDate()} ${MONTHS_FULL[start.getMonth()]}`;
  if (sameMonth) {
    return `${start.getDate()}–${end.getDate()} ${MONTHS_FULL[end.getMonth()]}`;
  }
  return `${start.getDate()} ${MONTHS_FULL[start.getMonth()]} — ${end.getDate()} ${MONTHS_FULL[end.getMonth()]}`;
}

export function dateRangeWithYear(from, to) {
  const end = parseISO(to || from);
  const label = dateRangeLabel(from, to);
  return end ? `${label} ${end.getFullYear()}` : label;
}

export function monthTitle(iso) {
  const date = parseISO(iso);
  if (!date) return 'Дата уточняется';
  const name = MONTHS_FULL[date.getMonth()];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${date.getFullYear()}`;
}

export const STATUS_LABEL = {
  scheduled: 'Запланирован',
  cancelled: 'Отменён',
  postponed: 'Перенесён',
  completed: 'Завершён',
  date_elapsed_status_unconfirmed: 'Даты прошли · статус не подтверждён',
  within_scheduled_dates_status_unconfirmed: 'Идёт по календарю · уточните у организатора',
  status_unconfirmed: 'Статус уточняется',
  date_unverified: 'Даты не подтверждены',
};

export const statusLabel = (code) => STATUS_LABEL[code] || 'Статус уточняется';

export function statusTone(code) {
  if (code === 'cancelled') return 'red';
  if (code === 'within_scheduled_dates_status_unconfirmed') return 'lime';
  if (code === 'scheduled') return 'green';
  if (code === 'date_elapsed_status_unconfirmed' || code === 'completed') return 'muted';
  return 'warn';
}

export const FRESHNESS_LABEL = {
  fresh: 'проверено недавно',
  stale: 'пора перепроверить',
  never_checked: 'без отметки проверки',
  historical: 'архив',
  date_unverified: 'дата не подтверждена',
};

export const freshnessLabel = (code) => FRESHNESS_LABEL[code] || 'проверка уточняется';

export const AUTHORITY_LABEL = {
  organizer: 'организатор',
  federation: 'федерация',
  club: 'клуб',
  aggregator: 'агрегатор',
  ranking: 'рейтинг',
};

export const COLLECTION_LABEL = {
  manual_review: 'ручная проверка',
  terms_review_required: 'нужно разрешение сайта',
  crawl_approved: 'сбор разрешён',
};

export const REGISTRATION_LABEL = {
  open: 'открыта',
  closed: 'закрыта',
  unknown: 'не подтверждена',
};

/** Сколько дней до старта и как это подписать. */
export function countdown(event) {
  const start = parseISO(event.start_date);
  const end = parseISO(event.end_date);
  if (!start || !end) return { text: 'дата уточняется', tone: 'muted' };
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  const dayMs = 86400000;
  const toStart = Math.round((start - today) / dayMs);
  const toEnd = Math.round((end - today) / dayMs);
  if (toEnd < 0) return { text: 'прошёл', tone: 'muted' };
  if (toStart <= 0 && toEnd >= 0) return { text: 'идёт сейчас', tone: 'lime' };
  if (toStart === 1) return { text: 'завтра', tone: 'lime' };
  if (toStart <= 14) return { text: `через ${toStart} ${daysWord(toStart)}`, tone: 'lime' };
  if (toStart <= 60) return { text: `через ${toStart} ${daysWord(toStart)}`, tone: 'soft' };
  return { text: `через ${Math.round(toStart / 30)} мес.`, tone: 'soft' };
}

export const isPast = (event) => String(event.end_date).slice(0, 10) < todayISO();
