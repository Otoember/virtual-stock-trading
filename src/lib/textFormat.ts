export function formatDeepSeekDisplayText(raw: string): string {
  if (!raw) return raw;
  let t = raw.replace(/\r\n/g, '\n');

  // 去掉首尾空行，避免“左侧大块空白”常见于首行缩进/空行叠加的观感
  t = t.replace(/^\s*\n+/, '');
  t = t.replace(/\n+\s*$/, '');

  // 去掉常见 Markdown 加粗/下划线标记，避免出现大量 *
  t = t.replace(/\*\*/g, '');
  t = t.replace(/__/g, '');

  // 把 Markdown 列表符号转换成更友好的圆点
  t = t.replace(/^(\s*)\*\s+/gm, '$1• ');
  t = t.replace(/^(\s*)-\s+/gm, '$1• ');
  t = t.replace(/^(\s*)\+\s+/gm, '$1• ');

  // 归一化缩进：移除所有非空行的“共同前导缩进”，减少整体左侧大空白
  // 例如模型输出整体缩进 4/8 个空格时，pre 会把它们完整显示，观感很差
  const lines = t.split('\n');
  const indents: number[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const m = line.match(/^[ \t]+/);
    if (!m) {
      indents.push(0);
      continue;
    }
    // tab 视作 2 个空格（仅用于计算共同缩进）
    const s = m[0].replace(/\t/g, '  ');
    indents.push(s.length);
  }
  const minIndent = indents.length ? Math.min(...indents) : 0;
  if (minIndent > 0) {
    const stripRe = new RegExp(`^[ \\t]{0,${minIndent}}`);
    t = lines.map((l) => l.replace(stripRe, '')).join('\n');
  }

  // 进一步限制行首超长空格（保留少量层级即可）
  t = t.replace(/^[ \t]{6,}/gm, '  ');

  return t;
}
