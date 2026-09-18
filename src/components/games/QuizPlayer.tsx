import type { ReactNode } from 'react';
import type {
  ClozeQuestion,
  HighlightedWord,
  Question,
  ReadingQuestion,
} from '../../types';
import { findWordMatches } from '../../games/findWords';
import { Button } from '../common/Button';

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

function renderHighlighted(passage: string, highlights: HighlightedWord[]): ReactNode[] {
  const seen = new Set<number>();
  const sorted = highlights
    .filter((h) => h.text && h.text.trim().length > 0)
    .flatMap((h) => findWordMatches(passage, h.text))
    .filter((m) => {
      if (seen.has(m.start)) return false;
      seen.add(m.start);
      return true;
    })
    .sort((a, b) => a.start - b.start)
    .filter((h) => h.start >= 0 && h.end > h.start && h.end <= passage.length);
  if (sorted.length === 0) return [passage];
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  for (const h of sorted) {
    if (h.start < cursor) continue;
    if (h.start > cursor) {
      nodes.push(passage.slice(cursor, h.start));
    }
    nodes.push(
      <mark key={key++} className="rounded bg-amber-200/70 px-0.5 text-amber-900">
        {passage.slice(h.start, h.end)}
      </mark>
    );
    cursor = h.end;
  }
  if (cursor < passage.length) nodes.push(passage.slice(cursor));
  return nodes;
}

function Options({
  options,
  selected,
  onSelect,
  numbered,
}: {
  options: string[];
  selected?: string;
  onSelect: (v: string) => void;
  numbered?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      {options.map((opt, i) => {
        const active = opt === selected;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(opt)}
            className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
              active
                ? 'border-brand-500 bg-brand-50 text-brand-800'
                : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-slate-50'
            }`}
          >
            {numbered && (
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                {OPTION_LABELS[i] ?? i + 1}
              </span>
            )}
            <span className="flex-1">{opt}</span>
          </button>
        );
      })}
    </div>
  );
}

function ClozePlayer({
  question,
  answers,
  onAnswer,
}: {
  question: ClozeQuestion;
  answers: Record<number, string>;
  onAnswer: (index: number, value: string) => void;
}) {
  const passage = question.content.passage;
  const blanks = [...question.content.blanks].sort((a, b) => a.index - b.index);
  const segments = passage.split(/_{4,}/);
  const children: ReactNode[] = [];

  segments.forEach((seg, i) => {
    children.push(<span key={`s${i}`}>{seg}</span>);
    const blank = blanks.find((b) => b.index === i);
    if (blank) {
      const selected = answers[blank.index];
      children.push(
        <span
          key={`b${i}`}
          className={`inline-block min-w-28 rounded border-b-2 px-2 pb-0.5 text-center ${
            selected ? 'border-brand-500 bg-brand-50' : 'border-slate-300'
          }`}
        >
          {selected || '\u00A0'}
        </span>
      );
    }
  });

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="text-sm leading-7 text-slate-800">{children}</div>
        <p className="text-xs text-slate-400">点击下方空白编号，从 4 个选项中选出答案。</p>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {blanks.map((blank) => (
          <div key={blank.index} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                {blank.index + 1}
              </span>
              <span className="text-sm font-medium text-slate-600">第 {blank.index + 1} 空</span>
            </div>
            <Options
              options={blank.options}
              selected={answers[blank.index]}
              onSelect={(v) => onAnswer(blank.index, v)}
              numbered
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ReadingPlayer({
  question,
  answers,
  onAnswer,
}: {
  question: ReadingQuestion;
  answers: Record<number, string>;
  onAnswer: (index: number, value: string) => void;
}) {
  const questions = [...question.content.questions].sort((a, b) => a.index - b.index);
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 leading-7 text-slate-800">
        {renderHighlighted(question.content.passage, question.highlightedWords)}
      </div>
      {questions.map((q) => (
        <div key={q.index} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-start gap-2">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
              {q.index + 1}
            </span>
            <p className="text-sm font-medium leading-6 text-slate-800">{q.stem}</p>
          </div>
          <Options options={q.options} selected={answers[q.index]} onSelect={(v) => onAnswer(q.index, v)} numbered />
        </div>
      ))}
    </div>
  );
}

interface Props {
  question: Question;
  index: number;
  total: number;
  answers: Record<number, string>;
  onAnswer: (index: number, value: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
}

export function QuizPlayer({
  question,
  index,
  total,
  answers,
  onAnswer,
  onPrev,
  onNext,
  onSubmit,
}: Props) {
  const items = question.type === 'cloze'
    ? (question.content as ClozeQuestion['content']).blanks
    : (question.content as ReadingQuestion['content']).questions;
  const answeredCount = items.filter((it) => answers[it.index]).length;
  const allAnswered = answeredCount === items.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          题目 {index + 1} / {total}
        </span>
        <span>
          已答 {answeredCount} / {items.length}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-brand-500 transition-all"
          style={{ width: `${(answeredCount / items.length) * 100}%` }}
        />
      </div>

      {question.type === 'cloze' ? (
        <ClozePlayer
          question={question as ClozeQuestion}
          answers={answers}
          onAnswer={onAnswer}
        />
      ) : (
        <ReadingPlayer
          question={question as ReadingQuestion}
          answers={answers}
          onAnswer={onAnswer}
        />
      )}

      <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-4">
        <Button variant="secondary" onClick={onPrev} disabled={index === 0}>
          ← 上一题
        </Button>
        {index < total - 1 ? (
          <Button onClick={onNext}>下一题 →</Button>
        ) : (
          <Button onClick={onSubmit} disabled={!allAnswered}>
            提交作答
          </Button>
        )}
      </div>
    </div>
  );
}