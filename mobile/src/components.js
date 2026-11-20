import React from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { C, S } from './theme';

export const T = StyleSheet.create({
  h1: { fontSize: 28, lineHeight: 32, fontWeight: '800', color: C.ink, letterSpacing: -0.5 },
  h2: { fontSize: 20, lineHeight: 24, fontWeight: '800', color: C.ink },
  h3: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: C.ink },
  body: { fontSize: 14, lineHeight: 20, color: C.ink2 },
  muted: { fontSize: 13, lineHeight: 18, color: C.muted },
  tiny: { fontSize: 11, lineHeight: 15, color: C.muted },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: C.muted },
  section: { fontSize: 13, lineHeight: 17, fontWeight: '800', color: C.muted, marginTop: 26, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
});

export function Button({ title, onPress, variant = 'primary', disabled, style }) {
  const palette = {
    primary: { bg: C.ink, text: C.white },
    dark: { bg: C.green, text: C.white },
    secondary: { bg: C.bg2, text: C.ink2, border: true },
    ghost: { bg: 'transparent', text: C.muted, border: false },
    danger: { bg: C.redSoft, text: C.red },
  }[variant] || palette.primary;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        st.button,
        { backgroundColor: palette.bg, opacity: disabled ? 0.4 : pressed ? 0.85 : 1, ...(palette.border ? { borderWidth: 1, borderColor: C.line } : {}) },
        style,
      ]}
    >
      <Text style={[st.buttonText, { color: palette.text }]}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ title, active, onPress, tone = 'default' }) {
  return (
    <Pressable onPress={onPress} style={[st.chip, active && st.chipActive]}>
      <Text style={[st.chipText, active && st.chipTextActive]}>{title}</Text>
    </Pressable>
  );
}

export function Pill({ children, tone = 'muted' }) {
  const palette = {
    muted: { bg: C.bg2, text: C.muted },
    green: { bg: C.green, text: C.white },
    lime: { bg: '#EBF4CA', text: C.limeInk },
    soft: { bg: C.greenSoft, text: C.green },
    gold: { bg: C.goldSoft, text: C.gold },
    red: { bg: C.redSoft, text: C.red },
    blue: { bg: C.blueSoft, text: C.blue },
    ink: { bg: C.ink, text: C.white },
  }[tone] || palette.muted;
  return (
    <View style={[st.pill, { backgroundColor: palette.bg }]}>
      <Text style={[st.pillText, { color: palette.text }]}>{children}</Text>
    </View>
  );
}

export function Card({ children, onPress, style }) {
  const content = <View style={[st.card, style]}>{children}</View>;
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.95 : 1 })}>
      {content}
    </Pressable>
  );
}

export function Section({ title, hint, right, children, style }) {
  return (
    <View style={style}>
      <View style={st.sectionHead}>
        <Text style={[T.section, { marginTop: 0, marginBottom: 0, flex: 1 }]}>{title}</Text>
        {right}
      </View>
      {!!hint && <Text style={[T.muted, { marginTop: 4, marginBottom: 10 }]}>{hint}</Text>}
      <View style={{ marginTop: hint ? 0 : 10 }}>{children}</View>
    </View>
  );
}

export function Stat({ value, label, tone }) {
  return (
    <View style={st.stat}>
      <Text style={[st.statValue, tone === 'green' && { color: C.green }, tone === 'muted' && { color: C.muted }]}>{value}</Text>
      <Text style={st.statLabel}>{label}</Text>
    </View>
  );
}

export function Empty({ title, text, action, onAction }) {
  return (
    <View style={st.empty}>
      <Text style={[T.h3, { textAlign: 'center', marginTop: 0 }]}>{title}</Text>
      <Text style={[T.muted, { textAlign: 'center', marginTop: 6 }]}>{text}</Text>
      {!!action && <Button title={action} onPress={onAction} variant="secondary" style={{ marginTop: 14 }} />}
    </View>
  );
}

export function Field({ label, value, onChangeText, placeholder, hint, ...rest }) {
  return (
    <View style={{ marginBottom: 12 }}>
      {!!label && <Text style={st.fieldLabel}>{label}</Text>}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#C0C5BF"
        style={st.input}
        {...rest}
      />
      {!!hint && <Text style={[T.tiny, { marginTop: 5 }]}>{hint}</Text>}
    </View>
  );
}

export function Sheet({ visible, onClose, title, children, footer }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={st.sheetBackdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={st.sheet}>
          <View style={st.sheetHandle} />
          <View style={st.sheetHead}>
            <Text style={[T.h2, { flex: 1 }]} numberOfLines={2}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12} style={st.closeBtn}>
              <Text style={{ fontSize: 18, color: C.muted, fontWeight: '300' }}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
          {footer}
        </View>
      </View>
    </Modal>
  );
}

export function Loading({ label = 'Загружаем' }) {
  return (
    <View style={{ paddingVertical: 40, alignItems: 'center' }}>
      <ActivityIndicator color={C.ink} />
      <Text style={[T.muted, { marginTop: 10 }]}>{label}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  button: { borderRadius: S.radiusSm, paddingHorizontal: 18, paddingVertical: 14, alignItems: 'center' },
  buttonText: { fontWeight: '700', fontSize: 14, letterSpacing: 0.2 },
  chip: { borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, paddingVertical: 9, paddingHorizontal: 16 },
  chipActive: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { color: C.ink2, fontWeight: '600', fontSize: 12 },
  chipTextActive: { color: C.white },
  pill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  card: { backgroundColor: C.card, borderRadius: S.radius, padding: 16, borderWidth: 1, borderColor: C.line },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  stat: { flex: 1, minWidth: '30%', backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: S.radiusSm, padding: 14, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: C.ink },
  statLabel: { fontSize: 11, color: C.muted, marginTop: 3, lineHeight: 14, letterSpacing: 0.2 },
  empty: { backgroundColor: C.bg2, borderRadius: S.radius, padding: 24, alignItems: 'center' },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line, borderRadius: S.radiusSm,
    paddingHorizontal: 16, paddingVertical: 13, color: C.ink, fontSize: 15, minHeight: 48,
  },
  sheetBackdrop: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.bg, borderTopLeftRadius: S.radiusLg, borderTopRightRadius: S.radiusLg,
    paddingHorizontal: 20, paddingTop: 10, maxHeight: '92%',
  },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.lineStrong, marginBottom: 10 },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.bg2, alignItems: 'center', justifyContent: 'center' },
});
