import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { api, checkConnection, connection, offlineMeta, setBase } from './api';
import { DEFAULT_PROFILE, usePersisted } from './storage';
import EventsScreen from './screens/EventsScreen';
import MyGameScreen from './screens/MyGameScreen';
import ClubsScreen from './screens/ClubsScreen';
import MoreScreen from './screens/MoreScreen';
import EventSheet from './EventSheet';
import { C } from './theme';

const TABS = [
  { key: 'events', label: 'Турниры', icon: '⛳' },
  { key: 'game', label: 'Моя игра', icon: '📈' },
  { key: 'clubs', label: 'Клубы', icon: '📍' },
  { key: 'more', label: 'Ещё', icon: '⋯' },
];

const TOP_INSET = Platform.OS === 'android' ? (StatusBar.currentHeight || 26) : 46;

export default function App() {
  const [tab, setTab] = useState('events');
  const [events, setEvents] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [sources, setSources] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState('local');
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState('');

  const [saved, setSaved] = usePersisted('saved-events', []);
  const [profile, setProfile, profileReady] = usePersisted('player-preferences', DEFAULT_PROFILE);
  const [rounds, setRounds] = usePersisted('local-rounds', []);

  const load = useCallback(async () => {
    setRefreshing(true);
    setNotice('');
    try {
      if (profileReady) setBase(profile.apiUrl || '');
      const online = await checkConnection();
      const [eventsAnswer, clubsAnswer, sourcesAnswer] = await Promise.all([
        api.tournaments({ limit: 100 }),
        api.clubs({ limit: 100 }),
        api.sources(),
      ]);
      setEvents(eventsAnswer.items || []);
      setClubs(clubsAnswer.items || []);
      setSources(sourcesAnswer.items || []);
      setMode(api.source());
      if (!online && connection.base) {
        setNotice(`Сервер недоступен — показываем офлайн-каталог. ${connection.lastError || ''}`.trim());
      }
    } catch (error) {
      setNotice(error.message || 'Не удалось загрузить данные');
    } finally {
      setRefreshing(false);
    }
  }, [profile.apiUrl, profileReady]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSave = useCallback((id) => {
    setSaved((previous) => (previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]));
  }, [setSaved]);

  const meta = useMemo(() => ({
    season: offlineMeta.season,
    generatedAt: offlineMeta.generatedAt,
    events: events.length || offlineMeta.events,
    sources,
  }), [events.length, sources]);

  const renderTab = () => {
    if (tab === 'events') {
      return (
        <EventsScreen
          events={events}
          saved={saved}
          onToggleSave={toggleSave}
          onOpen={setSelected}
          onRefresh={load}
          refreshing={refreshing}
          profile={profile}
          mode={mode}
          meta={meta}
        />
      );
    }
    if (tab === 'game') return <MyGameScreen rounds={rounds} setRounds={setRounds} />;
    if (tab === 'clubs') return <ClubsScreen clubs={clubs} />;
    return (
      <MoreScreen
        profile={profile}
        setProfile={setProfile}
        sources={sources}
        meta={meta}
        connection={connection}
        onSync={() => load()}
        refreshing={refreshing}
      />
    );
  };

  return (
    <View style={st.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} translucent={false} />
      <View style={[st.topbar, { paddingTop: TOP_INSET + 6 }]}>
        <View style={st.brandRow}>
          <View style={st.mark}><Text style={{ fontSize: 15 }}>⛳</Text></View>
          <View>
            <Text style={st.brand}>МИР ГОЛЬФА</Text>
            <Text style={st.tagline}>Турниры · клубы · результаты</Text>
          </View>
        </View>
        <Pressable onPress={load} hitSlop={12} style={st.refresh}>
          <Text style={st.refreshIcon}>{refreshing ? '…' : '↻'}</Text>
        </Pressable>
      </View>

      {!!notice && (
        <Pressable onPress={() => setNotice('')} style={st.notice}>
          <Text style={st.noticeText} numberOfLines={2}>{notice}</Text>
        </Pressable>
      )}

      <View style={{ flex: 1 }}>{renderTab()}</View>

      <View style={st.tabbar}>
        {TABS.map((item) => {
          const active = tab === item.key;
          return (
            <Pressable key={item.key} onPress={() => setTab(item.key)} style={st.tabButton}>
              <View style={[st.tabIconWrap, active && st.tabIconWrapActive]}>
                <Text style={[st.tabIcon, active && { opacity: 1 }]}>{item.icon}</Text>
              </View>
              <Text style={[st.tabText, active && st.tabTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {!!selected && (
        <EventSheet
          event={selected}
          onClose={() => setSelected(null)}
          saved={saved.includes(selected.id)}
          onToggleSave={() => toggleSave(selected.id)}
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topbar: {
    paddingHorizontal: 18, paddingBottom: 10, backgroundColor: C.bg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  mark: { width: 30, height: 30, borderRadius: 10, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: 12, fontWeight: '900', letterSpacing: 2, color: C.green },
  tagline: { fontSize: 10, color: C.muted, marginTop: 1 },
  refresh: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  refreshIcon: { fontSize: 17, color: C.green, fontWeight: '900', marginTop: -2 },
  notice: { marginHorizontal: 18, marginBottom: 8, backgroundColor: '#FBF0DA', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  noticeText: { color: C.gold, fontSize: 11, lineHeight: 15, fontWeight: '700' },
  tabbar: {
    flexDirection: 'row', backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line,
    paddingTop: 8, paddingBottom: Platform.OS === 'android' ? 14 : 24, paddingHorizontal: 6,
  },
  tabButton: { flex: 1, alignItems: 'center', gap: 3 },
  tabIconWrap: { width: 38, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  tabIconWrapActive: { backgroundColor: C.limeSoft },
  tabIcon: { fontSize: 15, opacity: 0.65 },
  tabText: { fontSize: 10, fontWeight: '700', color: C.muted },
  tabTextActive: { color: C.green, fontWeight: '900' },
});
