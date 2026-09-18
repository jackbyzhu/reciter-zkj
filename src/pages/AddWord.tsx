import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { generateCard } from '../services/ai';
import { addCard, hardDeleteCard } from '../services/mutations';
import { isAIConfigured, useSettings } from '../stores/settingsStore';
import { Button } from '../components/common/Button';
import { Input, Textarea } from '../components/common/Input';
import { AlertBanner } from '../components/common/Feedback';
import { GeneratingState } from '../components/games/GeneratingState';
import {
  CardForm,
  type CardFormState,
  fromCardForm,
  toCardForm,
} from '../components/cards/CardForm';
import { CardFace } from '../components/cards/CardFace';
import type { Card } from '../types';

type Phase = 'input' | 'generating' | 'preview';

interface AddedRecord {
  cardId: string;
  word: string;
}

export function AddWord() {
  const settings = useSettings((s) => s.settings);
  const [params] = useSearchParams();
  const prefillWord = params.get('word') ?? '';
  const [phase, setPhase] = useState<Phase>('input');
  const [word, setWord] = useState(prefillWord);
  const [meaning, setMeaning] = useState('');
  const [preview, setPreview] = useState<CardFormState | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAdded, setLastAdded] = useState<AddedRecord | null>(null);
  const [justAdded, setJustAdded] = useState(false);

  const configured = isAIConfigured(settings);

  async function runGeneration(w: string, m: string) {
    setError(null);
    setPhase('generating');
    try {
      const partial = await generateCard(w, m, settings);
      const base = toCardForm(partial as Partial<Card> & { word: string });
      setPreview({ ...base, word: base.word || w });
      setPhase('preview');
    } catch (e) {
      const message = e instanceof Error ? e.message : '生成失败，请重试。';
      setError(message);
      setPhase('input');
    }
  }

  function handleGenerate() {
    if (!word.trim()) {
      setError('请输入要录入的单词。');
      return;
    }
    void runGeneration(word.trim(), meaning.trim());
  }

  async function handleSave() {
    if (!preview || !preview.word.trim()) {
      setError('单词不能为空。');
      return;
    }
    const base = fromCardForm(preview);
    const card = await addCard({
      ...base,
      word: preview.word.trim(),
      source: 'ai_generated',
    });
    setLastAdded({ cardId: card.id, word: card.word });
    setJustAdded(true);
    setWord('');
    setMeaning('');
    setPreview(null);
    setPhase('input');
  }

  async function handleUndo() {
    if (!lastAdded) return;
    await hardDeleteCard(lastAdded.cardId);
    setLastAdded(null);
    setJustAdded(false);
  }

  function handleDiscard() {
    setPreview(null);
    setPhase('input');
    setError(null);
    setEditing(false);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">录单词</h1>
        <p className="mt-1 text-sm text-slate-500">
          输入单词，AI 生成记忆卡片，预览编辑后入库。
        </p>
      </div>

      {!configured && (
        <AlertBanner type="warn">
          尚未配置 AI。请先到{' '}
          <Link to="/settings" className="font-semibold underline">
            设置
          </Link>{' '}
          页填入 API Key 或开启代理模式。
        </AlertBanner>
      )}

      {justAdded && lastAdded && (
        <AlertBanner type="info" onClose={() => setJustAdded(false)}>
          已录入「{lastAdded.word}」。
          <button
            type="button"
            onClick={() => void handleUndo()}
            className="ml-2 font-semibold underline"
          >
            撤销
          </button>
        </AlertBanner>
      )}

      {error && phase !== 'generating' && (
        <AlertBanner type="error" onClose={() => setError(null)}>
          {error}
        </AlertBanner>
      )}

      {phase === 'input' && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Input
            label="单词 *"
            placeholder="如：serendipity"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleGenerate();
            }}
            autoFocus
          />
          <Textarea
            label="意思（可选，填你的理解会帮助 AI）"
            placeholder="如：意外发现美好事物的运气"
            rows={2}
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
          />
          <div className="flex gap-2">
            <Button onClick={handleGenerate} disabled={!configured} className="flex-1">
              生成记忆卡片 ✨
            </Button>
          </div>
        </div>
      )}

      {phase === 'generating' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <GeneratingState
            title={`正在为「${word}」生成卡片`}
            subtitle="AI 正在分析单词，生成释义、助记和例句…"
            steps={['解析单词与发音', '生成释义与词根', '编写助记与例句', '校验卡片格式']}
          />
        </div>
      )}

      {phase === 'preview' && preview && (
        <div className="space-y-3">
          <CardFace
            card={
              {
                ...fromCardForm(preview),
                id: 'preview',
                createdAt: 0,
                updatedAt: 0,
                schemaVersion: 1,
                source: 'ai_generated',
              } as Card
            }
          />
          {editing ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">编辑卡片</h3>
                  <span className="text-xs text-slate-400">编辑内容不触发 AI 重新生成</span>
                </div>
                <CardForm value={preview} onChange={setPreview} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void handleSave()} className="flex-1">
                  保存并录入单词库 ✓
                </Button>
                <Button variant="secondary" onClick={() => setEditing(false)}>
                  收起编辑
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void handleSave()} className="flex-1">
                录入单词库 ✓
              </Button>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                开始编辑 ✏️
              </Button>
              <Button variant="secondary" onClick={() => void runGeneration(word.trim(), meaning.trim())}>
                重新生成
              </Button>
              <Button variant="ghost" onClick={handleDiscard}>
                丢弃
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}