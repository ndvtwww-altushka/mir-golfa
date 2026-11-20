// Дизайн-система «Мир Гольфа»: цвета, отступы, тени.
export const C = {
  bg: '#F2F5EE',
  card: '#FFFFFF',
  ink: '#12251C',
  ink2: '#3B4C44',
  muted: '#6E7C73',
  green: '#0F3D2E',
  green2: '#1A5A42',
  lime: '#C9F06B',
  limeSoft: '#EAF7C6',
  limeInk: '#14301F',
  line: '#E2E8DB',
  sand: '#F6F1E4',
  gold: '#B98A2F',
  red: '#B3452F',
  blue: '#2C5B86',
  white: '#FFFFFF',
  overlay: 'rgba(15,61,46,0.45)',
};

export const S = {
  pad: 18,
  radius: 22,
  radiusSm: 14,
  shadow: {
    shadowColor: '#0F3D2E',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
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
