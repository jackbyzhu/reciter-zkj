import { extractJson } from './json';
import { getLastPassage, setLastPassage } from './meta';
import { resolvePrompt, renderPrompt } from '../prompts/resolve';
import type { Card, GenerationPreset, PromptKey, QuestionDraft, Settings } from '../types';
import type { GameRule } from '../games';

function appendCustomInstruction(prompt: string, custom?: string): string {
  const extra = custom?.trim();
  if (!extra) return prompt;
  return `${prompt}\n\n【用户附加要求（优先满足）】\n${extra}`;
}

function mergePresetInstructions(
  preset: GenerationPreset | undefined,
  global: string
): string {
  return [preset?.instruction, global].filter((s) => s && s.trim()).join('\n');
}

// ===== 错误类型 =====

export class AIConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIConfigError';
  }
}

export class AIFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIFormatError';
  }
}

export class AINetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AINetworkError';
  }
}

export class AITimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AITimeoutError';
    this.message = '请求超时，请稍后重试';
  }
}

export class AIAbortError extends Error {
  constructor() {
    super('请求已取消');
    this.name = 'AIAbortError';
  }
}

export class AIRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIRateLimitError';
  }
}

export type AIError =
  | AIConfigError
  | AIFormatError
  | AINetworkError
  | AITimeoutError
  | AIAbortError
  | AIRateLimitError;

export function isAIError(e: unknown): e is AIError {
  return (
    e instanceof AIConfigError ||
    e instanceof AIFormatError ||
    e instanceof AINetworkError ||
    e instanceof AITimeoutError ||
    e instanceof AIAbortError ||
    e instanceof AIRateLimitError
  );
}

// ===== 基础配置 =====

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini';
const REQUEST_TIMEOUT_MS = 90_000;
const MIN_INTERVAL_MS = 400;
const MAX_RETRIES = 2;

let lastCallAt = 0;

function buildCompletionUrl(settings: Settings): string {
  let base = settings.aiBaseUrl.trim().replace(/\/+$/, '');
  if (!base) {
    if (settings.aiMode === 'proxy') throw new AIConfigError('代理模式下请填写 aiBaseUrl');
    base = DEFAULT_BASE_URL;
  }
  if (/\/chat\/completions$/.test(base)) return base;
  return `${base}/chat/completions`;
}

async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ===== AI 调用 =====

export async function callAI(
  prompt: string,
  settings: Settings,
  signal?: AbortSignal
): Promise<string> {
  if (settings.aiMode === 'direct' && !settings.aiApiKey.trim()) {
    throw new AIConfigError('未配置 API Key，请到设置页填写，或切换到代理模式。');
  }

  const url = buildCompletionUrl(settings);
  const model = settings.aiModel.trim() || DEFAULT_MODEL;

  const sleep = Math.max(0, lastCallAt + MIN_INTERVAL_MS - Date.now());
  if (sleep > 0) await wait(sleep);

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);

    try {
      lastCallAt = Date.now();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (settings.aiMode === 'direct') {
        headers.Authorization = `Bearer ${settings.aiApiKey.trim()}`;
      }

      const resp = await fetch(url, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model,
          temperature: 0.7,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) {
          throw new AIConfigError('API Key 无效或被拒绝（请检查 Key 与 provider）。');
        }
        if (resp.status === 404) {
          throw new AIConfigError(`接口地址错误（404）：${url}，请检查 aiBaseUrl。`);
        }
        if (resp.status === 429) {
          if (attempt < MAX_RETRIES) {
            await wait(1000 * (attempt + 1));
            continue;
          }
          throw new AIRateLimitError('请求过于频繁，已被限流，请稍后再试。');
        }
        if (resp.status >= 500) {
          if (attempt < MAX_RETRIES) {
            await wait(1200 * (attempt + 1));
            continue;
          }
          throw new AINetworkError(`服务端错误（${resp.status}），请稍后重试。`);
        }
        throw new AIConfigError(`请求失败（HTTP ${resp.status}）。`);
      }

      const data = await resp.json();
      const content: unknown = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        throw new AIFormatError('模型返回内容为空。');
      }
      return content;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        if (signal?.aborted) throw new AIAbortError();
        throw new AITimeoutError('');
      }
      lastError = e;
      if (e instanceof AIConfigError || e instanceof AIRateLimitError || e instanceof AIAbortError) {
        throw e;
      }
      if (attempt < MAX_RETRIES) {
        await wait(500 * (attempt + 1));
        continue;
      }
      if (e instanceof AIFormatError) throw e;
      throw new AINetworkError('网络请求失败，请检查网络或代理配置。');
    } finally {
      clearTimeout(timeoutTimer);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  throw lastError instanceof Error ? lastError : new AINetworkError('网络请求失败。');
}

// ===== 卡片生成 =====

function strField(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  return typeof v === 'string' ? v : '';
}

export async function generateCard(
  word: string,
  meaning: string,
  settings: Settings,
  signal?: AbortSignal
): Promise<Partial<Card>> {
  const template = resolvePrompt('card', settings);
  const prompt = appendCustomInstruction(
    renderPrompt(template, { word, meaning: meaning || '' }),
    settings.customInstruction
  );
  const raw = await callAI(prompt, settings, signal);
  const parsed = extractJson(raw);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new AIFormatError('AI 返回的内容不是有效 JSON。');
  }
  const obj = parsed as Record<string, unknown>;

  const generatedWord = strField(obj, 'word') || word;
  const examples = Array.isArray(obj.examples)
    ? (obj.examples as unknown[])
        .map((e) => {
          if (!e || typeof e !== 'object') return null;
          const ex = e as Record<string, unknown>;
          return { en: strField(ex, 'en'), zh: strField(ex, 'zh') };
        })
        .filter((e): e is { en: string; zh: string } => !!e)
    : [];

  return {
    word: generatedWord,
    pos: strField(obj, 'pos'),
    meaning: strField(obj, 'meaning'),
    pronunciation: strField(obj, 'pronunciation'),
    humorExplanation: strField(obj, 'humorExplanation'),
    roots: strField(obj, 'roots'),
    mnemonic: strField(obj, 'mnemonic'),
    examples,
    tags: Array.isArray(obj.tags) ? obj.tags.filter((t): t is string => typeof t === 'string') : [],
  };
}

// ===== 题目生成 =====

export async function generateQuestion(
  rule: GameRule,
  words: Card[],
  settings: Settings,
  signal?: AbortSignal,
  preset?: GenerationPreset
): Promise<QuestionDraft> {
  const template = resolvePrompt(rule.id as PromptKey, settings);
  const lastPassage = await getLastPassage(rule.id);
  const prompt = rule.buildPrompt(words, template, {
    customInstruction: mergePresetInstructions(preset, settings.customInstruction),
    genre: preset?.genre,
    lastPassage,
  });
  const raw = await callAI(prompt, settings, signal);
  const parsed = extractJson(raw);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new AIFormatError('AI 返回的内容不是有效 JSON。');
  }

  const draft = rule.parseResponse(raw, words);

  if (rule.id === 'reading' && !draft.translation?.trim()) {
    throw new AIFormatError('阅读理解的译文缺失，请重试。');
  }

  const passage = (draft.content as { passage?: unknown }).passage;
  if (typeof passage === 'string' && passage.trim()) {
    await setLastPassage(rule.id, passage.trim()).catch(() => undefined);
  }

  return draft;
}

export type { PromptKey, QuestionType } from '../types';