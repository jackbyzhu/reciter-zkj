import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { deleteCard } from '../services/mutations';
import { matchQuery } from '../services/cards';
import { useCardStore, type CardSort } from '../stores/cardStore';
import { useShallow } from 'zustand/react/shallow';
import { useSettings } from '../stores/settingsStore';
import { Button } from '../components/common/Button';
import { Input, Select } from '../components/common/Input';
import { AlertBanner, EmptyState } from '../components/common/Feedback';
import { ConfirmDialog } from '../components/common/Dialog';
import { CardFace } from '../components/cards/CardFace';
import type { Card, ReviewState } from '../types';

function DueChip({ state }: { state?: ReviewState }) {
  if (!state) return <span className="text-xs text-slate-400">—</span>;
  const diffDays = Math.floor((state.due - Date.now()) / 86_400_000);
  let text: string;
  let cls: string;
  if (diffDays < 0) {
    text = `已逾期 ${-diffDays} 天`;
    cls = 'bg-red-50 text-red-600';
  } else if (diffDays === 0) {
    text = '今日到期';
    cls = 'bg-amber-50 text-amber-600';
  } else if (diffDays < 30) {
    text = `还有 ${diffDays} 天`;
    cls = 'bg-emerald-50 text-emerald-600';
  } else {
    text = '已熟练';
    cls = 'bg-slate-100 text-slate-500';
  }
  return <span className={`rounded px-1.5 py-0.5 text-xs ${cls}`}>{text}</span>;
}

