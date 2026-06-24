import { GoogleGenAI } from "@google/genai";
import { Settings, BookInfo, Character, TOCItem, ShortStoryInfo, StorySegment, Realm, SubRealm, RealmProgress, NovelMemory } from "../types";
import { getThemePrompt } from "../config/themes";

function extractJSON(text: string): any {
  // 提取JSON文本
  let jsonStr = text;
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) {
    jsonStr = match[1];
  }

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // 尝试自动修复常见JSON错误
    try {
      // 修复1: 数组元素之间缺少 } (如 }  { → }, {)
      let fixed = jsonStr.replace(/\}\s*\{/g, '}, {');
      // 修复1b: 对象之间完全缺少闭合}（如 "字符串值"\n    { → "字符串值"}\n    {）
      fixed = fixed.replace(/"\s*\n(\s*)\{/g, '"}\n$1{');
      // 修复2: 末尾多余的逗号
      fixed = fixed.replace(/,\s*([}\]])/g, '$1');
      // 修复3: AI把键值对写成 "key:value" 而非 "key":value（如 "chapterNumber:124" → "chapterNumber":124）
      fixed = fixed.replace(/"(\w+):(\d+)"\s*:/g, '"$1":$2,');
      // 修复4: 缺少闭合的 } (统计 { 和 } 数量，补齐)
      const openBraces = (fixed.match(/{/g) || []).length;
      const closeBraces = (fixed.match(/}/g) || []).length;
      if (openBraces > closeBraces) {
        fixed += '}'.repeat(openBraces - closeBraces);
      }
      const openBrackets = (fixed.match(/\[/g) || []).length;
      const closeBrackets = (fixed.match(/]/g) || []).length;
      if (openBrackets > closeBrackets) {
        fixed += ']'.repeat(openBrackets - closeBrackets);
      }
      return JSON.parse(fixed);
    } catch (e2) {
      console.error("Failed to parse JSON:", text);
      throw new Error("AI 返回的数据格式不正确，请重试。");
    }
  }
}

function ensureArray<T = any>(value: any, fieldName: string): T[] {
  if (Array.isArray(value)) return value;
  throw new Error(`AI 返回的数据缺少有效的 ${fieldName} 数组，请重试。`);
}

function cleanText(value: any): string {
  return typeof value === 'string' ? value.trim() : '';
}

const FINAL_ONLY_TITLE_PATTERN = /(大结局|最终章|终章|尾声|完结|结局篇|全书终)/;
const EARLY_ENDING_TITLE_PATTERN = /(大结局|最终章|终章|尾声|完结|结局篇|全书终|终局|最终|最后一战|最后的决战|落幕|归宿|终点|终焉|谢幕|尘埃落定|一切终结)/;

function getClosingTitleStart(targetChapterCount: number): number {
  const closingWindow = Math.max(5, Math.ceil(targetChapterCount * 0.05));
  return Math.max(1, targetChapterCount - closingWindow + 1);
}

function getEndingTitleIssue(title: string, chapterNumber: number, targetChapterCount: number): string | undefined {
  if (FINAL_ONLY_TITLE_PATTERN.test(title) && chapterNumber !== targetChapterCount) {
    return `第${chapterNumber}章标题“${title}”过早使用大结局/终章类词汇`;
  }

  const closingTitleStart = getClosingTitleStart(targetChapterCount);
  if (EARLY_ENDING_TITLE_PATTERN.test(title) && chapterNumber < closingTitleStart) {
    return `第${chapterNumber}章标题“${title}”带有结局感，只能放在第${closingTitleStart}章之后`;
  }

  return undefined;
}

function validateBookTitles(data: any): Array<{ title: string; intro: string }> {
  return ensureArray<any>(data?.titles, 'titles')
    .map(item => ({
      title: cleanText(item?.title),
      intro: cleanText(item?.intro),
    }))
    .filter(item => item.title && item.intro)
    .slice(0, 5);
}

function validateCharacters(data: any): Character[] {
  const names = new Set<string>();
  const characters = ensureArray<any>(data?.characters, 'characters')
    .map((item, index) => ({
      id: cleanText(item?.id) || `char${index + 1}`,
      name: cleanText(item?.name),
      role: cleanText(item?.role),
      description: cleanText(item?.description),
    }))
    .filter(item => item.name && item.role && item.description)
    .filter(item => {
      if (names.has(item.name)) return false;
      names.add(item.name);
      return true;
    });

  if (characters.length === 0) {
    throw new Error('AI 返回的人物设定为空或字段不完整，请重试。');
  }
  return characters;
}

function validateTOC(data: any, startIndex: number, endIndex: number, existingTitles: string[], targetChapterCount = endIndex): TOCItem[] {
  const titleSet = new Set(existingTitles.map(title => title.trim()));
  const byChapter = new Map<number, TOCItem>();
  const invalidTitleIssues: string[] = [];

  ensureArray<any>(data?.chapters, 'chapters').forEach(item => {
    const chapterNumber = Number(item?.chapterNumber);
    const title = cleanText(item?.title);
    const summary = cleanText(item?.summary);
    if (!Number.isInteger(chapterNumber) || chapterNumber < startIndex || chapterNumber > endIndex) return;
    if (!title || !summary || titleSet.has(title)) return;
    const endingTitleIssue = getEndingTitleIssue(title, chapterNumber, targetChapterCount);
    if (endingTitleIssue) {
      invalidTitleIssues.push(endingTitleIssue);
      return;
    }
    if (!byChapter.has(chapterNumber)) {
      byChapter.set(chapterNumber, { chapterNumber, title, summary });
      titleSet.add(title);
    }
  });

  const chapters = Array.from(byChapter.values()).sort((a, b) => a.chapterNumber - b.chapterNumber);
  const expectedCount = endIndex - startIndex + 1;
  if (chapters.length !== expectedCount) {
    if (invalidTitleIssues.length > 0) {
      throw new Error(`AI 返回的目录标题节奏不合理：${invalidTitleIssues[0]}，请重试。`);
    }
    throw new Error(`AI 返回的目录不完整：期望 ${expectedCount} 章，实际有效 ${chapters.length} 章，请重试。`);
  }
  return chapters;
}

