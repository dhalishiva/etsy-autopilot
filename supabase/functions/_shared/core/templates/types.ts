import type { ProductSpec } from '../spec/types.ts';
import type { ListingSeed } from '../listing/index.ts';

export type { ListingSeed };

export type TemplateCategory =
  | 'Finance'
  | 'Business'
  | 'Events'
  | 'Planning'
  | 'Career'
  | 'Wellness';

export interface ParamField {
  key: string;
  label: string;
  type: 'text' | 'select';
  options?: { value: string; label: string }[];
  default: string;
  help?: string;
}

export type TemplateParams = Record<string, string>;

export interface Template {
  id: string;
  name: string;
  category: TemplateCategory;
  kind: ProductSpec['kind'];
  blurb: string;
  params: ParamField[];
  suggestedPriceUsd: number;
  build(params: TemplateParams): ProductSpec;
  seed(params: TemplateParams): ListingSeed;
}
