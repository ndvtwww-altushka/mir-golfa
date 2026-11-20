import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, S, plural } from '../theme';
import { Button, Card, Chip, Empty, Pill, T } from '../components';
import { countdown, dateRangeWithYear, isPast, monthShort, monthTitle, statusLabel } from '../format';

const PERIODS = [
  { key: 'upcoming', label: 'Ближайшие' },
  { key: 'all', label: 'Все' },
  { key: 'archive', label: 'Архив' },
];

function levelTone(level) {
  if (/Всероссийск/i.test(level || '')) return 'ink';
  if (/Международн/i.test(level || '')) return 'blue';
  if (/Региональн/i.test(level || '')) return 'soft';
  return 'muted';
}

function EventCard({ event, saved, onPress, onToggleSave }) {
  const when = countdown(event);
  const past = isPast(event);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.card, past && { opacity: 0.6 }, pressed && { opacity: 0.85 }]}>
      <View style={st.cardRow}>
        <View style={[st.dateBox, past && { backgroundColor: C.bg2 }]}>
          <Text style={[st.dateDay, past && { color: C.muted }]}>{String(event.start_date).slice(8, 10)}</Text>\n          <Text style={[st.dateMonth, past && { color: C.muted }]}>{monthShort(event.start_date)}</Text>\n        </View>
        <View style={{ flex: 1 }}>
          <View style={st.badges}>
            <Pill tone={levelTone(event.level)}>{event.level || 'уточняется'}</Pill>
            <Pill tone={when.tone}>{when.text}</Pill>
          </View>
          <Text style={st.title} numberOfLines={2}>{event.name}</Text>\n          <Text style={st.meta} numberOfLines={1}>{event.venue || event.region || 'Место уточняется'}</Text>\n        </View>
        <Pressable onPress={onToggleSave} hitSlop={12} style={st.star}>
          <Ionicons name={saved ? 'star' : 'star-outline'} size={18} color={saved ? C.gold : C.lineStrong} />
        </Pressable>
      </View>
      {!!event.entry_fee_text && <Text style={st.fee}>{event.entry_fee_text}</Text>}
      <View style={st.divider} />
      <Text style={st.statusLine} numberOfLines={1}>
        {dateRangeWithYear(event.start_date, event.end_date)}  ·  {statusLabel(event.display_status)}
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
      .sort((a, b) => (period === 'archive'\n        ? b.start_date.localeCompare(a.start_date)\n        : a.start_date.localeCompare(b.start_date)));
  }, [events, period, sport, region, savedOnly, saved, query, profile.handicap]);

  const groups = useMemo(() => {
    const buckets = [];
    filtered.forEach((event) => {
      const key = String(event.start_date).slice(0, 7);
      const last = buckets[buckets.length - 1];
      if (last && last.key === key) last.items.push(event);\n      else buckets.push({ key, items: [event] });
    });
    return buckets;
  }, [filtered]);

  return (
    <ScrollView
      contentContainerStyle={st.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.ink} />}
    >
      <View style={st.hero}>
        <Text style={st.heroKicker}>СЕЗОН {meta.season}</Text>\n        <Text style={st.heroTitle}>
          {upcomingCount > 0
            ? `${upcomingCount} ${plural(upcomingCount, ['турнир', 'турнира', 'турниров'])} впереди`
            : 'Сезон закрыт'}
        </Text>
        <View style={st.heroStats}>
          <View style={st.heroStat}><Text style={st.heroStatValue}>{events.length}</Text><Text style={st.heroStatLabel}>событий</Text></View>
          <View style={st.heroDivider} />
          <View style={st.heroStat}><Text style={st.heroStatValue}>{meta.sources.filter((s) => s.enabled !== false).length}</Text><Text style={st.heroStatLabel}>источников</Text></View>
          <View style={st.heroDivider} />
          <View style={st.heroStat}><Text style={st.heroStatValue}>{new Set(events.map((e) => e.region).filter(Boolean)).size}</Text><Text style={st.heroStatLabel}>регионов</Text></View>\n        </View>
      </View>

      <View style={st.searchWrap}>
        <Ionicons name="search-outline" size={18} color={C.muted} style={{ marginRight: 8 }} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Найти турнир, клуб, город"
          placeholderTextColor="#C0C5BF"
          style={st.search}
          returnKeyType="search"
        />
        {!!query && (
          <Pressable onPress={() => setQuery('')} hitSlop={10}>
            <Ionicons name="close-circle" size={16} color={C.muted} />
          </Pressable>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>\n        {PERIODS.map((item) => (\n          <Chip key={item.key} title={item.label} active={period === item.key} onPress={() => setPeriod(item.key)} />\n        ))}\n        <Chip title={savedOnly ? '★ Избранное' : '☆ Избранное'} active={savedOnly} onPress={() => setSavedOnly((value) => !value)} />\n      </ScrollView>\n\n      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>\n        <Chip title=\"Все виды\" active={sport === 'all'} onPress={() => setSport('all')} />\n        <Chip title=\"Гольф\" active={sport === 'golf'} onPress={() => setSport('golf')} />\n        <Chip title=\"Мини-гольф\" active={sport === 'mini_golf'} onPress={() => setSport('mini_golf')} />\n        {regions.map((name) => (\n          <Chip key={name} title={name} active={region === name} onPress={() => setRegion(region === name ? null : name)} />\n        ))}\n      </ScrollView>

      {filtered.length === 0 ? (
        <Empty
          title={savedOnly ? 'В избранном пусто' : period === 'upcoming' ? 'Ближайших турниров нет' : 'Ничего не нашлось'}\n          text={savedOnly
            ? 'Отмечайте турниры звёздочкой — они соберутся здесь.'
            : period === 'upcoming'
              ? 'Календарь сезона закончился. Новые даты появятся после публикации АГР.'
              : 'Попробуйте изменить фильтры или очистить поиск.'}
          action={period === 'upcoming' ? 'Открыть архив' : 'Сбросить фильтры'}\n          onAction={() => {\n            if (period === 'upcoming') setPeriod('archive');\n            else { setQuery(''); setSport('all'); setRegion(null); setSavedOnly(false); }\n          }}\n        />
      ) : (
        groups.map((group) => (
          <View key={group.key} style={{ marginTop: 22 }}>\n            <View style={st.groupHead}>\n              <Text style={st.groupTitle}>{monthTitle(`${group.key}-01`)}</Text>\n              <Text style={st.groupCount}>{group.items.length}</Text>\n            </View>\n            {group.items.map((event) => (\n              <EventCard
                key={event.id}
                event={event}
                saved={saved.includes(event.id)}
                onPress={() => onOpen(event)}
                onToggleSave={() => onToggleSave(event.id)}
              />
            ))}\n          </View>\n        ))\n      )}

      <Text style={st.footer}>\n        Данные: официальный календарь АГР и положения организаторов. Прошедшие даты не означают завершение турнира.\n      </Text>\n    </ScrollView>
  );
}

