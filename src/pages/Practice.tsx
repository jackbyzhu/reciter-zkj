import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useGameStore } from '../stores/gameStore';
import { useSettings } from '../stores/settingsStore';
import { getRule } from '../games/registry';
import { Button } from '../components/common/Button';
import { Input, Select } from '../components/common/Input';
import { AlertBanner, EmptyState } from '../components/common/Feedback';
import { ConfirmDialog } from '../components/common/Dialog';
import { GeneratingState } from '../components/games/GeneratingState';
import { QuizPlayer } from '../components/games/QuizPlayer';
import type { QuestionType } from '../types';

function LearnStrip({ wordIds }: { wordIds: string[] }) {
  const [open, setOpen] = useState(true);
  const cards = useLiveQuery(() => db.cards.bulkGet(wordIds), [wordIds]) ?? [];

  const rows = wordIds.map((_id, i) => {
    const card = cards[i];
    return {
      card,
      missing: !card,
    };
  });
  const missingCount = rows.filter((r) => r.missing).length;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <span className="text-sm font-semibold text-slate-700">📌 边练边学 · 本组单词</span>
        <span className="flex items-center gap-2">
          {missingCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              {missingCount} 个未收录
            </span>
          )}
          <span className={`text-xs text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
        </span>
      </button>
      {open && (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {rows.map((r, i) => {
            return (
              <li key={wordIds[i]} className="flex items-center gap-3 px-5 py-2.5">
                <span className="text-xs font-medium text-slate-400">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-800">
                    {r.card?.word ?? '未收录单词'}
                    {r.card?.pos && (
                      <span className="ml-2 font-normal text-xs text-brand-600">
                        {r.card.pos}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {r.card?.meaning ?? '该词已从词库移除，可在“录单词”中重新收录'}
                  </span>
                </span>
                {r.card ? (
                  <Link
                    to={`/library/${r.card.id}`}
                    className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-brand-300 hover:text-brand-600"
                  >
                    查看
                  </Link>
                ) : (
                  <Link
                    to="/add"
                    className="shrink-0 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-brand-700"
                  >
                    + 收录
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function Practice() {
  const navigate = useNavigate();
  const game = useGameStore();
  const settings = useSettings((s) => s.settings);
  const [discardOpen, setDiscardOpen] = useState(false);

  if (game.status === 'done') {
    return <Navigate to="/practice/result" replace />;
  }

  if (game.status === 'generating') {
    return (
      <div className="mx-auto max-w-xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <GeneratingState
            title={`正在生成${game.ruleId ? getRule(game.ruleId).name : ''}题目`}
            subtitle={`按到期顺序取队首 ${game.count} 个单词，正在构思一档好题…`}
          />
        </div>
      </div>
    );
  }

  if (game.status === 'new-rule') {
    const enabledRules = settings.gameRulesEnabled;
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">选择题型</h1>
        {enabledRules.length === 0 ? (
          <EmptyState
            icon="🎲"
            title="未启用任何题型"
            description="到设置页开启完形填空 / 阅读理解。"
            action={<Button onClick={() => navigate('/settings')}>去设置</Button>}
          />
        ) : (
          <div className="space-y-3">
            {enabledRules.map((id) => {
              const rule = getRule(id as QuestionType);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => game.chooseRule(id as QuestionType)}
                  className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-xl text-white">
                    {id === 'cloze' ? '◻' : '📖'}
                  </span>
                  <span>
                    <span className="block text-base font-semibold text-slate-800">
                      {rule.name}
                    </span>
                    <span className="block text-sm text-slate-500">{rule.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <Button variant="ghost" onClick={game.reset}>
          ← 返回
        </Button>
      </div>
    );
  }

  if (game.status === 'new-count') {
    const rule = game.ruleId ? getRule(game.ruleId) : null;
    const presets = settings.generationPresets ?? [];
    const selectedPreset = presets.find((p) => p.id === game.presetId);
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">{rule?.name ?? '出题'}</h1>
        {game.error && <AlertBanner onClose={game.clearError}>{game.error}</AlertBanner>}
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Input
            type="number"
            label="取队列前几个单词用来出题"
            value={game.count}
            min={1}
            max={50}
            onChange={(e) => game.setCount(Number(e.target.value))}
            hint={`从单词队列按到期顺序取队首 ${game.count} 个。`}
          />
          <div className="grid grid-cols-1 gap-3">
            <Select
              label="生成方案"
              value={game.presetId ?? ''}
              onChange={(e) => game.setPreset(e.target.value || null)}
            >
              <option value="">默认方案（题材多样）</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.genre ? ` · ${p.genre}` : ''}
                </option>
              ))}
            </Select>
            {selectedPreset && (
              <div className="rounded-xl bg-paper-100/70 px-3 py-2 text-sm text-slate-600">
                {selectedPreset.genre && (
                  <p>
                    <span className="font-medium text-slate-500">文章性质：</span>
                    {selectedPreset.genre}
                  </p>
                )}
                {selectedPreset.instruction && (
                  <p className="mt-1 whitespace-pre-wrap">
                    <span className="font-medium text-slate-500">补充要求：</span>
                    {selectedPreset.instruction}
                  </p>
                )}
                {!selectedPreset.genre && !selectedPreset.instruction && (
                  <p className="text-slate-400">该方案未配置性质与提示，仅使用全局生成偏好。</p>
                )}
              </div>
            )}
          </div>
          <Button size="lg" className="w-full" onClick={() => void game.startNew()}>
            生成题目 ✨
          </Button>
        </div>
        <Button variant="ghost" onClick={game.reset}>
          ← 返回
        </Button>
      </div>
    );
  }

  if (game.status === 'playing' && game.questions.length > 0) {
    const question = game.questions[game.currentIndex];
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-brand-600 px-2 py-0.5 text-xs font-medium text-white">
              {game.mode === 'new' ? '新题' : '刷现有题'}
            </span>
            <span className="text-sm text-slate-500">
              {question.type === 'cloze' ? '完形填空' : '阅读理解'}
            </span>
            {game.currentIndex > 0 && (
              <span className="text-xs text-slate-400">
                第 {game.currentIndex + 1} / {game.questions.length} 题
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-brand-300 hover:text-brand-600"
              title="暂存本场，之后可回来继续"
            >
              暂存退出
            </button>
            <button
              type="button"
              onClick={() => setDiscardOpen(true)}
              className="text-sm text-slate-400 hover:text-red-500"
            >
              放弃
            </button>
          </div>
        </div>
        <QuizPlayer
          question={question}
          index={game.currentIndex}
          total={game.questions.length}
          answers={game.answers[question.id] ?? {}}
          onAnswer={(idx, v) => game.answer(question.id, idx, v)}
          onPrev={() => game.goTo(game.currentIndex - 1)}
          onNext={() => game.goTo(game.currentIndex + 1)}
          onSubmit={() => void game.submit()}
        />
        <LearnStrip wordIds={question.wordIds} />
        <ConfirmDialog
          open={discardOpen}
          title="放弃本场练习？"
          message="放弃后本场进度会被清空，下次需要重新生成题目。"
          confirmText="放弃"
          onConfirm={() => {
            setDiscardOpen(false);
            game.reset();
          }}
          onCancel={() => setDiscardOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">刷题</h1>
        <p className="mt-1 text-sm text-slate-500">生成新题目，或刷已有题目巩固记忆。</p>
      </div>

      {game.error && (
        <AlertBanner onClose={game.clearError}>{game.error}</AlertBanner>
      )}

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => game.enterNew()}
          className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50/40"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-xl text-white">
              ✨
            </span>
            <span>
              <span className="block text-base font-semibold text-slate-800">生成新题</span>
              <span className="block text-sm text-slate-500">完形填空 / 阅读理解，按队列单词出题</span>
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => void game.startExisting()}
          className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50/40"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-600 text-xl text-white">
              📝
            </span>
            <span>
              <span className="block text-base font-semibold text-slate-800">刷现有题</span>
              <span className="block text-sm text-slate-500">按题目权重排序出题</span>
            </span>
          </span>
        </button>
        {game.loadingExisting && (
          <AlertBanner type="info">正在加载题目…</AlertBanner>
        )}
      </div>
    </div>
  );
}