import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { C, S, plural } from '../theme';
import { Button, Card, Chip, Empty, Pill, T } from '../components';
import { countdown, dateRangeWithYear, isPast, monthShort, monthTitle, statusLabel } from '../format';

const PERIODS = [
  { key: 'upcoming', label: 'Скоро' },
  { key: 'all', label: 'Все' },
  { key: 'archive', label: 'Архив' },
];

function levelTone(level) {
  if (/Всероссийск/i.test(level || '')) return 'green';
  if (/Международн/i.test(level || '')) return 'blue';
  if (/Региональн/i.test(level || '')) return 'soft';
  return 'muted';
}

function EventCard({ event, saved, onPress, onToggleSave }) {
  const when = countdown(event);
  const past = isPast(event);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.card, past && { opacity: 0.72 }, pressed && { opacity: 0.9 }]}>
      <View style={st.cardRow}>
        <View style={[st.dateBox, past && { backgroundColor: '#E8EDE3' }]}>
          <Text style={[st.dateDay, past && { color: C.muted }]}>{String(event.start_date).slice(8, 10)}</Text>
          <Text style={[st.dateMonth, past && { color: C.muted }]}>{monthShort(event.start_date)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={st.badges}>
            <Pill tone={levelTone(event.level)}>{event.level || 'уровень уточняется'}</Pill>
            <Pill tone={when.tone}>{when.text}</Pill>
          </View>
          <Text style={st.title} numberOfLines={2}>{event.name}</Text>
          <Text style={st.meta} numberOfLines={1}>⌖ {event.venue || event.region || 'Место уточняется'}</Text>
        </View>
        <Pressable onPress={onToggleSave} hitSlop={12} style={st.star}>
          <Text style={{ fontSize: 20, color: saved ? C.gold : '#C3CCBF' }}>{saved ? '★' : '☆'}</Text>
        </Pressable>
      </View>
      {!!event.entry_fee_text && <Text style={st.fee}>{event.entry_fee_text}</Text>}
      <Text style={st.statusLine} numberOfLines={1}>
        {dateRangeWithYear(event.start_date, event.end_date)} · {statusLabel(event.display_status)}
      </Text>
    </Pressable>
  );
}

