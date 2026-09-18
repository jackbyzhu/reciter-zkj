import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { updateCard } from '../services/mutations';
import { generateCard } from '../services/ai';
import { useSettings } from '../stores/settingsStore';
import { Button } from '../components/common/Button';
import { AlertBanner, EmptyState } from '../components/common/Feedback';
import { ConfirmDialog } from '../components/common/Dialog';
import { GeneratingState } from '../components/games/GeneratingState';
import {
  CardForm,
  type CardFormState,
  fromCardForm,
  toCardForm,
} from '../components/cards/CardForm';
import type { Card } from '../types';

export function EditCard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const settings = useSettings((s) => s.settings);

  const card = useLiveQuery(async () => {
    if (!id) return undefined;
    return db.cards.get(id);
  }, [id]);

  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState<CardFormState | null>(null);

  const currentForm = formState ?? (card && !card.deletedAt ? toCardForm(card) : null);

  if (!id) return null;
  if (card === undefined) return null;

  if (!card || card.deletedAt) {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState
          icon="🔍"
          title="未找到该单词"
          description="可能已被删除。"
          action={<Button onClick={() => navigate('/library')}>返回单词库</Button>}
        />
      </div>
    );
  }

  const cardId = id;
  const currentCard = card;

  async function handleSave(backToDetail: boolean) {
    if (!currentForm) return;
    if (!currentForm.word.trim()) {
      setError('单词不能为空。');
      return;
    }
    setSaving(true);
    try {
      await updateCard(
        cardId,
        fromCardForm(currentForm) as Parameters<typeof updateCard>[1]
      );
      setFormState(null);
      navigate(backToDetail ? `/library/${cardId}` : '/library');
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerate() {
    setConfirmRegenerate(false);
    setGenerating(true);
    setError(null);
    try {
      const partial = await generateCard(currentCard.word, currentCard.meaning, settings);
      const next = toCardForm(partial as Partial<Card> & { word: string });
      setFormState({ ...currentForm!, ...next, word: next.word || currentCard.word });
    } catch (e) {
      setError(e instanceof Error ? e.message : '重新生成失败');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/library" className="hover:text-brand-600">单词库</Link>
        <span>/</span>
        <Link to={`/library/${cardId}`} className="hover:text-brand-600">
          {currentCard.word}
        </Link>
        <span>/</span>
        <span className="text-slate-700">编辑</span>
      </nav>

      {error && <AlertBanner onClose={() => setError(null)}>{error}</AlertBanner>}

      {generating ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <GeneratingState
            title={`正在重新生成「${currentCard.word}」`}
            subtitle="将保持原单词，更新释义、词根与助记等内容…"
          />
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {currentForm && (
            <CardForm value={currentForm} onChange={setFormState} />
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={() => void handleSave(true)} disabled={saving} className="flex-1">
              {saving ? '保存中…' : '保存 ✨'}
            </Button>
            <Button variant="secondary" onClick={() => void handleSave(false)} disabled={saving}>
              保存并返回词库
            </Button>
            <Button
              variant="ghost"
              onClick={() => setConfirmRegenerate(true)}
              disabled={saving}
            >
              AI 重新生成
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmRegenerate}
        title="重新生成"
        message={`即将调用 AI 重新生成「${currentCard.word}」的全部卡片内容，当前编辑内容会被覆盖，确定继续？`}
        confirmText="开始生成"
        danger={false}
        onConfirm={() => void handleRegenerate()}
        onCancel={() => setConfirmRegenerate(false)}
      />
    </div>
  );
}