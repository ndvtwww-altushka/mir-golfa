import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Простое хранилище «ключ → JSON» с мгновенным локальным состоянием. */
export function usePersisted(key, initial) {
  const [value, setValue] = useState(initial);
  const [ready, setReady] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (!mounted.current || !raw) return;
        try {
          setValue(JSON.parse(raw));
        } catch {
          // Битое значение просто игнорируем: локальные данные не должны ронять экран.
        }
      })
      .catch(() => {})
      .finally(() => mounted.current && setReady(true));
    return () => { mounted.current = false; };
  }, [key]);

  const update = useCallback((next) => {
    setValue((previous) => {
      const resolved = typeof next === 'function' ? next(previous) : next;
      AsyncStorage.setItem(key, JSON.stringify(resolved)).catch(() => {});
      return resolved;
    });
  }, [key]);

  return [value, update, ready];
}

export const DEFAULT_PROFILE = {
  name: '',
  region: '',
  age_group: '',
  handicap: '',
  apiUrl: '',
};

/**
 * Оценка гандикапа по личным раундам. Это не официальный WHS:
 * грубый дифференциал «счёт на 18 лунок минус пар», лучшие 40% раундов.
 */
export function estimateHandicap(rounds) {
  const diffs = (rounds || [])
    .filter((round) => Number(round.gross_score) > 0 && [9, 18].includes(Number(round.holes)))
    .slice(0, 20)
    .map((round) => (Number(round.gross_score) * 18) / Number(round.holes) - 72)
    .map((value) => Math.max(0, value))
    .sort((a, b) => a - b);
  if (diffs.length < 3) return null;
  const take = Math.max(1, Math.round(diffs.length * 0.4));
  const best = diffs.slice(0, take);
  return Math.round((best.reduce((sum, value) => sum + value, 0) / best.length) * 10) / 10;
}
