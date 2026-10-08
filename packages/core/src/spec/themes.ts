import type { CurrencyFormat, Theme } from './types.ts';

export const THEMES: Record<string, Theme> = {
  sage: {
    id: 'sage',
    name: 'Sage',
    primary: '#4F6F52',
    onPrimary: '#FFFFFF',
    accent: '#C9A66B',
    surface: '#F2F5EF',
    ink: '#1F2A1F',
    muted: '#8A9688',
  },
  blush: {
    id: 'blush',
    name: 'Blush',
    primary: '#B5677D',
    onPrimary: '#FFFFFF',
    accent: '#E8B4A0',
    surface: '#FBF1F2',
    ink: '#3A2229',
    muted: '#A88C93',
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    primary: '#1E2A44',
    onPrimary: '#FFFFFF',
    accent: '#F2A93B',
    surface: '#EEF1F7',
    ink: '#141A26',
    muted: '#7D879C',
  },
  terracotta: {
    id: 'terracotta',
    name: 'Terracotta',
    primary: '#B4583A',
    onPrimary: '#FFFFFF',
    accent: '#2F6F73',
    surface: '#FBF2EC',
    ink: '#2E1B14',
    muted: '#A38C80',
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    primary: '#1F6F8B',
    onPrimary: '#FFFFFF',
    accent: '#F28C6B',
    surface: '#EDF6F8',
    ink: '#10262E',
    muted: '#7E9AA3',
  },
  mono: {
    id: 'mono',
    name: 'Mono',
    primary: '#222222',
    onPrimary: '#FFFFFF',
    accent: '#8C8C8C',
    surface: '#F4F4F4',
    ink: '#111111',
    muted: '#9A9A9A',
  },
};

export const CURRENCIES: Record<string, CurrencyFormat> = {
  INR: { code: 'INR', symbol: '₹', excelFormat: '"₹"#,##,##0.00' },
  USD: { code: 'USD', symbol: '$', excelFormat: '"$"#,##0.00' },
  GBP: { code: 'GBP', symbol: '£', excelFormat: '"£"#,##0.00' },
  EUR: { code: 'EUR', symbol: '€', excelFormat: '"€"#,##0.00' },
  AUD: { code: 'AUD', symbol: 'A$', excelFormat: '"A$"#,##0.00' },
  CAD: { code: 'CAD', symbol: 'C$', excelFormat: '"C$"#,##0.00' },
};

export function theme(id: string | undefined): Theme {
  return THEMES[id ?? ''] ?? THEMES.sage!;
}

export function currency(code: string | undefined): CurrencyFormat {
  return CURRENCIES[code ?? ''] ?? CURRENCIES.USD!;
}
