// Слой доступа к данным: сеть, если сервер настроен и отвечает, иначе локальный каталог.
import * as local from './offline';

const envBase = (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_URL) || '';

export const connection = {
  base: envBase.replace(/\/$/, ''),
  online: false,
  checkedAt: null,
  lastError: '',
};

export function setBase(url) {
  connection.base = String(url || '').trim().replace(/\/$/, '');
  connection.online = false;
  connection.checkedAt = null;
}

function queryString(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const result = search.toString();
  return result ? `?${result}` : '';
}

async function network(path, { timeout = 9000, ...options } = {}) {
  if (!connection.base) throw new Error('Сервер не настроен');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${connection.base}/api/v1${path}`, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) {
      const detail = typeof body === 'object' ? body.detail : body;
      throw new Error(detail || `Ошибка сервера ${response.status}`);
    }
    return body;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Сервер не ответил за отведённое время');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Проверяет сервер и запоминает результат. Без адреса сразу офлайн. */
export async function checkConnection() {
  if (!connection.base) {
    connection.online = false;
    return false;
  }
  try {
    await network('/health', { timeout: 4500 });
    connection.online = true;
    connection.lastError = '';
  } catch (error) {
    connection.online = false;
    connection.lastError = error.message || 'Сервер недоступен';
  }
  connection.checkedAt = new Date().toISOString();
  return connection.online;
}

async function withFallback(path, params, fallback, options) {
  if (connection.base && connection.online) {
    try {
      return await network(`${path}${queryString(params)}`, options);
    } catch (error) {
      connection.online = false;
      connection.lastError = error.message || 'Сервер недоступен';
    }
  }
  return fallback();
}

export const api = {
  source: () => (connection.online && connection.base ? 'network' : 'local'),

  tournaments: (params) => withFallback('/tournaments', params, () => local.queryEvents(params)),
  tournament: (id) => withFallback(`/tournaments/${encodeURIComponent(id)}`, {}, () => local.getEvent(id)),
  clubs: (params) => withFallback('/clubs', params, () => local.queryClubs(params)),
  sources: () => withFallback('/sources', {}, () => ({ items: local.meta.sources, count: local.meta.sources.length })),
  overview: () => withFallback('/stats/overview', {}, () => local.meta.stats),
  recommend: (params) => withFallback('/recommendations', params, () => local.recommendations(params)),
  results: () => withFallback('/results', {}, () => ({ items: [] })),

  submitEvent: async (payload) => {
    try {
      return await network('/organizer/submissions', { method: 'POST', body: JSON.stringify(payload), timeout: 12000 });
    } catch (error) {
      connection.online = false;
      throw new Error(
        `${error.message}. Заявку можно отправить письмом: события@миргольфа.рф — приложите ссылку на положение.`,
      );
    }
  },

  reportCorrection: async (id, payload) => {
    try {
      return await network(`/tournaments/${encodeURIComponent(id)}/corrections`, {
        method: 'POST', body: JSON.stringify(payload), timeout: 12000,
      });
    } catch (error) {
      connection.online = false;
      throw new Error(
        `${error.message}. Пока сервер недоступен, напишите на события@миргольфа.рф со ссылкой на источник.`,
      );
    }
  },

  calendarUrl: () => (connection.base && connection.online ? `${connection.base}/api/v1/calendar.ics` : null),
};

export const offlineMeta = local.meta;
