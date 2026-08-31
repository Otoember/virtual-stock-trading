export type Topic =
  | '感情'
  | '学业'
  | '工作'
  | '自我成长'
  | '人际关系'
  | '家庭'
  | '健康'
  | '财务'
  | '创作';

export type DeepSeekModel = 'deepseek-chat' | 'deepseek-reasoner';

export type ThinkingParam = { type: 'enabled' | 'disabled' };

export type SpreadPosition = {
  index: number;
  title: string;
  question: string;
};

export type Spread = {
  id: string;
  name: string;
  use_cases: string[];
  n_cards: number;
  positions: SpreadPosition[];
  reading_order: number[];
  tips: string[];
};

export type DeckCard = {
  id: string;
  name_cn: string;
  name_en: string;
  keywords_upright: string[];
  keywords_reversed: string[];
  short_meaning: string;
  advice: string;
  caution: string;
  domain_tips?: string[];
  misconceptions?: string[];
  question_prompts?: string[];
};

export type DrawnCard = {
  positionIndex: number;
  cardId: string;
  reversed: boolean;
};

export type StructuredPositionReading = {
  index: number;
  title: string;
  question: string;
  cardId: string;
  cardName: string;
  reversed: boolean;
  text: string;
};

export type StructuredReading = {
  overview: string;
  positions: StructuredPositionReading[];
  conflicts: string[];
  actions: string[];
  domainTips?: string[];
  misconceptions?: string[];
  questionPrompts?: string[];
  trends: { if_follow: string[]; if_ignore: string[] };
  reminder: string;
};

export type DeepSeekResult = {
  model: DeepSeekModel;
  content: string;
  reasoningContent?: string;
};

export type PrivacyCheck = {
  shouldHide: boolean;
  reasons: string[];
};

export type HistoryEntry = {
  id: string;
  createdAt: string;
  topic: Topic;
  timeframe: string;
  spreadId: string;
  spreadName: string;
  questionMasked: string;
  questionHidden: boolean;
  cards: Array<{
    positionIndex: number;
    positionTitle: string;
    positionQuestion: string;
    cardId: string;
    cardName: string;
    reversed: boolean;
  }>;
  offlineReading: StructuredReading;
  deepseek?: DeepSeekResult & { systemPrompt: string };
};
