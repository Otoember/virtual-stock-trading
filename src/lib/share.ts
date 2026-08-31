import type { Spread, StructuredReading, Topic } from './types';
import { maskQuestion, privacyRulesText } from './privacy';

export function buildShareText(params: {
  createdAtISO: string;
  topic: Topic;
  timeframe: string;
  question: string;
  spread: Spread;
  cards: Array<{ index: number; title: string; cardName: string; reversed: boolean }>;
  offline: StructuredReading;
}): { text: string; questionHidden: boolean; privacyReasons: string[] } {
  const { createdAtISO, topic, timeframe, question, spread, cards, offline } = params;
  const masked = maskQuestion(question);

  const date = new Date(createdAtISO);
  const timeText = Number.isFinite(date.getTime()) ? date.toLocaleString() : createdAtISO;
  const cardLines = cards
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((c) => `${c.index}. ${c.title}：${c.cardName}${c.reversed ? '（逆位）' : '（正位）'}`)
    .join('\n');

  const advice3 = offline.actions.slice(0, 3).map((a, i) => `${i + 1}) ${a.replace(/。$/g, '')}`).join('\n');

  const text = [
    '【塔罗解读分享】',
    `时间：${timeText}`,
    `主题：${topic}`,
    `时间范围：${timeframe || '（未填写）'}`,
    `牌阵：${spread.name}`,
    masked.hidden ? '用户提问：已隐藏（隐私保护）' : `用户提问：${masked.masked}`,
    '',
    '抽牌：',
    cardLines,
    '',
    '三条建议摘要：',
    advice3 || '（暂无）',
    '',
    `温和提醒：${offline.reminder}`,
    '',
    '说明：以上为反思与沟通辅助，不替代医疗/法律/投资等专业意见。',
    `隐私检测规则：${privacyRulesText}`
  ].join('\n');

  return { text, questionHidden: masked.hidden, privacyReasons: masked.reasons };
}

