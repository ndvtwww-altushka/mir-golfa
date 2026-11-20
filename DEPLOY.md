# Деплой «Мира Гольфа»

Проект состоит из трёх частей, и каждая разворачивается бесплатно.

## 1. Приложение и веб-версия — GitHub Pages + Releases

Уже настроено в `.github/workflows`:

- **APK** — пуш в `main` → сборка → подпись → релиз `apk-latest`.
  Скачать: `https://github.com/ndvtwww-altushka/mir-golfa/releases/latest/download/mir-golfa.apk`
- **Веб-версия** — тот же пуш → Expo export → GitHub Pages.
  Адрес: `https://ndvtwww-altushka.github.io/mir-golfa/`

Чтобы включить Pages: **Settings → Pages → Source: GitHub Actions**.

## 2. API — Render (бесплатный план)

В корне лежит `render.yaml`. Порядок:

1. Зайти на [render.com](https://render.com) через GitHub.
2. **New → Blueprint** → выбрать репозиторий `mir-golfa`.
3. Render прочитает `render.yaml`, соберёт `backend/Dockerfile` и выдаст адрес вида
   `https://mir-golfa-api.onrender.com`.
4. Проверить: `https://mir-golfa-api.onrender.com/api/v1/health`.
5. Открыть приложение → **Ещё → Адрес API** → вставить адрес → «Обновить данные».

Особенности бесплатного плана: сервис засыпает через 15 минут простоя и просыпается
за ~30 секунд. Приложение это переживает — оно работает на встроенном каталоге.

База — SQLite в `/tmp`, то есть **перезаписывается при каждом деплое**. Календарь
восстанавливается из `backend/data/*.seed.json`, но заявки организаторов и правки,
принятые модератором, живут только до перезапуска. Для постоянного хранения нужен
Postgres и `GOLF_DATABASE_URL` (в планах).

### Админ-доступ

При первом деплое Render генерирует `GOLF_ADMIN_TOKEN`. Он нужен для заголовка
`X-Admin-Token` в `/api/v1/admin/...`. Посмотреть значение: Render → сервис → Environment.

## 3. Альтернатива: свой сервер

```bash
cd backend
docker build -t mir-golfa-api .
docker run -p 8000:8000 mir-golfa-api
```

Uvicorn внутри контейнера слушает `$PORT` (по умолчанию 8000).

## Обновление календаря

`sync-data.yml` каждый день в 05:00 UTC:

1. скачивает официальный календарь АГР;
2. проверяет, что разбор нашёл хотя бы 10 событий (защита от смены вёрстки);
3. обновляет `backend/data/events.seed.json` и `mobile/src/data/bootstrap.json`;
4. коммитит изменения — Pages пересобирается, данные в приложении обновляются.

Запустить вручную: **Actions → Обновление календаря → Run workflow**.

## Переменные окружения

| Переменная | Назначение | По умолчанию |
|---|---|---|
| `GOLF_DATABASE_PATH` | путь к SQLite | `backend/data/mir_golfa.sqlite3` |
| `GOLF_CORS_ORIGINS` | разрешённые источники через запятую | localhost |
| `GOLF_ADMIN_TOKEN` | секрет для `/admin/*` | не задан (админка закрыта) |
| `GOLF_CIS_USER_AGENT` | честный User-Agent сборщика | `MirGolfaBot/1.0` |
| `EXPO_PUBLIC_API_URL` | адрес API, вшитый в сборку | пусто (офлайн-режим) |
