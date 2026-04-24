import { GoogleGenAI } from "@google/genai";
import { Settings, BookInfo, Character, TOCItem, ShortStoryInfo, StorySegment } from "../types";

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
    temperature: 0.7
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
    const config: any = { temperature: 0.7 };
    
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
    throw new Error(`所有 API 密钥均失效:\n${errors.join('\n')}\n\n请检查密钥是否过期或余额不足。`);
  }
}

export async function generateBookInfo(currentBookInfo: BookInfo, settings: Settings): Promise<Partial<BookInfo>> {
  const lengthText = `${currentBookInfo.targetChapterCount}章`;
  
  let existingInfo = '';
  if (currentBookInfo.title) existingInfo += `\n已有书名：${currentBookInfo.title}`;
  if (currentBookInfo.outline) existingInfo += `\n已有大纲：${currentBookInfo.outline}`;
  if (currentBookInfo.worldbuilding) existingInfo += `\n已有世界观：${currentBookInfo.worldbuilding}`;

  const prompt = `请帮我构思或完善一本小说设定。
【基本设定】
主题：${currentBookInfo.themes.join('、')}
篇幅：${lengthText}${existingInfo ? `\n\n【已有内容参考】\n请基于以下已有内容进行扩写、润色或补充，绝对不要完全推翻重写：${existingInfo}` : ''}

请提供完整的书名、故事大纲和世界观设定。
- 如果已有书名，请保留或微微润色；如果没有，请生成一个吸引人的书名。
- 如果已有大纲/世界观，请在此基础上扩写细节，使其更丰满（大纲约300字，世界观约200字）；如果没有，请发挥创意生成。

请严格以 JSON 格式返回一个对象，包含以下字段：
- title (字符串): 书名
- outline (字符串): 故事大纲
- worldbuilding (字符串): 世界观设定
不要输出其他任何解释性文字。`;

  const responseText = await callAI(prompt, settings, true);
  const data = extractJSON(responseText);
  return {
    title: data.title || currentBookInfo.title,
    outline: data.outline || currentBookInfo.outline,
    worldbuilding: data.worldbuilding || currentBookInfo.worldbuilding
  };
}

