import { useRef, useState } from 'react';
import { useSettings } from '../stores/settingsStore';
import { clearAllData } from '../services/mutations';
import { importFromFile, type ImportResult } from '../services/import';
import { downloadExport } from '../services/export';
import { DEFAULT_PROMPTS } from '../prompts';
import { REQUIRED_VARS, getMissingVars } from '../prompts/resolve';
import { uuid } from '../utils/uuid';
import { Button } from '../components/common/Button';
import { Input, Textarea } from '../components/common/Input';
import { AlertBanner } from '../components/common/Feedback';
import { ConfirmDialog, Dialog } from '../components/common/Dialog';
import type {
  AiMode,
  GenerationPreset,
  ImportConflictStrategy,
  PromptKey,
  Settings,
} from '../types';

const GENRE_OPTIONS = [
  '',
  '记叙文',
  '说明文',
  '议论文',
  '散文',
  '随笔',
  '书信',
  '日记',
  '新闻报道',
  '科普文',
  '小故事',
  '游记',
  '影评',
  '人物访谈',
];

interface AIForm {
  aiProvider: string;
  aiApiKey: string;
  aiModel: string;
  aiBaseUrl: string;
  aiMode: AiMode;
  targetRetention: number;
  reviewBatchSize: number;
  clozeCount: number;
  readingCount: number;
  gameRulesEnabled: Settings['gameRulesEnabled'];
  customInstruction: string;
}

const PROMPT_KEYS: PromptKey[] = ['card', 'cloze', 'reading'];
const PROMPT_LABEL: Record<PromptKey, string> = {
  card: '卡片生成',
  cloze: '完形填空',
  reading: '阅读理解',
};

