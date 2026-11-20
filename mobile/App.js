import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, Modal, Pressable, RefreshControl,
  SafeAreaView, ScrollView, StatusBar, Text, TextInput, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './src/api';

const C = {
  bg: '#F4F6F0', card: '#FFFFFF', ink: '#17251D', muted: '#68766D',
  green: '#14543B', pale: '#E7EFE7', lime: '#D9F17A', line: '#DDE5DC',
  red: '#A43932', amber: '#96620A',
};
const TABS = ['События', 'Клубы', 'Результаты', 'Моя игра', 'Профиль'];
const EMPTY_FORM = { event_name: '', start_date: '', end_date: '', country: 'Россия', region: '', venue: '', organizer: '', level: '', age_group: '', hcp_min: '', hcp_max: '', sport: 'golf', registration_url: '', regulations_url: '', source_url: '', notes: '' };
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const emptyRoundForm = () => ({ played_on: todayLocal(), course: '', holes: '18', gross_score: '', putts: '', greens_in_regulation: '', fairways_hit: '', fairways_total: '' });
const dateLabel = (from, to) => {
  if (!from) return 'Дата уточняется';
  const format = (s) => new Date(`${s}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  return from === to ? format(from) : `${format(from)} — ${format(to)}`;
};
const authorityText = (value) => ({ organizer: 'организатор', federation: 'федерация', club: 'клуб', aggregator: 'агрегатор', ranking: 'рейтинг' }[value] || 'источник');
const collectionText = (value) => ({ manual_review: 'ручная проверка', terms_review_required: 'проверка условий доступа', crawl_approved: 'сбор разрешён' }[value] || value || 'не настроено');
const freshnessText = (value) => ({ fresh: 'проверка свежая', stale: 'проверка устарела', never_checked: 'не проверено', historical: 'архив', date_unverified: 'проверка даты нужна' }[value] || 'проверка уточняется');
const statusText = (value) => ({
  scheduled: 'Запланирован', cancelled: 'Отменён', postponed: 'Перенесён', completed: 'Завершён',
  date_elapsed_status_unconfirmed: 'Даты прошли · статус не подтверждён',
  within_scheduled_dates_status_unconfirmed: 'По календарю проходит сейчас · уточните у организатора',
  status_unconfirmed: 'Статус уточняется', date_unverified: 'Даты не подтверждены',
}[value] || 'Статус уточняется');

function Button({ title, onPress, secondary = false, disabled = false }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={[styles.button, secondary && styles.buttonSecondary, disabled && { opacity: 0.5 }]}>
    <Text style={[styles.buttonText, secondary && { color: C.green }]}>{title}</Text>
  </Pressable>;
}
function Chip({ title, active, onPress }) {
  return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
    <Text style={[styles.chipText, active && { color: '#fff' }]}>{title}</Text>
  </Pressable>;
}
function Empty({ title, text, onRetry }) {
  return <View style={styles.empty}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.muted}>{text}</Text>
    {onRetry && <Button title="Обновить" onPress={onRetry} secondary />}</View>;
}
function EventCard({ event, onOpen, saved }) {
  return <Pressable onPress={onOpen} style={styles.card}>
    <View style={styles.rowBetween}><Text style={styles.eyebrow}>{event.sport === 'mini_golf' ? 'МИНИ-ГОЛЬФ' : 'ГОЛЬФ'}</Text>
      {!!event.level && <Text style={styles.level}>{event.level}</Text>}</View>
    <Text style={styles.eventTitle}>{event.name}</Text>
    <Text style={styles.eventDate}>◷  {dateLabel(event.start_date, event.end_date)}</Text>
    <Text style={styles.muted}>⌖  {[event.venue, event.city, event.region].filter(Boolean).join(' · ') || 'Место уточняется'}</Text>
    {!!event.entry_fee_text && <Text style={styles.feePreview}>{event.entry_fee_text}</Text>}
    {(event.eligibility_match === 'check_regulations' || event.eligibility_state === 'check_regulations') && <Text style={styles.eligibilityWarning}>Сверь ограничения по HCP/возрасту с регламентом</Text>}
    <View style={styles.rowBetween}><Text style={styles.status}>{statusText(event.display_status)}</Text>
      <Text style={styles.savedMark}>{saved ? '★' : '→'}</Text></View>
    <Text style={styles.checked}>Источник: {event.source_name || event.source_id || 'не указан'} ({authorityText(event.source_authority)}) · проверено: {event.last_checked_at ? event.last_checked_at.slice(0, 10) : 'нет отметки'} · {freshnessText(event.freshness_state)}</Text>
  </Pressable>;
}

export default function App() {
  const [tab, setTab] = useState('События');
  const [period, setPeriod] = useState('Ближайшие');
  const [sport, setSport] = useState('all');
  const [registrationOnly, setRegistrationOnly] = useState(false);
  const [personalized, setPersonalized] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [correction, setCorrection] = useState({ field_name: '', suggested_value: '', evidence_url: '' });
  const [query, setQuery] = useState('');
  const [events, setEvents] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [results, setResults] = useState([]);
  const [stats, setStats] = useState(null);
  const [sources, setSources] = useState([]);
  const [profile, setProfile] = useState({ region: '', age_group: '', handicap: '' });
  const [saved, setSaved] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [rounds, setRounds] = useState([]);
  const [roundModal, setRoundModal] = useState(false);
  const [roundForm, setRoundForm] = useState(emptyRoundForm);
  const [roundSaving, setRoundSaving] = useState(false);

  const load = useCallback(async () => {
    setBusy(true); setError('');
    const range = period === 'Архив' ? { ended_before: todayLocal() } : { start_from: todayLocal() };
    try {
      const eventRequest = period === 'Архив'
        ? api.tournaments({ ...range, limit: 100 })
        : personalized
          ? api.recommend({ region: profile.region || undefined, age_group: profile.age_group || undefined,
              handicap: profile.handicap ? Number(profile.handicap) : undefined, limit: 100 })
          : api.tournaments({ ...range, limit: 100 });
      const responses = await Promise.allSettled([
        eventRequest, api.clubs({ limit: 100 }), api.results({ limit: 100 }), api.overview(), api.sources(),
      ]);
      if (responses[0].status === 'rejected') throw responses[0].reason;
      const [eventResult, clubResult, resultResult, statsResult, sourceResult] = responses;
      setEvents(eventResult.value.items || []);
      setClubs(clubResult.status === 'fulfilled' ? (clubResult.value.items || []) : []);
      setResults(resultResult.status === 'fulfilled' ? (resultResult.value.items || []) : []);
      setStats(statsResult.status === 'fulfilled' ? statsResult.value : null);
      setSources(sourceResult.status === 'fulfilled' ? (sourceResult.value.items || []) : []);
      if (responses.slice(1).some((result) => result.status === 'rejected')) setError('Календарь загружен, но часть разделов сейчас недоступна. Потяни экран вниз, чтобы повторить.');
    } catch (e) { setError(e.message || 'Не удалось загрузить календарь'); }
    finally { setBusy(false); }
  }, [period, personalized, profile.region, profile.age_group, profile.handicap]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    (async () => {
      try {
        const [savedRaw, profileRaw, roundsRaw] = await Promise.all([AsyncStorage.getItem('saved-events'), AsyncStorage.getItem('player-preferences'), AsyncStorage.getItem('local-rounds')]);
        if (savedRaw) setSaved(JSON.parse(savedRaw));
        if (profileRaw) setProfile((p) => ({ ...p, ...JSON.parse(profileRaw) }));
        if (roundsRaw) setRounds(JSON.parse(roundsRaw));
      } catch { /* Local preferences are optional; app remains usable. */ }
    })();
  }, []);

  const filteredEvents = useMemo(() => events.filter((event) => {
    const text = [event.name, event.region, event.city, event.venue, event.organizer].filter(Boolean).join(' ').toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (sport === 'all' || event.sport === sport) && (!showSavedOnly || saved.includes(event.id)) && (!registrationOnly || event.registration_status === 'open');
  }), [events, query, sport, showSavedOnly, saved, registrationOnly]);

  const roundStats = useMemo(() => {
    const totalHoles = rounds.reduce((sum, r) => sum + r.holes, 0);
    const avg18 = rounds.length ? rounds.reduce((sum, r) => sum + (r.gross_score / r.holes) * 18, 0) / rounds.length : null;
    const puttRounds = rounds.filter((r) => r.putts !== null);
    const puttHoles = puttRounds.reduce((sum, r) => sum + r.holes, 0);
    const putts18 = puttHoles ? puttRounds.reduce((sum, r) => sum + r.putts, 0) / puttHoles * 18 : null;
    const girRounds = rounds.filter((r) => r.greens_in_regulation !== null);
    const girHoles = girRounds.reduce((sum, r) => sum + r.holes, 0);
    const girPct = girHoles ? girRounds.reduce((sum, r) => sum + r.greens_in_regulation, 0) / girHoles * 100 : null;
    const fairwayRounds = rounds.filter((r) => r.fairways_total !== null && r.fairways_total > 0);
    const fairwaysTotal = fairwayRounds.reduce((sum, r) => sum + r.fairways_total, 0);
    const fairwaysPct = fairwaysTotal ? fairwayRounds.reduce((sum, r) => sum + r.fairways_hit, 0) / fairwaysTotal * 100 : null;
    return { totalHoles, avg18, putts18, girPct, fairwaysPct };
  }, [rounds]);

  const toggleSaved = async (id) => {
    const next = saved.includes(id) ? saved.filter((item) => item !== id) : [...saved, id];
    setSaved(next); await AsyncStorage.setItem('saved-events', JSON.stringify(next));
  };
  const updateProfile = async (key, value) => {
    const next = { ...profile, [key]: value };
    setProfile(next); await AsyncStorage.setItem('player-preferences', JSON.stringify(next));
  };
  const saveRound = async () => {
    const holes = Number(roundForm.holes);
    const score = Number(roundForm.gross_score);
    const putts = roundForm.putts === '' ? null : Number(roundForm.putts);
    const gir = roundForm.greens_in_regulation === '' ? null : Number(roundForm.greens_in_regulation);
    const fairwaysHit = roundForm.fairways_hit === '' ? null : Number(roundForm.fairways_hit);
    const fairwaysTotal = roundForm.fairways_total === '' ? null : Number(roundForm.fairways_total);
    const dateParts = roundForm.played_on.split('-').map(Number);
    const parsedDate = dateParts.length === 3 ? new Date(dateParts[0], dateParts[1] - 1, dateParts[2]) : null;
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(roundForm.played_on) && parsedDate && parsedDate.getFullYear() === dateParts[0] && parsedDate.getMonth() === dateParts[1] - 1 && parsedDate.getDate() === dateParts[2];
    if (!roundForm.course.trim() || !validDate || roundForm.played_on > todayLocal() || ![9, 18].includes(holes) || !Number.isInteger(score) || score < holes || score > holes * 10) {
      return Alert.alert('Проверь запись', 'Нужны поле, прошедшая дата, 9/18 лунок и корректный общий счёт.');
    }
    if (putts !== null && (!Number.isInteger(putts) || putts < 0 || putts > holes * 3 || putts > score)) return Alert.alert('Проверь патты', 'Число паттов должно быть от 0 до 3 на лунку.');
    if (gir !== null && (!Number.isInteger(gir) || gir < 0 || gir > holes)) return Alert.alert('Проверь GIR', 'GIR не может быть больше числа сыгранных лунок.');
    if ((fairwaysHit === null) !== (fairwaysTotal === null) || (fairwaysTotal !== null && (!Number.isInteger(fairwaysHit) || !Number.isInteger(fairwaysTotal) || fairwaysHit < 0 || fairwaysTotal < 0 || fairwaysHit > fairwaysTotal || fairwaysTotal > holes))) {
      return Alert.alert('Проверь fairways', 'Укажи корректно попадания и число возможностей попасть на фервей.');
    }
    const item = { id: `round-${Date.now()}`, played_on: roundForm.played_on, course: roundForm.course.trim(), holes, gross_score: score, putts, greens_in_regulation: gir, fairways_hit: fairwaysHit, fairways_total: fairwaysTotal };
    const next = [item, ...rounds].slice(0, 500);
    setRoundSaving(true);
    try { await AsyncStorage.setItem('local-rounds', JSON.stringify(next)); setRounds(next); setRoundForm(emptyRoundForm()); setRoundModal(false); }
    catch { Alert.alert('Не сохранилось', 'Проверь свободное место на устройстве и попробуй ещё раз.'); }
    finally { setRoundSaving(false); }
  };
  const deleteRound = (id) => Alert.alert('Удалить раунд?', 'Эта запись исчезнет с устройства.', [{ text: 'Отмена', style: 'cancel' }, { text: 'Удалить', style: 'destructive', onPress: async () => { const next = rounds.filter((round) => round.id !== id); try { await AsyncStorage.setItem('local-rounds', JSON.stringify(next)); setRounds(next); } catch { Alert.alert('Не удалось сохранить изменения'); } } }]);
  const mapUrl = (query) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  const openUrl = async (url) => {
    if (!url) return Alert.alert('Ссылка не указана', 'У организатора пока нет ссылки в карточке.');
    try { await Linking.openURL(url); } catch { Alert.alert('Не удалось открыть ссылку', url); }
  };
  const shareCalendar = () => openUrl(api.calendarUrl());
  const openEvent = async (event) => {
    setSelected(event); setDetail(event);
    try { setDetail(await api.tournament(event.id)); } catch { /* The list card remains usable if detail fetch fails. */ }
  };
  const closeEvent = () => { setSelected(null); setDetail(null); };
  const detailEvent = detail || selected;

  const submitEvent = async () => {
    if (!form.event_name || !form.start_date || !form.end_date || !form.source_url) {
      return Alert.alert('Заполни обязательные поля', 'Нужны название, даты и ссылка на источник.');
    }
    setSubmitting(true);
    try {
      const answer = await api.submitEvent({ ...form, notes: form.notes || null, region: form.region || null, venue: form.venue || null, organizer: form.organizer || null, level: form.level || null, age_group: form.age_group || null, hcp_min: form.hcp_min ? Number(form.hcp_min) : null, hcp_max: form.hcp_max ? Number(form.hcp_max) : null, registration_url: form.registration_url || null, regulations_url: form.regulations_url || null });
      Alert.alert('Заявка принята', answer.message); setForm(EMPTY_FORM);
    } catch (e) { Alert.alert('Не отправилось', e.message); }
    finally { setSubmitting(false); }
  };

  const renderEvents = () => <>
    <View style={styles.hero}>
      <Text style={styles.heroKicker}>ТУРНИРЫ · КЛУБЫ · РЕЗУЛЬТАТЫ</Text>
      <Text style={styles.heroTitle}>Твой следующий{ '\n' }старт — здесь.</Text>
      <Text style={styles.heroBody}>Факты со ссылкой на источник. Если статус не подтверждён — так и скажем.</Text>
      <View style={styles.heroButtons}><Button title="Мой календарь .ics" onPress={shareCalendar} secondary /></View>
    </View>
    <View style={styles.rowBetween}><Text style={styles.sectionTitle}>Календарь</Text><Text style={styles.muted}>{filteredEvents.length} событий</Text></View>
    <View style={styles.chipRow}><Chip title="Ближайшие" active={period === 'Ближайшие'} onPress={() => { setPeriod('Ближайшие'); setPersonalized(false); }} /><Chip title="Архив" active={period === 'Архив'} onPress={() => { setPeriod('Архив'); setPersonalized(false); }} /></View>
    <TextInput value={query} onChangeText={setQuery} placeholder="Турнир, клуб, регион…" placeholderTextColor={C.muted} style={styles.input} />
    <View style={styles.chipRow}><Chip title={personalized ? 'Мои рекомендации ✓' : 'Подобрать под меня'} active={personalized} onPress={() => setPersonalized((v) => !v)} /><Chip title={showSavedOnly ? 'Избранное ✓' : 'Избранное'} active={showSavedOnly} onPress={() => setShowSavedOnly((v) => !v)} /></View>
    <View style={styles.chipRow}><Chip title={registrationOnly ? 'Регистрация открыта ✓' : 'Регистрация открыта'} active={registrationOnly} onPress={() => setRegistrationOnly((v) => !v)} /></View>
    <View style={styles.chipRow}><Chip title="Все" active={sport === 'all'} onPress={() => setSport('all')} /><Chip title="Гольф" active={sport === 'golf'} onPress={() => setSport('golf')} /><Chip title="Мини-гольф" active={sport === 'mini_golf'} onPress={() => setSport('mini_golf')} /></View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {busy && events.length === 0 ? <ActivityIndicator color={C.green} style={{ margin: 30 }} /> : filteredEvents.length ? filteredEvents.map((event) => <EventCard key={event.id} event={event} saved={saved.includes(event.id)} onOpen={() => openEvent(event)} />) : <Empty title={period === 'Архив' ? 'Архив пока пуст' : 'Нет подтверждённых ближайших турниров'} text="Мы не подставляем выдуманные даты. Можно проверить источники или отправить организатору ссылку на добавление турнира." onRetry={load} />}
  </>;

  const renderClubs = () => <>
    <Text style={styles.sectionTitle}>Клубы и поля</Text>
    <Text style={styles.muted}>Каталог появляется только после проверки адреса и сайта клуба. Мы не выдаём пустые карточки за каталог.</Text>
    {clubs.length ? clubs.map((club) => <View key={club.id} style={styles.card}><Text style={styles.eventTitle}>{club.name}</Text><Text style={styles.muted}>{[club.city, club.region, club.country].filter(Boolean).join(' · ')}</Text>{club.address && <><Text style={styles.body}>{club.address}</Text><Button title="Маршрут / карта ↗" onPress={() => openUrl(mapUrl(`${club.name}, ${club.address}, ${club.city || ''}`))} secondary /></>}{club.phone && <Button title={`Позвонить ${club.phone}`} onPress={() => openUrl(`tel:${club.phone.replace(/[^0-9+]/g, '')}`)} secondary />}{club.source_excerpt && <Text style={styles.muted}>{club.source_excerpt}</Text>}<Text style={styles.checked}>Данные: {club.evidence_state} · проверено: {club.checked_at || 'нет отметки'}</Text>{club.website && <Button title="Страница / сайт ↗" onPress={() => openUrl(club.website)} secondary />}{club.source_url && <Pressable onPress={() => openUrl(club.source_url)}><Text style={styles.link}>Источник адреса ↗</Text></Pressable>}</View>) : <Empty title="Проверенных карточек пока нет" text="Каталог полей публикуется только с адресом и первоисточником." />}
  </>;

  const renderResults = () => <>
    <Text style={styles.sectionTitle}>Результаты</Text>
    <Text style={styles.muted}>Показываем только официальные результаты с источником и отметкой проверки.</Text>
    {results.length ? results.map((result, i) => <View key={`${result.tournament_id}-${i}`} style={styles.card}><Text style={styles.eventTitle}>{result.tournament_name}</Text><Text style={styles.body}>{result.place ? `${result.place} место · ` : ''}{result.participant_name}</Text><Text style={styles.muted}>{result.category || ''} {result.gross_score ? `· Gross ${result.gross_score}` : ''}</Text><Text style={styles.checked}>Официально подтверждено · {result.verified_at}</Text>{result.source_url && <Pressable onPress={() => openUrl(result.source_url)}><Text style={styles.link}>Открыть протокол ↗</Text></Pressable>}</View>) : <Empty title="Подтверждённых протоколов пока нет" text="Не показываем фамилии и счёт, пока нет официального протокола. Ссылку на результат можно отправить через форму исправления в карточке турнира." />}
  </>;

  const renderOverview = () => <>
    <View style={styles.rowBetween}><Text style={styles.sectionTitle}>Моя игра</Text><Button title="+ Записать раунд" onPress={() => setRoundModal(true)} /></View>
    <Text style={styles.muted}>Личная статистика хранится только на этом устройстве. Это не официальный гандикап и не турнирный протокол.</Text>
    <View style={styles.statGrid}>
      {[[rounds.length, 'раундов записано'], [roundStats.totalHoles, 'лунок сыграно'], [roundStats.avg18 === null ? '—' : roundStats.avg18.toFixed(1), 'средний счёт / 18 лунок'], [roundStats.putts18 === null ? '—' : roundStats.putts18.toFixed(1), 'патты / 18 лунок'], [roundStats.girPct === null ? '—' : `${roundStats.girPct.toFixed(0)}%`, 'GIR'], [roundStats.fairwaysPct === null ? '—' : `${roundStats.fairwaysPct.toFixed(0)}%`, 'попадания на фервей']].map(([number, label]) => <View style={styles.statCard} key={label}><Text style={styles.statNumber}>{number}</Text><Text style={styles.muted}>{label}</Text></View>)}
    </View>
    <Text style={[styles.sectionTitle, { marginTop: 24 }]}>История раундов</Text>
    {rounds.length ? rounds.map((round) => <View key={round.id} style={styles.card}>
      <View style={styles.rowBetween}><Text style={styles.bodyBold}>{round.course}</Text><Pressable onPress={() => deleteRound(round.id)}><Text style={styles.deleteText}>Удалить</Text></Pressable></View>
      <Text style={styles.muted}>{dateLabel(round.played_on, round.played_on)} · {round.holes} лунок · {round.gross_score} ударов</Text>
      <Text style={styles.muted}>{round.putts !== null ? `${round.putts} паттов` : 'патты не записаны'}{round.greens_in_regulation !== null ? ` · GIR ${round.greens_in_regulation}/${round.holes}` : ''}{round.fairways_total ? ` · фервеи ${round.fairways_hit}/${round.fairways_total}` : ''}</Text>
    </View>) : <Empty title="Пока ни одного раунда" text="Добавь счёт после игры — средние показатели посчитаются автоматически. Данные остаются на телефоне." />}
    <Text style={[styles.sectionTitle, { marginTop: 26 }]}>Состояние календаря</Text>
    <Text style={styles.muted}>Это состояние нашей базы, не оценка всего рынка гольфа.</Text>
    {stats ? <View style={styles.statGrid}>
      {[[stats.published_events, 'событий в базе'], [stats.upcoming_events, 'ближайших по датам'], [stats.verified_results, 'подтверждённых результатов'], [stats.verified_clubs, 'проверенных клубов'], [stats.enabled_sources, 'источников включено']].map(([number, label]) => <View style={styles.statCard} key={label}><Text style={styles.statNumber}>{number}</Text><Text style={styles.muted}>{label}</Text></View>)}
    </View> : <ActivityIndicator color={C.green} />}
    <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Источники</Text>
    {sources.map((source) => <View key={source.id} style={styles.sourceRow}><Text style={styles.bodyBold}>{source.name}</Text><Text style={styles.muted}>{source.country || ''} · {authorityText(source.authority)} · {collectionText(source.collection_mode)}</Text><Pressable onPress={() => openUrl(source.url)}><Text style={styles.link}>Открыть первоисточник ↗</Text></Pressable></View>)}
  </>;

  const renderProfile = () => <>
    <Text style={styles.sectionTitle}>Мои фильтры</Text>
    <Text style={styles.muted}>Сохраняются только на этом устройстве. Гандикап и возраст не публикуются в профиле.</Text>
    <Text style={styles.label}>Регион</Text><TextInput value={profile.region} onChangeText={(v) => updateProfile('region', v)} placeholder="Например, Москва" style={styles.input} />
    <Text style={styles.label}>Гандикап (необязательно)</Text><TextInput value={profile.handicap} onChangeText={(v) => updateProfile('handicap', v.replace(',', '.'))} keyboardType="decimal-pad" placeholder="Например, 24.5" style={styles.input} />
    <Text style={styles.label}>Возрастная категория</Text><TextInput value={profile.age_group} onChangeText={(v) => updateProfile('age_group', v)} placeholder="Например, юниоры / взрослые" style={styles.input} />
    <Text style={styles.sectionTitle}>Избранное · {saved.length}</Text>
    <Button title="Показать избранные турниры" onPress={() => { setPeriod('Ближайшие'); setShowSavedOnly(true); setTab('События'); }} secondary />
    <Text style={styles.muted}>Избранные события хранятся локально. Напоминания включим, когда будут подтверждены даты и регистрация.</Text>
    <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Для организаторов</Text>
    <Text style={styles.muted}>Отправьте событие на модерацию. Оно не попадёт в общий календарь автоматически.</Text>
    <Text style={styles.label}>Вид спорта</Text>
    <View style={styles.chipRow}><Chip title="Гольф" active={form.sport === 'golf'} onPress={() => setForm((f) => ({ ...f, sport: 'golf' }))} /><Chip title="Мини-гольф" active={form.sport === 'mini_golf'} onPress={() => setForm((f) => ({ ...f, sport: 'mini_golf' }))} /></View>
    {[
      ['event_name', 'Название турнира *'], ['start_date', 'Дата начала YYYY-MM-DD *'], ['end_date', 'Дата окончания YYYY-MM-DD *'],
      ['country', 'Страна *'], ['region', 'Регион'], ['venue', 'Поле / площадка'], ['organizer', 'Организатор'],
      ['level', 'Уровень соревнования'], ['age_group', 'Возрастная категория'], ['venue_address', 'Адрес площадки'], ['format', 'Формат турнира'], ['eligibility_notes', 'Условия допуска'], ['entry_fee_text', 'Стоимость / доплаты'], ['contact_phone', 'Телефон регистрации'], ['contact_note', 'Как записаться / альтернативная площадка'], ['hcp_min', 'Минимальный HCP допуска'],
      ['hcp_max', 'Максимальный HCP допуска'], ['registration_url', 'Ссылка на регистрацию'],
      ['regulations_url', 'Ссылка на регламент'], ['source_url', 'Официальная ссылка *'], ['notes', 'Комментарий для редактора'],
    ].map(([key, label]) => <View key={key}><Text style={styles.label}>{label}</Text><TextInput value={form[key]} onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))} keyboardType={['hcp_min','hcp_max'].includes(key) ? 'decimal-pad' : 'default'} autoCapitalize={key.endsWith('_url') ? 'none' : 'sentences'} style={styles.input} placeholder={label.replace(' *', '')} multiline={key === 'notes'} /></View>)}
    <Button title={submitting ? 'Отправляем…' : 'Отправить на проверку'} onPress={submitEvent} disabled={submitting} />
    <Text style={[styles.checked, { marginTop: 10 }]}>Для публикации нужны проверка редактором и первичный источник.</Text>
  </>;

  const renderTab = () => {
    if (tab === 'События') return renderEvents();
    if (tab === 'Клубы') return renderClubs();
    if (tab === 'Результаты') return renderResults();
    if (tab === 'Моя игра') return renderOverview();
    return renderProfile();
  };

  return <SafeAreaView style={styles.safe}>
    <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
    <View style={styles.topbar}><View><Text style={styles.brand}>МИР ГОЛЬФА</Text><Text style={styles.tagline}>Турниры без информационного тумана</Text></View><Pressable onPress={load} accessibilityLabel="Обновить"><Text style={styles.refresh}>↻</Text></Pressable></View>
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={C.green} />}>
      {renderTab()}
      <Text style={styles.footer}>У каждого факта должен быть источник. Демо-данные не выдаются за живой календарь.</Text>
    </ScrollView>
    <View style={styles.tabbar}>{TABS.map((name) => <Pressable key={name} onPress={() => setTab(name)} style={styles.tabButton}><Text style={[styles.tabText, tab === name && styles.tabTextActive]}>{name}</Text></Pressable>)}</View>
    <Modal visible={roundModal} animationType="slide" onRequestClose={() => setRoundModal(false)}>
      <SafeAreaView style={styles.modalSafe}>
        <View style={styles.modalTop}><Pressable onPress={() => setRoundModal(false)}><Text style={styles.link}>← Назад</Text></Pressable><Text style={styles.bodyBold}>Новый раунд</Text></View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.muted}>Запись личная и локальная. Она не меняет официальный HCP и не публикуется.</Text>
          <Text style={styles.label}>Дата YYYY-MM-DD</Text><TextInput value={roundForm.played_on} onChangeText={(v) => setRoundForm((x) => ({ ...x, played_on: v }))} style={styles.input} placeholder="2026-06-20" />
          <Text style={styles.label}>Поле / клуб</Text><TextInput value={roundForm.course} onChangeText={(v) => setRoundForm((x) => ({ ...x, course: v }))} style={styles.input} placeholder="Название поля" />
          <Text style={styles.label}>Лунок</Text><View style={styles.chipRow}><Chip title="9" active={roundForm.holes === '9'} onPress={() => setRoundForm((x) => ({ ...x, holes: '9' }))} /><Chip title="18" active={roundForm.holes === '18'} onPress={() => setRoundForm((x) => ({ ...x, holes: '18' }))} /></View>
          {[
            ['gross_score', 'Общий счёт (удары) *'], ['putts', 'Патты (необязательно)'],
            ['greens_in_regulation', 'GIR (0–число лунок)'], ['fairways_hit', 'Попадания на фервей'], ['fairways_total', 'Возможности попасть на фервей'],
          ].map(([key, label]) => <View key={key}><Text style={styles.label}>{label}</Text><TextInput value={roundForm[key]} onChangeText={(v) => setRoundForm((x) => ({ ...x, [key]: v.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" style={styles.input} placeholder="Число" /></View>)}
          <Button title={roundSaving ? 'Сохраняем…' : 'Сохранить на устройстве'} onPress={saveRound} disabled={roundSaving} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
    <Modal visible={!!selected} animationType="slide" onRequestClose={closeEvent}>
      <SafeAreaView style={styles.modalSafe}>
        <View style={styles.modalTop}><Pressable onPress={closeEvent}><Text style={styles.link}>← Назад</Text></Pressable><Pressable onPress={() => detailEvent && toggleSaved(detailEvent.id)}><Text style={styles.link}>{detailEvent && saved.includes(detailEvent.id) ? '★ Сохранено' : '☆ В избранное'}</Text></Pressable></View>
        {detailEvent && <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.eyebrow}>{detailEvent.sport === 'mini_golf' ? 'МИНИ-ГОЛЬФ' : 'ГОЛЬФ'} · {detailEvent.level || 'уровень уточняется'}</Text>
          <Text style={styles.modalTitle}>{detailEvent.name}</Text>
          <Text style={styles.eventDate}>{dateLabel(detailEvent.start_date, detailEvent.end_date)}</Text>
          <Text style={styles.body}>{[detailEvent.venue, detailEvent.venue_address, detailEvent.city, detailEvent.region].filter(Boolean).join(' · ') || 'Место уточняется'}</Text>
          {detailEvent.venue_address && <Button title="Открыть место на карте ↗" onPress={() => openUrl(mapUrl(`${detailEvent.venue}, ${detailEvent.venue_address}, ${detailEvent.city || ''}`))} secondary />}
          <View style={styles.card}><Text style={styles.bodyBold}>Статус: {statusText(detailEvent.display_status)}</Text><Text style={styles.muted}>Регистрация: {detailEvent.registration_status === 'open' ? 'открыта' : detailEvent.registration_status === 'closed' ? 'закрыта' : 'не подтверждена'}</Text><Text style={styles.muted}>Организатор: {detailEvent.organizer || 'уточняется'}</Text><Text style={styles.muted}>Последняя проверка: {detailEvent.last_checked_at || 'нет отметки'} · {freshnessText(detailEvent.freshness_state)}</Text></View>
          {!!detailEvent.format && <View style={styles.card}><Text style={styles.bodyBold}>Формат</Text><Text style={styles.muted}>{detailEvent.format}</Text></View>}
          {!!detailEvent.eligibility_notes && <View style={styles.card}><Text style={styles.bodyBold}>Кому подходит</Text><Text style={styles.muted}>{detailEvent.eligibility_notes}</Text></View>}
          {!!detailEvent.entry_fee_text && <View style={styles.card}><Text style={styles.bodyBold}>Стоимость</Text><Text style={styles.muted}>{detailEvent.entry_fee_text}</Text></View>}
          {!!detailEvent.summary && <Text style={styles.body}>{detailEvent.summary}</Text>}
          {detailEvent.source_excerpt && <View style={styles.card}><Text style={styles.bodyBold}>Что подтверждает источник</Text><Text style={styles.muted}>{detailEvent.source_excerpt}</Text></View>}
          {!!detailEvent.evidence?.length && <View style={styles.card}><Text style={styles.bodyBold}>История подтверждений по полям</Text>{detailEvent.evidence.map((item, index) => <View key={`${item.field_name}-${index}`} style={{ marginTop: 9 }}><Text style={styles.bodyBold}>{item.field_name}: {item.field_value} · {item.evidence_state}</Text><Text style={styles.muted}>{item.observed_at?.slice(0, 10) || 'дата не указана'}</Text><Pressable onPress={() => openUrl(item.source_url)}><Text style={styles.link}>Доказательство ↗</Text></Pressable></View>)}</View>}
          {detailEvent.registration_url && <Button title="Регистрация" onPress={() => openUrl(detailEvent.registration_url)} />}
          {detailEvent.contact_phone && <Button title={`Позвонить ${detailEvent.contact_phone}`} onPress={() => openUrl(`tel:${detailEvent.contact_phone.replace(/[^0-9+]/g, '')}`)} />}
          {!!detailEvent.contact_note && <Text style={styles.muted}>{detailEvent.contact_note}</Text>}
          {detailEvent.regulations_url && <Button title="Регламент" onPress={() => openUrl(detailEvent.regulations_url)} secondary />}
          <Button title="Открыть первоисточник ↗" onPress={() => openUrl(detailEvent.source_url)} secondary />
          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Нашёл ошибку?</Text>
          <Text style={styles.muted}>Предложение уйдёт редактору, а карточка не изменится до проверки.</Text>
          <TextInput value={correction.field_name} onChangeText={(v) => setCorrection((x) => ({ ...x, field_name: v }))} placeholder="Поле: start_date / end_date / venue" style={styles.input} />
          <TextInput value={correction.suggested_value} onChangeText={(v) => setCorrection((x) => ({ ...x, suggested_value: v }))} placeholder="Правильное значение" style={styles.input} />
          <TextInput value={correction.evidence_url} onChangeText={(v) => setCorrection((x) => ({ ...x, evidence_url: v }))} placeholder="Ссылка-доказательство (необязательно)" style={styles.input} />
          <Button title="Отправить исправление" secondary onPress={async () => {
            if (!correction.field_name || !correction.suggested_value) return Alert.alert('Нужны поле и значение');
            try {
              const payload = { ...correction, evidence_url: correction.evidence_url || null };
              const answer = await api.reportCorrection(selected.id, payload);
              Alert.alert('Принято', answer.message); setCorrection({ field_name: '', suggested_value: '', evidence_url: '' });
            } catch (e) { Alert.alert('Не отправилось', e.message); }
          }} />
        </ScrollView>}
      </SafeAreaView>
    </Modal>
  </SafeAreaView>;
}

const styles = {
  safe: { flex: 1, backgroundColor: C.bg }, modalSafe: { flex: 1, backgroundColor: C.bg },
  topbar: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: C.green, fontSize: 12, fontWeight: '900', letterSpacing: 2 }, tagline: { color: C.muted, fontSize: 12, marginTop: 3 }, refresh: { color: C.green, fontSize: 30, paddingHorizontal: 8 },
  content: { paddingHorizontal: 18, paddingBottom: 28 }, hero: { backgroundColor: C.green, borderRadius: 24, padding: 20, marginBottom: 20 }, heroKicker: { color: C.lime, fontSize: 11, fontWeight: '900', letterSpacing: 1 }, heroTitle: { color: '#fff', fontSize: 27, lineHeight: 33, fontWeight: '900', marginTop: 12 }, heroBody: { color: '#E5EEE7', lineHeight: 21, marginTop: 8 }, heroButtons: { alignItems: 'flex-start', marginTop: 12 },
  sectionTitle: { fontSize: 22, fontWeight: '900', color: C.ink, marginTop: 10, marginBottom: 10 }, rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginVertical: 8 }, chip: { borderRadius: 30, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, paddingVertical: 9, paddingHorizontal: 13 }, chipActive: { backgroundColor: C.green, borderColor: C.green }, chipText: { color: C.ink, fontWeight: '700', fontSize: 12 },
  input: { backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginTop: 7, marginBottom: 8, color: C.ink, minHeight: 45 }, label: { color: C.ink, fontWeight: '800', marginTop: 10 },
  feePreview: { color: C.ink, fontSize: 12, fontWeight: '700', marginTop: 8 }, eligibilityWarning: { color: C.amber, fontSize: 11, fontWeight: '800', marginTop: 7 }, card: { backgroundColor: C.card, borderRadius: 20, padding: 16, marginVertical: 7, borderWidth: 1, borderColor: C.line }, eyebrow: { color: C.green, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, level: { color: C.muted, fontSize: 11, fontWeight: '700' }, eventTitle: { color: C.ink, fontSize: 18, lineHeight: 23, fontWeight: '900', marginVertical: 9 }, eventDate: { color: C.green, fontWeight: '800', marginBottom: 6 }, muted: { color: C.muted, lineHeight: 20, fontSize: 13 }, status: { color: C.amber, fontSize: 12, fontWeight: '800', marginTop: 12, flex: 1 }, savedMark: { fontSize: 20, color: C.green }, checked: { color: C.muted, fontSize: 10, marginTop: 10 }, body: { color: C.ink, fontSize: 14, lineHeight: 22, marginVertical: 5 }, bodyBold: { color: C.ink, fontSize: 14, lineHeight: 21, fontWeight: '800' },
  button: { backgroundColor: C.lime, borderRadius: 13, paddingHorizontal: 16, paddingVertical: 12, marginTop: 8, alignItems: 'center' }, buttonSecondary: { backgroundColor: C.pale }, buttonText: { color: C.ink, fontWeight: '900' }, error: { color: C.red, marginVertical: 8 }, empty: { alignItems: 'center', padding: 24, backgroundColor: C.card, borderRadius: 18, marginTop: 12, gap: 10 }, emptyTitle: { color: C.ink, fontWeight: '900', fontSize: 17, textAlign: 'center' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 12 }, statCard: { width: '48%', backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14 }, statNumber: { color: C.green, fontSize: 25, fontWeight: '900' }, deleteText: { color: C.red, fontWeight: '800' }, sourceRow: { backgroundColor: C.card, borderRadius: 15, borderWidth: 1, borderColor: C.line, padding: 14, marginVertical: 5 }, link: { color: C.green, fontWeight: '900', marginTop: 8 }, footer: { color: C.muted, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 20 }, tabbar: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10, paddingBottom: 13, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line }, tabButton: { paddingHorizontal: 5, paddingVertical: 4 }, tabText: { color: C.muted, fontSize: 10, fontWeight: '700' }, tabTextActive: { color: C.green, fontWeight: '900' }, modalTop: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 10 }, modalTitle: { color: C.ink, fontSize: 27, fontWeight: '900', lineHeight: 33, marginVertical: 10 },
};
