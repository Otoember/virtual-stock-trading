import { useMemo, useState } from 'react';
import spreadsData from '../data/spreads.json';
import type { HistoryEntry } from '../lib/types';
import { clearHistory, deleteHistoryEntry, loadHistory } from '../lib/historyStorage';
import { exportAllJson, exportAllMarkdown, exportEntryJson, exportEntryMarkdown } from '../lib/exporters';
import { formatDeepSeekDisplayText } from '../lib/textFormat';
import { exportLongImagePng } from '../lib/imageExport';
import type { Spread } from '../lib/types';

const spreads = spreadsData as Spread[];

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>(() => loadHistory());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [topic, setTopic] = useState<'全部' | HistoryEntry['topic']>('全部');
  const [spreadId, setSpreadId] = useState<'全部' | string>('全部');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const selected = useMemo(() => entries.find((e) => e.id === selectedId) ?? null, [entries, selectedId]);

  const filteredEntries = useMemo(() => {
    const text = q.trim().toLowerCase();
    const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTime = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;

    return entries.filter((e) => {
      if (topic !== '全部' && e.topic !== topic) return false;
      if (spreadId !== '全部' && e.spreadId !== spreadId) return false;

      const t = new Date(e.createdAt).getTime();
      if (fromTime !== null && Number.isFinite(fromTime) && t < fromTime) return false;
      if (toTime !== null && Number.isFinite(toTime) && t > toTime) return false;

      if (text) {
        const hay = `${e.spreadName} ${e.questionMasked}`.toLowerCase();
        if (!hay.includes(text)) return false;
      }
      return true;
    });
  }, [dateFrom, dateTo, entries, q, spreadId, topic]);

  function onDelete(id: string) {
    const next = deleteHistoryEntry(id);
    setEntries(next);
    if (selectedId === id) setSelectedId(null);
  }

  function onClear() {
    const ok = confirm('确认清空全部历史记录？此操作不可撤销。');
    if (!ok) return;
    setEntries(clearHistory());
    setSelectedId(null);
  }

  function exportSelectedPng(entry: HistoryEntry) {
    const timeText = new Date(entry.createdAt).toLocaleString();
    const cards = entry.cards
      .slice()
      .sort((a, b) => a.positionIndex - b.positionIndex)
      .map((c) => `${c.positionIndex}. ${c.positionTitle}：${c.cardName}${c.reversed ? '（逆位）' : '（正位）'}`);

    const offline = entry.offlineReading;
    const offlineBlocks = [
      { title: '离线｜一句话总览', lines: [offline.overview] },
      {
        title: '离线｜逐牌位解读',
        lines: offline.positions.map((p) => `${p.index}. ${p.title}｜${p.cardName}${p.reversed ? '（逆位）' : '（正位）'}\n${p.text}`)
      },
      { title: '离线｜冲突点/卡点', lines: offline.conflicts },
      { title: '离线｜三条可执行建议', lines: offline.actions },
      ...(offline.domainTips?.length ? [{ title: '离线｜适用领域提示', lines: offline.domainTips }] : []),
      ...(offline.misconceptions?.length ? [{ title: '离线｜常见误区', lines: offline.misconceptions }] : []),
      ...(offline.questionPrompts?.length ? [{ title: '离线｜提问引导', lines: offline.questionPrompts }] : []),
      { title: '离线｜时间窗口趋势（按建议做）', lines: offline.trends.if_follow },
      { title: '离线｜时间窗口趋势（不做调整）', lines: offline.trends.if_ignore },
      { title: '离线｜温和提醒', lines: [offline.reminder] }
    ];

    const deepBlocks =
      entry.deepseek?.content
        ? [
            {
              title: `DeepSeek｜解读正文（${entry.deepseek.model}）`,
              lines: [formatDeepSeekDisplayText(entry.deepseek.content)]
            }
          ]
        : [];

    exportLongImagePng({
      filename: `tarot-${entry.id}.png`,
      title: '塔罗解读记录（长图导出）',
      metaLines: [
        `时间：${timeText}`,
        `主题：${entry.topic}｜时间范围：${entry.timeframe || '（未填写）'}`,
        `牌阵：${entry.spreadName}`,
        `提问：${entry.questionMasked}`,
        `抽牌：\n${cards.join('\n')}`
      ],
      blocks: [...offlineBlocks, ...deepBlocks]
    });
  }

  return (
    <div className="grid">
      <section className="panel">
        <div className="panel__hd">
          <div>
            <div className="panel__title">历史日志</div>
            <div className="panel__sub">保存在浏览器 localStorage；可导出 Markdown / JSON</div>
          </div>
          <div className="chip">
            <strong>显示/总数</strong>
            <span>
              {filteredEntries.length}/{entries.length}
            </span>
          </div>
        </div>
        <div className="panel__bd">
          <div className="cardItem" style={{ marginBottom: 12 }}>
            <div className="cardItem__title">搜索/筛选</div>
            <div className="row" style={{ marginTop: 10 }}>
              <div className="label">关键词</div>
              <div>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索牌阵名/提问（已脱敏）" />
              </div>
            </div>
            <div className="row">
              <div className="label">主题</div>
              <div className="split">
                <select value={topic} onChange={(e) => setTopic(e.target.value as any)}>
                  <option value="全部">全部</option>
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
                  <option value="全部">全部牌阵</option>
                  {spreads.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="row" style={{ marginBottom: 0 }}>
              <div className="label">日期范围</div>
              <div className="split">
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                <button
                  className="btn"
                  onClick={() => {
                    setQ('');
                    setTopic('全部');
                    setSpreadId('全部');
                    setDateFrom('');
                    setDateTo('');
                  }}
                >
                  清空筛选
                </button>
              </div>
            </div>
          </div>

          <div className="actionGrid" style={{ marginBottom: 12 }}>
            <button className="btn" onClick={() => exportAllMarkdown(entries)} disabled={entries.length === 0}>
              导出全部（Markdown）
            </button>
            <button className="btn" onClick={() => exportAllJson(entries)} disabled={entries.length === 0}>
              导出全部（JSON）
            </button>
            <button className="btn btn--danger" onClick={onClear} disabled={entries.length === 0}>
              全部清空
            </button>
          </div>

          {entries.length === 0 ? (
            <div className="notice">暂无记录：去“占卜”页抽牌后点击“保存到历史”。</div>
          ) : (
            <div className="list">
              {filteredEntries.map((e) => (
                <div className="cardItem" key={e.id}>
                  <div className="cardItem__hd">
                    <div className="cardItem__title">{e.spreadName}</div>
                    <div className="actions">
                      <button className="btn" onClick={() => setSelectedId(e.id)}>
                        查看
                      </button>
                      <button className="btn btn--danger" onClick={() => onDelete(e.id)}>
                        删除
                      </button>
                    </div>
                  </div>
                  <div className="cardItem__meta">
                    <div>时间：{new Date(e.createdAt).toLocaleString()}</div>
                    <div>
                      主题：{e.topic}｜时间范围：{e.timeframe || '（未填写）'}
                    </div>
                    <div>提问：{e.questionMasked}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel__hd">
          <div>
            <div className="panel__title">记录详情</div>
            <div className="panel__sub">点击左侧“查看”打开；可单条导出/删除</div>
          </div>
        </div>
        <div className="panel__bd">
          {selected ? (
            <>
              <div className="actionGrid" style={{ marginBottom: 12 }}>
                <button className="btn" onClick={() => exportEntryMarkdown(selected)}>
                  导出（Markdown）
                </button>
                <button className="btn" onClick={() => exportEntryJson(selected)}>
                  导出（JSON）
                </button>
                <button className="btn" onClick={() => exportSelectedPng(selected)}>
                  导出（PNG长图）
                </button>
                <button className="btn btn--danger" onClick={() => onDelete(selected.id)}>
                  删除本条
                </button>
              </div>

              <div className="cardItem">
                <div className="cardItem__title">{selected.spreadName}</div>
                <div className="cardItem__meta">
                  <div>时间：{new Date(selected.createdAt).toLocaleString()}</div>
                  <div>
                    主题：{selected.topic}｜时间范围：{selected.timeframe || '（未填写）'}
                  </div>
                  <div>提问：{selected.questionMasked}</div>
                </div>
              </div>

              <div className="hr" />

              <div className="cardItem">
                <div className="cardItem__title">抽牌</div>
                <div className="list" style={{ marginTop: 10 }}>
                  {selected.cards
                    .slice()
                    .sort((a, b) => a.positionIndex - b.positionIndex)
                    .map((c) => (
                      <div className="cardItem" key={c.positionIndex} style={{ margin: 0 }}>
                        <div className="cardItem__title">
                          {c.positionIndex}. {c.positionTitle}：{c.cardName}
                          {c.reversed ? '（逆位）' : '（正位）'}
                        </div>
                        <div className="cardItem__meta">{c.positionQuestion}</div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="hr" />

              <div className="cardItem">
                <div className="cardItem__title">离线基础解读</div>
                <div className="cardItem__meta" style={{ marginTop: 8 }}>
                  1) 一句话总览：{selected.offlineReading.overview}
                </div>
                <div className="hr" />
                <div className="cardItem__title">逐牌位解读</div>
                <div className="list" style={{ marginTop: 10 }}>
                  {selected.offlineReading.positions.map((p) => (
                    <div className="cardItem" key={p.index} style={{ margin: 0 }}>
                      <div className="cardItem__title">
                        {p.index}. {p.title}｜{p.cardName}
                        {p.reversed ? '（逆位）' : '（正位）'}
                      </div>
                      <div className="cardItem__meta">{p.question}</div>
                      <div style={{ marginTop: 8, lineHeight: 1.7 }}>{p.text}</div>
                    </div>
                  ))}
                </div>

                <div className="hr" />

                <div className="cardItem__title">冲突点/卡点</div>
                <ul style={{ margin: '10px 0 0 18px', lineHeight: 1.7, color: 'rgba(255,255,255,0.86)' }}>
                  {selected.offlineReading.conflicts.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>

                <div className="hr" />

                <div className="cardItem__title">可执行建议</div>
                <ul style={{ margin: '10px 0 0 18px', lineHeight: 1.7, color: 'rgba(255,255,255,0.86)' }}>
                  {selected.offlineReading.actions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>

                <div className="hr" />

                {selected.offlineReading.domainTips?.length ||
                selected.offlineReading.misconceptions?.length ||
                selected.offlineReading.questionPrompts?.length ? (
                  <>
                    <div className="cardItem__title">补充：更贴近你的问题</div>

                    {selected.offlineReading.domainTips?.length ? (
                      <>
                        <div className="hr" />
                        <div className="cardItem__title">适用领域提示</div>
                        <ul style={{ margin: '10px 0 0 18px', lineHeight: 1.7, color: 'rgba(255,255,255,0.86)' }}>
                          {selected.offlineReading.domainTips.map((t, i) => (
                            <li key={i}>{t}</li>
                          ))}
                        </ul>
                      </>
                    ) : null}

                    {selected.offlineReading.misconceptions?.length ? (
                      <>
                        <div className="hr" />
                        <div className="cardItem__title">常见误区（避免踩坑）</div>
                        <ul style={{ margin: '10px 0 0 18px', lineHeight: 1.7, color: 'rgba(255,255,255,0.86)' }}>
                          {selected.offlineReading.misconceptions.map((t, i) => (
                            <li key={i}>{t}</li>
                          ))}
                        </ul>
                      </>
                    ) : null}

                    {selected.offlineReading.questionPrompts?.length ? (
                      <>
                        <div className="hr" />
                        <div className="cardItem__title">提问引导（你可以这样问）</div>
                        <ul style={{ margin: '10px 0 0 18px', lineHeight: 1.7, color: 'rgba(255,255,255,0.86)' }}>
                          {selected.offlineReading.questionPrompts.map((t, i) => (
                            <li key={i}>{t}</li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                  </>
                ) : null}

                <div className="hr" />

                <div className="cardItem__title">温和提醒</div>
                <div style={{ marginTop: 8 }}>{selected.offlineReading.reminder}</div>
              </div>

              <div className="hr" />

              <div className="cardItem">
                <div className="cardItem__title">DeepSeek 解读</div>
                {selected.deepseek ? (
                  <>
                    <div className="cardItem__meta">模型：{selected.deepseek.model}</div>
                    {selected.deepseek.reasoningContent ? (
                      <details style={{ marginTop: 10 }}>
                        <summary>推理内容（折叠）</summary>
                        <pre className="mono" style={{ whiteSpace: 'pre-wrap', marginTop: 10 }}>
                          {formatDeepSeekDisplayText(selected.deepseek.reasoningContent)}
                        </pre>
                      </details>
                    ) : null}
                    <pre style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65, marginTop: 10 }}>
                      {formatDeepSeekDisplayText(selected.deepseek.content)}
                    </pre>
                  </>
                ) : (
                  <div className="notice" style={{ marginTop: 10 }}>
                    本条记录未生成 DeepSeek 解读。
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="notice">未选择记录：请在左侧点击“查看”。</div>
          )}
        </div>
      </section>
    </div>
  );
}
