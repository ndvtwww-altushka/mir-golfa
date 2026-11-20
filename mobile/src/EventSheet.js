import React from 'react';
import { Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, S } from './theme';
import { Button, Card, Pill, Sheet, T } from './components';
import {
  AUTHORITY_LABEL, REGISTRATION_LABEL, countdown, dateRangeWithYear,
  freshnessLabel, statusLabel, statusTone,
} from './format';

const openUrl = (url) => url && Linking.openURL(url).catch(() => {});

const mapUrl = (event) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  [event.venue, event.venue_address, event.city, event.region].filter(Boolean).join(', '),
)}`;

export default function EventSheet({ event, onClose, saved, onToggleSave }) {
  if (!event) return null;
  const when = countdown(event);
  const share = () => {
    Share.share({
      message: `${event.name}\n${dateRangeWithYear(event.start_date, event.end_date)}\n${[event.venue, event.region].filter(Boolean).join(', ')}\n${event.source_url || ''}`.trim(),
    }).catch(() => {});
  };

  return (
    <Sheet visible onClose={onClose} title={event.name}>
      <View style={st.badges}>
        <Pill tone={event.sport === 'mini_golf' ? 'blue' : 'ink'}>{event.sport === 'mini_golf' ? 'мини-гольф' : 'гольф'}</Pill>
        <Pill tone={statusTone(event.display_status)}>{statusLabel(event.display_status)}</Pill>
        <Pill tone={when.tone}>{when.text}</Pill>
      </View>

      <Text style={st.date}>{dateRangeWithYear(event.start_date, event.end_date)}</Text>
      <Text style={[T.body, { marginTop: 6 }]}>\n        {[event.venue, event.venue_address, event.city, event.region, event.country].filter(Boolean).join(' · ') || 'Место уточняется'}\n      </Text>

      <View style={st.actionRow}>
        <Button title={saved ? '★ В избранном' : '☆ В избранное'} variant="secondary" onPress={onToggleSave} style={{ flexGrow: 1 }} />
        <Button title="Поделиться" variant="ghost" onPress={share} style={{ flexGrow: 1 }} />
      </View>
      {!!event.venue && (
        <Button title="Открыть на карте" variant="ghost" onPress={() => openUrl(mapUrl(event))} style={{ marginTop: 8 }} />
      )}

      <Card style={{ marginTop: 16 }}>
        <Text style={[T.h3]}>Детали</Text>
        <Row label="Уровень" value={event.level || 'уточняется'} />
        <Row label="Организатор" value={event.organizer || 'уточняется'} />
        <Row label="Возраст" value={event.age_group || 'без ограничений по возрасту'} />
        {(event.hcp_min != null || event.hcp_max != null) && (
          <Row
            label="Гандикап"
            value={`${event.hcp_min != null ? `от ${event.hcp_min}` : ''}${event.hcp_min != null && event.hcp_max != null ? ' ' : ''}${event.hcp_max != null ? `до ${event.hcp_max}` : ''}`}
          />
        )}
        <Row label="Регистрация" value={REGISTRATION_LABEL[event.registration_status] || 'не подтверждена'} />
        {!!event.entry_fee_text && <Row label="Стоимость" value={event.entry_fee_text} />}
        !!event.format && <Row label="Формат" value={event.format} />
      </Card>

      {!!event.eligibility_notes && (
        <Card style={{ marginTop: 10 }}>
          <Text style={[T.h3]}>Кому подходит</Text>
          <Text style={[T.muted, { marginTop: 6 }]}>{event.eligibility_notes}</Text>
        </Card>
      )}

      <Card style={{ marginTop: 10 }}>
        <Text style={[T.h3]}>Источник</Text>
        <Text style={[T.muted, { marginTop: 6 }]}>{event.source_name || 'Первоисточник'}{event.source_authority ? ` · ${AUTHORITY_LABEL[event.source_authority] || event.source_authority}` : ''}</Text>
        {!!event.source_excerpt && <Text style={st.excerpt}>«{event.source_excerpt}»</Text>}
        <Text style={[T.tiny, { marginTop: 8 }]}>Проверка: {event.last_checked_at ? String(event.last_checked_at).slice(0, 10) : 'нет отметки'} · {freshnessLabel(event.freshness_state)}</Text>
        {!!event.source_url && (<Text style={st.link} onPress={() => openUrl(event.source_url)}>Открыть первоисточник</Text>)}
      </Card>

      <Card style={{ marginTop: 10 }}>
        <Text style={[T.h3]}>Результаты</Text>
        <Text style={[T.muted, { marginTop: 6 }]}>Показываем только официальные протоколы с источником. Если протокола нет — карточка остаётся без победителя и счёта.</Text>
      </Card>

      {!!event.registration_url && (
        <Button title="Перейти к регистрации" onPress={() => openUrl(event.registration_url)} style={{ marginTop: 14 }} />
      )}
      {!!event.contact_phone && (
        <Button title={`Позвонить ${event.contact_phone}`} variant="secondary" onPress={() => openUrl(`tel:${String(event.contact_phone).replace(/[^0-9+]/g, '')}`)} style={{ marginTop: 8 }} />
      )}
      {!!event.regulations_url && (
        <Button title="Положение о турнире" variant="ghost" onPress={() => openUrl(event.regulations_url)} style={{ marginTop: 8 }} />
      )}

      <Pressable onPress={() => openUrl(`mailto:events@mirgolfa.ru?subject=${encodeURIComponent(`Исправление: ${event.name}`)}&body=${encodeURIComponent(`Событие: ${event.name}\n${event.id}\n\nЧто не так:\n\nСсылка на подтверждение:\n`)}`)}>
        <Text style={st.correction}>Нашли ошибку? Напишите нам</Text>
      </Pressable>
    </Sheet>
  );
}

function Row({ label, value }) {
  return (
    <View style={st.row}>
      <Text style={st.rowLabel}>{label}</Text>
      <Text style={st.rowValue}>{value}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 12 },
  date: { fontSize: 19, fontWeight: '800', color: C.green, letterSpacing: -0.2 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.line },
  rowLabel: { fontSize: 12, color: C.muted, flex: 1 },
  rowValue: { fontSize: 12, color: C.ink, fontWeight: '600', flex: 1.4, textAlign: 'right' },
  excerpt: { fontSize: 12, lineHeight: 18, color: C.ink2, marginTop: 10, fontStyle: 'italic' },
  link: { color: C.green, fontWeight: '700', fontSize: 12, marginTop: 10 },
  correction: { color: C.green, fontWeight: '700', fontSize: 12, textAlign: 'center', marginTop: 18, marginBottom: 8 },
});