export async function generateCharacters(bookInfo: BookInfo, settings: Settings): Promise<Character[]> {
  const prompt = `根据以下小说设定，生成 8-15 个主要人物及其关系。
【书籍信息】
书名：${bookInfo.title}
主题：${bookInfo.themes.join('、')}
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
  return data.characters || [];
}

export async function generateTOC(bookInfo: BookInfo, characters: Character[], settings: Settings, startIndex: number, batchSize: number, existingTitles: string[] = []): Promise<TOCItem[]> {
  const charsStr = characters.map(c => `- ${c.name} (${c.role}): ${c.description}`).join('\n');
  const endIndex = Math.min(startIndex + batchSize - 1, bookInfo.targetChapterCount);
  
  const existingTitlesStr = existingTitles.length > 0 
    ? `\n【已生成的章节标题（请务必避免重复）】\n${existingTitles.join(' | ')}\n` 
    : '';

  const progressPercentage = Math.round((endIndex / bookInfo.targetChapterCount) * 100);
  const remainingChapters = bookInfo.targetChapterCount - endIndex;
  
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

  const prompt = `根据以下小说设定和人物，生成第 ${startIndex} 章到第 ${endIndex} 章的目录大纲。
【书籍信息】
书名：${bookInfo.title}
大纲：${bookInfo.outline}
【主要人物】
${charsStr}${existingTitlesStr}
${pacingInstruction}

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

  let prompt = `你是一位顶尖的小说家。请根据以下设定撰写小说的第 ${tocItem.chapterNumber} 章：${tocItem.title}。

${pacingContext}

【核心要求】
1. 本章字数必须**不少于 ${settings.minWordCount} 字**。请充分展开细节、对话、环境描写和心理活动。
2. 紧扣本章摘要推进剧情，将摘要扩写为充满画面感的具体情节。
3. 直接输出小说正文，绝对不要包含任何标题、问候语、总结或多余的解释。

【番茄小说风格 - 悬念与伏笔系统】（这是让你写得更像真人作者的关键！）
1. **伏笔管理（极其重要）**：
   - **观察整体**：基于全书大纲和人物关系，识别可以制造悬念的地方
   - **埋下新伏笔**：如果本章适合埋下悬念（如主角获得神秘物品、听到奇怪对话、发现异常现象），请通过一个**不经意的细节**自然带过，不要解释
   - **暗示旧伏笔**：如果之前有未解之谜，在本章通过角色的细微反应、物品异常等给出**模糊线索**，加深读者好奇
   - **回收到期伏笔**：如果某个悬念已经铺垫足够，在本章揭晓时要有**冲击力**和反转感

2. **断章技巧（番茄小说式）**：
   - **绝对禁止**："本章完"、"未完待续"、剧情总结、人生感悟
   - **正确做法**：在情节最高点**戛然而止**！让读者感觉"下一秒就要发生大事"
   - **断章类型**：动作断章（正要出手/开门）、对话断章（关键话说到一半）、发现断章（突然看到惊人真相）、危机断章（危险降临瞬间）

3. **去AI味指令**：
   - 禁用高频AI词汇："只见"、"就在这时"、"然而"、"不禁"、"顿时"、"不由得"
   - 拒绝套路化开头/结尾：不要前情提要，不要人生感悟
   - 多描写少叙述：用动作、神态、对话推动剧情，不要大段旁白总结
   - 自然衔接：如果是续写，直接从上一章结尾场景自然过渡，不要重复介绍人物

4. **【核心：言语即刀锋】权力博弈与质感描写**（高阶写作要求）：

   **【对话即攻防】**
   - 每一句台词都必须是"进攻"或"防御"，带有潜台词让读者去猜，拒绝闲聊
   - 降维逻辑：主角用信息差和逻辑悖论直接封死对方退路，不废话

   **【视觉：关键帧抓拍】**
   - **严禁连续微动作描写**！一个场景（300-500字）内，仅允许 1-2 处瞬时动作特写
   - **爆发式点缀**：只有在逻辑反转或情绪临界点，才给一个"喉结微滚"或"指尖一顿"的抓拍，其余时间全速推进对话
   - **物理环境化**：用环境的变动（风声骤停、烟头火星熄灭、茶杯撞击声）代替角色的心理活动

   **【质感：克制与留白】**
   - **点到即止**：成人向试探要"隔岸观火"。一个眼神，一句带隐喻的双关，下一秒立刻转入公事。张力来自"求而不得"的克制感
   - **去AI腔**：彻底禁用"仿佛、宛如、那一刻"。台词要硬，叙述要稳，拒绝煽情
   - 主角智商在线不圣母：行事果断有逻辑，该狠则狠，该算计则算计

   **【排版：呼吸感】**
   - 段落不超过 3 行
   - 关键打脸台词、致命反问、决绝背影，必须**独立成段**
   - 短促有力，营造刀锋般的节奏感

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
  const prompt = `你是一位深谙爆款逻辑的网文主编。请根据以下主题，为一篇7k-12k字的短篇小说构思 5 个极具吸引力、点击率极高的爆款标题。

主题：${themes.join('、')}

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

// 生成分段大纲
export async function generateShortStorySegments(
  info: ShortStoryInfo,
  settings: Settings
): Promise<StorySegment[]> {
  const prompt = `你是一个专业的小说结构规划师。

请为以下短篇故事设计分段大纲，将故事拆分成3-5个逻辑连贯的部分。

故事标题：${info.title || '未命名'}
主题：${info.themes.join('、')}
目标字数：${info.targetWordCount}字

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
  
  // 添加content和isGenerated字段
  return segments.map((seg: any) => ({
    ...seg,
    content: '',
    isGenerated: false
  }));
}

// 生成指定分段内容
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

【言语即刀锋】权力博弈与质感描写（高阶写作要求）

**【对话即攻防】**
- 每一句台词都必须是"进攻"或"防御"，带有潜台词让读者去猜，拒绝闲聊
- 降维逻辑：主角用信息差和逻辑悖论直接封死对方退路，不废话

**【视觉：关键帧抓拍】**
- **严禁连续微动作描写**！一个场景（300-500字）内，仅允许 1-2 处瞬时动作特写
- **爆发式点缀**：只有在逻辑反转或情绪临界点，才给一个"喉结微滚"或"指尖一顿"的抓拍，其余时间全速推进对话
- **物理环境化**：用环境的变动（风声骤停、烟头火星熄灭、茶杯撞击声）代替角色的心理活动

**【质感：克制与留白】**
- **点到即止**：成人向试探要"隔岸观火"。一个眼神，一句带隐喻的双关，下一秒立刻转入公事。张力来自"求而不得"的克制感
- **去AI腔**：彻底禁用"仿佛、宛如、那一刻"。台词要硬，叙述要稳，拒绝煽情
- 主角智商在线不圣母：行事果断有逻辑，该狠则狠，该算计则算计

**【排版：呼吸感】**
- 段落不超过 3 行
- 关键打脸台词、致命反问、决绝背影，必须**独立成段**
- 短促有力，营造刀锋般的节奏感
`;

  if (existingContent) {
    const recentContent = existingContent.slice(-1500);
    const totalLength = existingContent.length;
    prompt += `\n【前文回顾】\n以下是你已经写出的前文最后部分（全文约${Math.round(totalLength / 2)}字，请勿重复已写内容），请紧接其后继续撰写新内容：\n\n${recentContent}\n\n【重要提醒】你正在续写第${Math.floor(totalLength / 1500) + 1}部分内容。绝对不要重复上文已出现的对话、场景描写或情节，必须推进新的剧情发展。`;
  }

  const responseText = await callAI(prompt, settings, false);
  return responseText.trim();
}