export function WordLibrary() {
  const navigate = useNavigate();
  const settings = useSettings();
  const libraryView = settings.settings.libraryView;
  const cardStore = useCardStore(
    useShallow((s) => ({
      query: s.query,
      selectedTags: s.selectedTags,
      sort: s.sort,
      descending: s.descending,
      index: s.index,
      selectedIds: s.selectedIds,
      setQuery: s.setQuery,
      toggleTag: s.toggleTag,
      clearTags: s.clearTags,
      setSort: s.setSort,
      toggleDirection: s.toggleDirection,
      setIndex: s.setIndex,
      toggleSelect: s.toggleSelect,
      setSelectAll: s.setSelectAll,
      clearSelect: s.clearSelect,
    }))
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);

  const data = useLiveQuery(async () => {
    const cards = await db.cards.toArray();
    const states = await db.reviewStates.bulkGet(cards.map((c) => c.id));
    const stateMap = new Map<string, ReviewState>();
    cards.forEach((c, i) => {
      const s = states[i];
      if (s) stateMap.set(c.id, s);
    });
    return { cards: cards.filter((c) => !c.deletedAt), stateMap };
  }, []);

  const allCards = data?.cards ?? [];
  const stateMap = data?.stateMap ?? new Map();

  const allTags = useMemo(
    () => [...new Set(allCards.flatMap((c) => c.tags))].sort(),
    [allCards]
  );

  const filtered = useMemo(
    () => matchQuery(allCards, cardStore.query, cardStore.selectedTags),
    [allCards, cardStore.query, cardStore.selectedTags]
  );

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = cardStore.descending ? -1 : 1;
    arr.sort((a, b) => {
      if (cardStore.sort === 'due') {
        const da = stateMap.get(a.id)?.due ?? Number.POSITIVE_INFINITY;
        const db2 = stateMap.get(b.id)?.due ?? Number.POSITIVE_INFINITY;
        return da - db2;
      }
      const key = cardStore.sort;
      const va = a[key] as number;
      const vb = b[key] as number;
      return (va - vb) * dir;
    });
    return arr;
  }, [filtered, cardStore.sort, cardStore.descending, stateMap]);

  useEffect(() => {
    if (sorted.length === 0) {
      cardStore.setIndex(0);
      return;
    }
    if (cardStore.index >= sorted.length) {
      cardStore.setIndex(sorted.length - 1);
    }
  }, [sorted.length, cardStore]);

  const current = sorted[cardStore.index];

  useEffect(() => {
    if (libraryView !== 'card') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') cardStore.setIndex(Math.max(0, cardStore.index - 1));
      if (e.key === 'ArrowRight') cardStore.setIndex(Math.min(sorted.length - 1, cardStore.index + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [libraryView, cardStore, sorted.length, cardStore.index]);

  async function handleDelete() {
    if (current) {
      await deleteCard(current.id);
      setConfirmDelete(false);
    }
  }

  async function handleBatchDelete() {
    await Promise.all(cardStore.selectedIds.map((id) => deleteCard(id)));
    cardStore.clearSelect();
    setConfirmBatchDelete(false);
  }

  const sortLabels: Record<string, string> = {
    createdAt: '录入时间',
    updatedAt: '更新时间',
    due: '下次复习',
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">单词库</h1>
          <p className="mt-0.5 text-sm text-slate-500">共 {sorted.length} 个单词</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white">
            <button
              type="button"
              onClick={() => settings.patch({ libraryView: 'card' })}
              className={`px-3 py-1.5 text-sm ${libraryView === 'card' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              卡片
            </button>
            <button
              type="button"
              onClick={() => settings.patch({ libraryView: 'list' })}
              className={`px-3 py-1.5 text-sm ${libraryView === 'list' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              列表
            </button>
          </div>
          <Button onClick={() => navigate('/add')} size="sm">
            ＋ 添加
          </Button>
        </div>
      </div>

      {error && <AlertBanner onClose={() => setError(null)}>{error}</AlertBanner>}

      {allCards.length === 0 ? (
        <EmptyState
          icon="📚"
          title="单词库为空"
          description="先录入几个单词，AI 会自动生成记忆卡片。"
          action={<Button onClick={() => navigate('/add')}>去录单词</Button>}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="搜索单词 / 释义…"
              value={cardStore.query}
              onChange={(e) => cardStore.setQuery(e.target.value)}
              className="!w-56"
            />
            {allTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                {cardStore.selectedTags.length > 0 && (
                  <button
                    type="button"
                    onClick={cardStore.clearTags}
                    className="rounded-full px-2 py-0.5 text-xs text-slate-400 hover:text-slate-600"
                  >
                    清除
                  </button>
                )}
                {allTags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => cardStore.toggleTag(t)}
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      cardStore.selectedTags.includes(t)
                        ? 'bg-brand-600 text-white'
                        : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    #{t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {libraryView === 'list' && (
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={cardStore.sort}
                onChange={(e) => cardStore.setSort(e.target.value as CardSort)}
                className="!w-auto"
              >
                {Object.entries(sortLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    按{v}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                variant="secondary"
                onClick={cardStore.toggleDirection}
                disabled={cardStore.sort === 'due'}
              >
                {cardStore.descending ? '降序 ↓' : '升序 ↑'}
              </Button>
              {cardStore.selectedIds.length > 0 && (
                <Button size="sm" variant="danger" onClick={() => setConfirmBatchDelete(true)}>
                  批量删除（{cardStore.selectedIds.length}）
                </Button>
              )}
            </div>
          )}

          {sorted.length === 0 ? (
            <EmptyState
              icon="🔍"
              title="没有匹配的单词"
              description="换个关键词或清除筛选试试。"
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    cardStore.setQuery('');
                    cardStore.clearTags();
                  }}
                >
                  清除筛选
                </Button>
              }
            />
          ) : libraryView === 'card' && current ? (
            <div
              className="relative"
              onTouchStart={(e) => {
                touchStartX.current = e.touches[0].clientX;
              }}
              onTouchEnd={(e) => {
                if (touchStartX.current === null) return;
                const dx = e.changedTouches[0].clientX - touchStartX.current;
                touchStartX.current = null;
                if (dx < -40) cardStore.setIndex(Math.min(sorted.length - 1, cardStore.index + 1));
                else if (dx > 40) cardStore.setIndex(Math.max(0, cardStore.index - 1));
              }}
            >
              <CardFace card={current} />
              <button
                type="button"
                className="absolute -left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-lg text-slate-600 shadow disabled:opacity-30 sm:-left-6"
                disabled={cardStore.index === 0}
                onClick={() => cardStore.setIndex(cardStore.index - 1)}
                title={cardStore.index === 0 ? '已是最新' : '上一条（更新）'}
              >
                ‹
              </button>
              <button
                type="button"
                className="absolute -right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-lg text-slate-600 shadow disabled:opacity-30 sm:-right-6"
                disabled={cardStore.index >= sorted.length - 1}
                onClick={() => cardStore.setIndex(cardStore.index + 1)}
                title={cardStore.index >= sorted.length - 1 ? '已是最早' : '下一条（更早）'}
              >
                ›
              </button>
              <div className="mt-2 text-center text-xs text-slate-400">
                第 {cardStore.index + 1} / {sorted.length}
                {cardStore.index === 0 ? ' · 已是最新' : cardStore.index >= sorted.length - 1 ? ' · 已是最早' : ''}
              </div>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => navigate(`/library/${current.id}/edit`)}>
                  开始编辑 ✏️
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate(`/library/${current.id}`)}>
                  查看详情
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                  删除
                </Button>
              </div>
            </div>
          ) : (
            <VirtualList
              items={sorted}
              stateMap={stateMap}
              selectedIds={cardStore.selectedIds}
              onOpen={(card) => navigate(`/library/${card.id}`)}
              onToggle={cardStore.toggleSelect}
              onSelectAll={(ids, sel) => cardStore.setSelectAll(ids, sel)}
            />
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="删除单词"
        message={`确定删除「${current?.word ?? ''}」？删除后不会出现在队列中，但已生成的题目仍会保留。`}
        confirmText="删除"
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmDialog
        open={confirmBatchDelete}
        title="批量删除"
        message={`确定删除选中的 ${cardStore.selectedIds.length} 个单词？删除后不会出现在队列中。`}
        confirmText="删除"
        onConfirm={() => void handleBatchDelete()}
        onCancel={() => setConfirmBatchDelete(false)}
      />
    </div>
  );
}

function VirtualList({
  items,
  stateMap,
  selectedIds,
  onOpen,
  onToggle,
  onSelectAll,
}: {
  items: Card[];
  stateMap: Map<string, ReviewState>;
  selectedIds: string[];
  onOpen: (card: Card) => void;
  onToggle: (id: string) => void;
  onSelectAll: (ids: string[], selected: boolean) => void;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const ROW_H = 76;
  const VIEW_H = 460;
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - 5);
  const end = Math.min(items.length, start + Math.ceil(VIEW_H / ROW_H) + 10);
  const visible = items.slice(start, end);
  const allSelected = items.length > 0 && items.every((c) => selectedIds.includes(c.id));

  return (
    <div
      className="overflow-y-auto rounded-xl border border-slate-200 bg-white"
      style={{ height: VIEW_H }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={(e) => onSelectAll(items.map((c) => c.id), e.target.checked)}
          className="h-4 w-4"
        />
        <span className="text-xs text-slate-500">全选</span>
      </div>
      <div style={{ height: items.length * ROW_H, position: 'relative' }}>
        {visible.map((card, i) => {
          const abs = start + i;
          const selected = selectedIds.includes(card.id);
          return (
            <div
              key={card.id}
              style={{ position: 'absolute', top: abs * ROW_H, left: 0, right: 0, height: ROW_H }}
              className={`flex cursor-pointer items-center gap-2 border-b border-slate-50 px-3 hover:bg-brand-50/50 ${selected ? 'bg-brand-50' : ''}`}
              onClick={() => onOpen(card)}
            >
              <input
                type="checkbox"
                checked={selected}
                onClick={(e) => e.stopPropagation()}
                onChange={() => onToggle(card.id)}
                className="h-4 w-4 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate font-semibold text-slate-800">{card.word}</span>
                  <span className="truncate text-sm text-slate-500">{card.meaning}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                  {card.tags.slice(0, 3).map((t) => (
                    <span key={t}>#{t}</span>
                  ))}
                </div>
              </div>
              <DueChip state={stateMap.get(card.id)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}