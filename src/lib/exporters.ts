import type { HistoryEntry, StructuredReading } from './types';

function downloadText(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportJson(filename: string, data: unknown) {
  downloadText(filename, JSON.stringify(data, null, 2), 'application/json;charset=utf-8');
}

export function structuredReadingToMarkdown(reading: StructuredReading): string {
  const pos = reading.positions
    .map((p) => {
      const title = `${p.index}. ${p.title}｜${p.cardName}${p.reversed ? '（逆位）' : '（正位）'}`;
      return `### ${title}\n\n${p.text}\n`;
    })
    .join('\n');

  const conflicts = reading.conflicts.map((c) => `- ${c.replace(/。$/g, '')}`).join('\n');
  const actions = reading.actions.map((a) => `- ${a.replace(/。$/g, '')}`).join('\n');
  const domainTips = (reading.domainTips ?? []).map((t) => `- ${t.replace(/。$/g, '')}`).join('\n');
  const misconceptions = (reading.misconceptions ?? []).map((t) => `- ${t.replace(/。$/g, '')}`).join('\n');
  const questionPrompts = (reading.questionPrompts ?? []).map((t) => `- ${t.replace(/[?？]$/g, '')}？`).join('\n');
  const trends1 = reading.trends.if_follow.map((t) => `- ${t.replace(/。$/g, '')}`).join('\n');
  const trends2 = reading.trends.if_ignore.map((t) => `- ${t.replace(/。$/g, '')}`).join('\n');

  return [
    '## 离线基础解读',
    '',
    '### 1) 一句话总览',
    '',
    reading.overview,
    '',
    '### 2) 逐牌位解读',
    '',
    pos,
    '### 3) 冲突点/卡点（3条要点）',
    '',
    conflicts || '- （暂无）',
    '',
    '### 4) 三条可执行建议（具体动作）',
    '',
    actions || '- （暂无）',
    '',
    domainTips
      ? ['### 补充｜适用领域提示', '', domainTips, ''].join('\n')
      : '',
    misconceptions
      ? ['### 补充｜常见误区', '', misconceptions, ''].join('\n')
      : '',
    questionPrompts
      ? ['### 补充｜提问引导', '', questionPrompts, ''].join('\n')
      : '',
    '### 5) 时间窗口趋势',
    '',
    '**按建议做的倾向：**',
    trends1 || '- （暂无）',
    '',
    '**不做调整的倾向：**',
    trends2 || '- （暂无）',
    '',
    '### 6) 一句温和提醒',
    '',
    reading.reminder,
    ''
  ].join('\n');
}

export function entryToMarkdown(entry: HistoryEntry): string {
  const header = [
    '# 塔罗解读记录',
    '',
    `- 时间：${new Date(entry.createdAt).toLocaleString()}`,
    `- 主题：${entry.topic}`,
    `- 时间范围：${entry.timeframe || '（未填写）'}`,
    `- 牌阵：${entry.spreadName}`,
    `- 提问：${entry.questionMasked}`,
    '',
    '## 抽牌',
    ''
  ].join('\n');

  const cards = entry.cards
    .slice()
    .sort((a, b) => a.positionIndex - b.positionIndex)
    .map((c) => `- ${c.positionIndex}. ${c.positionTitle}：${c.cardName}${c.reversed ? '（逆位）' : '（正位）'}`)
    .join('\n');

  const offline = structuredReadingToMarkdown(entry.offlineReading);

  const deep = entry.deepseek
    ? [
        '## DeepSeek 解读',
        '',
        `- 模型：${entry.deepseek.model}`,
        '',
        entry.deepseek.reasoningContent
          ? [
              '<details>',
              '<summary>推理内容（折叠）</summary>',
              '',
              '```text',
              entry.deepseek.reasoningContent,
              '```',
              '',
              '</details>',
              ''
            ].join('\n')
          : '',
        '### 解读正文',
        '',
        entry.deepseek.content,
        ''
      ].join('\n')
    : '';

  const footer = [
    '---',
    '免责声明：本记录仅供自我反思与沟通辅助，不替代医疗/法律/投资等专业意见。',
    ''
  ].join('\n');

  return [header, cards, '', offline, deep, footer].filter(Boolean).join('\n');
}

export function exportEntryMarkdown(entry: HistoryEntry) {
  const filename = `tarot-${entry.id}.md`;
  downloadText(filename, entryToMarkdown(entry), 'text/markdown;charset=utf-8');
}

export function exportEntryJson(entry: HistoryEntry) {
  const filename = `tarot-${entry.id}.json`;
  exportJson(filename, entry);
}

export function exportAllMarkdown(entries: HistoryEntry[]) {
  const filename = `tarot-history-${new Date().toISOString().slice(0, 10)}.md`;
  const combined = entries.map((e) => entryToMarkdown(e)).join('\n\n');
  downloadText(filename, combined, 'text/markdown;charset=utf-8');
}

export function exportAllJson(entries: HistoryEntry[]) {
  const filename = `tarot-history-${new Date().toISOString().slice(0, 10)}.json`;
  exportJson(filename, entries);
}
