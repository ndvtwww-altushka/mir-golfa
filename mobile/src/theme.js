// Дизайн-система «Мир Гольфа» v2.2 — «Имба»
// Строгая монохромная база + глубокий изумруд + золото статусов.

export const C = {
  // База
  bg: '#FFFFFF',
  bg2: '#F7F7F5',          // Тёплый светло-серый для подложек
  card: '#FFFFFF',
  ink: '#0A0F0D',          // Почти чёрный
  ink2: '#3C4642',
  muted: '#8A938E',
  line: '#E8EAE7',
  lineStrong: '#D5D9D5',

  // Акцент — глубокий изумруд (газон)
  green: '#0E4633',
  green2: '#155C43',
  greenSoft: '#EDF3EF',

  // Золото — для избранного и рейтингов
  gold: '#A8842C',
  goldSoft: '#F7F1E1',

  // Статусы
  lime: '#C8E64A',
  limeInk: '#1C2A0C',
  red: '#B23B2E',
  redSoft: '#F9ECEA',
  blue: '#2D5A87',
  blueSoft: '#EBF1F7',

  white: '#FFFFFF',
  overlay: 'rgba(10,15,13,0.5)',
};

export const S = {
  pad: 20,
  padLg: 24,
  radius: 16,
  radiusLg: 22,
  radiusSm: 10,
  shadow: {
    shadowColor: '#0A0F0D',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
};

export const MONTHS_SHORT = ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК'];
export const MONTHS_FULL = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

export const plural = (n, forms) => {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
};

export const daysWord = (n) => plural(n, ['день', 'дня', 'дней']);
