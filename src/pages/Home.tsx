import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { EmptyState } from '../components/common/Feedback';

export function Home() {
  const stats = useLiveQuery(
    async () => {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const todayDue = await db.reviewStates
        .where('due')
        .belowOrEqual(end.getTime())
        .count();
      const all = await db.cards.toArray();
      const active = all.filter((c) => !c.deletedAt);
      const states = await db.reviewStates.bulkGet(active.map((c) => c.id));
      const reviewed = states.filter((s) => s && s.reps > 0).length;
      const questionCount = await db.questions.count();
      return { total: active.length, todayDue, reviewed, questionCount };
    },
    [],
    { total: 0, todayDue: 0, reviewed: 0, questionCount: 0 }
  );

  if (!stats.total) {
    return (
      <EmptyState
        icon="📚"
        title="还没有单词"
        description="先录入第一个单词吧。输入单词，AI 会自动生成记忆卡片。"
        action={
          <Link
            to="/add"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            去录单词
          </Link>
        }
      />
    );
  }

  const quickLinks: {
    to: string;
    title: string;
    desc: string;
    accent: string;
    icon: string;
    wide?: boolean;
  }[] = [
    { to: '/review', title: '回顾单词', desc: stats.todayDue > 0 ? `今日待复习 ${stats.todayDue} 个` : '今天的都复习完啦', accent: 'bg-brand-600', icon: '🔁' },
    { to: '/add', title: '录单词', desc: '录入新词，AI 生成卡片', accent: 'bg-emerald-600', icon: '➕' },
    { to: '/library', title: '单词库', desc: `共 ${stats.total} 个单词`, accent: 'bg-amber-500', icon: '📚' },
    { to: '/practice', title: '刷题', desc: stats.questionCount > 0 ? '继续刷题巩固' : '生成新题练一练', accent: 'bg-purple-600', icon: '🎯' },
    { to: '/curve', title: '记忆曲线', desc: '看看哪些单词快要忘了', accent: 'bg-sky-600', icon: '📈', wide: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">今天也要记得牢 🧠</h1>
        <p className="mt-1 text-sm text-slate-500">
          坚持每天复习，记忆会越来越稳。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-2xl font-bold text-brand-600">{stats.total}</div>
          <div className="mt-1 text-xs text-slate-500">单词总数</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-2xl font-bold text-red-500">{stats.todayDue}</div>
          <div className="mt-1 text-xs text-slate-500">今日待复习</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-2xl font-bold text-emerald-600">{stats.reviewed}</div>
          <div className="mt-1 text-xs text-slate-500">已复习过</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-2xl font-bold text-purple-600">{stats.questionCount}</div>
          <div className="mt-1 text-xs text-slate-500">题库题目</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {quickLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={`flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50/40 ${link.wide ? 'sm:col-span-2' : ''}`}
          >
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg text-white ${link.accent}`}
            >
              {link.icon}
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-800">{link.title}</span>
              <span className="block text-xs text-slate-500">{link.desc}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}