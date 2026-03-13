export type Provider = 'gemini' | 'openai' | 'deepseek' | 'zhipu' | 'moonshot' | 'custom';

export interface Settings {
  provider: Provider;
  apiKey: string;
  baseUrl: string;
  model: string;
  minWordCount: number;
}

export interface BookInfo {
  title: string;
  themes: string[];
  lengthType: 'short' | 'medium' | 'long';
  targetChapterCount: number;
  outline: string;
  worldbuilding: string;
}

export interface ShortStoryInfo {
  title: string;
  themes: string[];
  targetWordCount: number;
  outline: string;
  content: string;
}

export interface Character {
  id: string;
  name: string;
  role: string;
  description: string;
}

export interface TOCItem {
  chapterNumber: number;
  title: string;
  summary: string;
}
