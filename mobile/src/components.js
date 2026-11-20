import React from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { C, S } from './theme';

export const T = StyleSheet.create({
  h1: { fontSize: 30, lineHeight: 34, fontWeight: '900', color: C.ink, letterSpacing: -0.5 },
  h2: { fontSize: 21, lineHeight: 26, fontWeight: '900', color: C.ink, letterSpacing: -0.2 },
  h3: { fontSize: 16, lineHeight: 21, fontWeight: '800', color: C.ink },
  body: { fontSize: 14, lineHeight: 21, color: C.ink2 },
  muted: { fontSize: 13, lineHeight: 19, color: C.muted },
  tiny: { fontSize: 11, lineHeight: 15, color: C.muted },
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4, color: C.green },
  section: { fontSize: 20, lineHeight: 25, fontWeight: '900', color: C.ink, marginTop: 22, marginBottom: 8 },
});

export function Button({ title, onPress, variant = 'primary', disabled, style }) {
  const palette = {
    primary: { bg: C.lime, text: C.limeInk, border: C.lime },
    dark: { bg: C.green, text: C.white, border: C.green },
    secondary: { bg: C.limeSoft, text: C.green, border: C.limeSoft },
    ghost: { bg: 'transparent', text: C.green, border: C.line },
    danger: { bg: 'transparent', text: C.red, border: 'transparent' },
  }[variant] || {};
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        st.button,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <Text style={[st.buttonText, { color: palette.text }]}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ title, active, onPress, tone = 'default' }) {
  return (
    <Pressable onPress={onPress} style={[st.chip, active && st.chipActive, tone === 'lime' && !active && { backgroundColor: C.limeSoft, borderColor: C.limeSoft }]}>
      <Text style={[st.chipText, active && { color: C.white }]}>{title}</Text>
    </Pressable>
  );
}

export function Pill({ children, tone = 'muted' }) {
  const palette = {
    muted: { bg: '#EEF2E9', text: C.ink2 },
    green: { bg: C.green, text: C.white },
    lime: { bg: C.lime, text: C.limeInk },
    soft: { bg: C.limeSoft, text: C.green },
    warn: { bg: '#FBF0DA', text: C.gold },
    red: { bg: '#FBEBE7', text: C.red },
    blue: { bg: '#E8F0F7', text: C.blue },
  }[tone] || { bg: '#EEF2E9', text: C.ink2 };
  return (
    <View style={{ backgroundColor: palette.bg, borderRadius: 30, paddingHorizontal: 10, paddingVertical: 5 }}>
      <Text style={{ color: palette.text, fontSize: 11, fontWeight: '800' }}>{children}</Text>
    </View>
  );
}

export function Card({ children, onPress, style }) {
  const content = <View style={[st.card, style]}>{children}</View>;
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
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
      <View style={st.emptyMark}><Text style={{ fontSize: 22 }}>⛳</Text></View>
      <Text style={[T.h3, { textAlign: 'center', marginTop: 10 }]}>{title}</Text>
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
        placeholderTextColor="#9AA69E"
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
              <Text style={{ fontSize: 18, color: C.green, fontWeight: '900' }}>✕</Text>
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

export function Loading({ label = 'Загружаем…' }) {
  return (
    <View style={{ paddingVertical: 40, alignItems: 'center' }}>
      <ActivityIndicator color={C.green} />
      <Text style={[T.muted, { marginTop: 10 }]}>{label}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  button: { borderRadius: S.radiusSm, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 13, alignItems: 'center' },
  buttonText: { fontWeight: '900', fontSize: 14 },
  chip: { borderRadius: 30, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, paddingVertical: 8, paddingHorizontal: 13 },
  chipActive: { backgroundColor: C.green, borderColor: C.green },
  chipText: { color: C.ink2, fontWeight: '800', fontSize: 12 },
  card: { backgroundColor: C.card, borderRadius: S.radius, padding: 16, borderWidth: 1, borderColor: C.line, ...S.shadow },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  stat: { flex: 1, minWidth: '30%', backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 13 },
  statValue: { fontSize: 23, fontWeight: '900', color: C.ink },
  statLabel: { fontSize: 11, color: C.muted, marginTop: 2, lineHeight: 14 },
  empty: { backgroundColor: C.card, borderRadius: S.radius, borderWidth: 1, borderColor: C.line, padding: 22, alignItems: 'center' },
  emptyMark: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.limeSoft, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: C.ink2, marginBottom: 6 },
  input: {
    backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 13,
    paddingHorizontal: 14, paddingVertical: 12, color: C.ink, fontSize: 14, minHeight: 46,
  },
  sheetBackdrop: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 18, paddingTop: 8, maxHeight: '92%',
  },
  sheetHandle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#CBD5C6', marginBottom: 8 },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line },
});
