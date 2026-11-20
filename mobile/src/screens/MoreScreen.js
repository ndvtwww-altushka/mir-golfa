import React, { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C, S } from '../theme';
import { Button, Card, Field, Pill, T } from '../components';
import { api } from '../api';
import { AUTHORITY_LABEL, COLLECTION_LABEL } from '../format';

const openUrl = (url) => url && Linking.openURL(url).catch(() => {});

const RELEASE_URL = 'https://github.com/ndvtwww-altushka/mir-golfa/releases/latest';

export default function MoreScreen({ profile, setProfile, sources, meta, connection, onSync, refreshing }) {
  const [form, setForm] = useState({ event_name: '', start_date: '', end_date: '', country: 'Россия', region: '', venue: '', source_url: '', notes: '' });
  const [sending, setSending] = useState(false);
  const [apiDraft, setApiDraft] = useState(profile.apiUrl || '');
  const [showOrganizer, setShowOrganizer] = useState(false);

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
      <Text style={[T.h1, { marginTop: 12 }]}>Настройки{'\n'}и источники</Text>

      <Card style={{ marginTop: 16 }}>
        <View style={st.rowBetween}>
          <Text style={[T.h3]}>Данные</Text>
          <Pill tone={connection.online ? 'soft' : 'warn'}>{connection.online ? 'сервер онлайн' : 'офлайн-каталог'}</Pill>
        </View>
        <Text style={[T.muted, { marginTop: 8 }]}>
          Обновлено {updatedLabel}. В офлайн-режиме календарь читается с устройства и работает без интернета.
        </Text>
        <Text style={[T.tiny, { marginTop: 6 }]}>
          {meta.events} событий · {meta.sources.length} источников · сезон {meta.season}
        </Text>
        <Button title={refreshing ? 'Обновляем…' : 'Обновить данные'} variant="secondary" onPress={onSync} disabled={refreshing} style={{ marginTop: 12 }} />
        <Field
          label="Адрес API (необязательно)"
          value={apiDraft}
          onChangeText={setApiDraft}
          placeholder="https://ваш-сервер.onrender.com"
          autoCapitalize="none"
          keyboardType="url"
          hint="Пока адрес пуст, приложение работает на встроенном каталоге. Введите адрес FastAPI и нажмите «Обновить данные»."
        />
        <Button
          title="Проверить адрес"
          variant="ghost"
          onPress={() => { setProfile({ ...profile, apiUrl: apiDraft.trim() }); setTimeout(onSync, 150); }}
        />
      </Card>

      <Text style={T.section}>Мои фильтры</Text>
      <Text style={[T.muted, { marginBottom: 12 }]}>
        Хранятся только на телефоне. Подбор турниров учитывает регион и гандикап.
      </Text>
      <Field label="Имя" value={profile.name} onChangeText={(value) => setProfile({ ...profile, name: value })} placeholder="Как к вам обращаться" />
      <Field label="Регион" value={profile.region} onChangeText={(value) => setProfile({ ...profile, region: value })} placeholder="Москва, Санкт-Петербург…" />
      <Field label="Возрастная категория" value={profile.age_group} onChangeText={(value) => setProfile({ ...profile, age_group: value })} placeholder="взрослые / юниоры" />
      <Field
        label="Гандикап"
        value={String(profile.handicap)}
        onChangeText={(value) => setProfile({ ...profile, handicap: value.replace(',', '.') })}
        keyboardType="decimal-pad"
        placeholder="например, 24.5"
        hint="Ограничения HCP из регламента подставляются в фильтр турниров."
      />

      <Text style={T.section}>Источники</Text>
      <Text style={[T.muted, { marginBottom: 12 }]}>
        Реестр того, откуда берутся данные. Статус «сбор разрешён» означает только техническую готовность,
        а не факт, что каждое событие подтверждено.
      </Text>
      {sources.map((source) => (
        <Card key={source.id} style={{ marginBottom: 10 }}>
          <Text style={[T.h3]}>{source.name}</Text>
          <Text style={[T.muted, { marginTop: 5 }]}>
            {[source.country, AUTHORITY_LABEL[source.authority], COLLECTION_LABEL[source.collection_mode]].filter(Boolean).join(' · ')}
          </Text>
          {!!source.notes && <Text style={[T.tiny, { marginTop: 6 }]}>{source.notes}</Text>}
          <Text style={st.link} onPress={() => openUrl(source.url)}>Открыть первоисточник ↗</Text>
        </Card>
      ))}

      <Text style={T.section}>Организаторам</Text>
      <Card>
        <Text style={[T.muted]}>
          Пришлите событие на проверку. Оно не попадёт в календарь автоматически: редактор сверит
          положение и даты, затем опубликует.
        </Text>
        <Button
          title={showOrganizer ? 'Свернуть форму' : 'Добавить турнир'}
          variant="secondary"
          onPress={() => setShowOrganizer((value) => !value)}
          style={{ marginTop: 12 }}
        />
        {showOrganizer && (
          <View style={{ marginTop: 14 }}>
            <Field label="Название *" value={form.event_name} onChangeText={(value) => setForm({ ...form, event_name: value })} placeholder="Кубок клуба" />
            <Field label="Дата начала * (ГГГГ-ММ-ДД)" value={form.start_date} onChangeText={(value) => setForm({ ...form, start_date: value })} placeholder="2027-05-15" />
            <Field label="Дата окончания *" value={form.end_date} onChangeText={(value) => setForm({ ...form, end_date: value })} placeholder="2027-05-16" />
            <Field label="Регион" value={form.region} onChangeText={(value) => setForm({ ...form, region: value })} placeholder="Московская область" />
            <Field label="Поле / площадка" value={form.venue} onChangeText={(value) => setForm({ ...form, venue: value })} placeholder="Forest Hills" />
            <Field label="Ссылка на официальный источник *" value={form.source_url} onChangeText={(value) => setForm({ ...form, source_url: value })} placeholder="https://…" autoCapitalize="none" keyboardType="url" />
            <Button title={sending ? 'Отправляем…' : 'Отправить на проверку'} onPress={submit} disabled={sending} />
          </View>
        )}
      </Card>

      <Text style={T.section}>О приложении</Text>
      <Card>
        <Text style={[T.body]}>
          «Мир Гольфа» — календарь турниров по гольфу и мини-гольфу в России и СНГ.
          Каждое событие связано с первоисточником, а статусы не додумываются.
        </Text>
        <Text style={[T.tiny, { marginTop: 10 }]}>
          Версия 2.1.0 · офлайн-каталог {meta.events} событий · сезон {meta.season}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <Button title="Скачать APK" variant="secondary" onPress={() => openUrl(RELEASE_URL)} style={{ flexGrow: 1 }} />
          <Button title="Исходный код" variant="ghost" onPress={() => openUrl('https://github.com/ndvtwww-altushka/mir-golfa')} style={{ flexGrow: 1 }} />
        </View>
      </Card>

      <Text style={st.footer}>
        Приложение не является официальным продуктом АГР. Даты и статусы проверяйте у организатора.
      </Text>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  content: { paddingHorizontal: S.pad, paddingBottom: 28 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  link: { color: C.green, fontWeight: '800', fontSize: 12, marginTop: 10 },
  footer: { fontSize: 10, lineHeight: 15, color: C.muted, textAlign: 'center', marginTop: 24 },
});
