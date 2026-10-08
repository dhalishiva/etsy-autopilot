import type { ProductStatus } from '../lib/types';

const STAGES = [
  { key: 'draft', label: 'Draft', color: 'var(--color-slate)' },
  { key: 'ready', label: 'Ready', color: 'var(--color-ready)' },
  { key: 'on_etsy', label: 'On Etsy', color: 'var(--color-etsy)' },
  { key: 'live', label: 'Live', color: 'var(--color-live)' },
] as const;

function stageIndex(status: ProductStatus): number {
  if (status === 'pushing') return 1;
  if (status === 'error') return -1;
  return STAGES.findIndex((s) => s.key === status);
}

/**
 * The product's position on the line from draft to live. Filled dots are
 * done, the ringed dot is where it is now.
 */
export function StageRail({ status, compact = false }: { status: ProductStatus; compact?: boolean }) {
  const at = stageIndex(status);
  return (
    <ol className="flex items-center" aria-label={`Stage: ${status === 'error' ? 'needs attention' : STAGES[Math.max(at, 0)]!.label}`}>
      {STAGES.map((s, i) => {
        const done = i < at;
        const current = i === at;
        return (
          <li key={s.key} className="flex items-center">
            {i > 0 && (
              <span
                aria-hidden
                className={`h-[3px] ${compact ? 'w-5' : 'w-10 sm:w-14'} rounded-full`}
                style={{ background: i <= at ? STAGES[i]!.color : 'var(--color-rule)' }}
              />
            )}
            <span className="flex flex-col items-center gap-1">
              <span
                className={`block rounded-full ${compact ? 'h-3 w-3' : 'h-4 w-4'} ${current && status === 'pushing' ? 'rail-active' : ''}`}
                style={{
                  color: s.color,
                  background: done || (current && s.key === 'live') ? s.color : current ? '#fff' : 'var(--color-mist)',
                  border: `3px solid ${done || current ? s.color : 'var(--color-rule)'}`,
                }}
              />
              {!compact && (
                <span className={`text-xs ${current ? 'font-semibold text-ink' : 'text-slate'}`}>{s.label}</span>
              )}
            </span>
          </li>
        );
      })}
      {status === 'error' && <li className="ml-3 text-xs font-semibold text-danger">Needs attention</li>}
    </ol>
  );
}
