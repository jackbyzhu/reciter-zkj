import { Navigate, useNavigate } from 'react-router-dom';
import { useGameStore, type QuestionResultEntry } from '../stores/gameStore';
import { Button } from '../components/common/Button';
import type { ClozeQuestion, Question, ReadingQuestion } from '../types';

function ClozeDetail({
  question,
  myAnswers,
}: {
  question: ClozeQuestion;
  myAnswers: Record<number, string>;
}) {
  const blanks = [...question.content.blanks].sort((a, b) => a.index - b.index);
  return (
    <div>
      <div className="mb-2 max-h-40 overflow-y-auto rounded-lg bg-slate-50 p-3 text-sm leading-7 text-slate-700">
        {question.content.passage}
      </div>
      <ul className="space-y-2">
        {blanks.map((b) => {
          const mine = myAnswers[b.index];
          const ok = !!mine && mine.trim().toLowerCase() === b.answer.trim().toLowerCase();
          return (
            <li key={b.index} className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                {b.index + 1}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {ok ? (
                  <span className="text-emerald-600">✓</span>
                ) : (
                  <span className="text-red-500">✗</span>
                )}
                <span className="text-slate-600">你的答案：<b className={ok ? 'text-emerald-700' : 'text-red-600'}>{mine || '—'}</b></span>
                {!ok && (
                  <span className="text-slate-600">正确答案：<b className="text-emerald-700">{b.answer}</b></span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ReadingDetail({
  question,
  myAnswers,
}: {
  question: ReadingQuestion;
  myAnswers: Record<number, string>;
}) {
  const sub = [...question.content.questions].sort((a, b) => a.index - b.index);
  return (
    <div className="space-y-3">
      {question.translation && (
        <div className="rounded-lg bg-sky-50 p-3 text-sm leading-6 text-sky-800">
          <div className="mb-1 text-xs font-semibold text-sky-500">译文</div>
          {question.translation}
        </div>
      )}
      <div className="max-h-40 overflow-y-auto rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">
        {question.content.passage}
      </div>
      <ul className="space-y-2">
        {sub.map((q) => {
          const mine = myAnswers[q.index];
          const ok = !!mine && mine.trim().toLowerCase() === q.answer.trim().toLowerCase();
          return (
            <li key={q.index} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                  {q.index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-slate-800">{q.stem}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {ok ? (
                      <span className="text-emerald-600">✓</span>
                    ) : (
                      <span className="text-red-500">✗</span>
                    )}
                    <span className="text-slate-600">你的答案：<b className={ok ? 'text-emerald-700' : 'text-red-600'}>{mine || '—'}</b></span>
                    {!ok && (
                      <span className="text-slate-600">正确答案：<b className="text-emerald-700">{q.answer}</b></span>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DetailCard({
  question,
  myAnswers,
  result,
}: {
  question: Question;
  myAnswers: Record<number, string>;
  result: QuestionResultEntry;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-brand-600 px-2 py-0.5 text-xs font-medium text-white">
            {question.type === 'cloze' ? '完形填空' : '阅读理解'}
          </span>
          <span className="text-xs text-slate-500">难度 {question.difficulty}</span>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            result.isCorrect ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
          }`}
        >
          {result.correctCount}/{result.totalCount} {result.isCorrect ? '✓' : '✗'}
        </span>
      </div>

      {question.type === 'cloze' ? (
        <ClozeDetail question={question as ClozeQuestion} myAnswers={myAnswers} />
      ) : (
        <ReadingDetail question={question as ReadingQuestion} myAnswers={myAnswers} />
      )}

      {question.explanation && (
        <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900">
          <div className="mb-1 text-xs font-semibold text-amber-600">解析</div>
          {question.explanation}
        </div>
      )}
    </div>
  );
}

export function PracticeResult() {
  const navigate = useNavigate();
  const game = useGameStore();
  const { result, questions, answers } = game;

  if (!result || game.status !== 'done' || questions.length === 0) {
    return <Navigate to="/practice" replace />;
  }

  const accuracy = result.totalCount
    ? Math.round((result.correctCount / result.totalCount) * 100)
    : 0;

  const accuracyColor =
    accuracy >= 80 ? 'text-emerald-600' : accuracy >= 60 ? 'text-amber-500' : 'text-red-500';

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="text-5xl">{accuracy >= 80 ? '🏆' : accuracy >= 60 ? '💪' : '📖'}</div>
        <div className={`mt-2 text-4xl font-bold ${accuracyColor}`}>{accuracy}%</div>
        <p className="mt-1 text-sm text-slate-500">
          共 {result.questionCount} 题 · 答对 {result.correctCount}/{result.totalCount} 个空
        </p>
      </div>

      {questions.map((q, i) => (
        <DetailCard
          key={q.id}
          question={q}
          myAnswers={answers[q.id] ?? {}}
          result={result.perQuestion[i]!}
        />
      ))}

      <Button size="lg" className="w-full" onClick={() => {
        game.reset();
        navigate('/');
      }}>
        完成 🎉
      </Button>
    </div>
  );
}