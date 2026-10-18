import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { MASTERY_LABEL, type Mastery, type MasteryCounts } from '../core/stats';
import { go } from '../lib/router';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-water text-white dark:text-paper hover:bg-water-deep dark:hover:bg-water-deep shadow-sm',
  secondary: 'bg-surface text-ink border border-line hover:border-water',
  ghost: 'text-water hover:bg-sunken',
  danger: 'bg-surface text-wrong border border-line hover:border-wrong',
};

export function Button({ variant = 'secondary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...p}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function LinkButton({ to, children, variant = 'secondary', className = '' }: { to: string; children: ReactNode; variant?: Variant; className?: string }) {
  return (
    <a
      href={`#${to}`}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 font-medium transition-colors ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </a>
  );
}

/** Strona z nagłówkiem (wszystko poza ekranami z mapą na pełny ekran). */
export function Page({ title, children, back = '/', actions }: { title: string; children: ReactNode; back?: string | null; actions?: ReactNode }) {
  return (
    <div className="min-h-full">
      <header className="contours border-b border-line bg-surface/70">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          {back !== null && (
            <button onClick={() => go(back)} className="flex size-10 items-center justify-center rounded-full hover:bg-sunken" aria-label="Wróć">
              <Icon name="back" />
            </button>
          )}
          <h1 className="flex-1 text-xl font-semibold">{title}</h1>
          {actions}
        </div>
        <div className="hypso h-1" aria-hidden />
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Pasek postępu: opanowane / w nauce / do powtórki / nowe – kolor + deseń. */
export function MasteryBar({ c, height = 'h-3' }: { c: MasteryCounts; height?: string }) {
  if (!c.total) return null;
  const seg = (n: number, cls: string, key: Mastery) =>
    n > 0 ? <div key={key} className={cls} style={{ width: `${(n / c.total) * 100}%` }} title={`${MASTERY_LABEL[key]}: ${n}`} /> : null;
  return (
    <div className={`flex w-full overflow-hidden rounded-full bg-sunken ${height}`} role="img" aria-label={`Opanowane ${c.mastered}, w nauce ${c.learning}, do powtórki ${c.due}, nowe ${c.new}`}>
      {seg(c.mastered, 'bg-ok', 'mastered')}
      {seg(c.learning, 'pat-learning bg-warn/30', 'learning')}
      {seg(c.due, 'pat-due bg-wrong/25', 'due')}
    </div>
  );
}

export function MasteryLegend({ compact = false }: { compact?: boolean }) {
  const items: [Mastery, ReactNode][] = [
    ['mastered', <span className="inline-flex size-4 items-center justify-center rounded-full bg-ok text-[10px] text-white">✓</span>],
    ['learning', <span className="pat-learning inline-block size-4 rounded-sm border border-warn bg-warn/25" />],
    ['due', <span className="pat-due inline-block size-4 rounded-sm border border-wrong bg-wrong/20" />],
    ['new', <span className="inline-block size-4 rounded-full border-2 border-new" />],
  ];
  return (
    <ul className={`flex flex-wrap gap-x-4 gap-y-1 text-sm ${compact ? '' : 'mt-2'}`}>
      {items.map(([k, ico]) => (
        <li key={k} className="flex items-center gap-1.5">
          {ico}
          {MASTERY_LABEL[k]}
        </li>
      ))}
    </ul>
  );
}

/** Informacja zwrotna – zawsze ikona + tekst, nie tylko kolor. */
export function Verdict({ kind, children }: { kind: 'ok' | 'typo' | 'bad'; children: ReactNode }) {
  const map = {
    ok: ['bg-ok/12 text-ok border-ok/40', 'check', 'Dobrze'],
    typo: ['bg-warn/12 text-warn border-warn/40', 'check', 'Prawie dobrze'],
    bad: ['bg-wrong/12 text-wrong border-wrong/40', 'cross', 'Źle'],
  } as const;
  const [cls, ico, label] = map[kind];
  return (
    <div className={`anim-pop flex items-start gap-2 rounded-xl border px-3 py-2 ${cls}`} role="status">
      <Icon name={ico} className="mt-0.5 shrink-0" />
      <div className="min-w-0 text-ink">
        <strong className={`mr-1 ${kind === 'ok' ? 'text-ok' : kind === 'typo' ? 'text-warn' : 'text-wrong'}`}>{label}.</strong>
        {children}
      </div>
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="hidden rounded border border-line bg-sunken px-1.5 text-xs text-ink-soft sm:inline">{children}</kbd>;
}

const PATHS: Record<string, string> = {
  back: 'M15 18l-6-6 6-6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  cross: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  map: 'M9 4L3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4zM9 4v13.5M15 6.5V20',
  play: 'M8 5.5v13l10.5-6.5L8 5.5z',
  target: 'M12 3v3M12 18v3M3 12h3M18 12h3M12 8a4 4 0 100 8 4 4 0 000-8z',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5',
  trash: 'M5 7h14M10 11v6M14 11v6M7 7l1 12h8l1-12M9 7V4h6v3',
  flame: 'M12 3c1 3.5 5 5.5 5 10a5 5 0 01-10 0c0-2.5 1.5-4 2.5-5 .3 1.6 1.2 2.6 2.5 3-.5-3 0-5.5 0-8z',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  layers: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5',
  home: 'M4 11l8-7 8 7M6 9.5V20h12V9.5',
};

export function Icon({ name, className = '', size = 20 }: { name: keyof typeof PATHS | string; className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-ink-soft">{children}</p>;
}

export function formatDuration(ms: number) {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m ? `${m} min ${s % 60} s` : `${s} s`;
}

export function plural(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  const d = n % 10;
  const t = n % 100;
  if (d >= 2 && d <= 4 && (t < 12 || t > 14)) return few;
  return many;
}
