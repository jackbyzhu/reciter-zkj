const DEFAULT_STEPS = ['读取复习队列', '挑选单词', '调用 AI 生成内容', '校验格式与答案'];

export function GeneratingState({
  title,
  subtitle,
  steps = DEFAULT_STEPS,
}: {
  title: string;
  subtitle?: string;
  steps?: string[];
}) {
  return (
    <div className="flex flex-col items-center py-6">
      <div className="relative mb-6 flex h-16 w-16 items-center justify-center">
        <span className="gen-icon absolute inset-0 rounded-full bg-brand-500/20" />
        <span className="gen-spin-dual absolute -inset-1 rounded-full border-2 border-dashed border-brand-300" />
        <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-2xl text-white">
          ✨
        </span>
      </div>

      <h2 className="text-lg font-bold text-slate-900">
        {title}
        <span className="ml-1 inline-flex text-brand-600">
          <span className="gen-dot" />
          <span className="gen-dot" />
          <span className="gen-dot" />
        </span>
      </h2>
      {subtitle && <p className="mt-1 text-center text-sm text-slate-500">{subtitle}</p>}

      <div className="mt-7 w-full max-w-sm space-y-2.5">
        {steps.map((step, i) => (
          <div
            key={step}
            className="anim-fade-up flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/70 px-3.5 py-2.5"
            style={{ animationDelay: `${0.15 + i * 0.55}s` }}
          >
            <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
              <span className="h-2 w-2 animate-ping rounded-full bg-brand-400/70" />
              <span className="absolute h-1.5 w-1.5 rounded-full bg-brand-600" />
            </span>
            <span className="text-sm text-slate-600">{step}</span>
          </div>
        ))}
      </div>

      <div className="mt-7 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-slate-100">
        <div className="gen-shimmer h-full w-2/5 rounded-full bg-gradient-to-r from-brand-400 via-brand-500 to-brand-600" />
      </div>

      <p className="mt-3 text-xs text-slate-400">首次生成可能较慢，AI 需要一点时间思考</p>
    </div>
  );
}