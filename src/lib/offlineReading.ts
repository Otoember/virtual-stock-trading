import type { DeckCard, DrawnCard, Spread, StructuredReading, Topic } from './types';

function pick<T>(arr: T[], index: number): T {
  const safe = arr.length > 0 ? arr : ([] as unknown as T[]);
  return safe[Math.max(0, Math.min(index, safe.length - 1))];
}

function compactChinese(maxLen: number, text: string) {
  const t = text.replace(/\s+/g, '').trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen);
}

function orientationText(reversed: boolean) {
  return reversed ? '（逆位）' : '（正位）';
}

function cardKeywords(card: DeckCard, reversed: boolean) {
  const kws = reversed ? card.keywords_reversed : card.keywords_upright;
  return kws.slice(0, 3);
}

function sentenceJoin(parts: string[]) {
  return parts.filter(Boolean).join('');
}

function buildOverview(topic: Topic, spreadName: string, mainKeywords: string[], questionBrief: string) {
  const kw0 = (mainKeywords[0] || '调整').replace(/\s+/g, '');
  const kw1 = (mainKeywords[1] || '节奏').replace(/\s+/g, '');
  const prefix = topic ? `${topic}：` : '';
  const core = spreadName.includes('二选一') ? `${kw0}/${kw1}，权衡取舍` : `${kw0}/${kw1}，先做小步行动`;
  const q = questionBrief ? `｜${questionBrief}` : '';
  return compactChinese(25, `${prefix}${core}${q}`);
}

function stripShortLabel(text: string) {
  const i = text.indexOf('：');
  if (i > 0 && i <= 6) return text.slice(i + 1);
  return text;
}

function pickTopicTip(card: DeckCard, topic: Topic) {
  const tips = card.domain_tips ?? [];
  if (tips.length === 0) return '';
  const matched = tips.filter((t) => t.startsWith(`${topic}：`));
  const chosen = (matched.length ? matched : tips)[0] || '';
  return stripShortLabel(chosen);
}

function pickMisconception(card: DeckCard) {
  return (card.misconceptions ?? [])[0] || '';
}

function pickQuestionPrompt(card: DeckCard) {
  return (card.question_prompts ?? [])[0] || '';
}

function buildPositionText(params: {
  positionQuestion: string;
  card: DeckCard;
  reversed: boolean;
  topic: Topic;
  questionBrief: string;
}) {
  const { positionQuestion, card, reversed, topic, questionBrief } = params;
  const kws = cardKeywords(card, reversed);
  const meaning = card.short_meaning;
  const advice = card.advice;
  const caution = card.caution;
  const tip = pickTopicTip(card, topic);
  const mis = pickMisconception(card);
  const qPrompt = pickQuestionPrompt(card);

  const qPart = questionBrief ? `围绕你问的「${questionBrief}」，` : '';
  const s1 = `${qPart}就「${positionQuestion}」而言，${card.name_cn}${orientationText(reversed)}指向：${meaning}`;
  const s2 = reversed
    ? `逆位更容易表现为${kws.join('、')}，需要把注意力从情绪拉回事实与边界。`
    : `正位更强调${kws.join('、')}，你可以更主动地把资源用在关键处。`;
  const s3 = tip ? `在「${topic}」主题上，更建议你关注：${tip}` : '';
  const s4 = `行动建议：${advice}`;
  const s5 = sentenceJoin([
    `提醒：${caution}`,
    mis ? `（常见误区：${mis}）` : '',
    qPrompt ? `你也可以追问：${qPrompt}` : ''
  ]);

  return [s1, s2, s3, s4, s5].filter(Boolean).map((s) => (s.endsWith('。') ? s : `${s}。`)).join('');
}

function uniqTop(items: string[], n: number) {
  const out: string[] = [];
  for (const it of items) {
    const t = it.trim();
    if (!t) continue;
    if (out.includes(t)) continue;
    out.push(t);
    if (out.length >= n) break;
  }
  return out;
}

