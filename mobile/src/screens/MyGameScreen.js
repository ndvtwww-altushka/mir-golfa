import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C, S, plural } from '../theme';
import { Button, Card, Chip, Empty, Field, Pill, Sheet, T } from '../components';
import { estimateHandicap } from '../storage';
import { dateRangeLabel, todayISO } from '../format';

const emptyRound = () => ({
  played_on: todayISO(),
  course: '',
  holes: '18',
  gross_score: '',
  putts: '',
  greens_in_regulation: '',
  fairways_hit: '',
  fairways_total: '',
});

function statOf(rounds) {
  const totalHoles = rounds.reduce((sum, round) => sum + Number(round.holes), 0);
  const avg18 = rounds.length
    ? rounds.reduce((sum, round) => sum + (Number(round.gross_score) / Number(round.holes)) * 18, 0) / rounds.length
    : null;
  const withPutts = rounds.filter((round) => round.putts !== null && round.putts !== '');
  const puttHoles = withPutts.reduce((sum, round) => sum + Number(round.holes), 0);
  const putts18 = puttHoles ? (withPutts.reduce((sum, round) => sum + Number(round.putts), 0) / puttHoles) * 18 : null;
  const withGir = rounds.filter((round) => round.greens_in_regulation !== null && round.greens_in_regulation !== '');
  const girHoles = withGir.reduce((sum, round) => sum + Number(round.holes), 0);
  const girPct = girHoles ? (withGir.reduce((sum, round) => sum + Number(round.greens_in_regulation), 0) / girHoles) * 100 : null;
  const withFairways = rounds.filter((round) => Number(round.fairways_total) > 0);
  const fairwayTotal = withFairways.reduce((sum, round) => sum + Number(round.fairways_total), 0);
  const fairwayPct = fairwayTotal
    ? (withFairways.reduce((sum, round) => sum + Number(round.fairways_hit), 0) / fairwayTotal) * 100
    : null;
  const best = rounds.length ? Math.min(...rounds.map((round) => (Number(round.gross_score) * 18) / Number(round.holes))) : null;
  return { totalHoles, avg18, putts18, girPct, fairwayPct, best };
}