export default function EventsScreen({
  events, saved, onToggleSave, onOpen, onRefresh, refreshing, profile, mode, meta,
}) {
  const [period, setPeriod] = useState('upcoming');
  const [query, setQuery] = useState('');
  const [sport, setSport] = useState('all');
  const [region, setRegion] = useState(null);
  const [savedOnly, setSavedOnly] = useState(false);

  const regions = useMemo(() => {
    const counter = new Map();
    events.forEach((event) => {
      if (!event.region) return;
      counter.set(event.region, (counter.get(event.region) || 0) + 1);
    });
    return [...counter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name]) => name);
  }, [events]);

  const upcomingCount = useMemo(() => events.filter((event) => !isPast(event)).length, [events]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const handicap = profile.handicap === '' ? null : Number(String(profile.handicap).replace(',', '.'));
    return events
      .filter((event) => {
        if (period === 'upcoming' && isPast(event)) return false;
        if (period === 'archive' && !isPast(event)) return false;
        if (sport !== 'all' && event.sport !== sport) return false;
        if (region && event.region !== region) return false;
        if (savedOnly && !saved.includes(event.id)) return false;
        if (needle) {
          const haystack = [event.name, event.venue, event.city, event.region, event.organizer]
            .filter(Boolean).join(' ').toLowerCase();
          if (!haystack.includes(needle)) return false;
        }
        if (Number.isFinite(handicap)) {
          if (event.hcp_min != null && handicap < Number(event.hcp_min)) return false;
          if (event.hcp_max != null && handicap > Number(event.hcp_max)) return false;
        }
        return true;
      })
      .sort((a, b) => (period === 'archive'
        ? b.start_date.localeCompare(a.start_date)
        : a.start_date.localeCompare(b.start_date)));
  }, [events, period, sport, region, savedOnly, saved, query, profile.handicap]);

  const groups = useMemo(() => {
    const buckets = [];
    filtered.forEach((event) => {
      const key = String(event.start_date).slice(0, 7);
      const last = buckets[buckets.length - 1];
      if (last && last.key === key) last.items.push(event);
      else buckets.push({ key, items: [event] });
    });
    return buckets;
  }, [filtered]);

  return (
    <ScrollView
      contentContainerStyle={st.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.green} />}
    >
      <View style={st.hero}>
        <View style={st.heroTop}>
          <Text style={st.heroKicker}>СЕЗОН {meta.season}</Text>
          <View style={st.liveDotRow}>
            <View style={[st.liveDot, { backgroundColor: mode === 'network' ? C.lime : '#9CB08F' }]} />
            <Text style={st.liveText}>{mode === 'network' ? 'онлайн' : 'офлайн-каталог'}</Text>
          </View>
        </View>
        <Text style={st.heroTitle}>
          {upcomingCount > 0
            ? `${upcomingCount} ${plural(upcomingCount, ['турнир', 'турнира', 'турниров'])} впереди`
            : 'Сезон закрыт — открыт архив'}
        </Text>
        <Text style={st.heroBody}>
          Официальный календарь АГР, клубы и результаты в одном месте. У каждого факта есть ссылка на источник.
        </Text>
        <View style={st.heroStats}>
          <View style={st.heroStat}><Text style={st.heroStatValue}>{events.length}</Text><Text style={st.heroStatLabel}>событий в базе</Text></View>
          <View style={st.heroDivider} />
          <View style={st.heroStat}><Text style={st.heroStatValue}>{meta.sources.filter((s) => s.enabled !== false).length}</Text><Text style={st.heroStatLabel}>источников</Text></View>
          <View style={st.heroDivider} />
          <View style={st.heroStat}><Text style={st.heroStatValue}>{new Set(events.map((e) => e.region).filter(Boolean)).size}</Text><Text style={st.heroStatLabel}>регионов</Text></View>
        </View>
      </View>

      <View style={st.searchWrap}>
        <Text style={st.searchIcon}>⌕</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Турнир, клуб, город…"
          placeholderTextColor="#9AA69E"
          style={st.search}
          returnKeyType="search"
        />
        {!!query && <Pressable onPress={() => setQuery('')} hitSlop={10}><Text style={st.clear}>✕</Text></Pressable>}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>
        {PERIODS.map((item) => (
          <Chip key={item.key} title={item.label} active={period === item.key} onPress={() => setPeriod(item.key)} />
        ))}
        <Chip title={savedOnly ? '★ Избранное' : '☆ Избранное'} active={savedOnly} onPress={() => setSavedOnly((value) => !value)} tone="lime" />
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>
        <Chip title="Все виды" active={sport === 'all'} onPress={() => setSport('all')} />
        <Chip title="Гольф" active={sport === 'golf'} onPress={() => setSport('golf')} />
        <Chip title="Мини-гольф" active={sport === 'mini_golf'} onPress={() => setSport('mini_golf')} />
        {regions.map((name) => (
          <Chip key={name} title={name} active={region === name} onPress={() => setRegion(region === name ? null : name)} />
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <Empty
          title={savedOnly ? 'В избранном пока пусто' : period === 'upcoming' ? 'Ближайших турниров нет' : 'Ничего не нашлось'}
          text={savedOnly
            ? 'Отмечайте турниры звёздочкой — они соберутся здесь.'
            : period === 'upcoming'
              ? 'Официальный календарь сезона закончился. Новые даты появятся после публикации АГР — обновите каталог позже.'
              : 'Попробуйте изменить фильтры или очистить поиск.'}
          action={period === 'upcoming' ? 'Открыть архив' : 'Сбросить фильтры'}
          onAction={() => {
            if (period === 'upcoming') setPeriod('archive');
            else { setQuery(''); setSport('all'); setRegion(null); setSavedOnly(false); }
          }}
        />
      ) : (
        groups.map((group) => (
          <View key={group.key} style={{ marginTop: 18 }}>
            <View style={st.groupHead}>
              <Text style={st.groupTitle}>{monthTitle(`${group.key}-01`)}</Text>
              <Text style={st.groupCount}>{group.items.length}</Text>
            </View>
            {group.items.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                saved={saved.includes(event.id)}
                onPress={() => onOpen(event)}
                onToggleSave={() => onToggleSave(event.id)}
              />
            ))}
          </View>
        ))
      )}

      <Text style={st.footer}>
        Данные: официальный календарь АГР и положения организаторов. Прошедшие даты не означают, что турнир
        завершён — статус и протокол подтверждаются отдельно.
      </Text>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  content: { paddingHorizontal: S.pad, paddingBottom: 28 },
  hero: { backgroundColor: C.green, borderRadius: 26, padding: 20, marginTop: 10, marginBottom: 16 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroKicker: { color: C.lime, fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
  liveDotRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveText: { color: '#BFD3C4', fontSize: 10, fontWeight: '700' },
  heroTitle: { color: C.white, fontSize: 27, lineHeight: 31, fontWeight: '900', marginTop: 12, letterSpacing: -0.5 },
  heroBody: { color: '#DCE9DE', fontSize: 13, lineHeight: 19, marginTop: 8 },
  heroStats: { flexDirection: 'row', alignItems: 'center', marginTop: 18, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, paddingVertical: 12 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatValue: { color: C.white, fontSize: 19, fontWeight: '900' },
  heroStatLabel: { color: '#BFD3C4', fontSize: 10, marginTop: 2 },
  heroDivider: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.14)' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, paddingHorizontal: 12, marginBottom: 10 },
  searchIcon: { fontSize: 18, color: C.muted, marginRight: 8, marginTop: -2 },
  search: { flex: 1, paddingVertical: 13, fontSize: 14, color: C.ink },
  clear: { color: C.muted, fontSize: 14, padding: 4 },
  chips: { gap: 8, paddingVertical: 4, paddingRight: 8 },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  groupTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 1.2, color: C.muted, textTransform: 'uppercase' },
  groupCount: { fontSize: 11, fontWeight: '800', color: C.green, backgroundColor: C.limeSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  card: { backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 13, marginBottom: 10, ...S.shadow },
  cardRow: { flexDirection: 'row', gap: 12 },
  dateBox: { width: 48, height: 54, borderRadius: 14, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  dateDay: { color: C.white, fontSize: 19, fontWeight: '900', lineHeight: 22 },
  dateMonth: { color: C.lime, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 5 },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '800', color: C.ink },
  meta: { fontSize: 12, color: C.muted, marginTop: 3 },
  star: { paddingLeft: 4, paddingTop: 2 },
  fee: { fontSize: 12, fontWeight: '700', color: C.ink2, marginTop: 8 },
  statusLine: { fontSize: 11, color: C.muted, marginTop: 8 },
  footer: { fontSize: 10, lineHeight: 15, color: C.muted, textAlign: 'center', marginTop: 22 },
});
