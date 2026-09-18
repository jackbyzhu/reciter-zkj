import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { buildCurveWords, endOfToday, nextDueBuckets, retentionCurve } from '../algorithms/curve';
import { useSettings } from '../stores/settingsStore';
import { Button } from '../components/common/Button';
import { EmptyState, Loading } from '../components/common/Feedback';
import { RetentionChart, Sparkline } from '../components/charts/RetentionChart';
import type { CurveWord } from '../algorithms/curve';

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

function pct(r: number): string {
  return `${Math.round(r * 100)}%`;
}

function dueLabel(w: CurveWord): { text: string; tone: string } {
  if (!w.state) return { text: '待记忆', tone: 'bg-slate-100 text-slate-500' };
  if (w.state.reps <= 0) return { text: '新词待学', tone: 'bg-slate-100 text-slate-500' };
  if (w.dueInDays < 0)
    return { text: `已过期 ${Math.ceil(-w.dueInDays)} 天`, tone: 'bg-red-50 text-red-600' };
  if (w.dueInDays <= 1)
    return { text: '今天到期', tone: 'bg-amber-50 text-amber-600' };
  return { text: `${Math.ceil(w.dueInDays)} 天后`, tone: 'bg-slate-100 text-slate-500' };
}

export function Curve() {
  const navigate = useNavigate();
  const target = useSettings((s) => s.settings.targetRetention);

  const data = useLiveQuery(async () => {
    const cards = await db.cards.toArray();
    const states = await db.reviewStates.toArray();
    return { cards, states };
  }, []);

  const words = useMemo(() => {
    if (!data) return [];
    return buildCurveWords(data.cards, data.states, target);
  }, [data, target]);

  const hasCurve = useMemo(
    () =>
      words.filter(
        (w) => w.state && w.state.state !== 'new' && w.stabilityDays > 0
      ),
    [words]
  );
  const fallbackId =
    (hasCurve.sort((a, b) => a.retention - b.retention)[0]?.card.id as string | undefined) ??
    words[0]?.card.id ??
    '';
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const currentId =
    selectedId !== null && words.some((w) => w.card.id === selectedId)
      ? selectedId
      : fallbackId;

  if (!data) {
    return (
      <div className="mx-auto max-w-5xl">
        <Loading message="正在读取记忆数据…" />
      </div>
    );
  }

  if (data.cards.filter((c) => !c.deletedAt).length === 0) {
    return (
      <div className="mx-auto max-w-5xl">
        <EmptyState
          icon="📈"
          title="还没有单词"
          description="录几个单词并开始复习后，这里会展示每个单词的记忆曲线与复习计划。"
          action={<Button onClick={() => navigate('/add')}>去录单词</Button>}
        />
      </div>
    );
  }

  const now = Date.now();
  const todayEnd = endOfToday(now);
  const reviewed = words.filter(
    (w) => w.state && w.state.reps > 0 && w.state.state !== 'new'
  );
  const dueToday = reviewed.filter((w) => w.state && w.state.due <= todayEnd).length;
  const buckets = nextDueBuckets(words, 7, now);
  const dueNext7 = buckets.reduce((a, b) => a + b.count, 0);
  const riskWords = words
    .filter((w) => w.state && w.state.reps > 0 && w.retention < target)
    .sort((a, b) => a.retention - b.retention)
    .slice(0, 15);
  const maxBucket = Math.max(1, ...buckets.map((b) => b.count));

  const selected =
    words.find((w) => w.card.id === currentId) ??
    hasCurve[0] ??
    words[0];
  const selectedState = selected?.state ?? null;

  const curvePoints =
    selectedState && selectedState.state !== 'new'
      ? retentionCurve(selectedState, target, now)
      : [];

  const selectableWords = [...words].sort((a, b) => {
    const aa = a.retention < target ? 1 : 0;
    const bb = b.retention < target ? 1 : 0;
    if (aa !== bb) return bb - aa;
    return a.retention - b.retention;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">记忆曲线</h1>
        <p className="mt-1 text-sm text-slate-500">
          基于间隔重复算法，预测每个单词的记忆保持率，提前发现容易遗忘的词。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: '单词总数', value: words.length, tone: 'text-brand-600' },
          { label: '已形成记忆', value: reviewed.length, tone: 'text-emerald-600' },
          { label: '今日到期', value: dueToday, tone: 'text-amber-600' },
          { label: '未来 7 天', value: dueNext7, tone: 'text-purple-600' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-white p-4 shadow-sm">
            <div className={`text-2xl font-bold ${s.tone}`}>{s.value}</div>
            <div className="mt-1 text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-800">未来 7 天复习计划</h2>
          <p className="text-xs text-slate-500">已开始记忆的单词，未来每天预计到期数量</p>
        </div>
        <div className="flex h-40 items-end gap-2 sm:gap-3">
          {buckets.map((b) => {
            const h = b.count > 0 ? Math.round((b.count / maxBucket) * 100) : 4;
            return (
              <div
                key={b.date.getTime()}
                className="group flex flex-1 flex-col items-center gap-1"
                title={`${b.count} 个`}
              >
                <span className="h-5 text-xs font-semibold text-slate-600">
                  {b.count > 0 ? b.count : ''}
                </span>
                <div
                  className={`w-full rounded-t-md transition-colors ${
                    b.count > 0
                      ? 'bg-gradient-to-t from-brand-600 to-brand-400 group-hover:from-brand-700 group-hover:to-brand-500'
                      : 'bg-slate-100'
                  }`}
                  style={{ height: `${h}px` }}
                />
                <span className="text-[11px] text-slate-500">周{WEEK[b.date.getDay()]}</span>
                <span className="text-[11px] text-slate-400">{b.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800">易遗忘单词</h2>
            {riskWords.length > 0 && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                {riskWords.length} 个风险
              </span>
            )}
          </div>
          <p className="mb-3 text-xs text-slate-500">
            预测保持率低于目标 {pct(target)}，记得优先复习
          </p>

          {riskWords.length === 0 ? (
            <div className="rounded-xl bg-emerald-50 px-4 py-6 text-center">
              <div className="text-2xl">🎉</div>
              <p className="mt-1 text-sm font-medium text-emerald-700">当前没有容易遗忘的单词</p>
              <p className="text-xs text-emerald-600/70">坚持每天复习，记忆很牢固</p>
            </div>
          ) : (
            <div className="space-y-2">
              {riskWords.map((w) => {
                const due = dueLabel(w);
                const pts = w.state ? retentionCurve(w.state, target, now, 24) : [];
                return (
                  <button
                    key={w.card.id}
                    type="button"
                    onClick={() => setSelectedId(w.card.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      selected?.card.id === w.card.id
                        ? 'border-brand-400 bg-brand-50/50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-slate-800">
                        {w.card.word}
                      </span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${due.tone}`}>
                        {due.text}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-xs text-slate-400">{w.card.meaning}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-red-500 to-amber-400"
                          style={{ width: `${Math.round(w.retention * 100)}%` }}
                        />
                      </div>
                      <span className="w-10 shrink-0 text-right text-xs font-semibold text-red-500">
                        {pct(w.retention)}
                      </span>
                      <span className="w-[84px] shrink-0">
                        <Sparkline points={pts} danger />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-800">单词记忆曲线</h2>
            <select
              value={selected?.card.id ?? ''}
              onChange={(e) => setSelectedId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              {selectableWords.map((w) => (
                <option key={w.card.id} value={w.card.id}>
                  {w.card.word}（{pct(w.retention)}）
                </option>
              ))}
            </select>
          </div>

          {curvePoints.length === 0 ? (
            <div className="flex h-56 items-center justify-center rounded-xl bg-slate-50">
              <div className="text-center">
                <div className="text-2xl">🆕</div>
                <p className="mt-1 text-sm text-slate-500">这个单词还没有记忆数据</p>
                <p className="text-xs text-slate-400">去「回顾」复习一次，曲线就会生成</p>
              </div>
            </div>
          ) : selectedState ? (
            <>
              <RetentionChart
                points={curvePoints}
                dueTime={selectedState.due}
                nowTime={now}
                target={target}
                word={selected?.card.word ?? ''}
                status={selectedState.state}
              />
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                  稳定性 {selected?.stabilityDays.toFixed(1) ?? '—'} 天
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                  难度 D{selected?.difficulty.toFixed(1) ?? '—'}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                  复习 {selected?.reps ?? 0} 次
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                  遗忘 {selected?.lapses ?? 0} 次
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                  {selectedState.state === 'learning'
                    ? '学习中'
                    : selectedState.state === 'relearning'
                      ? '重学中'
                      : '已掌握'}
                </span>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}