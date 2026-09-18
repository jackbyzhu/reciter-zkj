import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { snapshotQueue, todayDueCount, type QueueItem } from '../services/queue';
import { rateCard } from '../services/mutations';
import { useSettings } from '../stores/settingsStore';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { AlertBanner, EmptyState } from '../components/common/Feedback';
import { CardFace } from '../components/cards/CardFace';
import type { Rating } from '../types';

type Phase = 'setup' | 'recognition' | 'card' | 'finish';

interface ReviewResult {
  cardId: string;
  word: string;
  rating: Rating;
}

const RECOGNITION_BUTTONS: { value: boolean; label: string; className: string }[] = [
  { value: true, label: '记得 😄', className: 'bg-emerald-600 hover:bg-emerald-700' },
  { value: false, label: '不记得 🤔', className: 'bg-red-500 hover:bg-red-600' },
];

const CARD_BUTTONS: { value: boolean; label: string; className: string }[] = [
  { value: true, label: '真记得 ✅', className: 'bg-emerald-600 hover:bg-emerald-700' },
  { value: false, label: '卡了没记住 🔁', className: 'bg-red-500 hover:bg-red-600' },
];

const RATING_LABEL: Record<Rating, string> = {
  1: '忘记（Again）',
  2: '困难（Hard）',
  3: '良好（Good）',
  4: '简单（Easy）',
};

export function Review() {
  const navigate = useNavigate();
  const settings = useSettings((s) => s.settings);
  const [phase, setPhase] = useState<Phase>('setup');
  const [batchSize, setBatchSize] = useState(settings.reviewBatchSize);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [index, setIndex] = useState(0);
  const [remember, setRemember] = useState(false);
  const [results, setResults] = useState<ReviewResult[]>([]);
  const [saving, setSaving] = useState(false);

  const todayDue = useLiveQuery(() => todayDueCount(), [], 0);
  const remaining = useLiveQuery(() => db.reviewStates.count(), [], 0);

  useEffect(() => {
    setBatchSize(settings.reviewBatchSize);
  }, [settings.reviewBatchSize]);

  async function start() {
    const size = Math.max(1, Math.min(100, batchSize));
    const snapshot = await snapshotQueue(size);
    if (snapshot.length === 0) return;
    setItems(snapshot);
    setIndex(0);
    setResults([]);
    setPhase('recognition');
  }

  function handleRecognized(recognized: boolean) {
    setRemember(recognized);
    setPhase('card');
  }

  async function handleCardRating(realRemember: boolean) {
    const current = items[index];
    if (!current || saving) return;
    const rating: Rating = remember ? (realRemember ? 4 : 2) : realRemember ? 3 : 1;
    setSaving(true);
    await rateCard(current.card.id, rating, settings.targetRetention);
    const nextResults = [...results, { cardId: current.card.id, word: current.card.word, rating }];
    setResults(nextResults);
    setSaving(false);

    if (index + 1 >= items.length) {
      setPhase('finish');
    } else {
      setIndex(index + 1);
      setPhase('recognition');
    }
  }

  function reset() {
    setPhase('setup');
    setItems([]);
    setIndex(0);
    setResults([]);
  }

  if (phase === 'setup') {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">回顾单词</h1>
          <p className="mt-1 text-sm text-slate-500">
            识别模式只显示英文，不看中文，逼自己回忆一下。
          </p>
        </div>

        {!remaining ? (
          <EmptyState
            icon="📭"
            title="队列空了"
            description="先去录几个单词，再来复习吧。"
            action={
              <Button onClick={() => navigate('/add')}>去录单词</Button>
            }
          />
        ) : (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {todayDue === 0 ? (
              <AlertBanner type="info">今日待复习为 0，你可以预习队列中最近的单词。</AlertBanner>
            ) : (
              <AlertBanner type="info">今日待复习：{todayDue} 个</AlertBanner>
            )}
            <Input
              type="number"
              label="本次复习数量（1-100）"
              value={batchSize}
              min={1}
              max={100}
              onChange={(e) => setBatchSize(Number(e.target.value))}
            />
            <Button onClick={() => void start()} size="lg" className="w-full">
              开始复习（队列 {remaining} 个）
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (phase === 'finish') {
    const counts = results.reduce<Record<number, number>>((acc, r) => {
      acc[r.rating] = (acc[r.rating] ?? 0) + 1;
      return acc;
    }, {});
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="text-4xl">🎉</div>
          <h2 className="mt-2 text-xl font-bold text-slate-900">本轮完成！</h2>
          <p className="mt-1 text-sm text-slate-500">共复习 {results.length} 个单词</p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {([1, 2, 3, 4] as Rating[]).map((r) => (
              <div key={r} className="rounded-lg bg-slate-50 p-2">
                <div className="text-lg font-bold text-slate-800">{counts[r] ?? 0}</div>
                <div className="text-xs text-slate-500">{RATING_LABEL[r]}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          {results.map((r) => (
            <div
              key={r.cardId}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm"
            >
              <span className="font-medium text-slate-800">{r.word}</span>
              <span className="text-slate-500">{RATING_LABEL[r.rating]}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={reset} className="flex-1">
            再复习一轮
          </Button>
          <Button onClick={() => navigate('/')} className="flex-1">
            返回首页
          </Button>
        </div>
      </div>
    );
  }

  const current = items[index];
  if (!current) return null;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          {index + 1} / {items.length}
        </span>
        <button type="button" onClick={reset} className="text-slate-400 hover:text-slate-600">
          退出
        </button>
      </div>

      {phase === 'recognition' ? (
        <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-10 shadow-sm">
          <p className="mb-2 text-xs text-slate-400">想到意思了吗？</p>
          <h2 className="mb-8 text-center text-4xl font-bold tracking-wide text-slate-900">
            {current.card.word}
          </h2>
          <div className="flex w-full max-w-xs flex-col gap-3">
            {RECOGNITION_BUTTONS.map((b) => (
              <Button
                key={b.label}
                size="lg"
                className={b.className}
                onClick={() => handleRecognized(b.value)}
              >
                {b.label}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <CardFace card={current.card} />
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-600">先判断「{current.card.word}」对错</p>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                {remember ? '你选了：记得' : '你选了：不记得'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {CARD_BUTTONS.map((b) => (
                <Button
                  key={b.label}
                  size="lg"
                  className={b.className}
                  disabled={saving}
                  onClick={() => void handleCardRating(b.value)}
                >
                  {b.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}