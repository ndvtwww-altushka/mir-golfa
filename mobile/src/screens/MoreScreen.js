import React, { useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { C, S } from '../theme';
import { Button, Card, Chip, Field, Pill, T } from '../components';
import { api } from '../api';

const RELEASE_URL = 'https://github.com/ndvtwww-altushka/mir-golfa/releases/latest';
const REPO_URL = 'https://github.com/ndvtwww-altushka/mir-golfa';

const openUrl = (url) => url && Linking.openURL(url).catch(() => {});

const SOURCE_CATEGORIES = [
  { key: 'all', label: 'Все' },
  { key: 'federation', label: 'Федерации' },
  { key: 'club', label: 'Клубы' },
  { key: 'aggregator', label: 'Агрегаторы' },
  { key: 'ranking', label: 'Рейтинги' },
  { key: 'other', label: 'Прочее' },
];

const authorityLabel = {
  organizer: 'организатор',
  federation: 'федерация',
  club: 'клуб',
  aggregator: 'агрегатор',
  ranking: 'рейтинг',
  other: 'прочее',
};

const verifyTone = (state) => {
  if (state === 'page_checked') return 'soft';
  if (state === 'search_indexed') return 'muted';
  if (state === 'needs_recheck') return 'gold';
  return 'red';
};

const verifyLabel = (state) => {
  if (state === 'page_checked') return 'страница проверена';
  if (state === 'search_indexed') return 'в поисковой выдаче';
  if (state === 'directory_listed') return 'в каталоге';
  if (state === 'needs_recheck') return 'требует проверки';
  if (state === 'retired_unavailable') return 'недоступен';
  if (state === 'rejected_wrong_site') return 'исключён';
  return state || 'уточняется';
};

export default function MoreScreen({ profile, setProfile, sources, meta, connection, onSync, refreshing }) {
  const [form, setForm] = useState({ event_name: '', start_date: '', end_date: '', country: 'Россия', region: '', venue: '', source_url: '', notes: '' });
  const [sending, setSending] = useState(false);
  const [apiDraft, setApiDraft] = useState(profile.apiUrl || '');
  const [showOrganizer, setShowOrganizer] = useState(false);
  const [cat, setCat] = useState('all');
  const [sourceQuery, setSourceQuery] = useState('');

  const filteredSources = useMemo(() => {
    const needle = sourceQuery.trim().toLowerCase();
    return (sources || []).filter((source) => {
      if (cat !== 'all' && source.authority !== cat) return false;
      if (needle && !`${source.name || ''} ${source.country || ''} ${source.region || ''}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [sources, cat, sourceQuery]);

  const enabledCount = useMemo(() => (sources || []).filter((s) => s.enabled !== false).length, [sources]);

  const submit = async () => {
    if (!form.event_name || !form.start_date || !form.end_date || !form.source_url) {
      return Alert.alert('Нужны обязательные поля', 'Название, даты и ссылка на официальный источник.');
    }
    if (form.end_date < form.start_date) return Alert.alert('Проверьте даты', 'Дата окончания раньше даты начала.');
    setSending(true);
    try {
      const answer = await api.submitEvent({ ...form, region: form.region || null, venue: form.venue || null, notes: form.notes || null });
      Alert.alert('Заявка принята', answer.message || 'Событие уйдёт на проверку редактором.');
      setForm({ event_name: '', start_date: '', end_date: '', country: 'Россия', region: '', venue: '', source_url: '', notes: '' });
      setShowOrganizer(false);
    } catch (error) {
      Alert.alert('Не отправилось', error.message);
    } finally {
      setSending(false);
    }
  };

  const updated = meta.generatedAt ? new Date(meta.generatedAt) : null;
  const updatedLabel = updated
    ? updated.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'дата неизвестна';

  return (
    <ScrollView contentContainerStyle={st.content} showsVerticalScrollIndicator={false}>
      <Text style={[T.h1, { marginTop: 16 }]}>Настройки</Text>

      <Card style={{ marginTop: 16 }}>
        <View style={st.rowBetween}>
          <Text style={[T.h3]}>Данные</Text>
          <Pill tone={connection.online ? 'soft' : 'gold'}>{connection.online ? 'онлайн' : 'офлайн'}</Pill>
        </View>
        <Text style={[T.muted, { marginTop: 8 }]}>
          Обновлено {updatedLabel}. В офлайн-режиме календарь читается с устройства.
        </Text>
        <Text style={[T.tiny, { marginTop: 4 }]}>
          {meta.events} событий · {sources.length || enabledCount} источников · сезон {meta.season}
        </Text>
        <Button title={refreshing ? 'Обновляем' : 'Обновить данные'} variant="secondary" onPress={onSync} disabled={refreshing} style={{ marginTop: 14 }} />
        <Field
          label="Адрес API"
          value={apiDraft}
          onChangeText={setApiDraft}
          placeholder="https://ваш-сервер.onrender.com"
          autoCapitalize="none"
          keyboardType="url"
          hint="Пустой адрес — работа на встроенном каталоге."
        />
        <Button
          title="Сохранить адрес"
          variant="ghost"
          onPress={() => { setProfile({ ...profile, apiUrl: apiDraft.trim() }); setTimeout(onSync, 200); }}
        />
      </Card>

      <Text style={T.section}>Мой профиль</Text>
      <Field label="Имя" value={profile.name} onChangeText={(value) => setProfile({ ...profile, name: value })} placeholder="Как к вам обращаться" />
      <Field label="Регион" value={profile.region} onChangeText={(value) => setProfile({ ...profile, region: value })} placeholder="Москва, Санкт-Петербург" />
      <Field label="Категория" value={profile.age_group} onChangeText={(value) => setProfile({ ...profile, age_group: value })} placeholder="взрослые / юниоры" />
      <Field
        label="Гандикап"
        value={String(profile.handicap)}
        onChangeText={(value) => setProfile({ ...profile, handicap: value.replace(',', '.') })}
        keyboardType="decimal-pad"
        placeholder="например, 24.5"
        hint="Подставляется в фильтр турниров с ограничением HCP."
      />

      <Text style={T.section}>Источники · {filteredSources.length}</Text>
      <View style={st.searchWrap}>
        <Text style={st.searchIcon}>⌕</Text>
        <TextInput
          value={sourceQuery}
          onChangeText={setSourceQuery}
          placeholder="Найти источник"
          placeholderTextColor="#C0C5BF"
          style={st.search}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips} style={{ marginBottom: 12 }}>
        {SOURCE_CATEGORIES.map((item) => (
          <Chip key={item.key} title={item.label} active={cat === item.key} onPress={() => setCat(item.key)} />
        ))}
      </ScrollView>

      {filteredSources.map((source) => (
        <Card key={source.id} style={{ marginBottom: 8, padding: 14 }}>
          <View style={st.sourceHead}>
            <Text style={st.sourceName} numberOfLines={1}>{source.name}</Text>
            <Pill tone={verifyTone(source.verification_status)}>{verifyLabel(source.verification_status)}</Pill>
          </View>
          <Text style={[T.tiny, { marginTop: 3 }]}>
            {[source.country, source.region, authorityLabel[source.authority] || source.authority].filter(Boolean).join(' · ')}
          </Text>
          <View style={st.sourceLinks}>
            <Pressable onPress={() => openUrl(source.url)} style={st.sourceLink}>
              <Text style={st.sourceLinkText}>Сайт</Text>
            </Pressable>
            {source.enabled === false && <Text style={st.sourceDisabled}>выключен</Text>}
          </View>
        </Card>
      ))}

      <Text style={T.section}>Организаторам</Text>
      <Card>
        <Text style={[T.muted]}>
          Пришлите событие на проверку. Оно не попадёт в календарь автоматически: редактор сверит
          положение и даты, затем опубликует.
        </Text>
        <Button
          title={showOrganizer ? 'Свернуть' : 'Добавить турнир'}
          variant="secondary"
          onPress={() => setShowOrganizer((value) => !value)}
          style={{ marginTop: 14 }}
        />
        {showOrganizer && (
          <View style={{ marginTop: 14 }}>
            <Field label="Название *" value={form.event_name} onChangeText={(value) => setForm({ ...form, event_name: value })} placeholder="Кубок клуба" />
            <Field label="Начало * (ГГГГ-ММ-ДД)" value={form.start_date} onChangeText={(value) => setForm({ ...form, start_date: value })} placeholder="2027-05-15" />
            <Field label="Окончание *" value={form.end_date} onChangeText={(value) => setForm({ ...form, end_date: value })} placeholder="2027-05-16" />
            <Field label="Регион" value={form.region} onChangeText={(value) => setForm({ ...form, region: value })} placeholder="Московская область" />
            <Field label="Поле / площадка" value={form.venue} onChangeText={(value) => setForm({ ...form, venue: value })} placeholder="Forest Hills" />
            <Field label="Ссылка на источник *" value={form.source_url} onChangeText={(value) => setForm({ ...form, source_url: value })} placeholder="https://" autoCapitalize="none" keyboardType="url" />
            <Button title={sending ? 'Отправляем' : 'Отправить на проверку'} onPress={submit} disabled={sending} />
          </View>
        )}
      </Card>

      <Text style={T.section}>О приложении</Text>
      <Card>
        <Text style={[T.body]}>
          «Мир Гольфа» — календарь турниров по гольфу и мини-гольфу в России и СНГ.
          Каждое событие связано с первоисточником, статусы не додумываются.
        </Text>
        <Text style={[T.tiny, { marginTop: 10 }]}>
          Версия 2.2.0 · {meta.events} событий · сезон {meta.season}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <Button title="Скачать APK" variant="secondary" onPress={() => openUrl(RELEASE_URL)} style={{ flexGrow: 1 }} />
          <Button title="GitHub" variant="ghost" onPress={() => openUrl(REPO_URL)} style={{ flexGrow: 1 }} />
        </View>
      </Card>

      <Text style={st.footer}>
        Не является официальным продуктом АГР. Даты и статусы проверяйте у организатора.
      </Text>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  content: { paddingHorizontal: S.pad, paddingBottom: 28 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line, borderRadius: S.radiusSm, paddingHorizontal: 14, marginBottom: 10 },
  searchIcon: { fontSize: 18, color: C.muted, marginRight: 10, marginTop: -2 },
  search: { flex: 1, paddingVertical: 12, fontSize: 14, color: C.ink },
  chips: { gap: 8, paddingVertical: 5, paddingRight: 12 },
  sourceHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sourceName: { fontSize: 14, fontWeight: '700', color: C.ink, flex: 1 },
  sourceLinks: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  sourceLink: { paddingVertical: 4, paddingHorizontal: 12, backgroundColor: C.bg2, borderRadius: 8 },
  sourceLinkText: { color: C.green, fontWeight: '700', fontSize: 12 },
  sourceDisabled: { color: C.muted, fontSize: 11, fontWeight: '600' },
  footer: { fontSize: 10, lineHeight: 15, color: C.muted, textAlign: 'center', marginTop: 26 },
});
