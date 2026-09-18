export interface WordMatch {
  text: string;
  start: number;
  end: number;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 在短文中重新定位单词（含常见屈折后缀），大小写不敏感。
 * 不依赖模型给出的字符下标，避免高亮落错位置。
 */
export function findWordMatches(passage: string, word: string): WordMatch[] {
  const base = word.trim();
  if (!base) return [];
  const escaped = escapeRegex(base);
  // 常见词形变化：'s / es / ies / ed / ing / s / d
  const re = new RegExp(`\\b${escaped}(?:'s|es|ies|ed|ing|s|d)?\\b`, 'gi');
  const out: WordMatch[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(passage)) !== null) {
    if (m[0].length > 0) {
      out.push({ text: m[0], start: m.index, end: m.index + m[0].length });
    } else {
      re.lastIndex += 1;
    }
  }
  return out;
}

export function locateHighlights(
  passage: string,
  items: { wordId: string; word: string }[]
): { wordId: string; text: string; start: number; end: number }[] {
  const found: { wordId: string; text: string; start: number; end: number }[] = [];
  const seen = new Set<number>();
  for (const item of items) {
    for (const m of findWordMatches(passage, item.word)) {
      if (seen.has(m.start)) continue;
      seen.add(m.start);
      found.push({ wordId: item.wordId, text: m.text, start: m.start, end: m.end });
    }
  }
  return found.sort((a, b) => a.start - b.start);
}