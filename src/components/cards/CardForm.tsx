import type { Card } from '../../types';
import { Input, Textarea } from '../common/Input';
import { Button } from '../common/Button';

export interface CardFormState {
  word: string;
  pos: string;
  meaning: string;
  pronunciation: string;
  humorExplanation: string;
  roots: string;
  mnemonic: string;
  examples: { en: string; zh: string }[];
  tags: string;
}

export interface CardFormProps {
  value: CardFormState;
  onChange: (next: CardFormState) => void;
}

export function toCardForm(card: Partial<Card> & { word: string }): CardFormState {
  return {
    word: card.word ?? '',
    pos: card.pos ?? '',
    meaning: card.meaning ?? '',
    pronunciation: card.pronunciation ?? '',
    humorExplanation: card.humorExplanation ?? '',
    roots: card.roots ?? '',
    mnemonic: card.mnemonic ?? '',
    examples: card.examples ?? [],
    tags: (card.tags ?? []).join(', '),
  };
}

export function fromCardForm(form: CardFormState): Partial<Card> {
  return {
    word: form.word,
    pos: form.pos,
    meaning: form.meaning,
    pronunciation: form.pronunciation,
    humorExplanation: form.humorExplanation,
    roots: form.roots,
    mnemonic: form.mnemonic,
    examples: form.examples.map((e) => ({ en: e.en.trim(), zh: e.zh.trim() })).filter((e) => e.en),
    tags: form.tags
      .split(/[,，\s]+/)
      .map((t) => t.trim())
      .filter(Boolean),
  };
}

export function CardForm({ value, onChange }: CardFormProps) {
  const set = (patch: Partial<CardFormState>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="单词 *" value={value.word} onChange={(e) => set({ word: e.target.value })} />
        <Input
          label="词性"
          value={value.pos}
          onChange={(e) => set({ pos: e.target.value })}
          placeholder="如：n. 名词 / v. 动词"
        />
      </div>
      <Input
        label="释义"
        value={value.meaning}
        onChange={(e) => set({ meaning: e.target.value })}
      />
      <Input
        label="音标"
        value={value.pronunciation}
        onChange={(e) => set({ pronunciation: e.target.value })}
        placeholder="/əˈnæləsɪs/"
      />
      <Textarea
        label="趣味解释"
        rows={2}
        value={value.humorExplanation}
        onChange={(e) => set({ humorExplanation: e.target.value })}
      />
      <Textarea
        label="词根词缀"
        rows={2}
        value={value.roots}
        onChange={(e) => set({ roots: e.target.value })}
      />
      <Textarea
        label="助记口诀"
        rows={2}
        value={value.mnemonic}
        onChange={(e) => set({ mnemonic: e.target.value })}
      />
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-600">例句</span>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => set({ examples: [...value.examples, { en: '', zh: '' }] })}
          >
            + 添加
          </Button>
        </div>
        <div className="space-y-2">
          {value.examples.map((ex, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="grid flex-1 grid-cols-1 gap-1.5 sm:grid-cols-2">
                <input
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                  placeholder="英文例句"
                  value={ex.en}
                  onChange={(e) =>
                    set({
                      examples: value.examples.map((x, j) =>
                        j === i ? { ...x, en: e.target.value } : x
                      ),
                    })
                  }
                />
                <input
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                  placeholder="中文翻译"
                  value={ex.zh}
                  onChange={(e) =>
                    set({
                      examples: value.examples.map((x, j) =>
                        j === i ? { ...x, zh: e.target.value } : x
                      ),
                    })
                  }
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  set({ examples: value.examples.filter((_, j) => j !== i) })
                }
                className="mt-1 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-500"
                aria-label="删除例句"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
      <Input
        label="标签（逗号分隔）"
        value={value.tags}
        onChange={(e) => set({ tags: e.target.value })}
        placeholder="四级, 考研, 科技"
      />
    </div>
  );
}