import { GoogleGenAI } from "@google/genai";
import { Settings, BookInfo, Character, TOCItem, ShortStoryInfo } from "../types";

function extractJSON(text: string): any {
  try {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      return JSON.parse(match[1]);
    }
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse JSON:", text);
    throw new Error("AI 返回的数据格式不正确，请重试。");
  }
}

async function callAI(prompt: string, settings: Settings, expectJSON: boolean = false): Promise<string> {
  if (settings.provider === 'gemini') {
    const ai = new GoogleGenAI({ apiKey: settings.apiKey || process.env.GEMINI_API_KEY });
    const config: any = { temperature: 0.7 };
    
    if (expectJSON) {
      config.responseMimeType = "application/json";
    }

    const response = await ai.models.generateContent({
      model: settings.model || 'gemini-3.1-pro-preview',
      contents: prompt,
      config
    });
    
    return response.text || "";
  } else {
    // Custom / OpenAI compatible endpoint (DeepSeek, Zhipu, Moonshot, etc.)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (settings.apiKey) {
      headers['Authorization'] = `Bearer ${settings.apiKey}`;
    }

    const messages = [{ role: 'user', content: prompt }];
    const body: any = {
      model: settings.model || 'gpt-3.5-turbo',
      messages,
      temperature: 0.7
    };

    if (expectJSON) {
      messages[0].content += "\n\n请务必返回合法的 JSON 格式对象，不要包含任何其他文字或 Markdown 标记。";
    }

    const res = await fetch(`${settings.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`API 请求失败 (${res.status}): ${err}`);
    }

    const data = await res.json();
    return data.choices[0].message.content || "";
  }
}

export async function generateBookInfo(currentBookInfo: BookInfo, settings: Settings): Promise<Partial<BookInfo>> {
  const lengthText = `${currentBookInfo.lengthType}章`;
  const prompt = `请帮我构思一本小说。
【用户设定】
主题：${currentBookInfo.themes.join('、')}
篇幅：${lengthText}

请提供书名、故事大纲和世界观设定。
请严格以 JSON 格式返回一个对象，包含以下字段：
- title (字符串): 书名
- outline (字符串): 故事大纲（约300字）
- worldbuilding (字符串): 世界观设定（约200字）
不要输出其他任何解释性文字。`;

  const responseText = await callAI(prompt, settings, true);
  return extractJSON(responseText) as Partial<BookInfo>;
}

export async function generateCharacters(bookInfo: BookInfo, settings: Settings): Promise<Character[]> {
  const prompt = `根据以下小说设定，生成 3-5 个主要人物及其关系。
【书籍信息】
书名：${bookInfo.title}
主题：${bookInfo.themes.join('、')}
大纲：${bookInfo.outline}
世界观：${bookInfo.worldbuilding}

请严格以 JSON 格式返回一个对象，包含一个 \`characters\` 字段，其值为数组。数组中每个对象包含以下字段：
- id (字符串): 唯一标识，如 'char1'
- name (字符串): 角色姓名
- role (字符串): 角色定位（如'主角'、'反派'、'导师'等）
- description (字符串): 包含性格、背景和与其他人的关系（约100字）
不要输出其他任何解释性文字。`;

  const responseText = await callAI(prompt, settings, true);
  const data = extractJSON(responseText);
  return data.characters || [];
}

export async function generateTOC(bookInfo: BookInfo, characters: Character[], settings: Settings, startIndex: number, batchSize: number, existingTitles: string[] = []): Promise<TOCItem[]> {
  const charsStr = characters.map(c => `- ${c.name} (${c.role}): ${c.description}`).join('\n');
  const endIndex = Math.min(startIndex + batchSize - 1, bookInfo.targetChapterCount);
  
  const existingTitlesStr = existingTitles.length > 0 
    ? `\n【已生成的章节标题（请务必避免重复）】\n${existingTitles.join(' | ')}\n` 
    : '';

  const prompt = `根据以下小说设定和人物，生成第 ${startIndex} 章到第 ${endIndex} 章的目录大纲。
【书籍信息】
书名：${bookInfo.title}
大纲：${bookInfo.outline}
【主要人物】
${charsStr}${existingTitlesStr}
请严格以 JSON 格式返回一个对象，包含一个 \`chapters\` 字段，其值为数组。数组中每个对象包含以下字段：
- chapterNumber (数字): 章节序号（必须从 ${startIndex} 到 ${endIndex}）
- title (字符串): 章节标题（必须新颖，绝对不能与已生成的章节标题重复）
- summary (字符串): 本章详细剧情摘要（约100-150字，请务必保持高质量、逻辑严密和剧情连贯性，不要因为批量生成而降低质量）
不要输出其他任何解释性文字。`;

  const responseText = await callAI(prompt, settings, true);
  const data = extractJSON(responseText);
  return data.chapters || [];
}

export async function generateChapterContent(
  bookInfo: BookInfo,
  characters: Character[],
  tocItem: TOCItem,
  previousChapters: string[],
  settings: Settings,
  toc: TOCItem[]
): Promise<string> {
  const charsStr = characters.map(c => `- ${c.name} (${c.role}): ${c.description}`).join('\n');
  
  let prompt = `你是一位顶尖的小说家。请根据以下设定撰写小说的第 ${tocItem.chapterNumber} 章：${tocItem.title}。

【核心要求】
1. 本章字数必须**不少于 ${settings.minWordCount} 字**。请充分展开细节、对话、环境描写和心理活动。
2. 紧扣本章摘要推进剧情，将摘要扩写为充满画面感的具体情节。绝对不要像写大纲一样一笔带过。
3. 直接输出小说正文，绝对不要包含任何标题（如“第X章”）、问候语、总结或多余的解释。

【防重复与去AI味指令】（极其重要！）
1. **拒绝套路化开头/结尾**：绝对不要在章节开头进行“前情提要”或总结式的抒情；绝对不要在章节结尾进行“人生感悟”或“剧情总结”。
2. **结尾悬念（断章）**：章节结尾必须卡在一个具体的动作、一句关键对话或一个突发事件上，戛然而止，不要把话说完，留下悬念。
3. **禁用高频AI词汇**：禁用“只见”、“就在这时”、“然而”、“不禁”、“顿时”、“不由得”等词汇。丰富你的句式。
4. **自然衔接**：如果是续写，请直接从上一章的结尾场景自然过渡，不要重新介绍已经出场的人物背景或重复上一章的动作。
5. **多描写，少叙述**：用具体的动作、神态、对话和环境交互来推动剧情，而不是用大段的旁白去总结发生了什么。

【书籍信息】
书名：${bookInfo.title}
主题：${bookInfo.themes.join('、')}
大纲：${bookInfo.outline}
世界观：${bookInfo.worldbuilding}

【人物设定】
${charsStr}

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

export async function generateShortStoryTitles(themes: string[], settings: Settings): Promise<string[]> {
  const prompt = `请根据以下主题，为一篇7k-12k字的短篇小说构思 5 个吸引人的标题。
主题：${themes.join('、')}
请严格以 JSON 格式返回一个对象，包含一个 \`titles\` 字段，其值为字符串数组。不要输出其他任何解释性文字。`;
  const responseText = await callAI(prompt, settings, true);
  const data = extractJSON(responseText);
  return data.titles || [];
}

export async function generateShortStoryOutlineFromTitle(title: string, themes: string[], settings: Settings): Promise<string> {
  const prompt = `你是一位顶尖的短篇小说作家。请根据以下标题和主题，构思一个短篇故事（约7k-12k字）的核心脑洞和详细大纲。
标题：${title}
主题：${themes.join('、')}

要求：
1. 包含故事背景、主要人物简介、起因、发展、高潮、结局。
2. 剧情要有张力，符合所选主题。
3. 直接输出大纲文本，不需要 JSON 格式。`;
  const responseText = await callAI(prompt, settings, false);
  return responseText.trim();
}

export async function generateShortStoryContent(
  info: ShortStoryInfo,
  existingContent: string,
  settings: Settings
): Promise<string> {
  let prompt = `你是一位顶尖的短篇小说作家。请根据以下设定撰写短篇故事。

【故事设定】
标题：${info.title}
主题：${info.themes.join('、')}
目标总字数：约 ${info.targetWordCount} 字
核心脑洞/大纲：${info.outline}

【要求】
1. 充分展开细节、对话、环境描写和心理活动。
2. 直接输出正文，不要包含任何标题、问候语、总结或多余的解释。
3. 如果由于字数限制无法一次性写完，请在合适的剧情节点自然暂停，后续我会让你继续写。

【防重复与质量优化要求】（非常重要！）
1. **拒绝套路化开头/结尾**：不要在开头进行总结式的抒情；不要在结尾进行刻意的悬念总结或人生感悟。顺着剧情自然地切入和结束。
2. **避免句式重复**：不要频繁使用相同的句式结构，丰富你的词汇和表达方式。
3. **自然衔接**：如果是续写，请直接从前文的结尾场景自然过渡，不要重新介绍已经出场的人物背景或重复前文的动作。
4. **细节驱动**：用具体的动作、神态、对话和环境交互来推动剧情，而不是用大段的旁白总结。
`;

  if (existingContent) {
    prompt += `\n【前文回顾】\n以下是你已经写出的前文，请紧接其后继续撰写，保持文风和剧情连贯：\n\n${existingContent.slice(-2000)}`;
  }

  const responseText = await callAI(prompt, settings, false);
  return responseText.trim();
}
