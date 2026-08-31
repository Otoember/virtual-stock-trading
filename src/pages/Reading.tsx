import { useEffect, useMemo, useState } from 'react';
import spreadsData from '../data/spreads.json';
import deckData from '../data/deck.json';
import deckExtraData from '../data/deck_extra.json';
import {
  buildDeepSeekRequestBody,
  callDeepSeekChat,
  extractDeepSeekContent,
  extractDeepSeekStreamDelta,
  type DeepSeekExtracted
} from '../lib/deepseek';
import { exportEntryMarkdown, exportJson } from '../lib/exporters';
import { addHistoryEntry } from '../lib/historyStorage';
import { generateOfflineReading } from '../lib/offlineReading';
import { maskQuestion, privacyRulesText, sanitizeQuestionForLLM } from '../lib/privacy';
import { buildShareText } from '../lib/share';
import { formatDeepSeekDisplayText } from '../lib/textFormat';
import { readSSEStream } from '../lib/sse';
import { exportLongImagePng } from '../lib/imageExport';
import { recommendSpreads } from '../lib/recommendations';
import type { DeckCard, DeepSeekModel, DrawnCard, Spread, StructuredReading, ThinkingParam, Topic } from '../lib/types';
import { DEFAULT_SYSTEM_PROMPT } from '../prompt/defaultSystemPrompt';

const spreads = spreadsData as Spread[];
const deckExtra = deckExtraData as Record<
  string,
  { domain_tips?: string[]; misconceptions?: string[]; question_prompts?: string[] }
>;
const deck = (deckData as DeckCard[]).map((c) => ({ ...c, ...(deckExtra[c.id] ?? {}) }));

