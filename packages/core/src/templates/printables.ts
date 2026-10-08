import { theme } from '../spec/themes.ts';
import type { PrintableSpec } from '../spec/types.ts';
import { brandParam, defaults, paperParam, paperSizes, slug, themeParam } from './common.ts';
import type { Template } from './types.ts';

/* ---------------------------------------------------------------------- */
/* Habit tracker kit                                                       */
/* ---------------------------------------------------------------------- */

const habitFields = [brandParam, themeParam('sage'), paperParam];

export const habitTrackerKit: Template = {
  id: 'habit-tracker-kit',
  name: 'Habit Tracker Printable Kit',
  category: 'Wellness',
  kind: 'printable',
  blurb: 'Undated monthly habit grid, goal setting, weekly reflection and dot-grid notes — print and reuse every month.',
  params: habitFields,
  suggestedPriceUsd: 4.5,
  build(raw): PrintableSpec {
    const p = defaults(habitFields, raw);
    const name = 'Habit Tracker Printable Kit';
    const spec: PrintableSpec = {
      kind: 'printable',
      title: name,
      fileBase: slug(name),
      brand: p.brand || undefined,
      theme: theme(p.theme),
      paperSizes: paperSizes(p.paper),
      pages: [
        { type: 'cover', title: 'Habit Tracker', subtitle: 'Small steps, every day. Print a fresh set each month.' },
        { type: 'goals', title: 'This Month', boxes: ['Focus for the month', 'Habits I am building', 'Why they matter to me', 'How I will reward myself'] },
        { type: 'habit-tracker', title: 'Monthly Habit Tracker', rows: 16, days: 31 },
        { type: 'habit-tracker', title: 'Wellness Tracker', rows: 16, days: 31 },
        {
          type: 'checklist',
          title: 'Weekly Reflection',
          items: ['What went well this week?', 'Where did I get stuck?', 'One thing to change next week', 'Something I am grateful for'],
          blankLines: 14,
        },
        { type: 'notes', title: 'Notes', style: 'dot' },
      ],
    };
    return spec;
  },
  seed() {
    return {
      productName: 'Habit Tracker Printable',
      format: 'Printable PDF',
      audience: 'anyone building routines, journaling or setting new goals',
      keywords: [
        'habit tracker',
        'habit tracker pdf',
        'printable planner',
        'goal planner',
        'monthly tracker',
        'wellness planner',
        'self care planner',
        'bullet journal',
        'undated planner',
        'routine tracker',
        'productivity',
        'a4 printable',
        'letter printable',
        'mindfulness',
      ],
      features: [
        'Undated, so you can start any month and reprint forever',
        '31-day habit grid with 16 habits per page',
        'Monthly goals page and weekly reflection prompts',
        'Dot-grid notes page for ideas and doodles',
        'Clean, ink-friendly design',
      ],
      includes: ['A4 PDF and US Letter PDF', '6 pages per set: cover, goals, 2 trackers, reflection, notes'],
      howItWorks: ['Download the PDFs after purchase', 'Print at home or at a print shop (choose “Fit to page”)', 'Reprint a fresh set every month'],
    };
  },
};

/* ---------------------------------------------------------------------- */
/* Weekly life planner                                                     */
/* ---------------------------------------------------------------------- */

const plannerFields = [brandParam, themeParam('midnight'), paperParam];

export const lifePlanner: Template = {
  id: 'weekly-life-planner',
  name: 'Weekly Life Planner Printable',
  category: 'Planning',
  kind: 'printable',
  blurb: 'Undated weekly and monthly spreads, to-do list, meal planner, goals and lined notes.',
  params: plannerFields,
  suggestedPriceUsd: 5.5,
  build(raw): PrintableSpec {
    const p = defaults(plannerFields, raw);
    const name = 'Weekly Life Planner';
    const spec: PrintableSpec = {
      kind: 'printable',
      title: name,
      fileBase: slug(name),
      brand: p.brand || undefined,
      theme: theme(p.theme),
      paperSizes: paperSizes(p.paper),
      pages: [
        { type: 'cover', title: 'Weekly Life Planner', subtitle: 'Plan the week. Protect your priorities.' },
        { type: 'monthly-calendar', title: 'Monthly Overview' },
        { type: 'weekly-planner', title: 'This Week' },
        { type: 'checklist', title: 'To-Do List', blankLines: 24 },
        {
          type: 'table',
          title: 'Meal Planner',
          columns: [
            { header: 'Day', weight: 1 },
            { header: 'Breakfast', weight: 2 },
            { header: 'Lunch', weight: 2 },
            { header: 'Dinner', weight: 2 },
            { header: 'Snacks', weight: 1.5 },
          ],
          rows: 7,
        },
        {
          type: 'table',
          title: 'Grocery List',
          columns: [
            { header: 'Item', weight: 3 },
            { header: 'Qty', weight: 1 },
            { header: 'Item', weight: 3 },
            { header: 'Qty', weight: 1 },
          ],
          rows: 22,
        },
        { type: 'goals', title: 'Goals', boxes: ['Goal', 'Why it matters', 'Steps to get there', 'Deadline & reward'] },
        { type: 'notes', title: 'Notes', style: 'lined' },
      ],
    };
    return spec;
  },
  seed() {
    return {
      productName: 'Weekly Life Planner Printable',
      format: 'Printable PDF',
      audience: 'busy people who like to plan on paper',
      keywords: [
        'weekly planner',
        'printable planner',
        'undated planner',
        'life planner',
        'meal planner',
        'to do list',
        'monthly planner',
        'planner inserts',
        'productivity',
        'grocery list',
        'goal planner',
        'a4 printable',
        'letter printable',
        'daily planner',
      ],
      features: [
        'Undated weekly spread with a notes and priorities box',
        'Monthly calendar overview',
        'To-do list, meal planner and grocery list',
        'Goal planning page and lined notes',
        'Minimal design that prints beautifully in colour or black and white',
      ],
      includes: ['A4 PDF and US Letter PDF', '8 pages per set'],
      howItWorks: ['Download the PDFs after purchase', 'Print the pages you need (choose “Fit to page”)', 'Hole-punch for a binder or clip to a board'],
    };
  },
};