function validateRealms(data: any): Realm[] {
  const realms = ensureArray<any>(data?.realms, 'realms')
    .map((item, index) => ({
      id: cleanText(item?.id) || `realm${index + 1}`,
      name: cleanText(item?.name),
      level: Number(item?.level) || index + 1,
      description: cleanText(item?.description),
      breakthroughCondition: cleanText(item?.breakthroughCondition) || '已至巅峰',
      subRealms: Array.isArray(item?.subRealms)
        ? item.subRealms.map((sub: any) => ({
            name: cleanText(sub?.name),
            description: cleanText(sub?.description),
          })).filter((sub: SubRealm) => sub.name)
        : [],
    }))
    .filter(item => item.name && item.description);

  if (realms.length === 0) {
    throw new Error('AI 返回的境界体系为空或字段不完整，请重试。');
  }
  return realms;
}

function validateSegments(data: any): StorySegment[] {
  const rawSegments = Array.isArray(data) ? data : data?.segments;
  const segments = ensureArray<any>(rawSegments, 'segments')
    .map((seg, index) => ({
      segmentNumber: Number(seg?.segmentNumber) || index + 1,
      title: cleanText(seg?.title),
      wordCount: Number(seg?.wordCount) || 0,
      summary: cleanText(seg?.summary),
      content: '',
      isGenerated: false,
    }))
    .filter(seg => seg.title && seg.summary);

  if (segments.length === 0) {
    throw new Error('AI 返回的分段大纲为空或字段不完整，请重试。');
  }
  return segments;
}

