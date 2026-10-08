import { CURRENCIES, THEMES } from '../spec/themes.ts';
import type { GuideSheetSpec, PaperSize } from '../spec/types.ts';
import type { ParamField, TemplateParams } from './types.ts';

export const themeParam = (def = 'sage'): ParamField => ({
  key: 'theme',
  label: 'Colour theme',
  type: 'select',
  default: def,
  options: Object.values(THEMES).map((t) => ({ value: t.id, label: t.name })),
});

export const currencyParam = (def = 'USD'): ParamField => ({
  key: 'currency',
  label: 'Currency',
  type: 'select',
  default: def,
  options: Object.values(CURRENCIES).map((c) => ({ value: c.code, label: `${c.code} (${c.symbol})` })),
});

export const brandParam: ParamField = {
  key: 'brand',
  label: 'Shop / brand name',
  type: 'text',
  default: '',
  help: 'Printed in the file footer and guide. Leave blank for none.',
};

export const paperParam: ParamField = {
  key: 'paper',
  label: 'Paper sizes',
  type: 'select',
  default: 'both',
  options: [
    { value: 'both', label: 'A4 + US Letter (recommended)' },
    { value: 'A4', label: 'A4 only' },
    { value: 'Letter', label: 'US Letter only' },
  ],
};

export function defaults(fields: ParamField[], params: TemplateParams): TemplateParams {
  const out: TemplateParams = {};
  for (const f of fields) out[f.key] = params[f.key]?.trim() || f.default;
  return out;
}

export function paperSizes(p: string | undefined): PaperSize[] {
  if (p === 'A4') return ['A4'];
  if (p === 'Letter') return ['Letter'];
  return ['A4', 'Letter'];
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function spreadsheetGuide(name: string, extra: { heading: string; body: string[] }[], brand?: string): GuideSheetSpec {
  return {
    kind: 'guide',
    name: 'Start Here',
    title: `Welcome to your ${name}`,
    sections: [
      {
        heading: 'Getting started',
        body: [
          'Works in Microsoft Excel (2016 or newer), Excel for the web, Google Sheets and Apple Numbers.',
          'Google Sheets: open drive.google.com → New → File upload → choose this file → Open with Google Sheets.',
          'The example rows show how things work. Delete them (select the rows → right-click → Clear contents) before adding your own.',
          'Coloured columns calculate automatically — please don’t type over them.',
        ],
      },
      ...extra,
      {
        heading: 'Licence',
        body: [
          `This file is for your personal or internal business use. Please don’t resell or share the file itself.${brand ? ` © ${brand}.` : ''}`,
        ],
      },
    ],
  };
}