function toForm(s: Settings): AIForm {
  return {
    aiProvider: s.aiProvider,
    aiApiKey: s.aiApiKey,
    aiModel: s.aiModel,
    aiBaseUrl: s.aiBaseUrl,
    aiMode: s.aiMode,
    targetRetention: s.targetRetention,
    reviewBatchSize: s.reviewBatchSize,
    clozeCount: s.clozeCount,
    readingCount: s.readingCount,
    gameRulesEnabled: [...s.gameRulesEnabled],
    customInstruction: s.customInstruction,
  };
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Settings() {
  const store = useSettings();
  const settings = store.settings;
  const [form, setForm] = useState<AIForm>(() => toForm(settings));
  const [presets, setPresets] = useState<GenerationPreset[]>(() =>
    settings.generationPresets.map((p) => ({ ...p }))
  );
  const [promptDrafts, setPromptDrafts] = useState<Record<PromptKey, string>>({
    ...settings.prompts,
  });
  const [notice, setNotice] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importOpts, setImportOpts] = useState<{
    conflict: ImportConflictStrategy;
    overwritePrompts: boolean;
  }>({ conflict: 'skip', overwritePrompts: false });
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [clearOpen, setClearOpen] = useState(false);

  function set<K extends keyof AIForm>(key: K, value: AIForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSaveAI() {
    if (form.aiMode === 'proxy' && !form.aiBaseUrl.trim()) {
      setNotice('代理模式下请填写代理地址（aiBaseUrl）。');
      return;
    }
    await store.save({ ...settings, ...form });
    setNotice('AI 配置与数量设置已保存并生效。');
  }

  function updatePreset(i: number, patch: Partial<GenerationPreset>) {
    setPresets((list) => list.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  function addPreset() {
    setPresets((list) => [
      ...list,
      { id: uuid(), name: `方案 ${list.length + 1}`, genre: '', instruction: '' },
    ]);
  }

  function removePreset(i: number) {
    setPresets((list) => list.filter((_, idx) => idx !== i));
  }

  async function handleSavePresets() {
    const next = presets
      .filter((p) => p.name.trim().length > 0)
      .map((p) => ({ ...p, name: p.name.trim() }));
    await store.patch({ generationPresets: next });
    setPresets(next);
    setNotice(`已保存 ${next.length} 个生成方案，出题时可选择。`);
  }

  async function handleSavePrompt(key: PromptKey) {
    const missing = getMissingVars(key, promptDrafts[key]);
    if (missing.length > 0) {
      setNotice(`「${PROMPT_LABEL[key]}」缺少必要变量：{{${missing.join('}}、{{')}}}，请补齐后再保存。`);
      return;
    }
    await store.patch({ prompts: { ...store.settings.prompts, [key]: promptDrafts[key].trim() } });
    setNotice(`已保存「${PROMPT_LABEL[key]}」提示词。`);
  }

  async function handleResetPrompts() {
    await store.patch({ prompts: { ...DEFAULT_PROMPTS } });
    setPromptDrafts({ ...DEFAULT_PROMPTS });
    setNotice('全部提示词已恢复默认。');
  }

  async function handleExport() {
    try {
      await downloadExport();
      setNotice('已导出备份文件。');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '导出失败。');
    }
  }

  async function handleImportConfirm() {
    if (!importFile) return;
    setImporting(true);
    setImportError(null);
    try {
      const result = await importFromFile(importFile, importOpts);
      setImportResult(result);
      await store.reload();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : '导入失败。');
      setImportResult(null);
    } finally {
      setImporting(false);
    }
  }

  async function handleClear() {
    await clearAllData();
    setClearOpen(false);
    setNotice('所有单词、题目与记录已清空（提示词设置保留）。');
  }

  const toggleRule = (rule: 'cloze' | 'reading') => {
    set('gameRulesEnabled', form.gameRulesEnabled.includes(rule)
      ? form.gameRulesEnabled.filter((r) => r !== rule)
      : [...form.gameRulesEnabled, rule]);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">设置</h1>
        <p className="mt-1 text-sm text-slate-500">
          AI 配置、数量偏好、提示词与数据管理。
        </p>
      </div>

      {notice && <AlertBanner type="info" onClose={() => setNotice(null)}>{notice}</AlertBanner>}

      <Section title="AI 配置" subtitle="支持直连（自填 Key）与代理两种模式。Key 仅存浏览器本地 IndexedDB。">
        <div className="space-y-3">
          <div className="flex gap-4">
            {(['direct', 'proxy'] as AiMode[]).map((mode) => (
              <label key={mode} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  checked={form.aiMode === mode}
                  onChange={() => set('aiMode', mode)}
                />
                {mode === 'direct' ? '直连模式（自填 Key）' : '代理模式（后端注入 Key）'}
              </label>
            ))}
          </div>

          <Input
            label="Provider（模型服务商，如 openai、deepseek）"
            value={form.aiProvider}
            onChange={(e) => set('aiProvider', e.target.value)}
            placeholder="openai"
          />
          {form.aiMode === 'direct' && (
            <Input
              label="API Key"
              type="password"
              autoComplete="off"
              value={form.aiApiKey}
              onChange={(e) => set('aiApiKey', e.target.value)}
              hint="直连模式必须填写；仅保存在本地浏览器。"
            />
          )}
          <Input
            label="模型"
            value={form.aiModel}
            onChange={(e) => set('aiModel', e.target.value)}
            placeholder="gpt-4o-mini"
          />
          <Input
            label="接口地址（aiBaseUrl）"
            value={form.aiBaseUrl}
            onChange={(e) => set('aiBaseUrl', e.target.value)}
            placeholder={form.aiMode === 'proxy' ? 'https://your-proxy.example/v1' : 'https://api.openai.com/v1'}
            hint="代理模式下必须填写。留空时直连模式使用 OpenAI 默认地址。"
          />
          <Button onClick={() => void handleSaveAI()}>保存 AI 配置</Button>
        </div>
      </Section>

      <Section title="数量与偏好" subtitle="复习批次、出题数量、目标记忆保持率，均集中在此配置。">
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="number"
            label="每次复习数量（1-100）"
            value={form.reviewBatchSize}
            min={1}
            max={100}
            onChange={(e) => set('reviewBatchSize', Number(e.target.value))}
          />
          <Input
            type="number"
            label="完形填空取词数"
            value={form.clozeCount}
            min={1}
            max={50}
            onChange={(e) => set('clozeCount', Number(e.target.value))}
          />
          <Input
            type="number"
            label="阅读理解取词数"
            value={form.readingCount}
            min={1}
            max={50}
            onChange={(e) => set('readingCount', Number(e.target.value))}
          />
          <Input
            type="number"
            label="目标记忆保持率（0.7-1）"
            value={form.targetRetention}
            min={0.7}
            max={1}
            step={0.05}
            onChange={(e) => set('targetRetention', Number(e.target.value))}
          />
        </div>
        <div className="mt-3 flex gap-6">
          {(['cloze', 'reading'] as const).map((rule) => (
            <label key={rule} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.gameRulesEnabled.includes(rule)}
                onChange={() => toggleRule(rule)}
              />
              启用{rule === 'cloze' ? '完形填空' : '阅读理解'}
            </label>
          ))}
        </div>
        <div className="mt-3">
          <Button onClick={() => void handleSaveAI()}>保存偏好</Button>
        </div>
      </Section>

      <Section title="生成偏好" subtitle="适用于单词卡、完形与阅读的附加要求，每次 AI 生成都会带上，优先级最高。">
        <Textarea
          label="自定义要求（可空）"
          rows={3}
          value={form.customInstruction}
          onChange={(e) => set('customInstruction', e.target.value)}
          placeholder="如：用词尽量简单口语、每篇短文都编成一个小故事、例句里多出现校园场景等"
        />
        <p className="mt-1 text-xs text-slate-400">
          已保存的偏好会作为「用户附加要求」追加到提示词末尾；短文还会对比上次生成的同类短文以尽量不重复。
        </p>
        <div className="mt-3">
          <Button onClick={() => void handleSaveAI()}>保存生成偏好</Button>
        </div>
      </Section>

      <Section title="文章生成方案" subtitle="配置多个出题方案：文章性质（体裁）+ 个性化补充提示词。完形填空与阅读理解出题时均可选择。">
        <div className="space-y-3">
          {presets.length === 0 && (
            <p className="text-sm text-slate-400">还没有方案，点下方「+ 添加方案」创建一个。</p>
          )}
          {presets.map((p, i) => (
            <div key={p.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-700">方案 {i + 1}</span>
                <Button size="xs" variant="ghost" onClick={() => removePreset(i)}>
                  删除
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="方案名称"
                  value={p.name}
                  onChange={(e) => updatePreset(i, { name: e.target.value })}
                  placeholder="如：考研记叙文"
                />
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-600">文章性质</span>
                  <select
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none"
                    value={p.genre}
                    onChange={(e) => updatePreset(i, { genre: e.target.value })}
                  >
                    {GENRE_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g === '' ? '不限（自动选择）' : g}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-3">
                <Textarea
                  label="补充提示词（可选，用于个性化生成）"
                  rows={2}
                  value={p.instruction}
                  onChange={(e) => updatePreset(i, { instruction: e.target.value })}
                  placeholder="如：主角设定为大学生、语言简单口语化、结尾要反转等"
                />
              </div>
            </div>
          ))}
          <Button variant="secondary" onClick={addPreset}>
            + 添加方案
          </Button>
          <div>
            <Button onClick={() => void handleSavePresets()}>保存方案</Button>
          </div>
        </div>
      </Section>

      <Section title="提示词" subtitle="修改后立即生效，下一次 AI 调用使用新提示词。缺失必要变量禁止保存。">
        <div className="space-y-4">
          {PROMPT_KEYS.map((key) => (
            <div key={key} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-sm font-semibold text-slate-700">{PROMPT_LABEL[key]}</span>
                  <span className="ml-2 text-xs text-slate-400">
                    必要变量：{REQUIRED_VARS[key].map((v) => `{{${v}}}`).join('、')}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setPromptDrafts((d) => ({ ...d, [key]: DEFAULT_PROMPTS[key] }))
                    }
                  >
                    重置当前项
                  </Button>
                  <Button size="sm" onClick={() => void handleSavePrompt(key)}>
                    保存
                  </Button>
                </div>
              </div>
              <Textarea
                rows={8}
                value={promptDrafts[key]}
                onChange={(e) => setPromptDrafts((d) => ({ ...d, [key]: e.target.value }))}
                className="!bg-white font-mono !text-xs"
              />
              {getMissingVars(key, promptDrafts[key]).length > 0 && (
                <p className="mt-1 text-xs text-red-500">
                  缺少：{getMissingVars(key, promptDrafts[key]).map((v) => `{{${v}}}`).join('、')}
                </p>
              )}
            </div>
          ))}
          <Button variant="secondary" onClick={() => void handleResetPrompts()}>
            恢复全部默认
          </Button>
        </div>
      </Section>

      <Section title="数据管理" subtitle="单词库 / 题目库 JSON 互导，导出使用 gzip 压缩。">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void handleExport()}>
            导出备份
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setImportError(null);
              setImportResult(null);
              setImportFile(null);
              importInputRef.current?.click();
            }}
          >
            导入备份
          </Button>
          <Button variant="danger" onClick={() => setClearOpen(true)}>
            清空所有数据
          </Button>
        </div>
        <input
          ref={importInputRef}
          type="file"
          accept=".json,.gz"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setImportFile(file);
              setImportOpen(true);
            }
          }}
        />
      </Section>

      <Dialog
        open={importOpen}
        title="导入备份"
        onClose={() => setImportOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setImportOpen(false)} disabled={importing}>
              取消
            </Button>
            <Button onClick={() => void handleImportConfirm()} disabled={!importFile || importing}>
              {importing ? '导入中…' : '开始导入'}
            </Button>
          </>
        }
      >
        {importResult ? (
          <div className="text-sm text-slate-700">
            <p className="font-semibold text-emerald-600">导入完成</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-slate-600">
              <li>新增：{importResult.added}</li>
              <li>覆盖：{importResult.overwritten}</li>
              <li>跳过：{importResult.skipped}</li>
            </ul>
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => {
                setImportOpen(false);
                setImportResult(null);
                setImportFile(null);
              }}
            >
              完成
            </Button>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            {importError && <AlertBanner>{importError}</AlertBanner>}
            <p className="text-slate-600">文件：{importFile?.name}</p>
            <div>
              <div className="mb-1 font-medium text-slate-600">冲突处理</div>
              <div className="space-y-1.5">
                {(
                  [
                    ['skip', '跳过已有记录'],
                    ['overwrite', '覆盖已有记录'],
                    ['new-id', '新建 ID（保留为重复条目）'],
                  ] as [ImportConflictStrategy, string][]
                ).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={importOpts.conflict === value}
                      onChange={() => setImportOpts((o) => ({ ...o, conflict: value }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={importOpts.overwritePrompts}
                onChange={(e) =>
                  setImportOpts((o) => ({ ...o, overwritePrompts: e.target.checked }))
                }
              />
              覆盖当前提示词（使用备份文件中的提示词）
            </label>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={clearOpen}
        title="清空所有数据"
        message="将删除全部单词、复习记录、题目与作答历史（提示词设置保留）。此操作不可恢复，确定继续？"
        confirmText="清空"
        onConfirm={() => void handleClear()}
        onCancel={() => setClearOpen(false)}
      />
    </div>
  );
}