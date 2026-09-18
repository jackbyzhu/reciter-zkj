import pako from 'pako';

export function safeStringify(value: unknown, indent?: number): string {
  return JSON.stringify(value, null, indent);
}

export function parseJSON(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function stripMarkdownFence(raw: string): string {
  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }
  return text;
}

export function extractJson(raw: string): unknown {
  const text = stripMarkdownFence(raw);

  const first = text.indexOf('{');
  if (first !== -1) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = first; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
      } else if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          return parseJSON(text.slice(first, i + 1));
        }
      }
    }
  }

  const arrStart = text.indexOf('[');
  if (arrStart !== -1) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = arrStart; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === '[') depth++;
      else if (ch === ']') {
        depth--;
        if (depth === 0) {
          return parseJSON(text.slice(arrStart, i + 1));
        }
      }
    }
  }

  return parseJSON(text);
}

// ===== pako 压缩 =====

export function gzipString(text: string): Uint8Array {
  return pako.gzip(text, { level: 9 });
}

export function gunzipStringToText(data: Uint8Array): string {
  return pako.ungzip(data, { to: 'string' });
}

export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'));
    reader.readAsArrayBuffer(file);
  });
}