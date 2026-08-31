import type { Spread, Topic } from './types';

const TOPIC_TO_SPREAD_IDS: Record<Topic, string[]> = {
  感情: ['relationship-five', 'three-cards-situation-block-advice', 'emotion-four'],
  学业: ['three-cards-situation-block-advice', 'five-cards-situation-support-resistance-action-trend', 'weekly-seven'],
  工作: ['decision-six', 'five-cards-situation-support-resistance-action-trend', 'weekly-seven'],
  自我成长: ['emotion-four', 'shadow-six', 'review-four'],
  人际关系: ['communication-three', 'relationship-five', 'three-cards-situation-block-advice'],
  家庭: ['communication-three', 'relationship-five', 'five-cards-situation-support-resistance-action-trend'],
  健康: ['health-four', 'emotion-four', 'one-card-advice'],
  财务: ['money-five', 'either-or-seven', 'decision-six'],
  创作: ['one-card-advice', 'five-cards-situation-support-resistance-action-trend', 'weekly-seven']
};

export function recommendSpreads(topic: Topic, spreads: Spread[], max = 3): Spread[] {
  const ids = TOPIC_TO_SPREAD_IDS[topic] ?? [];
  const byId = new Map(spreads.map((s) => [s.id, s] as const));
  const out: Spread[] = [];
  for (const id of ids) {
    const s = byId.get(id);
    if (s) out.push(s);
    if (out.length >= max) break;
  }
  // 如果配置不足，补齐一些通用牌阵
  if (out.length < max) {
    const fallback = [
      'three-cards-situation-block-advice',
      'five-cards-situation-support-resistance-action-trend',
      'one-card-advice'
    ];
    for (const id of fallback) {
      if (out.length >= max) break;
      const s = byId.get(id);
      if (s && !out.find((x) => x.id === s.id)) out.push(s);
    }
  }
  return out.slice(0, max);
}

