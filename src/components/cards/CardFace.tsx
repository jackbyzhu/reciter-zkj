import type { Card } from '../../types';

export function CardMeta({ card }: { card: Card }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">
        {card.source === 'ai_generated'
          ? 'AI 生成'
          : card.source === 'user_added'
            ? '手录'
            : '导入'}
      </span>
      {card.tags.map((t) => (
        <span key={t} className="rounded bg-brand-100 px-1.5 py-0.5 text-brand-700">
          #{t}
        </span>
      ))}
    </div>
  );
}

export function CardFields({ card }: { card: Card }) {
  return (
    <div className="space-y-3 text-sm">
      {card.pronunciation && (
        <p className="text-sm text-slate-400">{card.pronunciation}</p>
      )}
      {card.meaning && (
        <div className="border-l-2 border-brand-400/70 pl-3">
          <div className="mb-0.5 text-xs font-medium text-slate-400">释义</div>
          <p className="leading-relaxed text-slate-800">{card.meaning}</p>
        </div>
      )}
      {(card.roots || card.mnemonic) && (
        <div className="grid grid-cols-1 gap-3 rounded-xl bg-paper-100/80 p-3 sm:grid-cols-2">
          {card.roots && (
            <div>
              <div className="mb-0.5 text-xs font-medium text-slate-400">词根词缀</div>
              <p className="text-slate-700">{card.roots}</p>
            </div>
          )}
          {card.mnemonic && (
            <div>
              <div className="mb-0.5 text-xs font-medium text-slate-400">助记</div>
              <p className="text-slate-700">{card.mnemonic}</p>
            </div>
          )}
        </div>
      )}
      {card.humorExplanation && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
          <div className="text-xs font-medium text-amber-500">趣味解释</div>
          <p>{card.humorExplanation}</p>
        </div>
      )}
      {card.examples.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium text-slate-400">例句</div>
          <ul className="space-y-1.5">
            {card.examples.map((ex, i) => (
              <li key={i} className="rounded-lg bg-white/70 px-3 py-2 ring-1 ring-slate-100">
                <p className="text-slate-700">{ex.en}</p>
                <p className="mt-0.5 text-slate-500">{ex.zh}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function CardFace({ card }: { card: Card }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-brand-200/70 bg-gradient-to-b from-white to-paper-100/60 p-6 shadow-sm">
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand-200/30 blur-2xl" />
      <div className="relative">
        <CardMeta card={card} />
        <div className="mb-2 flex flex-wrap items-baseline gap-3">
          <h2 className="font-display text-3xl font-bold tracking-wide text-slate-900">
            {card.word}
          </h2>
          {card.pos && (
            <span className="rounded-lg bg-brand-600 px-2 py-0.5 text-xs font-medium text-white">
              {card.pos}
            </span>
          )}
        </div>
        <CardFields card={card} />
      </div>
    </div>
  );
}