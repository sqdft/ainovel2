import fs from 'fs';
const path = 'src/services/aiService.ts';

let content = fs.readFileSync(path, 'utf8');

const startStr = "export async function updateNovelMemory(";

const startIdx = content.indexOf(startStr);
const restContent = content.slice(startIdx);
const nextCallAI = restContent.indexOf("const responseText = await callAI");

if (startIdx !== -1 && nextCallAI !== -1) {
  const newPrompt = `export async function updateNovelMemory(
  previousMemory: NovelMemory,
  bookInfo: BookInfo,
  tocItem: TOCItem,
  chapterContent: string,
  settings: Settings
): Promise<NovelMemory> {
  const prompt = \`你是小说长线连续性记忆校对官。请根据刚才产出的《第\${tocItem.chapterNumber}章：\${tocItem.title}》正文内容，对比覆盖原有全书记忆。

【书籍信息】书名：\${bookInfo.title}
大纲：\${bookInfo.outline}

【原有全书记忆】
故事进展：\${previousMemory.storySoFar || '暂无'}
人物状态：\${previousMemory.characterStates || '暂无'}
待填坑伏笔：\${previousMemory.openThreads.join('、') || '暂无'}
已解决线索：\${previousMemory.resolvedThreads.join('、') || '暂无'}
核心物品设定：\${previousMemory.importantItems.join('、') || '暂无'}

【最新章节正文内容】
\${chapterContent.slice(0, 10000)}

【任务要求】
分析最新章节内容，输出全书记忆的更新合并版本。你的输出必须是合规的JSON，绝对不要包含任何多余文字回答：
{
  "storySoFar": "合并旧进展并补充本章推进。限400字",
  "characterStates": "更新人物的动态状态及伤亡情况。限400字",
  "openThreads": ["提取新伏笔，合并旧悬念。如果伏笔被填坑，在此数组删除。最多10条"],
  "resolvedThreads": ["本章刚兑现的伏笔或击败的人"],
  "importantItems": ["最核心的法宝、武技或重要物品设定。最多15条"],
  "lastUpdatedChapter": \${tocItem.chapterNumber}
}\`;\n\n  `;

  content = content.slice(0, startIdx) + newPrompt + restContent.slice(nextCallAI);
  fs.writeFileSync(path, content, 'utf8');
  console.log("Replaced via precise index");
} else {
  console.log("Failed", startIdx, nextCallAI);
}
