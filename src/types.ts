export type Provider = 'gemini' | 'openai' | 'deepseek' | 'zhipu' | 'moonshot' | 'custom' | 'kilo' | 'free';

export interface Settings {
  provider: Provider;
  apiKey: string;
  apiKeys: string[]; // 多密钥轮询（主要用于免费提供商）
  currentKeyIndex: number; // 当前使用的密钥索引
  baseUrl: string;
  model: string;
  availableModels: ModelInfo[]; // 可用模型列表
  minWordCount: number;
  temperature: number; // 温度参数，控制创作自由度 (0-2)
}

export interface BookInfo {
  title: string;
  themes: string[];
  lengthType: string;
  targetChapterCount: number;
  outline: string;
  worldbuilding: string;
  endingOutline: string;
  titleOptions?: Array<{title: string, intro: string}>; // 生成的书名选项列表（含介绍）
  isTitleSelected?: boolean; // 是否已选择书名
  enableRealms?: boolean; // 是否启用境界体系
}

export interface StorySegment {
  segmentNumber: number;
  title: string;
  wordCount: number;
  summary: string;
  content: string;
  isGenerated: boolean;
}

export interface ShortStoryInfo {
  title: string;
  themes: string[];
  targetWordCount: number;
  outline: string;
  content: string;
  segments: StorySegment[];
  currentSegment: number; // 当前正在生成的分段
  isOutlineGenerated: boolean;
}

export interface Character {
  id: string;
  name: string;
  role: string;
  description: string;
}

export interface SubRealm {
  name: string;         // 如 "初期" "中期" "后期" "圆满"
  description: string; // 简要描述
}

export interface Realm {
  id: string;
  name: string;
  level: number;
  description: string;
  breakthroughCondition: string;
  subRealms: SubRealm[]; // 小境界，如 [初期, 中期, 后期, 圆满]
}

export interface RealmProgress {
  realms: Realm[];
  protagonistCurrentRealmIndex: number;
  protagonistCurrentSubRealmIndex: number; // 当前大境界内的小境界索引
  chapterRealmMap: Record<number, { realmIndex: number; subRealmIndex: number }>; // chapterNumber -> {大境界索引, 小境界索引}
}

export interface TOCItem {
  chapterNumber: number;
  title: string;
  summary: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: Provider;
  contextLength?: number;
}