// 使用单个密钥调用 OpenAI 兼容 API
async function callOpenAIWithKey(
  prompt: string, 
  settings: Settings, 
  apiKey: string,
  expectJSON: boolean
): Promise<{ success: boolean; content?: string; error?: string; isAuthError?: boolean }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const messages = [{ role: 'user', content: prompt }];
  const body: any = {
    model: settings.model || 'gpt-3.5-turbo',
    messages,
    temperature: settings.temperature || 0.9
  };

  if (expectJSON) {
    messages[0].content += "\n\n请务必返回合法的 JSON 格式对象，不要包含任何其他文字或 Markdown 标记。";
  }

  try {
    const res = await fetch(`${settings.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    // 检查是否是认证错误（401/403），这类错误可以尝试下一个密钥
    if (res.status === 401 || res.status === 403) {
      const err = await res.text();
      return { success: false, error: err, isAuthError: true };
    }

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `API 请求失败 (${res.status}): ${err}` };
    }

    const data = await res.json();
    
    // 安全检查 API 响应格式
    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      if (data.error) {
        return { success: false, error: `API 错误: ${data.error.message || data.error.code || JSON.stringify(data.error)}` };
      }
      return { success: false, error: `API 返回格式异常: ${JSON.stringify(data).slice(0, 200)}` };
    }
    
    if (!data.choices[0].message || typeof data.choices[0].message.content !== 'string') {
      return { success: false, error: 'API 返回内容异常，缺少 message.content 字段' };
    }
    
    return { success: true, content: data.choices[0].message.content || "" };
  } catch (e: any) {
    return { success: false, error: e.message || '网络请求失败' };
  }
}

async function callAI(prompt: string, settings: Settings, expectJSON: boolean = false): Promise<string> {
  if (settings.provider === 'gemini') {
    const ai = new GoogleGenAI({ apiKey: settings.apiKey || process.env.GEMINI_API_KEY });
    const config: any = { temperature: settings.temperature || 0.9 };
    
    if (expectJSON) {
      config.responseMimeType = "application/json";
    }

    const response = await ai.models.generateContent({
      model: settings.model || 'gemini-3.1-pro-preview',
      contents: prompt,
      config
    });
    
    // 安全检查 Gemini 响应
    if (!response) {
      console.error('Gemini API 返回空响应');
      throw new Error('AI 返回空响应，请重试');
    }
    
    return response.text || "";
  } else {
    // Custom / OpenAI compatible endpoint (DeepSeek, Zhipu, Moonshot, etc.)
    // 免费提供商支持多密钥轮询
    const isFreeProvider = settings.provider === 'free';
    const keysToTry = isFreeProvider && settings.apiKeys.length > 0 
      ? settings.apiKeys 
      : [settings.apiKey];
    
    // 读取失败密钥记录（带冷却期）
    const COOLDOWN_MS = 30 * 60 * 1000; // 30分钟冷却期
    let failedKeys: Record<string, number> = {};
    if (isFreeProvider && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('ai_novel_failed_keys');
        if (stored) {
          failedKeys = JSON.parse(stored);
          // 清理过期的记录（超过30分钟）
          const now = Date.now();
          Object.keys(failedKeys).forEach(key => {
            if (now - failedKeys[key] > COOLDOWN_MS) {
              delete failedKeys[key];
            }
          });
        }
      } catch (e) {
        console.error('读取失败密钥记录失败:', e);
      }
    }
    
    // 对密钥进行排序：未失败的优先，失败的按时间远近排序
    const now = Date.now();
    const sortedIndices = keysToTry.map((_, idx) => idx).sort((a, b) => {
      const keyA = keysToTry[a];
      const keyB = keysToTry[b];
      const failedA = failedKeys[keyA] || 0;
      const failedB = failedKeys[keyB] || 0;
      // 都未失败或都失败，按原始顺序
      if ((failedA === 0 && failedB === 0) || (failedA > 0 && failedB > 0)) {
        return a - b;
      }
      // 未失败的排前面
      return failedA - failedB;
    });
    
    // 从当前索引开始轮询（在排序后的列表中找到起始位置）
    const startPos = isFreeProvider 
      ? Math.max(0, sortedIndices.indexOf(settings.currentKeyIndex))
      : 0;
    const errors: string[] = [];
    
    for (let i = 0; i < sortedIndices.length; i++) {
      const pos = (startPos + i) % sortedIndices.length;
      const keyIndex = sortedIndices[pos];
      const apiKey = keysToTry[keyIndex];
      
      if (!apiKey) continue;
      
      // 检查是否在冷却期（仅记录认证错误的密钥）
      const failedAt = failedKeys[apiKey];
      if (failedAt && now - failedAt < COOLDOWN_MS) {
        const remainingMin = Math.ceil((COOLDOWN_MS - (now - failedAt)) / 60000);
        errors.push(`密钥${keyIndex + 1}: 冷却中(${remainingMin}分钟后重试)`);
        continue;
      }
      
      const result = await callOpenAIWithKey(prompt, settings, apiKey, expectJSON);
      
      if (result.success && result.content !== undefined) {
        // 成功，将该密钥从失败列表中移除
        if (isFreeProvider && typeof window !== 'undefined') {
          if (failedKeys[apiKey]) {
            delete failedKeys[apiKey];
            localStorage.setItem('ai_novel_failed_keys', JSON.stringify(failedKeys));
          }
          // 更新当前密钥索引到下一个（为下次请求做准备）
          const nextPos = (pos + 1) % sortedIndices.length;
          const nextIndex = sortedIndices[nextPos];
          const savedSettings = JSON.parse(localStorage.getItem('ai_novel_settings') || '{}');
          savedSettings.currentKeyIndex = nextIndex;
          localStorage.setItem('ai_novel_settings', JSON.stringify(savedSettings));
        }
        return result.content;
      }
      
      // 记录错误
      errors.push(`密钥${keyIndex + 1}: ${result.error?.slice(0, 50)}...`);
      
      // 认证错误（401/403）标记到失败列表
      if (result.isAuthError && isFreeProvider && typeof window !== 'undefined') {
        failedKeys[apiKey] = Date.now();
        localStorage.setItem('ai_novel_failed_keys', JSON.stringify(failedKeys));
        console.warn(`密钥 ${keyIndex + 1} 认证失败，已标记冷却30分钟`);
      }
      
      // 如果不是认证错误，且不是免费提供商，直接抛出
      if (!result.isAuthError && !isFreeProvider) {
        throw new Error(result.error);
      }
      
      // 继续尝试下一个密钥
      console.warn(`密钥 ${keyIndex + 1} 失败，尝试下一个...`);
    }
    
    // 所有密钥都失败了
    throw new Error(`所有 API 密钥均失效:\n${errors.join('\n')}\n\n账户余额不足，请找小羊老师咨询。`);
  }
}

// 生成书名选项（新增）
export async function generateBookTitles(themes: string[], lengthType: string, settings: Settings, targetChapterCount?: number): Promise<Array<{title: string, intro: string}>> {
  const chapterCount = lengthType === 'custom'
    ? targetChapterCount || 100
    : LENGTHS.find(l => l.value === lengthType)?.count || 100;
  const lengthText = `${chapterCount}章`;
  const themePrompts = themes.map(theme => getThemePrompt(theme, 'novel')).join('\n');
  
  const prompt = `你是一位深谙爆款逻辑的网文主编。请根据以下主题，为一部${lengthText}的长篇小说构思 5 个极具吸引力、点击率极高的爆款书名。

${themePrompts}

【书名要求】（非常重要！）
1. 必须符合当前网文平台的爆款风格（如：情绪拉扯、极致反转、打脸虐渣、猎奇悬疑等）。
2. 书名要有强烈的画面感、反差感或悬念，能瞬间抓住读者的眼球。
3. 句式参考（不限于）：
   - 第一人称自述式（例：《我死后，渣男他疯了》、《给京圈太子爷当替身的第三年》）
   - 强反差/打脸式（例：《真千金回归后，全家跪求原谅》、《被辞退后，我成了前老板的顶头上司》）
   - 悬念/规则式（例：《规则怪谈：不要在半夜照镜子》、《我的老公每天都在换脸》）
   - 修仙/玄幻式（例：《开局签到混沌体》、《我在异界当剑仙》）
4. 书名字数控制在 5-15 字之间，语言要接地气、有网感。

【介绍要求】
每个书名需要配一句话介绍（15-30字），简要说明故事核心卖点或主角设定，吸引读者点击。

请严格以 JSON 格式返回一个对象，包含一个 \`titles\` 字段，其值为对象数组。每个对象包含：
- title (字符串): 书名
- intro (字符串): 一句话介绍（15-30字）
不要输出其他任何解释性文字。`;

  const responseText = await callAI(prompt, settings, true);
  const data = extractJSON(responseText);
  const titles = validateBookTitles(data);
  if (titles.length === 0) {
    throw new Error('AI 返回的书名选项为空或字段不完整，请重试。');
  }
  return titles;
}

// LENGTHS 常量定义（用于上面的函数）
const LENGTHS = [
  { label: '短篇 (100章)', value: '100', count: 100 },
  { label: '中短篇 (200章)', value: '200', count: 200 },
  { label: '中篇 (300章)', value: '300', count: 300 },
  { label: '中长篇 (400章)', value: '400', count: 400 },
  { label: '长篇 (500章)', value: '500', count: 500 },
  { label: '自定义', value: 'custom', count: 100 },
];

export async function generateBookInfo(currentBookInfo: BookInfo, settings: Settings): Promise<Partial<BookInfo>> {
  const lengthText = `${currentBookInfo.targetChapterCount}章`;
  
  let existingInfo = '';
  if (currentBookInfo.title) existingInfo += `\n已有书名：${currentBookInfo.title}`;
  if (currentBookInfo.outline) existingInfo += `\n已有大纲：${currentBookInfo.outline}`;
  if (currentBookInfo.worldbuilding) existingInfo += `\n已有世界观：${currentBookInfo.worldbuilding}`;

  const themePrompts = currentBookInfo.themes.map(theme => getThemePrompt(theme, 'novel')).join('\n');
  const prompt = `请帮我构思或完善一本小说设定。
【基本设定】
书名：${currentBookInfo.title}
${themePrompts}
篇幅：${lengthText}${existingInfo ? `\n\n【已有内容参考】\n请基于以下已有内容进行扩写、润色或补充，绝对不要完全推翻重写：${existingInfo}` : ''}

【重要】请基于书名《${currentBookInfo.title}》生成完整的故事大纲和世界观设定：
1. 故事大纲（outline）：约300字，包含故事背景、主角设定、核心冲突、主要剧情发展、结局方向
2. 世界观设定（worldbuilding）：约200字，包含世界背景、力量体系、社会结构、特殊设定等

请严格以 JSON 格式返回一个对象，必须包含以下三个字段：
{
  "title": "书名（保持原书名）",
  "outline": "故事大纲（约300字）",
  "worldbuilding": "世界观设定（约200字）"
}

注意：
- 三个字段都必须填写，不能为空
- outline 和 worldbuilding 必须是不同的内容，不要重复
- 不要输出其他任何解释性文字，只返回 JSON 对象`;

  const responseText = await callAI(prompt, settings, true);
  const data = extractJSON(responseText);
  
  // 调试日志
  console.log('AI 返回的数据:', data);
  
  // 确保返回的数据包含所有必要字段
  const result = {
    title: data.title || currentBookInfo.title,
    outline: data.outline || currentBookInfo.outline || '',
    worldbuilding: data.worldbuilding || data.worldBuilding || data.world_building || currentBookInfo.worldbuilding || ''
  };
  
  // 如果世界观仍然为空，给出警告
  if (!result.worldbuilding) {
    console.warn('警告：AI 未返回世界观设定，返回的数据:', data);
  }
  
  return result;
}

export async function generateCharacters(bookInfo: BookInfo, settings: Settings): Promise<Character[]> {
  const themePrompts = bookInfo.themes.map(theme => getThemePrompt(theme, 'novel')).join('\n');
  const prompt = `根据以下小说设定，生成 8-15 个主要人物及其关系。
【书籍信息】
书名：${bookInfo.title}
${themePrompts}
大纲：${bookInfo.outline}
世界观：${bookInfo.worldbuilding}

请严格以 JSON 格式返回一个对象，包含一个 \`characters\` 字段，其值为数组。数组中每个对象包含以下字段：
- id (字符串): 唯一标识，如 'char1'
- name (字符串): 角色姓名
- role (字符串): 角色定位（如'主角'、'反派'、'导师'、'挚友'、'红颜知己'、'宿敌'、'亲人'、'神秘人物'等）
- description (字符串): 包含性格、背景、与其他人的关系、在剧情中的作用（约100字）

注意：
1. 人物数量尽可能多（8-15个），确保剧情有足够的角色互动和铺垫空间。
2. 配角要有鲜明个性，能在不同剧情阶段起到关键推动作用。
3. 人物之间应有复杂的关系网络，包括亲情、友情、爱情、师徒、恩怨、竞争等。
不要输出其他任何解释性文字。`;

  const responseText = await callAI(prompt, settings, true);
  const data = extractJSON(responseText);
  return validateCharacters(data);
}

// 生成境界体系
export async function generateRealms(bookInfo: BookInfo, characters: Character[], settings: Settings): Promise<Realm[]> {
  const protagonist = characters.find(c => c.role === '主角');
  const protagonistName = protagonist?.name || '主角';
  const themePrompts = bookInfo.themes.map(theme => getThemePrompt(theme, 'novel')).join('\n');

  const prompt = `根据以下小说设定，生成一套完整的修炼/力量境界体系。

【书籍信息】
书名：${bookInfo.title}
${themePrompts}
大纲：${bookInfo.outline}
世界观：${bookInfo.worldbuilding}
主角：${protagonistName}

要求：
1. 大境界数量：8-12个，从低到高排列。
2. 每个大境界包含小境界，必须符合网文惯例，只允许以下两种风格（全书统一选一种）：
   - 重数制：一重、二重、三重、四重、五重、六重、七重、八重、九重（共9个小境界，适合修仙/玄幻）
   - 三层制：初期、中期、后期（共3个小境界，适合都市/异能/简洁体系）
   不要自创其他小境界名称！
3. 每个大境界要有独特名称（符合世界观风格，如修仙用"炼气/筑基/金丹"，都市用"觉醒/C级/B级/A级/S级"，玄幻用"战士/战师/战王/战皇"等）。
4. 每个大境界简要描述特征和能力范围。
5. 每个大境界给出突破到下一大境界的条件（如需要什么资源、领悟、机缘等）。
6. 境界之间要有明确的实力差距感，高境界对低境界有碾压感。
7. 主角起始境界应在第1-2阶初期，最终达到最高或次高大境界巅峰。

请严格以 JSON 格式返回一个对象，包含一个 \`realms\` 字段，其值为数组。数组中每个对象包含以下字段：
- id (字符串): 唯一标识，如 'realm1'
- name (字符串): 大境界名称
- level (数字): 等级序号，从1开始
- description (字符串): 大境界特征描述（约30字）
- breakthroughCondition (字符串): 突破到下一大境界的条件（约30字，最高境界写"已至巅峰"）
- subRealms (数组): 小境界列表，每个对象包含：
  - name (字符串): 小境界名称（如"初期"）
  - description (字符串): 小境界简要描述（约15字）
不要输出其他任何解释性文字。`;

  const responseText = await callAI(prompt, settings, true);
  const data = extractJSON(responseText);
  return validateRealms(data);
}

export async function generateTOC(bookInfo: BookInfo, characters: Character[], settings: Settings, startIndex: number, batchSize: number, existingTitles: string[] = []): Promise<TOCItem[]> {
  const charsStr = characters.map(c => `- ${c.name} (${c.role}): ${c.description}`).join('\n');
  const endIndex = Math.min(startIndex + batchSize - 1, bookInfo.targetChapterCount);
  
  const existingTitlesStr = existingTitles.length > 0 
    ? `\n【已生成的章节标题（请务必避免重复）】\n${existingTitles.join(' | ')}\n` 
    : '';

  const progressPercentage = Math.round((endIndex / bookInfo.targetChapterCount) * 100);
  const remainingChapters = bookInfo.targetChapterCount - endIndex;
  const closingTitleStart = getClosingTitleStart(bookInfo.targetChapterCount);
  
  let pacingInstruction = '';
  if (endIndex === bookInfo.targetChapterCount) {
    pacingInstruction = `【🚨 完结红色警告 🚨】
当前正在生成全书的最后 ${endIndex - startIndex + 1} 章大纲（第 ${startIndex} 章至第 ${endIndex} 章）。
注意：第 ${endIndex} 章就是全书的【最终大结局】！
请务必在本批次大纲中：
1. 彻底解决所有核心冲突，填平所有伏笔。
2. 第 ${endIndex} 章必须是真正的大结局，给故事画上圆满句号。
3. 绝对、绝对不要再引入任何新人物、新矛盾或新剧情分支！`;
  } else if (remainingChapters <= 10) {
    pacingInstruction = `【⚠️ 终局收网阶段 ⚠️】
距离全书完结（第 ${bookInfo.targetChapterCount} 章）仅剩最后 ${remainingChapters} 章！
请开始全面收网，解决次要矛盾，将所有线索和角色汇聚向最终决战或大结局。切忌再展开新地图或新剧情！`;
  } else if (progressPercentage >= 60) {
    pacingInstruction = `【🔥 剧情高潮阶段 🔥】
当前进度约 ${progressPercentage}%。请围绕大纲展开核心冲突，安排高潮事件，深化人物关系，剧情节奏加快。`;
  } else {
    pacingInstruction = `【🌱 剧情铺垫/发展阶段 🌱】
当前进度约 ${progressPercentage}%。请稳步推进剧情，铺陈世界观，引出核心矛盾，设置悬念，吸引读者。`;
  }

  const themePrompts = bookInfo.themes.map(theme => getThemePrompt(theme, 'novel')).join('\n');
  const prompt = `根据以下小说设定和人物，生成第 ${startIndex} 章到第 ${endIndex} 章的目录大纲。
【书籍信息】
书名：${bookInfo.title}
${themePrompts}
大纲：${bookInfo.outline}
【主要人物】
${charsStr}${existingTitlesStr}
${pacingInstruction}

【章节标题节奏硬性规则】
1. 第 ${closingTitleStart} 章之前，标题禁止出现“大结局、最终章、终章、尾声、完结、终局、最终、最后一战、最后的决战、落幕、归宿、终点、终焉、谢幕、尘埃落定、一切终结”等结局性词汇。
2. “大结局、最终章、终章、尾声、完结、结局篇、全书终”只能用于第 ${bookInfo.targetChapterCount} 章，其他章节绝对不能使用。
3. 早中期标题要体现阶段冲突、转折、线索或人物行动，不要提前剧透最终胜负或故事收束。

请严格以 JSON 格式返回一个对象，包含一个 \`chapters\` 字段，其值为数组。数组中每个对象包含以下字段：
- chapterNumber (数字): 章节序号（必须从 ${startIndex} 到 ${endIndex}）
- title (字符串): 章节标题（必须新颖，绝对不能与已生成的章节标题重复）
- summary (字符串): 本章详细剧情摘要（约100-150字，请务必保持高质量、逻辑严密和剧情连贯性，不要因为批量生成而降低质量）
不要输出其他任何解释性文字。`;

  const responseText = await callAI(prompt, settings, true);
  const data = extractJSON(responseText);
  return validateTOC(data, startIndex, endIndex, existingTitles, bookInfo.targetChapterCount);
}

export async function generateChapterContent(
  bookInfo: BookInfo,
  characters: Character[],
  tocItem: TOCItem,
  previousChapters: string[],
  settings: Settings,
  toc: TOCItem[],
  realmProgress?: RealmProgress,
  novelMemory?: NovelMemory
): Promise<string> {
  const charsStr = characters.map(c => `- ${c.name} (${c.role}): ${c.description}`).join('\n');
  
  const isFinalChapter = tocItem.chapterNumber === bookInfo.targetChapterCount;
  const remainingChapters = bookInfo.targetChapterCount - tocItem.chapterNumber;
  
  // 计算当前进度百分比
  const progressPercent = Math.round((tocItem.chapterNumber / bookInfo.targetChapterCount) * 100);
  
  let pacingContext = '';
  if (isFinalChapter) {
    pacingContext = `【🚨 完结红色警告 🚨】本章是全书的最后一章（第 ${bookInfo.targetChapterCount} 章）！请务必给故事画上一个完整的句号，解决所有悬念，绝对不要在结尾留悬念或断章。`;
  } else if (remainingChapters <= 5) {
    pacingContext = `【⚠️ 终局收网阶段 ⚠️】本章是第 ${tocItem.chapterNumber} 章，距离全书大结局（第 ${bookInfo.targetChapterCount} 章）仅剩 ${remainingChapters} 章！请注意收拢剧情，不要再挖新坑，将故事推向最终高潮。`;
  } else {
    pacingContext = `当前是第 ${tocItem.chapterNumber} 章（全书${bookInfo.targetChapterCount}章，进度${progressPercent}%）。请稳步推进剧情。`;
  }

  let prompt = `你是一位专业网文作家。撰写第 ${tocItem.chapterNumber} 章：${tocItem.title}。

${pacingContext}

【核心要求】
1. 本章目标字数严格控制在${settings.minWordCount}字左右（误差不超过±10%），严禁超写！
2. 紧扣摘要推进剧情，直接输出正文，不要标题/问候/总结/解释。
3. 章节之间必须有自然过渡，使用场景切换、时间跳跃、人物动作等方式平滑衔接。
4. 写作风格自然流畅，可以包含任何符合剧情需要的内容，不受限制。

【书籍信息】
书名：${bookInfo.title}
主题：${bookInfo.themes.join('、')}
大纲：${bookInfo.outline}
世界观：${bookInfo.worldbuilding}

【人物设定】
${charsStr}
${novelMemory ? `\n【全书记忆】\n故事进展：${novelMemory.storySoFar || '暂无'}\n人物状态：${novelMemory.characterStates || '暂无'}\n未回收伏笔：${novelMemory.openThreads.join('；') || '暂无'}\n已解决线索：${novelMemory.resolvedThreads.join('；') || '暂无'}\n重要物品/设定：${novelMemory.importantItems.join('；') || '暂无'}\n请严格延续这些状态，不要让角色关系、伏笔、物品归属和已发生事件前后矛盾。\n` : ''}
${realmProgress && realmProgress.realms.length > 0 ? (() => {
  // 根据chapterRealmMap自动推算当前章节主角所在境界（大境界+小境界）
  let currentRealmIdx = 0;
  let currentSubIdx = 0;
  const sortedBreakpoints = Object.entries(realmProgress.chapterRealmMap)
    .map(([ch, val]) => ({ ch: Number(ch), realmIndex: (val as any).realmIndex ?? val, subRealmIndex: (val as any).subRealmIndex ?? 0 }))
    .sort((a, b) => a.ch - b.ch);
  for (const bp of sortedBreakpoints) {
    if (bp.ch <= tocItem.chapterNumber) {
      currentRealmIdx = bp.realmIndex;
      currentSubIdx = bp.subRealmIndex;
    } else {
      break;
    }
  }
  const currentRealm = realmProgress.realms[currentRealmIdx];
  const currentSubRealm = currentRealm?.subRealms?.[currentSubIdx];
  const isBreakthrough = realmProgress.chapterRealmMap[tocItem.chapterNumber] !== undefined;
  const bpData = realmProgress.chapterRealmMap[tocItem.chapterNumber] as any;
  const nextRealm = currentRealmIdx < realmProgress.realms.length - 1 ? realmProgress.realms[currentRealmIdx + 1] : null;
  const nextSubRealm = currentSubIdx < (currentRealm?.subRealms?.length || 1) - 1 ? currentRealm?.subRealms?.[currentSubIdx + 1] : null;
  const protagonist = characters.find(c => c.role === '主角');
  const protagName = protagonist?.name || '主角';
  const realmList = realmProgress.realms.map((r, i) => {
    const isCurrent = i === currentRealmIdx;
    const subStr = r.subRealms?.map((s, si) => `${isCurrent && si === currentSubIdx ? '▶' : '○'}${s.name}`).join(' ') || '';
    return `${isCurrent ? '▶' : '○'} ${r.level}. ${r.name} ${subStr}`;
  }).join('\n');
  // 判断突破类型
  let breakthroughHint = '';
  if (isBreakthrough) {
    const isBigBreakthrough = bpData?.subRealmIndex === 0 && bpData?.realmIndex > 0; // 进入新大境界
    if (isBigBreakthrough) {
      const prevRealm = realmProgress.realms[(bpData.realmIndex as number) - 1];
      breakthroughHint = `⚠️ 本章主角大境界突破！${prevRealm?.name || '初始'} → ${currentRealm.name}！必须写出震撼的突破过程（天象异变/灵力暴涌/战斗中突破），突破后实力碾压同阶，展示全新能力。`;
    } else {
      breakthroughHint = `⚠️ 本章主角小境界提升→${currentSubRealm?.name || ''}！写出修炼感悟/瓶颈突破的过程，实力小幅提升，为后续大境界突破蓄势。`;
    }
  }
  const fullRealmName = currentSubRealm ? `${currentRealm.name}·${currentSubRealm.name}` : currentRealm?.name || '未知';
  const nextFullRealm = nextSubRealm ? `${currentRealm.name}·${nextSubRealm.name}` : (nextRealm ? `${nextRealm.name}·${nextRealm.subRealms?.[0]?.name || ''}` : null);
  return `\n【境界体系】主角${protagName}当前境界：${fullRealmName}（第${currentRealm?.level || '?'}阶）
${nextFullRealm ? `下一阶段：${nextFullRealm}${nextRealm && !nextSubRealm ? `（大境界突破条件：${nextRealm.breakthroughCondition}）` : ''}` : '已至巅峰！'}
境界全览：
${realmList}
${breakthroughHint}
【境界贯穿要求】境界需自然融入正文，约20-30章提及1次即可，不要每章都提。提及方式：
1. 战斗/对决时：用境界名描述实力差距（"区区${currentRealm?.name}也敢拦我"），或展示境界特有能力。
2. 修炼/突破时：写修炼场景，感悟瓶颈，正常修炼突破也可以，不必每次都靠战斗突破。
3. 遇强敌时：被高境界碾压的无力感，为后续突破蓄势。
4. 旁人评价：他人议论主角境界变化，侧面烘托。
不要生硬插入，用对话/旁白/心理活动自然带出。非提及章节正常写剧情即可，不需要刻意提境界。`;
})() : ''}

【本章摘要】
${tocItem.summary}
`;

  if (previousChapters.length > 0) {
    prompt += `\n【前文回顾】\n为了保持长线剧情连贯，以下是前几章的剧情摘要：\n`;
    
    // 获取最近3章的摘要
    const recentTocItems = toc.filter(t => t.chapterNumber < tocItem.chapterNumber).slice(-3);
    recentTocItems.forEach(t => {
      prompt += `第${t.chapterNumber}章摘要：${t.summary}\n`;
    });

    prompt += `\n为了保证章节之间的自然衔接，以下是上一章结尾的部分正文，请**直接顺着上一章的结尾继续往下写**，不要重复上一章的内容：\n`;
    const lastChapter = previousChapters[previousChapters.length - 1];
    prompt += `--- 上一章结尾 ---\n...${lastChapter.slice(-500)}\n`;
  }

  const responseText = await callAI(prompt, settings, false);
  return responseText.trim();
}

export async function updateNovelMemory(
  previousMemory: NovelMemory,
  bookInfo: BookInfo,
  tocItem: TOCItem,
  chapterContent: string,
  settings: Settings
): Promise<NovelMemory> {
  const prompt = `你是小说长线连续性编辑。请根据当前章节，更新全书记忆，帮助后续章节保持设定一致。

【书籍信息】
书名：${bookInfo.title}
总大纲：${bookInfo.outline}

【原有全书记忆】
故事进展：${previousMemory.storySoFar || '暂无'}
人物状态：${previousMemory.characterStates || '暂无'}
未回收伏笔：${previousMemory.openThreads.join('；') || '暂无'}
已解决线索：${previousMemory.resolvedThreads.join('；') || '暂无'}
重要物品/设定：${previousMemory.importantItems.join('；') || '暂无'}

【新章节】
第${tocItem.chapterNumber}章 ${tocItem.title}
章节摘要：${tocItem.summary}
章节正文：
${chapterContent.slice(0, 6000)}

请严格返回 JSON 对象：
{
  "storySoFar": "用300字以内概括截至本章的主线进展",
  "characterStates": "用300字以内记录主要人物当前关系、立场、伤势、目标、情绪变化",
  "openThreads": ["仍未解决的伏笔/矛盾/承诺，最多10条"],
  "resolvedThreads": ["本章已经解决或兑现的线索，最多10条"],
  "importantItems": ["重要物品、能力、地点、组织和设定状态，最多10条"],
  "lastUpdatedChapter": ${tocItem.chapterNumber}
}
不要输出其他文字。`;

  const responseText = await callAI(prompt, settings, true);
  const data = extractJSON(responseText);
  return {
    storySoFar: cleanText(data.storySoFar).slice(0, 600),
    characterStates: cleanText(data.characterStates).slice(0, 600),
    openThreads: Array.isArray(data.openThreads) ? data.openThreads.map(cleanText).filter(Boolean).slice(0, 10) : previousMemory.openThreads,
    resolvedThreads: Array.isArray(data.resolvedThreads) ? data.resolvedThreads.map(cleanText).filter(Boolean).slice(0, 10) : previousMemory.resolvedThreads,
    importantItems: Array.isArray(data.importantItems) ? data.importantItems.map(cleanText).filter(Boolean).slice(0, 10) : previousMemory.importantItems,
    lastUpdatedChapter: Number(data.lastUpdatedChapter) || tocItem.chapterNumber,
  };
}

export async function generateShortStoryTitles(themes: string[], settings: Settings): Promise<string[]> {
  const themePrompts = themes.map(theme => getThemePrompt(theme, 'shortStory')).join('\n');
  const prompt = `你是一位深谙爆款逻辑的网文主编。请根据以下主题，为一篇7k-12k字的短篇小说构思 5 个极具吸引力、点击率极高的爆款标题。

${themePrompts}

【标题要求】（非常重要！）
1. 必须符合当前番茄小说、知乎等平台的短篇爆款风格（如：情绪拉扯、极致反转、打脸虐渣、猎奇悬疑等）。
2. 标题要有强烈的画面感、反差感或悬念，能瞬间抓住读者的眼球，让人产生强烈的点击欲望。
3. 句式参考（不限于）：
   - 第一人称自述式（例：《我死后，渣男他疯了》、《给京圈太子爷当替身的第三年》）
   - 强反差/打脸式（例：《真千金回归后，全家跪求原谅》、《被辞退后，我成了前老板的顶头上司》）
   - 悬念/规则式（例：《规则怪谈：不要在半夜照镜子》、《我的老公每天都在换脸》）
4. 标题字数控制在 8-20 字之间，语言要接地气、有网感。

请严格以 JSON 格式返回一个对象，包含一个 \`titles\` 字段，其值为字符串数组。不要输出其他任何解释性文字。`;
  const responseText = await callAI(prompt, settings, true);
  const data = extractJSON(responseText);
  return data.titles || [];
}

export async function generateShortStoryOutlineFromTitle(title: string, themes: string[], settings: Settings): Promise<string> {
  const themePrompts = themes.map(theme => getThemePrompt(theme, 'shortStory')).join('\n');
  const prompt = `你是一位顶尖的短篇小说作家。请根据以下标题和主题，构思一个短篇故事（约7k-12k字）的核心脑洞和详细大纲。
标题：${title}
${themePrompts}

要求：
1. 包含故事背景、主要人物简介、起因、发展、高潮、结局。
2. 剧情要有张力，符合所选主题。
3. 直接输出大纲文本，不需要 JSON 格式。`;
  const responseText = await callAI(prompt, settings, false);
  return responseText.trim();
}

// 生成分段大纲
export async function generateShortStorySegments(
  info: ShortStoryInfo,
  settings: Settings
): Promise<StorySegment[]> {
  const themePrompts = info.themes.map(theme => getThemePrompt(theme, 'shortStory')).join('\n');
  const prompt = `你是一个专业的小说结构规划师。

请为以下短篇故事设计分段大纲，将故事拆分成3-5个逻辑连贯的部分。

故事标题：${info.title || '未命名'}
${themePrompts}
目标字数：${info.targetWordCount}字
用户核心脑洞/已有大纲：${info.outline || '暂无，请根据标题和主题原创设计'}

要求：
1. 每个部分应该有独立的标题（如：开端、发展、高潮、结局等）
2. 每个部分标明预估字数（总字数接近${info.targetWordCount}）
3. 每个部分提供内容摘要，说明这部分要讲述什么
4. 确保各部分逻辑连贯，形成完整故事

请以JSON数组格式返回：
[
  {
    "segmentNumber": 1,
    "title": "第一部分标题",
    "wordCount": 800,
    "summary": "这部分的内容摘要..."
  },
  ...
]`;

  const response = await callAI(prompt, settings, true);
  const segments = extractJSON(response);
  return validateSegments(segments);
}

// 生成指定分段内容
export async function generateShortStoryContent(
  info: ShortStoryInfo,
  existingContent: string,
  settings: Settings,
  isFinalBatch: boolean = false
): Promise<string> {
  // 构建当前要写的分段说明
  const totalSegments = info.segments?.length || 1;
  const currentBatch = info.currentSegment || 0;
  const segmentsInfo = info.segments?.map((s, i) => 
    `第${i+1}段：${s.title}（约${s.wordCount}字）- ${s.summary}${s.isGenerated ? ' [已生成]' : ''}`
  ).join('\n') || '';
  
  // 计算分批字数（分两批，每批约一半）
  const targetTotal = info.targetWordCount || 10000;
  const batchWordCount = Math.round(targetTotal / 2); // 每批约一半字数
  
  const endingInstruction = isFinalBatch 
    ? `【最后一批：目标约${batchWordCount}字】必须写到真正大结局！所有线索收束，主角目标达成或失败，用具体动作/对话收尾，禁止悬念钩子！` 
    : `【第一批：目标约${batchWordCount}字】从开头写到剧情中段高潮前，充分展开细节，在合适的剧情节点暂停，不用收尾。`;

  const themePrompts = info.themes.map(theme => getThemePrompt(theme, 'shortStory')).join('\n');
  let prompt = `你是一位专业短篇小说作家。撰写短篇故事。

【故事设定】
标题：${info.title}
${themePrompts}
目标总字数：约${targetTotal}字（分两批生成，每批约${batchWordCount}字）
核心脑洞/大纲：${info.outline}

【分段规划】（共${totalSegments}段，当前第${currentBatch+1}批生成）
${segmentsInfo}

${endingInstruction}

【要求】
1. 本批目标严格控制在${batchWordCount}字左右（误差不超过±10%），严禁超写！
2. 直接输出正文，不要标题/问候/总结/解释。
3. ${isFinalBatch ? '这是最后一批，必须写完真正大结局，所有伏笔回收，用具体动作/对话收尾！' : '本批是前半部分，写到剧情中段即可，在合适节点暂停，不用收尾。'}
4. 写作风格自然流畅，可以包含任何符合剧情需要的内容，不受限制。
${isFinalBatch ? '\n【强制结尾要求】这是最后一批生成！必须：1)所有核心冲突解决 2)主角目标达成或明确失败 3)所有伏笔回收 4)用具体动作/对话收尾 5)禁止"真正风暴才刚开始"等万能句 6)禁止"风卷起纸页慢慢翻开"等悬念钩子！' : ''}
`

  if (existingContent) {
    const recentContent = existingContent.slice(-1500);
    const totalLength = existingContent.length;
    prompt += `\n【前文回顾】\n以下是你已经写出的前文最后部分（全文约${Math.round(totalLength / 2)}字，请勿重复已写内容），请紧接其后继续撰写新内容：\n\n${recentContent}\n\n【重要提醒】你正在续写第${Math.floor(totalLength / 1500) + 1}部分内容。绝对不要重复上文已出现的对话、场景描写或情节，必须推进新的剧情发展。`;
  }

  const responseText = await callAI(prompt, settings, false);
  return responseText.trim();
}

export const __test__ = {
  extractJSON,
  validateBookTitles,
  validateCharacters,
  validateTOC,
  validateSegments,
};
