// Локальный каталог: работает без сети и повторяет правила backend.
import bootstrap from './data/bootstrap.json';

const pad = (n) => String(n).padStart(2, '0');

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const parseDay = (iso) => {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0);
};

export const daysBetween = (isoA, isoB) => {
  const a = parseDay(isoA);
  const b = parseDay(isoB);
  if (!a || !b) return null;
  return Math.round((a - b) / 86400000);
};

/** Статус без выдумок: прошедшие даты не означают «завершён». */
export function displayStatus(event, today = todayISO()) {
  const state = String(event.event_status || 'unknown').toLowerCase();
  if (['cancelled', 'postponed', 'completed'].includes(state)) return state;
  const end = event.end_date ? String(event.end_date).slice(0, 10) : null;
  const start = event.start_date ? String(event.start_date).slice(0, 10) : null;
  if (!start || !end) return 'date_unverified';
  if (end < today) return 'date_elapsed_status_unconfirmed';
  if (start <= today && today <= end) return 'within_scheduled_dates_status_unconfirmed';
  if (state === 'scheduled') return 'scheduled';
  return 'status_unconfirmed';
}

export function freshness(event, today = todayISO()) {
  const checked = event.last_checked_at ? String(event.last_checked_at).slice(0, 10) : null;
  if (!checked) return 'never_checked';
  const end = String(event.end_date).slice(0, 10);
  if (end < today) return 'historical';
  const daysUntilStart = daysBetween(String(event.start_date).slice(0, 10), today) || 0;
  const maxAge = daysUntilStart <= 14 ? 3 : 14;
  const age = Math.max(0, daysBetween(today, checked) || 0);
  return age > maxAge ? 'stale' : 'fresh';
}

function isEligible(event, handicap, ageGroup) {
  const aliases = {
    open: ['open', 'all', 'все', 'любой возраст'],
    adult: ['adult', 'adults', 'взрослые', 'взрослый', '19+'],
    junior: ['junior', 'juniors', 'юниоры', 'юниор', 'дети'],
  };
  const key = (value) => {
    const folded = String(value || '').toLowerCase().trim();
    const found = Object.keys(aliases).find((group) => aliases[group].includes(folded));
    return found || folded;
  };
  if (ageGroup && event.age_group && !['open', key(ageGroup)].includes(key(event.age_group))) return false;
  if (handicap !== null && handicap !== undefined) {
    if (event.hcp_min !== null && event.hcp_min !== undefined && handicap < Number(event.hcp_min)) return false;
    if (event.hcp_max !== null && event.hcp_max !== undefined && handicap > Number(event.hcp_max)) return false;
  }
  return true;
}

function withRuntimeState(event, today) {
  return {
    ...event,
    display_status: displayStatus(event, today),
    freshness_state: freshness(event, today),
  };
}

const allEvents = (bootstrap.events || []).slice().sort((a, b) =>
  a.start_date === b.start_date ? a.name.localeCompare(b.name) : a.start_date.localeCompare(b.start_date));

export function queryEvents({
  q, country, region, sport, level, age_group, start_from, end_to, ended_before,
  registration_open, handicap, limit = 100, offset = 0,
} = {}) {
  const today = todayISO();
  const needle = String(q || '').trim().toLowerCase();
  const found = allEvents.filter((event) => {
    if (needle) {
      const haystack = [event.name, event.venue, event.city, event.region, event.organizer, event.country]
        .filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    if (country && !String(event.country || '').toLowerCase().includes(country.toLowerCase())) return false;
    if (region && !String(event.region || '').toLowerCase().includes(region.toLowerCase())) return false;
    if (sport && sport !== 'all' && event.sport !== sport) return false;
    if (level && !String(event.level || '').toLowerCase().includes(level.toLowerCase())) return false;
    if (start_from && String(event.end_date).slice(0, 10) < start_from) return false;
    if (end_to && String(event.start_date).slice(0, 10) > end_to) return false;
    if (ended_before && String(event.end_date).slice(0, 10) >= ended_before) return false;
    if (registration_open === true && event.registration_status !== 'open') return false;
    if (registration_open === false && event.registration_status === 'open') return false;
    if ((age_group || handicap !== undefined) && !isEligible(event, handicap, age_group)) return false;
    return true;
  }).map((event) => withRuntimeState(event, today));
  return { items: found.slice(offset, offset + limit), count: found.length, limit, offset };
}

export function getEvent(id) {
  const event = allEvents.find((item) => item.id === id);
  if (!event) return null;
  return { ...withRuntimeState(event, todayISO()), evidence: [] };
}

export function queryClubs({ q, region, limit = 100 } = {}) {
  const needle = String(q || '').trim().toLowerCase();
  const items = (bootstrap.clubs || []).filter((club) => {
    if (needle && !`${club.name || ''} ${club.city || ''} ${club.region || ''}`.toLowerCase().includes(needle)) return false;
    if (region && !String(club.region || '').toLowerCase().includes(region.toLowerCase())) return false;
    return true;
  }).slice(0, limit);
  return { items, count: items.length };
}

export function recommendations({ region, age_group, handicap, limit = 100 } = {}) {
  const today = todayISO();
  const needle = String(region || '').trim().toLowerCase();
  const scored = allEvents
    .filter((event) => String(event.end_date).slice(0, 10) >= today)
    .filter((event) => (needle ? String(event.region || '').toLowerCase().includes(needle) : true))
    .filter((event) => isEligible(event, handicap, age_group))
    .map((event) => {
      const start = Math.max(0, daysUntil(event.start_date) || 0);
      const score = (needle && String(event.region || '').toLowerCase().includes(needle) ? 40 : 0) + Math.max(0, 30 - start / 7);
      return { ...withRuntimeState(event, today), eligibility_match: event.hcp_min || event.hcp_max ? 'matched' : 'unknown', _score: score };
    })
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(({ _score, ...event }) => event);
  return { items: scored, count: scored.length };
}

export const daysUntil = (iso) => {
  const diff = daysBetween(String(iso).slice(0, 10), todayISO());
  return diff === null ? null : diff;
};

export const meta = {
  generatedAt: bootstrap.generated_at,
  season: bootstrap.season,
  seasonClosed: !!bootstrap.season_closed,
  events: (bootstrap.events || []).length,
  sources: bootstrap.sources || [],
  stats: bootstrap.stats || {},
};