const st = StyleSheet.create({
  content: { paddingHorizontal: S.pad, paddingBottom: 28 },
  hero: { marginTop: 16, marginBottom: 18 },
  heroKicker: { color: C.muted, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  heroTitle: { color: C.ink, fontSize: 30, lineHeight: 36, fontWeight: '800', marginTop: 6, letterSpacing: -0.8 },
  heroStats: { flexDirection: 'row', alignItems: 'center', marginTop: 18, backgroundColor: C.green, borderRadius: S.radius, paddingVertical: 14 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatValue: { color: C.white, fontSize: 18, fontWeight: '800' },
  heroStatLabel: { color: '#9DB5A8', fontSize: 9, marginTop: 2, letterSpacing: 0.6, textTransform: 'uppercase' },
  heroDivider: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.15)' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line, borderRadius: S.radiusSm, paddingHorizontal: 14, marginBottom: 10 },
  search: { flex: 1, paddingVertical: 14, fontSize: 15, color: C.ink },
  chips: { gap: 8, paddingVertical: 5, paddingRight: 12 },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  groupTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: C.muted, textTransform: 'uppercase' },
  groupCount: { fontSize: 11, fontWeight: '700', color: C.muted },
  card: { backgroundColor: C.card, borderRadius: S.radius, borderWidth: 1, borderColor: C.line, padding: 15, marginBottom: 10 },
  cardRow: { flexDirection: 'row', gap: 13 },
  dateBox: { width: 50, height: 56, borderRadius: S.radiusSm, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  dateDay: { color: C.white, fontSize: 20, fontWeight: '800', lineHeight: 23 },
  dateMonth: { color: '#9DB5A8', fontSize: 9, fontWeight: '800', letterSpacing: 1, marginTop: 1 },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 6 },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: C.ink },
  meta: { fontSize: 12, color: C.muted, marginTop: 4 },
  star: { paddingLeft: 6, paddingTop: 2 },
  fee: { fontSize: 12, fontWeight: '600', color: C.ink2, marginTop: 8 },
  divider: { height: 1, backgroundColor: C.line, marginTop: 12, marginBottom: 8 },
  statusLine: { fontSize: 11, color: C.muted, letterSpacing: 0.1 },
  footer: { fontSize: 10, lineHeight: 15, color: C.muted, textAlign: 'center', marginTop: 26 },
});