function Chart({ rounds }) {
  const items = rounds.slice(0, 8).reverse();
  if (items.length < 2) return null;
  const values = items.map((round) => (Number(round.gross_score) * 18) / Number(round.holes) - 72);
  const max = Math.max(...values, 4);
  return (
    <View style={st.chart}>
      {items.map((round, index) => {
        const value = values[index];
        const height = Math.max(6, Math.round((Math.abs(value) / max) * 76));
        return (
          <View key={round.id} style={st.barColumn}>
            <Text style={st.barValue}>{Math.round(value) > 0 ? `+${Math.round(value)}` : Math.round(value)}</Text>
            <View style={[st.bar, { height, backgroundColor: value <= 0 ? C.green : value <= 10 ? C.green2 : '#7E9A6B' }]} />
            <Text style={st.barLabel}>{String(round.played_on).slice(8, 10)}.{String(round.played_on).slice(5, 7)}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function MyGameScreen({ rounds, setRounds }) {
  const [form, setForm] = useState(emptyRound);
  const [open, setOpen] = useState(false);

  const stats = useMemo(() => statOf(rounds), [rounds]);
  const handicap = useMemo(() => estimateHandicap(rounds), [rounds]);
  const level = handicap === null ? 'нет данных' : handicap < 10 ? 'сильный игрок' : handicap < 20 ? 'уверенный любитель' : handicap < 30 ? 'любитель' : 'новичок';

  const save = () => {
    const holes = Number(form.holes);
    const score = Number(form.gross_score);
    if (!form.course.trim()) return Alert.alert('Нужно поле', 'Укажите клуб или поле, где играли.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.played_on) || form.played_on > todayISO()) {
      return Alert.alert('Проверьте дату', 'Формат ГГГГ-ММ-ДД, дата не может быть в будущем.');
    }
    if (!Number.isInteger(score) || score < holes || score > holes * 10) {
      return Alert.alert('Проверьте счёт', 'Общий счёт должен быть целым числом и не меньше числа лунок.');
    }
    const optional = (value) => (value === '' ? null : Number(value));
    const round = {
      id: `round-${Date.now()}`,
      played_on: form.played_on,
      course: form.course.trim(),
      holes,
      gross_score: score,
      putts: optional(form.putts),
      greens_in_regulation: optional(form.greens_in_regulation),
      fairways_hit: optional(form.fairways_hit),
      fairways_total: optional(form.fairways_total),
    };
    setRounds((previous) => [round, ...previous].slice(0, 500));
    setForm(emptyRound());
    setOpen(false);
  };

  const remove = (id) => Alert.alert('Удалить раунд?', 'Запись исчезнет с этого устройства.', [
    { text: 'Отмена', style: 'cancel' },
    { text: 'Удалить', style: 'destructive', onPress: () => setRounds((previous) => previous.filter((round) => round.id !== id)) },
  ]);

  return (
    <>
      <ScrollView contentContainerStyle={st.content} showsVerticalScrollIndicator={false}>
        <View style={st.hero}>
          <Text style={st.kicker}>ЛИЧНАЯ СТАТИСТИКА</Text>
          <View style={st.heroRow}>
            <View>
              <Text style={st.heroValue}>{handicap === null ? '—' : handicap.toFixed(1)}</Text>
              <Text style={st.heroLabel}>оценка гандикапа</Text>
            </View>
            <View style={st.levelBadge}><Text style={st.levelText}>{level}</Text></View>
          </View>
          <Text style={st.heroHint}>
            {handicap === null
              ? 'Добавьте три раунда — покажем примерный уровень игры.'
              : `Считается по ${rounds.length} ${plural(rounds.length, ['раунду', 'раундам', 'раундам'])} на устройстве. Это не официальный WHS.`}
          </Text>
        </View>

        <View style={st.statsRow}>
          <View style={st.stat}><Text style={st.statValue}>{rounds.length}</Text><Text style={st.statLabel}>раундов</Text></View>
          <View style={st.stat}><Text style={st.statValue}>{stats.totalHoles}</Text><Text style={st.statLabel}>лунок</Text></View>
          <View style={st.stat}><Text style={st.statValue}>{stats.avg18 ? stats.avg18.toFixed(0) : '—'}</Text><Text style={st.statLabel}>средний / 18</Text></View>
          <View style={st.stat}><Text style={st.statValue}>{stats.best ? stats.best.toFixed(0) : '—'}</Text><Text style={st.statLabel}>лучший / 18</Text></View>
        </View>

        <View style={st.statsRow}>
          <View style={st.stat}><Text style={st.statValue}>{stats.putts18 ? stats.putts18.toFixed(0) : '—'}</Text><Text style={st.statLabel}>патты / 18</Text></View>
          <View style={st.stat}><Text style={st.statValue}>{stats.girPct ? `${stats.girPct.toFixed(0)}%` : '—'}</Text><Text style={st.statLabel}>GIR</Text></View>
          <View style={st.stat}><Text style={st.statValue}>{stats.fairwayPct ? `${stats.fairwayPct.toFixed(0)}%` : '—'}</Text><Text style={st.statLabel}>фервеи</Text></View>
        </View>

        {rounds.length > 1 && (
          <Card style={{ marginTop: 14 }}>
            <Text style={[T.h3, { marginBottom: 4 }]}>Последние раунды</Text>
            <Text style={[T.muted, { marginBottom: 10 }]}>Отклонение от пара на 18 лунок</Text>
            <Chart rounds={rounds} />
          </Card>
        )}

        <Button title="+ Записать раунд" onPress={() => setOpen(true)} style={{ marginTop: 16 }} variant="dark" />

        <View style={st.listHead}>
          <Text style={[T.h2]}>История</Text>
          <Text style={T.tiny}>{rounds.length} записей</Text>
        </View>

        {rounds.length === 0 ? (
          <Empty
            title="Пока ни одного раунда"
            text="Добавьте счёт после игры — приложение посчитает средний результат, патты, GIR и фервеи. Всё хранится только на телефоне."
            action="Записать первый раунд"
            onAction={() => setOpen(true)}
          />
        ) : (
          rounds.map((round) => (
            <Card key={round.id} style={{ marginBottom: 10 }}>
              <View style={st.rowBetween}>
                <Text style={[T.h3, { flex: 1 }]} numberOfLines={1}>{round.course}</Text>
                <Pressable onPress={() => remove(round.id)} hitSlop={10}>
                  <Text style={st.delete}>Удалить</Text>
                </Pressable>
              </View>
              <Text style={[T.muted, { marginTop: 4 }]}>
                {dateRangeLabel(round.played_on, round.played_on)} · {round.holes} лунок · {round.gross_score} ударов
              </Text>
              <View style={st.roundBadges}>
                {round.putts !== null && <Pill tone="soft">{round.putts} паттов</Pill>}
                {round.greens_in_regulation !== null && <Pill tone="muted">GIR {round.greens_in_regulation}/{round.holes}</Pill>}
                {Number(round.fairways_total) > 0 && <Pill tone="muted">фервеи {round.fairways_hit}/{round.fairways_total}</Pill>}
              </View>
            </Card>
          ))
        )}

        <Text style={st.footer}>
          Это личный журнал, а не турнирный протокол. Официальный гандикап считается по правилам WHS
          и подтверждается федерацией.
        </Text>
      </ScrollView>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Новый раунд">
        <Text style={[T.muted, { marginBottom: 14 }]}>Запись останется на устройстве и не публикуется.</Text>
        <Field label="Дата (ГГГГ-ММ-ДД)" value={form.played_on} onChangeText={(value) => setForm({ ...form, played_on: value })} placeholder="2026-06-20" />
        <Field label="Поле или клуб" value={form.course} onChangeText={(value) => setForm({ ...form, course: value })} placeholder="Например, Forest Hills" />
        <Text style={st.fieldLabel}>Сколько лунок</Text>
        <View style={st.chipRow}>
          {['9', '18'].map((holes) => (
            <Chip key={holes} title={holes} active={form.holes === holes} onPress={() => setForm({ ...form, holes })} />
          ))}
        </View>
        <View style={{ height: 10 }} />
        {[
          ['gross_score', 'Общий счёт (удары)', 'например, 92'],
          ['putts', 'Патты', 'необязательно'],
          ['greens_in_regulation', 'GIR (0–18)', 'необязательно'],
          ['fairways_hit', 'Попадания на фервей', 'необязательно'],
          ['fairways_total', 'Сколько было возможностей', 'необязательно'],
        ].map(([key, label, placeholder]) => (
          <Field
            key={key}
            label={label}
            value={form[key]}
            onChangeText={(value) => setForm({ ...form, [key]: value.replace(/[^0-9]/g, '') })}
            keyboardType="number-pad"
            placeholder={placeholder}
          />
        ))}
        <Button title="Сохранить на устройстве" onPress={save} />
      </Sheet>
    </>
  );
}

const st = StyleSheet.create({
  content: { paddingHorizontal: S.pad, paddingBottom: 28 },
  hero: { backgroundColor: C.green, borderRadius: 26, padding: 20, marginTop: 10 },
  kicker: { color: C.lime, fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  heroValue: { color: C.white, fontSize: 46, fontWeight: '900', lineHeight: 50 },
  heroLabel: { color: '#BFD3C4', fontSize: 12, marginTop: 2 },
  levelBadge: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, maxWidth: 150 },
  levelText: { color: C.lime, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  heroHint: { color: '#DCE9DE', fontSize: 12, lineHeight: 18, marginTop: 14 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  stat: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center' },
  statValue: { fontSize: 19, fontWeight: '900', color: C.ink },
  statLabel: { fontSize: 10, color: C.muted, marginTop: 2, textAlign: 'center' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 116, marginTop: 6 },
  barColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: 18, borderRadius: 6 },
  barValue: { fontSize: 9, color: C.muted, marginBottom: 4, fontWeight: '700' },
  barLabel: { fontSize: 9, color: C.muted, marginTop: 5 },
  listHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  delete: { color: C.red, fontSize: 12, fontWeight: '800' },
  roundBadges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 10 },
  footer: { fontSize: 10, lineHeight: 15, color: C.muted, textAlign: 'center', marginTop: 22 },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: C.ink2, marginBottom: 8 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