function nowId() {
  return `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function randomInt(max: number) {
  if (max <= 0) return 0;
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] % max;
  }
  return Math.floor(Math.random() * max);
}

type RandInt = (max: number) => number;

function randomUint32(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] >>> 0;
  }
  return (Math.floor(Math.random() * 0x1_0000_0000) >>> 0) as number;
}

function mix32(x: number): number {
  // 32-bit avalanche (deterministic),用于把 seed 与计数器混合成“盐值”
  let n = x >>> 0;
  n ^= n >>> 16;
  n = Math.imul(n, 0x7feb352d);
  n ^= n >>> 15;
  n = Math.imul(n, 0x846ca68b);
  n ^= n >>> 16;
  return n >>> 0;
}

function makeMixedRand(seed: number): RandInt {
  const seed32 = seed >>> 0;
  let counter = 0;
  return (max: number) => {
    if (max <= 0) return 0;
    const salt = mix32(seed32 ^ counter);
    counter++;
    const base = randomUint32();
    const mixed = (base ^ salt) >>> 0;
    return mixed % max;
  };
}

function parseSeedNumber(text: string): number | null {
  const t = (text ?? '').trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return (Math.trunc(n) >>> 0) as number;
}

function shuffle<T>(arr: T[], randInt: RandInt = randomInt) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ReadingPage() {
  const [topic, setTopic] = useState<Topic>('自我成长');
  const [timeframe, setTimeframe] = useState('7天内');
  const [question, setQuestion] = useState('');
  const [spreadId, setSpreadId] = useState(spreads[0]?.id ?? '');
  const [allowReversed, setAllowReversed] = useState(true);
  const [seedNumberText, setSeedNumberText] = useState('');

  const [apiKey, setApiKey] = useState('');
  const [rememberSession, setRememberSession] = useState(true);
  const [model, setModel] = useState<DeepSeekModel>('deepseek-chat');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(3000);
  const [thinking, setThinking] = useState<ThinkingParam | undefined>(undefined);
  const [streamEnabled, setStreamEnabled] = useState(true);

  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);

  const [deepseekLoading, setDeepseekLoading] = useState(false);
  const [deepseekError, setDeepseekError] = useState<string | null>(null);
  const [deepseekResult, setDeepseekResult] = useState<DeepSeekExtracted | null>(null);
  const [deepseekProgress, setDeepseekProgress] = useState<{ content: string; reasoning?: string } | null>(null);
  const [aborter, setAborter] = useState<AbortController | null>(null);

  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const v = sessionStorage.getItem('deepseek_api_key');
    if (v) setApiKey(v);
  }, []);

  useEffect(() => {
    if (!rememberSession) {
      sessionStorage.removeItem('deepseek_api_key');
      return;
    }
    if (apiKey.trim()) sessionStorage.setItem('deepseek_api_key', apiKey.trim());
  }, [apiKey, rememberSession]);

  const spread = useMemo(() => spreads.find((s) => s.id === spreadId) ?? spreads[0], [spreadId]);

  const deckById = useMemo(() => {
    const map: Record<string, DeckCard> = {};
    for (const c of deck) map[c.id] = c;
    return map;
  }, []);

  const [drawn, setDrawn] = useState<DrawnCard[]>([]);

  useEffect(() => {
    const n = spread?.n_cards ?? 0;
    const init = Array.from({ length: n }).map((_, i) => ({ positionIndex: i + 1, cardId: '', reversed: false }));
    setDrawn(init);
    setDeepseekResult(null);
    setDeepseekError(null);
  }, [spreadId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!allowReversed) {
      setDrawn((prev) => prev.map((d) => ({ ...d, reversed: false })));
    }
  }, [allowReversed]);

  const canDraw = useMemo(() => question.trim().length > 0, [question]);

  const recommendedMaxTokens = useMemo(() => 3000, []);
  const recommendedSpreads = useMemo(() => (spread ? recommendSpreads(topic, spreads, 3) : []), [spread, topic]);

  const allSelected = useMemo(() => drawn.length > 0 && drawn.every((d) => Boolean(d.cardId)), [drawn]);

  const offlineReading: StructuredReading | null = useMemo(() => {
    if (!spread) return null;
    if (!allSelected) return null;
    return generateOfflineReading({
      topic,
      question,
      timeframe,
      spread,
      drawn,
      deckById
    });
  }, [allSelected, deckById, drawn, question, spread, timeframe, topic]);

  const usedCardIds = useMemo(() => new Set(drawn.map((d) => d.cardId).filter(Boolean)), [drawn]);

  function doRandomDraw() {
    if (!spread) return;
    if (!canDraw) {
      setToast('请先填写提问，再进行抽牌');
      setTimeout(() => setToast(null), 1500);
      return;
    }
    const n = spread.n_cards;
    const seed = parseSeedNumber(seedNumberText);
    const rand = seed === null ? randomInt : makeMixedRand(seed);
    const shuffled = shuffle(deck, rand);
    const picked = shuffled.slice(0, n);
    const next: DrawnCard[] = picked.map((c, i) => ({
      positionIndex: i + 1,
      cardId: c.id,
      reversed: allowReversed ? rand(2) === 1 : false
    }));
    setDrawn(next);
    setDeepseekResult(null);
    setDeepseekError(null);
  }

  function clearCards() {
    if (!spread) return;
    const n = spread.n_cards;
    setDrawn(Array.from({ length: n }).map((_, i) => ({ positionIndex: i + 1, cardId: '', reversed: false })));
    setDeepseekResult(null);
    setDeepseekError(null);
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast('已复制到剪贴板');
      setTimeout(() => setToast(null), 1500);
    } catch {
      setToast('复制失败：请手动复制');
      setTimeout(() => setToast(null), 1500);
    }
  }

  function buildUserPrompt(): string {
    if (!spread) return '';
    const sanitized = sanitizeQuestionForLLM(question);
    const posLines = spread.positions
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((p) => `${p.index}. ${p.title}｜问题句：${p.question}`)
      .join('\n');

    const cardLines = spread.positions
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((p) => {
        const d = drawn.find((x) => x.positionIndex === p.index);
        const c = d ? deckById[d.cardId] : undefined;
        if (!d || !c) return `${p.index}. ${p.title}：（未选择）`;
        const kws = (d.reversed ? c.keywords_reversed : c.keywords_upright).slice(0, 6).join('、');
        const ori = d.reversed ? '逆位' : '正位';
        return `${p.index}. ${p.title}：${c.name_cn} / ${c.name_en}（${ori}）｜关键词：${kws}｜简义：${c.short_meaning}`;
      })
      .join('\n');

    return [
      '【用户输入】',
      `主题：${topic}`,
      `时间范围：${timeframe || '（未填写）'}`,
      sanitized.redacted
        ? `提问（已脱敏：${sanitized.redactions.join('、')}）：${sanitized.text || '（未填写）'}`
        : `提问：${sanitized.text || '（未填写）'}`,
      '',
      `【牌阵】${spread.name}`,
      '牌位问题句：',
      posLines,
      '',
      '抽到的牌（含正/逆位）：',
      cardLines,
      '',
      '【解读要求】',
      '1) 必须围绕“用户提问”作答，不要只解释牌义。',
      '2) 逐牌位解读必须同时回应：牌位问题句 + 用户提问 + 时间范围；避免泛泛而谈。',
      '3) 若提问是“是否/会不会/能不能”类，请给出两种倾向与建议，不做绝对断言。',
      '4) 请严格按系统提示词要求的固定结构输出。'
    ].join('\n');
  }

  async function runDeepSeek() {
    setDeepseekError(null);
    setDeepseekResult(null);
    setDeepseekProgress(null);
    const key = apiKey.trim();
    if (!key) {
      setDeepseekError('未填写 API Key：仍可使用离线基础解读。');
      return;
    }
    if (!spread) return;
    if (!allSelected) {
      setDeepseekError('请先完成抽牌（每个牌位都选择一张牌）。');
      return;
    }

    setDeepseekLoading(true);
    try {
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: buildUserPrompt() }
      ];
      const req = {
        apiKey: key,
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        thinking
      };

      if (!streamEnabled) {
        const resp = await callDeepSeekChat(req);
        const extracted = extractDeepSeekContent(resp);
        setDeepseekResult(extracted);
        return;
      }

      const controller = new AbortController();
      setAborter(controller);
      setDeepseekProgress({ content: '', reasoning: '' });

      const resp = await fetch('/api/deepseek/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildDeepSeekRequestBody(req, true)),
        signal: controller.signal
      });

      if (!resp.ok) {
        let data: any = null;
        try {
          data = await resp.json();
        } catch {
          // ignore
        }
        const upstreamMsg =
          (data && (data.error?.message || data.message || data.error?.type)) || `请求失败（HTTP ${resp.status}）`;
        const err: any = new Error(upstreamMsg);
        err.status = resp.status;
        err.data = data;
        throw err;
      }

      let content = '';
      let reasoning = '';
      let finishReason: string | undefined;

      await readSSEStream({
        response: resp,
        onData: (data) => {
          if (data === '[DONE]') return;
          try {
            const json = JSON.parse(data);
            const delta = extractDeepSeekStreamDelta(json);
            if (delta.reasoningDelta) reasoning += delta.reasoningDelta;
            if (delta.contentDelta) content += delta.contentDelta;
            if (delta.finishReason) finishReason = delta.finishReason;
            setDeepseekProgress({ content, reasoning });
          } catch (e) {
            console.warn('[deepseek-stream] parse error:', e);
          }
        }
      });

      setDeepseekResult({
        content,
        reasoningContent: reasoning ? reasoning : undefined,
        finishReason
      });
      setDeepseekProgress(null);
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        setDeepseekError('已停止生成。');
        return;
      }
      const status = e?.status;
      if (status === 401 || status === 403) setDeepseekError('DeepSeek 返回 401/403：API Key 无效或权限不足。');
      else if (status === 429) setDeepseekError('DeepSeek 返回 429：请求过于频繁（限流）。请稍后重试。');
      else if (status) setDeepseekError(`DeepSeek 请求失败（HTTP ${status}）：${e?.message || '未知错误'}`);
      else setDeepseekError(`网络错误：${e?.message || '请检查网络/代理'}`);
    } finally {
      setDeepseekLoading(false);
      setAborter(null);
    }
  }

  function saveToHistory() {
    if (!spread) return;
    if (!offlineReading) return;

    const createdAt = new Date().toISOString();
    const masked = maskQuestion(question);

    const cards = spread.positions
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((p) => {
        const d = drawn.find((x) => x.positionIndex === p.index)!;
        const c = deckById[d.cardId];
        return {
          positionIndex: p.index,
          positionTitle: p.title,
          positionQuestion: p.question,
          cardId: d.cardId,
          cardName: `${c.name_cn} / ${c.name_en}`,
          reversed: d.reversed
        };
      });

    const entry = {
      id: nowId(),
      createdAt,
      topic,
      timeframe,
      spreadId: spread.id,
      spreadName: spread.name,
      questionMasked: masked.masked,
      questionHidden: masked.hidden,
      cards,
      offlineReading,
      deepseek: deepseekResult
        ? { model, content: deepseekResult.content, reasoningContent: deepseekResult.reasoningContent, systemPrompt }
        : undefined
    };

    addHistoryEntry(entry);
    setToast('已保存到历史');
    setTimeout(() => setToast(null), 1500);
  }

  function exportThisJson() {
    if (!spread || !offlineReading || !allSelected) return;
    const createdAt = new Date().toISOString();
    exportJson(`tarot-current-${createdAt.slice(0, 19).replace(/[:T]/g, '-')}.json`, {
      createdAt,
      topic,
      timeframe,
      question: maskQuestion(question).masked,
      spread,
      drawn,
      offlineReading,
      deepseek: deepseekResult ? { model, ...deepseekResult } : null
    });
  }

  function exportThisMarkdown() {
    if (!spread || !offlineReading) return;
    const createdAt = new Date().toISOString();
    const masked = maskQuestion(question);
    const cards = spread.positions
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((p) => {
        const d = drawn.find((x) => x.positionIndex === p.index)!;
        const c = deckById[d.cardId];
        return {
          positionIndex: p.index,
          positionTitle: p.title,
          positionQuestion: p.question,
          cardId: d.cardId,
          cardName: `${c.name_cn} / ${c.name_en}`,
          reversed: d.reversed
        };
      });
    const entry = {
      id: nowId(),
      createdAt,
      topic,
      timeframe,
      spreadId: spread.id,
      spreadName: spread.name,
      questionMasked: masked.masked,
      questionHidden: masked.hidden,
      cards,
      offlineReading,
      deepseek: deepseekResult
        ? { model, content: deepseekResult.content, reasoningContent: deepseekResult.reasoningContent, systemPrompt }
        : undefined
    };
    exportEntryMarkdown(entry);
  }

  function exportThisPng() {
    if (!spread || !offlineReading || !allSelected) return;
    const createdAtISO = new Date().toISOString();
    const masked = maskQuestion(question);
    const timeText = new Date(createdAtISO).toLocaleString();

    const cards = spread.positions
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((p) => {
        const d = drawn.find((x) => x.positionIndex === p.index)!;
        const c = deckById[d.cardId];
        return `${p.index}. ${p.title}：${c.name_cn}（${d.reversed ? '逆位' : '正位'}）`;
      });

    const offlineBlocks = [
      { title: '离线｜一句话总览', lines: [offlineReading.overview] },
      {
        title: '离线｜逐牌位解读',
        lines: offlineReading.positions.map((p) => `${p.index}. ${p.title}｜${p.cardName}${p.reversed ? '（逆位）' : '（正位）'}\n${p.text}`)
      },
      { title: '离线｜冲突点/卡点', lines: offlineReading.conflicts },
      { title: '离线｜三条可执行建议', lines: offlineReading.actions },
      ...(offlineReading.domainTips?.length ? [{ title: '离线｜适用领域提示', lines: offlineReading.domainTips }] : []),
      ...(offlineReading.misconceptions?.length ? [{ title: '离线｜常见误区', lines: offlineReading.misconceptions }] : []),
      ...(offlineReading.questionPrompts?.length ? [{ title: '离线｜提问引导', lines: offlineReading.questionPrompts }] : []),
      {
        title: '离线｜时间窗口趋势（按建议做）',
        lines: offlineReading.trends.if_follow
      },
      {
        title: '离线｜时间窗口趋势（不做调整）',
        lines: offlineReading.trends.if_ignore
      },
      { title: '离线｜温和提醒', lines: [offlineReading.reminder] }
    ];

    const deepBlocks =
      deepseekResult?.content
        ? [
            {
              title: `DeepSeek｜解读正文（${model}）`,
              lines: [formatDeepSeekDisplayText(deepseekResult.content)]
            }
          ]
        : [];

    exportLongImagePng({
      filename: `tarot-${createdAtISO.slice(0, 19).replace(/[:T]/g, '-')}.png`,
      title: '塔罗解读（长图导出）',
      metaLines: [
        `时间：${timeText}`,
        `主题：${topic}｜时间范围：${timeframe || '（未填写）'}`,
        `牌阵：${spread.name}`,
        `提问：${masked.masked}`,
        `抽牌：\n${cards.join('\n')}`
      ],
      blocks: [...offlineBlocks, ...deepBlocks]
    });
  }

  function copyShareText() {
    if (!spread || !offlineReading) return;
    const createdAtISO = new Date().toISOString();
    const cards = spread.positions.map((p) => {
      const d = drawn.find((x) => x.positionIndex === p.index)!;
      const c = deckById[d.cardId];
      return {
        index: p.index,
        title: p.title,
        cardName: `${c.name_cn} / ${c.name_en}`,
        reversed: d.reversed
      };
    });
    const share = buildShareText({
      createdAtISO,
      topic,
      timeframe,
      question,
      spread,
      cards,
      offline: offlineReading
    });
    copyToClipboard(share.text);
  }

  return (
    <div className="grid">
      <section className="panel">
        <div className="panel__hd">
          <div>
            <div className="panel__title">输入与抽牌</div>
            <div className="panel__sub">离线可用；填 Key 可调用 DeepSeek（经本地代理 /api/deepseek/chat）</div>
          </div>
          {toast ? <div className="chip">{toast}</div> : <div className="chip">隐私规则：{privacyRulesText}</div>}
        </div>
        <div className="panel__bd">
          <div className="row">
            <div className="label">提问</div>
            <div>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="建议：聚焦可行动的问题。例如：我该如何提升学习效率？\n反例：TA是不是注定会爱上我？"
              />
              <div className="hint">
                提示：若提问超过 30 字或疑似包含姓名/电话/地址/邮箱/学号等信息，分享/历史会自动隐藏提问正文。
              </div>
              {!canDraw ? (
                <div className="notice" style={{ marginTop: 10 }}>
                  为了让解读更聚焦：请先填写“提问”，再进行抽牌。
                </div>
              ) : null}
            </div>
          </div>

          <div className="row">
            <div className="label">时间范围</div>
            <div>
              <input value={timeframe} onChange={(e) => setTimeframe(e.target.value)} placeholder="例如：7天内 / 1个月内 / 直到本学期结束" />
            </div>
          </div>

          <div className="row">
            <div className="label">主题 / 牌阵</div>
            <div className="split">
              <select value={topic} onChange={(e) => setTopic(e.target.value as Topic)}>
                <option value="感情">感情</option>
                <option value="学业">学业</option>
                <option value="工作">工作</option>
                <option value="自我成长">自我成长</option>
                <option value="人际关系">人际关系</option>
                <option value="家庭">家庭</option>
                <option value="健康">健康</option>
                <option value="财务">财务</option>
                <option value="创作">创作</option>
              </select>
              <select value={spreadId} onChange={(e) => setSpreadId(e.target.value)}>
                {spreads.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}（{s.n_cards}张）
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="row">
            <div className="label">推荐牌阵</div>
            <div className="btnGroup">
              {recommendedSpreads.map((s) => (
                <button
                  key={s.id}
                  className={s.id === spreadId ? 'btn btn--primary' : 'btn'}
                  onClick={() => setSpreadId(s.id)}
                  type="button"
                >
                  {s.name}
                </button>
              ))}
              <div className="hint">根据主题推荐 3 个常用牌阵，你也可以自行选择。</div>
            </div>
          </div>

          {spread ? (
            <div className="notice" style={{ marginBottom: 12 }}>
              <div>
                <strong>适用场景：</strong>
                {spread.use_cases.join(' / ')}
              </div>
              <div style={{ marginTop: 6 }}>
                <strong>提示：</strong>
                {spread.tips.join(' ')}
              </div>
            </div>
          ) : null}

          <div className="split" style={{ alignItems: 'center', marginBottom: 12 }}>
            <label className="chip" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={allowReversed} onChange={(e) => setAllowReversed(e.target.checked)} />
              <span>允许逆位</span>
            </label>
            <button className="btn btn--primary" onClick={doRandomDraw} disabled={!spread || !canDraw}>
              随机抽牌（不重复）
            </button>
            <button className="btn" onClick={clearCards} disabled={!spread}>
              清空
            </button>
          </div>

          <div className="row">
            <div className="label">随机数字</div>
            <div>
              <input
                type="number"
                value={seedNumberText}
                onChange={(e) => setSeedNumberText(e.target.value)}
                placeholder="可选：输入数字参与抽牌，例如 7 或 20260128（清空则恢复纯随机）"
              />
              <div className="hint">会把该数字与系统随机数混合来抽牌；同一数字不保证每次都抽到相同结果。</div>
            </div>
          </div>

          <div className="list">
            {spread?.positions
              .slice()
              .sort((a, b) => a.index - b.index)
              .map((p) => {
                const d = drawn.find((x) => x.positionIndex === p.index);
                const selectedId = d?.cardId ?? '';
                return (
                  <div className="cardItem" key={p.index}>
                    <div className="cardItem__hd">
                      <div className="cardItem__title">
                        {p.index}. {p.title}
                      </div>
                      <div className="chip">
                        <strong>问题句</strong>
                        <span className="chip__text">{p.question}</span>
                      </div>
                    </div>

                    <div className="cardItem__meta" style={{ marginTop: 10 }}>
                      <div className="row" style={{ marginBottom: 0 }}>
                        <div className="label">选择牌</div>
                        <div className="split">
                          <select
                            value={selectedId}
                            onChange={(e) => {
                              const nextId = e.target.value;
                              setDrawn((prev) =>
                                prev.map((x) => (x.positionIndex === p.index ? { ...x, cardId: nextId } : x))
                              );
                              setDeepseekResult(null);
                              setDeepseekError(null);
                            }}
                            disabled={!canDraw}
                          >
                            <option value="">（请选择）</option>
                            {deck.map((c) => {
                              const disabled = usedCardIds.has(c.id) && c.id !== selectedId;
                              return (
                                <option key={c.id} value={c.id} disabled={disabled}>
                                  {c.name_cn} / {c.name_en}
                                </option>
                              );
                            })}
                          </select>

                          <label
                            className="chip"
                            style={{ cursor: allowReversed ? 'pointer' : 'not-allowed', opacity: allowReversed ? 1 : 0.6 }}
                          >
                            <input
                              type="checkbox"
                              disabled={!allowReversed || !canDraw}
                              checked={Boolean(d?.reversed)}
                              onChange={(e) => {
                                const rev = e.target.checked;
                                setDrawn((prev) =>
                                  prev.map((x) => (x.positionIndex === p.index ? { ...x, reversed: rev } : x))
                                );
                                setDeepseekResult(null);
                                setDeepseekError(null);
                              }}
                            />
                            <span>逆位</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="hr" />

          <div className="panel__title" style={{ marginBottom: 10 }}>
            DeepSeek 设置（可选）
          </div>

          <div className="row">
            <div className="label">API Key</div>
            <div>
              <input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="在此粘贴 DeepSeek API Key（不会写入仓库；可选仅记住本次会话）"
              />
              <div className="split" style={{ alignItems: 'center', marginTop: 8 }}>
                <label className="chip" style={{ cursor: 'pointer' }}>
                  <input type="checkbox" checked={rememberSession} onChange={(e) => setRememberSession(e.target.checked)} />
                  <span>仅记住本次会话（sessionStorage）</span>
                </label>
                <label className="chip" style={{ cursor: 'pointer' }}>
                  <input type="checkbox" checked={streamEnabled} onChange={(e) => setStreamEnabled(e.target.checked)} />
                  <span>流式输出（更像实时生成）</span>
                </label>
                <label className="chip" style={{ cursor: 'pointer' }}>
                  <span className="mono">模型</span>
                  <select value={model} onChange={(e) => setModel(e.target.value as DeepSeekModel)}>
                    <option value="deepseek-chat">deepseek-chat（默认）</option>
                    <option value="deepseek-reasoner">deepseek-reasoner（含推理）</option>
                  </select>
                </label>
              </div>
              <div className="hint">
                安全性：前端只请求同源 <span className="mono">/api/deepseek/chat</span>，由本地代理转发到 DeepSeek；Key 不落盘。
              </div>
            </div>
          </div>

          <div className="row">
            <div className="label">系统提示词</div>
            <div>
              <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />
              <div className="actions" style={{ marginTop: 8 }}>
                <button className="btn" onClick={() => setSystemPrompt(DEFAULT_SYSTEM_PROMPT)}>
                  重置为默认
                </button>
              </div>
            </div>
          </div>

          <details style={{ marginTop: 10 }}>
            <summary>高级参数（可选）</summary>
            <div style={{ marginTop: 10 }}>
              <div className="row">
                <div className="label">temperature</div>
                <div className="split">
                  <input
                    type="number"
                    min={0}
                    max={1.2}
                    step={0.1}
                    value={temperature}
                    onChange={(e) => setTemperature(Number(e.target.value))}
                  />
                  <span className="hint">建议 0.5~0.9；越高越发散。</span>
                </div>
              </div>
              <div className="row">
                <div className="label">max_tokens</div>
                <div className="split">
                  <input
                    type="number"
                    min={256}
                    max={3000}
                    step={64}
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(Number(e.target.value))}
                  />
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setMaxTokens(recommendedMaxTokens)}
                    disabled={maxTokens === recommendedMaxTokens}
                  >
                    使用推荐：{recommendedMaxTokens}
                  </button>
                  <span className="hint">输出被截断时优先调大；过大可能更慢/更贵。</span>
                </div>
              </div>
              <div className="row">
                <div className="label">thinking</div>
                <div className="split">
                  <select
                    value={thinking?.type ?? ''}
                    onChange={(e) => {
                      const v = e.target.value as '' | 'enabled' | 'disabled';
                      setThinking(v ? { type: v } : undefined);
                    }}
                  >
                    <option value="">（不发送）</option>
                    <option value="enabled">enabled</option>
                    <option value="disabled">disabled</option>
                  </select>
                  <span className="hint">仅在模型支持时生效；不确定可保持“不发送”。</span>
                </div>
              </div>
            </div>
          </details>

          <div className="hr" />

          <div className="actionGrid">
            <button className="btn btn--primary" onClick={runDeepSeek} disabled={deepseekLoading || !allSelected}>
              {deepseekLoading ? 'DeepSeek 解读中…' : '生成 DeepSeek 解读'}
            </button>
            {aborter ? (
              <button
                className="btn btn--danger"
                onClick={() => {
                  aborter.abort();
                  setAborter(null);
                  setDeepseekLoading(false);
                }}
              >
                停止生成
              </button>
            ) : null}
            <button className="btn" onClick={copyShareText} disabled={!offlineReading}>
              复制分享文本
            </button>
            <button className="btn" onClick={saveToHistory} disabled={!offlineReading}>
              保存到历史
            </button>
            <button className="btn" onClick={exportThisMarkdown} disabled={!offlineReading}>
              导出本次（Markdown）
            </button>
            <button className="btn" onClick={exportThisJson} disabled={!offlineReading}>
              导出本次（JSON）
            </button>
            <button className="btn" onClick={exportThisPng} disabled={!offlineReading}>
              导出本次（PNG长图）
            </button>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__hd">
          <div>
            <div className="panel__title">解读结果</div>
            <div className="panel__sub">离线基础解读（必有） / DeepSeek（可选）</div>
          </div>
          {allSelected ? (
            <div className="chip">
              <strong>已抽</strong>
              <span>{drawn.length} 张</span>
            </div>
          ) : (
            <div className="chip">请完成抽牌</div>
          )}
        </div>
        <div className="panel__bd">
          {offlineReading ? (
            <>
              <div className="panel__title">离线基础解读</div>
              <div className="hint">基于本地牌义库生成：不依赖网络、不依赖 Key，适合作为“可行动的初稿”。</div>
              <div className="hr" />

              <div className="cardItem">
                <div className="cardItem__title">1) 一句话总览</div>
                <div style={{ marginTop: 8 }}>{offlineReading.overview}</div>
              </div>

              <div className="hr" />

              <div className="cardItem">
                <div className="cardItem__title">2) 逐牌位解读</div>
                <div className="list" style={{ marginTop: 10 }}>
                  {offlineReading.positions.map((p) => (
                    <div className="cardItem" key={p.index} style={{ margin: 0 }}>
                      <div className="cardItem__hd">
                        <div className="cardItem__title">
                          {p.index}. {p.title}｜{p.cardName}
                          {p.reversed ? '（逆位）' : '（正位）'}
                        </div>
                      </div>
                      <div className="cardItem__meta">{p.question}</div>
                      <div style={{ marginTop: 8, lineHeight: 1.7 }}>{p.text}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="hr" />

              <div className="cardItem">
                <div className="cardItem__title">3) 冲突点/卡点（3条要点）</div>
                <ul style={{ margin: '10px 0 0 18px', lineHeight: 1.7, color: 'rgba(255,255,255,0.86)' }}>
                  {offlineReading.conflicts.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>

              <div className="hr" />

              <div className="cardItem">
                <div className="cardItem__title">4) 三条可执行建议（具体动作）</div>
                <ul style={{ margin: '10px 0 0 18px', lineHeight: 1.7, color: 'rgba(255,255,255,0.86)' }}>
                  {offlineReading.actions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>

              <div className="hr" />

              {offlineReading.domainTips?.length || offlineReading.misconceptions?.length || offlineReading.questionPrompts?.length ? (
                <>
                  <div className="cardItem">
                    <div className="cardItem__title">补充：更贴近你的问题</div>

                    {offlineReading.domainTips?.length ? (
                      <>
                        <div className="hr" />
                        <div className="cardItem__title">适用领域提示</div>
                        <ul style={{ margin: '10px 0 0 18px', lineHeight: 1.7, color: 'rgba(255,255,255,0.86)' }}>
                          {offlineReading.domainTips.map((t, i) => (
                            <li key={i}>{t}</li>
                          ))}
                        </ul>
                      </>
                    ) : null}

                    {offlineReading.misconceptions?.length ? (
                      <>
                        <div className="hr" />
                        <div className="cardItem__title">常见误区（避免踩坑）</div>
                        <ul style={{ margin: '10px 0 0 18px', lineHeight: 1.7, color: 'rgba(255,255,255,0.86)' }}>
                          {offlineReading.misconceptions.map((t, i) => (
                            <li key={i}>{t}</li>
                          ))}
                        </ul>
                      </>
                    ) : null}

                    {offlineReading.questionPrompts?.length ? (
                      <>
                        <div className="hr" />
                        <div className="cardItem__title">提问引导（你可以这样问）</div>
                        <ul style={{ margin: '10px 0 0 18px', lineHeight: 1.7, color: 'rgba(255,255,255,0.86)' }}>
                          {offlineReading.questionPrompts.map((t, i) => (
                            <li key={i}>{t}</li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                  </div>

                  <div className="hr" />
                </>
              ) : null}

              <div className="cardItem">
                <div className="cardItem__title">5) 时间窗口趋势</div>
                <div className="hint" style={{ marginTop: 8 }}>
                  这是“倾向”而非保证。建议把趋势当成你检验行动效果的反馈指标。
                </div>
                <div className="hr" />
                <div className="cardItem" style={{ margin: 0 }}>
                  <div className="cardItem__title">按建议做的倾向</div>
                  <ul style={{ margin: '10px 0 0 18px', lineHeight: 1.7, color: 'rgba(255,255,255,0.86)' }}>
                    {offlineReading.trends.if_follow.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
                <div className="hr" />
                <div className="cardItem" style={{ margin: 0 }}>
                  <div className="cardItem__title">不做调整的倾向</div>
                  <ul style={{ margin: '10px 0 0 18px', lineHeight: 1.7, color: 'rgba(255,255,255,0.86)' }}>
                    {offlineReading.trends.if_ignore.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="hr" />

              <div className="cardItem">
                <div className="cardItem__title">6) 一句温和提醒</div>
                <div style={{ marginTop: 8 }}>{offlineReading.reminder}</div>
              </div>
            </>
          ) : (
            <div className="notice">请先选择牌阵并完成抽牌；离线基础解读会自动生成。</div>
          )}

          <div className="hr" />

          <div className="panel__title">DeepSeek 解读</div>
          <div className="hint">需要在左侧填写 API Key；若使用 reasoner 且返回推理内容，会以折叠形式展示。</div>

          {deepseekError ? (
            <div className="error" style={{ marginTop: 10 }}>
              {deepseekError}
            </div>
          ) : null}

          {deepseekResult?.finishReason === 'length' ? (
            <div className="notice" style={{ marginTop: 10 }}>
              本次输出可能被截断（finish_reason=length）。在左侧“高级参数”把 <span className="mono">max_tokens</span> 调大（推荐{' '}
              {recommendedMaxTokens}）后重试，或选择更少张的牌阵/缩短提问与提示词。
            </div>
          ) : null}

          {deepseekResult ? (
            <div className="cardItem" style={{ marginTop: 10 }}>
              {deepseekResult.reasoningContent ? (
                <details>
                  <summary>推理内容（折叠）</summary>
                  <pre className="mono" style={{ whiteSpace: 'pre-wrap', marginTop: 10 }}>
                    {formatDeepSeekDisplayText(deepseekResult.reasoningContent)}
                  </pre>
                </details>
              ) : null}
              <div style={{ marginTop: deepseekResult.reasoningContent ? 12 : 0 }}>
                <div className="cardItem__title">解读正文</div>
                <pre style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65, marginTop: 10 }}>
                  {formatDeepSeekDisplayText(deepseekResult.content)}
                </pre>
              </div>
              {deepseekResult.usage?.total_tokens ? (
                <div className="hint" style={{ marginTop: 10 }}>
                  tokens：prompt {String(deepseekResult.usage.prompt_tokens ?? '?')} / completion{' '}
                  {String(deepseekResult.usage.completion_tokens ?? '?')} / total {String(deepseekResult.usage.total_tokens)}
                </div>
              ) : null}
              <div className="hint" style={{ marginTop: 10 }}>
                提示：若返回结构异常，已在本地控制台输出调试信息（不包含 API Key）。
              </div>
            </div>
          ) : deepseekProgress ? (
            <div className="cardItem" style={{ marginTop: 10 }}>
              {deepseekProgress.reasoning ? (
                <details>
                  <summary>推理内容{deepseekLoading ? '（生成中…）' : ''}</summary>
                  <pre className="mono" style={{ whiteSpace: 'pre-wrap', marginTop: 10 }}>
                    {formatDeepSeekDisplayText(deepseekProgress.reasoning)}
                  </pre>
                </details>
              ) : null}
              <div style={{ marginTop: deepseekProgress.reasoning ? 12 : 0 }}>
                <div className="cardItem__title">解读正文{deepseekLoading ? '（生成中…）' : ''}</div>
                <pre style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65, marginTop: 10 }}>
                  {formatDeepSeekDisplayText(deepseekProgress.content)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="notice" style={{ marginTop: 10 }}>
              未生成 DeepSeek 解读：你可以先使用离线基础解读；填 Key 后再点击“生成 DeepSeek 解读”增强表述与结构。
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
