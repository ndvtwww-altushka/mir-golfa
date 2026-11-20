import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StatusBar, StyleSheet, Text, View, SafeAreaView, ActivityIndicator } from 'react-native';
import { api, checkConnection, connection, offlineMeta, setBase } from './api';
import { DEFAULT_PROFILE, usePersisted } from './storage';
import EventsScreen from './screens/EventsScreen';
import MyGameScreen from './screens/MyGameScreen';
import ClubsScreen from './screens/ClubsScreen';
import MoreScreen from './screens/MoreScreen';
import EventSheet from './EventSheet';
import { C, S } from './theme';

const TABS = [
  { key: 'events', label: 'Турниры' },
  { key: 'game', label: 'Игра' },
  { key: 'clubs', label: 'Клубы' },
  { key: 'more', label: 'Ещё' },
];

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
        setNotice('Офлайн-режим');
      }
    } catch (error) {
      setNotice('Ошибка загрузки');
    } finally {
      setRefreshing(false);
    }
  }, [profile.apiUrl, profileReady]);

  useEffect(() => { load(); }, [load]);

  const toggleSave = useCallback((id) => {
    setSaved((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }, [setSaved]);

  const meta = useMemo(() => ({
    season: offlineMeta.season,
    generatedAt: offlineMeta.generatedAt,
    events: events.length || offlineMeta.events,
    sources,
  }), [events.length, sources]);

  const renderTab = () => {
    switch (tab) {
      case 'events': return <EventsScreen events={events} saved={saved} onToggleSave={toggleSave} onOpen={setSelected} onRefresh={load} refreshing={refreshing} profile={profile} mode={mode} meta={meta} />;
      case 'game': return <MyGameScreen rounds={rounds} setRounds={setRounds} />;
      case 'clubs': return <ClubsScreen clubs={clubs} />;
      default: return <MoreScreen profile={profile} setProfile={setProfile} sources={sources} meta={meta} connection={connection} onSync={load} refreshing={refreshing} />;
    }
  };

  return (
    <SafeAreaView style={st.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* ПРЕМИАЛЬНЫЙ ХЕДЕР */}
      <View style={st.header}>
        <View>
          <Text style={st.brand}>МИР ГОЛЬФА</Text>
          <View style={st.statusRow}>
            <View style={[st.dot, { backgroundColor: mode === 'network' ? '#1B4D3E' : '#999' }]} />
            <Text style={st.statusText}>{mode === 'network' ? 'ONLINE' : 'OFFLINE'}</Text>
          </View>
        </View>
        <Pressable onPress={load} style={st.refresh}>
          {refreshing ? <ActivityIndicator size="small" color="#000" /> : <Text style={st.refreshIcon}>↻</Text>}
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>{renderTab()}</View>

      {/* СТРОГИЙ ТАБ-БАР */}
      <View style={st.tabbar}>
        {TABS.map((item) => {
          const active = tab === item.key;
          return (
            <Pressable key={item.key} onPress={() => setTab(item.key)} style={st.tab}>
              <View style={[st.tabIndicator, active && st.tabIndicatorActive]} />
              <Text style={[st.tabLabel, active && st.tabLabelActive]}>{item.label.toUpperCase()}</Text>
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
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#EEE',
  },
  brand: { fontSize: 16, fontWeight: '900', letterSpacing: 3, color: '#000' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  statusText: { fontSize: 8, fontWeight: '900', color: '#999', letterSpacing: 1 },
  refresh: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  refreshIcon: { fontSize: 20, color: '#000', fontWeight: '300' },
  tabbar: {
    flexDirection: 'row', height: 60, borderTopWidth: 1, borderTopColor: '#EEE',
    backgroundColor: '#FFF', paddingHorizontal: 10,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabIndicator: { height: 2, width: 20, backgroundColor: 'transparent', marginBottom: 6 },
  tabIndicatorActive: { backgroundColor: '#000' },
  tabLabel: { fontSize: 9, fontWeight: '900', color: '#999', letterSpacing: 1 },
  tabLabelActive: { color: '#000' },
});
