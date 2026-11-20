import React from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C, S } from '../theme';
import { Button, Card, Empty, Pill, T } from '../components';

const openUrl = async (url) => {
  if (!url) return;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Не удалось открыть ссылку', url);
  }
};

const mapUrl = (club) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  [club.name, club.address, club.city].filter(Boolean).join(', '),
)}`;

export default function ClubsScreen({ clubs }) {
  return (
    <ScrollView contentContainerStyle={st.content} showsVerticalScrollIndicator={false}>
      <Text style={[T.h1, { marginTop: 12 }]}>Клубы{'\n'}и поля</Text>
      <Text style={[T.muted, { marginTop: 8, marginBottom: 16 }]}>
        В каталоге только площадки с проверенным адресом и ссылкой на первоисточник.
        Пустые карточки не публикуем.
      </Text>

      {clubs.length === 0 ? (
        <Empty
          title="Каталог пополняется"
          text="Добавляем клубы по мере проверки адресов и сайтов. Если вы организатор — пришлите ссылку на официальную страницу."
        />
      ) : (
        clubs.map((club) => (
          <Card key={club.id} style={{ marginBottom: 12 }}>
            <View style={st.head}>
              <Text style={[T.h3, { flex: 1 }]}>{club.name}</Text>
              <Pill tone={club.evidence_state === 'verified' ? 'soft' : 'warn'}>
                {club.evidence_state === 'verified' ? 'проверено' : 'на проверке'}
              </Pill>
            </View>
            <Text style={[T.muted, { marginTop: 6 }]}>
              {[club.city, club.region, club.country].filter(Boolean).join(' · ')}
            </Text>
            {!!club.address && <Text style={st.address}>{club.address}</Text>}
            {!!club.source_excerpt && <Text style={[T.tiny, { marginTop: 8 }]}>{club.source_excerpt}</Text>}

            <View style={st.actions}>
              {!!club.address && <Button title="Маршрут ↗" variant="secondary" onPress={() => openUrl(mapUrl(club))} style={st.action} />}
              {!!club.phone && (
                <Button
                  title="Позвонить"
                  variant="ghost"
                  onPress={() => openUrl(`tel:${String(club.phone).replace(/[^0-9+]/g, '')}`)}
                  style={st.action}
                />
              )}
              {!!club.website && <Button title="Сайт ↗" variant="ghost" onPress={() => openUrl(club.website)} style={st.action} />}
            </View>
            {!!club.source_url && (
              <Text style={st.source} onPress={() => openUrl(club.source_url)}>
                Источник данных ↗
              </Text>
            )}
          </Card>
        ))
      )}

      <Card style={{ marginTop: 8, backgroundColor: C.sand, borderColor: '#EDE3CC' }}>
        <Text style={[T.h3]}>Клубу нет в списке?</Text>
        <Text style={[T.muted, { marginTop: 6 }]}>
          Пришлите ссылку на официальную страницу клуба с адресом — проверим и добавим.
          Данные без первоисточника не публикуем.
        </Text>
      </Card>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  content: { paddingHorizontal: S.pad, paddingBottom: 28 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  address: { fontSize: 13, color: C.ink2, marginTop: 8, lineHeight: 19 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  action: { paddingHorizontal: 14, paddingVertical: 10, marginTop: 0 },
  source: { color: C.green, fontWeight: '800', fontSize: 12, marginTop: 12 },
});