export function generateOfflineReading(params: {
  topic: Topic;
  question: string;
  timeframe: string;
  spread: Spread;
  drawn: DrawnCard[];
  deckById: Record<string, DeckCard>;
}): StructuredReading {
  const { topic, spread, drawn, deckById } = params;
  const timeframeText = params.timeframe?.trim() ? `在${params.timeframe.trim()}内，` : '';
  const questionBrief = compactChinese(18, (params.question || '').replace(/\s+/g, '').trim());

  const byIndex = new Map<number, DrawnCard>();
  for (const d of drawn) byIndex.set(d.positionIndex, d);

  const positions = spread.positions
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((pos) => {
      const d = byIndex.get(pos.index);
      const card = d ? deckById[d.cardId] : undefined;
      const reversed = Boolean(d?.reversed);
      const cardName = card ? `${card.name_cn} / ${card.name_en}` : '（未选择）';
      const text = card
        ? buildPositionText({ positionQuestion: pos.question, card, reversed, topic, questionBrief })
        : '请先为该位置选择一张牌。';
      return {
        index: pos.index,
        title: pos.title,
        question: pos.question,
        cardId: d?.cardId ?? '',
        cardName,
        reversed,
        text
      };
    });

  const readingOrder = (spread.reading_order?.length ? spread.reading_order : positions.map((p) => p.index)).slice();

  const orderedCards: DeckCard[] = [];
  const orderedOrientations: boolean[] = [];
  for (const idx of readingOrder) {
    const d = byIndex.get(idx);
    const card = d ? deckById[d.cardId] : undefined;
    if (card) {
      orderedCards.push(card);
      orderedOrientations.push(Boolean(d?.reversed));
    }
  }

  const mainKeywords = orderedCards.length
    ? cardKeywords(orderedCards[0], orderedOrientations[0]).slice(0, 2)
    : ['调整节奏'];

  const overview = buildOverview(topic, spread.name, mainKeywords, questionBrief);

  const conflictCandidates: string[] = [];
  for (let i = 0; i < orderedCards.length; i++) {
    const c = orderedCards[i];
    const rev = orderedOrientations[i];
    if (rev) conflictCandidates.push(`更容易出现「${pick(c.keywords_reversed, 0)}」导致的卡顿。`);
    const mis = pickMisconception(c);
    if (mis) conflictCandidates.push(`常见误区：${mis}。`);
    conflictCandidates.push(`留意：${c.caution}`);
  }
  const conflicts = uniqTop(conflictCandidates, 3).map((s) => (s.endsWith('。') ? s : `${s}。`));

  const actionCandidates: string[] = [];
  for (let i = 0; i < orderedCards.length; i++) actionCandidates.push(orderedCards[i].advice);
  const actions = uniqTop(actionCandidates, 3).map((s) => (s.endsWith('。') ? s : `${s}。`));

  const domainTipCandidates: string[] = [];
  const promptCandidates: string[] = [];
  const misconceptionCandidates: string[] = [];
  for (let i = 0; i < orderedCards.length; i++) {
    const c = orderedCards[i];
    const tip = pickTopicTip(c, topic);
    if (tip) domainTipCandidates.push(tip);
    (c.question_prompts ?? []).forEach((p) => promptCandidates.push(p));
    (c.misconceptions ?? []).forEach((m) => misconceptionCandidates.push(m));
  }
  const domainTips = uniqTop(domainTipCandidates, 3).map((s) => (s.endsWith('。') ? s : `${s}。`));
  const questionPrompts = uniqTop(promptCandidates, 3).map((s) => (s.endsWith('？') ? s : `${s.replace(/[?？]$/g, '')}？`));
  const misconceptions = uniqTop(misconceptionCandidates, 3).map((s) => (s.endsWith('。') ? s : `${s}。`));

  const trendIf = [
    sentenceJoin([
      timeframeText || '',
      '如果按建议执行，你更可能看到：',
      mainKeywords[0] ? `「${mainKeywords[0]}」` : '更清晰的方向',
      '逐步增强，结果更稳定。'
    ]),
    '你会更容易获得反馈并及时修正，压力感倾向下降。',
    '即使进展不快，也更可持续。'
  ];
  const trendElse = [
    sentenceJoin([
      timeframeText || '',
      '如果不做调整，',
      mainKeywords[1] ? `「${mainKeywords[1]}」相关的问题` : '旧模式',
      '可能反复出现。'
    ]),
    '容易在情绪与拖延之间摇摆，机会窗口变窄。',
    '建议至少从一个小动作开始，避免长期消耗。'
  ];

  const reminder = compactChinese(20, '以温和行动取代自责。');

  return {
    overview,
    positions,
    conflicts,
    actions,
    domainTips: domainTips.length ? domainTips : undefined,
    misconceptions: misconceptions.length ? misconceptions : undefined,
    questionPrompts: questionPrompts.length ? questionPrompts : undefined,
    trends: { if_follow: trendIf, if_ignore: trendElse },
    reminder
  };
}
