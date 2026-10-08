import { habitTrackerKit, lifePlanner } from './printables.ts';
import { freelancerDashboard, gstInvoiceKit, jobHuntTracker, personalBudget, weddingPlanner } from './spreadsheets.ts';
import type { Template } from './types.ts';

export const TEMPLATES: Template[] = [
  gstInvoiceKit,
  freelancerDashboard,
  weddingPlanner,
  personalBudget,
  jobHuntTracker,
  habitTrackerKit,
  lifePlanner,
];

export function getTemplate(id: string): Template {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown template: ${id}`);
  return t;
}

export * from './types.ts';
export { defaults } from './common.ts';
