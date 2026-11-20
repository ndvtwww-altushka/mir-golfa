import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StatusBar, StyleSheet, Text, View, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, checkConnection, connection, offlineMeta, setBase } from './api';
import { DEFAULT_PROFILE, usePersisted } from './storage';
import EventsScreen from './screens/EventsScreen';
import MyGameScreen from './screens/MyGameScreen';
import ClubsScreen from './screens/ClubsScreen';
import MoreScreen from './screens/MoreScreen';
import EventSheet from './EventSheet';
import { C, S } from './theme';

const TABS = [
  { key: 'events', label: 'Турниры', icon: 'trophy-outline', iconActive: 'trophy' },
  { key: 'game', label: 'Игра', icon: 'golf-outline', iconActive: 'golf' },
  { key: 'clubs', label: 'Клубы', icon: 'map-outline', iconActive: 'map' },
  { key: 'more', label: 'Ещё', icon: 'ellipsis-horizontal-outline', iconActive: 'ellipsis-horizontal' },
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
      case 'events': return <EventsScreen events={events} saved={saved} onToggleSave={toggleSave} onOpen={setSelected} onRefresh={load} refreshing={refreshing} profile={profile} mode={mode} meta={meta} />;\n      case 'game': return <MyGameScreen rounds={rounds} setRounds={setRounds} />;\n      case 'clubs': return <ClubsScreen clubs={clubs} />;\n      default: return <MoreScreen profile={profile} setProfile={setProfile} sources={sources} meta={meta} connection={connection} onSync={load} refreshing={refreshing} />;\n    }
  };

  return (
    <SafeAreaView style={st.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* ПРЕМИАЛЬНЫЙ ХЕДЕР */}
      <View style={st.header}>
        <View>
          <Text style={st.brand}>МИР ГОЛЬФА</Text>\n          <View style={st.statusRow}>
            <View style={[st.dot, { backgroundColor: mode === 'network' ? '#1B4D3E' : '#999' }]} />
            <Text style={st.statusText}>{mode === 'network' ? 'ONLINE' : 'OFFLINE'}</Text>
          </View>
        </View>
        <Pressable onPress={load} style={st.refresh}>
          {refreshing ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Ionicons name="refresh-outline" size={20} color="#000" />
          )}
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>{renderTab()}</View>

      {/* СТРОГИЙ ТАБ-БАР */}
      <View style={st.tabbar}>
        {TABS.map((item) => {
          const active = tab === item.key;\n          return (
            <Pressable key={item.key} onPress={() => setTab(item.key)} style={st.tab}>
              <Ionicons
                name={active ? item.iconActive : item.icon}
                size={20}
                color={active ? '#0E4633' : '#8A938E'}
                style={{ marginBottom: 4 }}
              />
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
  tabbar: {
    flexDirection: 'row', height: 60, borderTopWidth: 1, borderTopColor: '#EEE',
    backgroundColor: '#FFF', paddingHorizontal: 10, paddingVertical: 5,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 9, fontWeight: '900', color: '#8A938E', letterSpacing: 1 },
  tabLabelActive: { color: '#0E4633' },
});
