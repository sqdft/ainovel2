import fs from 'fs';
const path = 'src/services/aiService.ts';

let content = fs.readFileSync(path, 'utf8');

const regexStr = /let prompt = `(?:[\s\S]*?)\{bookInfo\.worldbuilding\}/;
const regex = new RegExp(regexStr);

const newPrompt = "const styleInstructions = getThemeStyles(bookInfo.themes);\n  let prompt = `你是一位专业网文作家。撰写第 ${tocItem.chapterNumber} 章：${tocItem.title}。\n\n  ${pacingContext}\n\n  【核心要求】\n  1. 绝对不要为了凑字数而加大量没有信息量的短句。\n  2. 【骨架扩写】：在扩写正文之前，将摘要切分为几个明确的小节场景分布，然后再描绘！\n  3. 沉浸视角：禁止在末尾添加老套烂尾的总结感叹排比句（如他看着这天，知道新的旅战开始了等废话）！请使用主角行动作为本章结尾。\n\n  ${styleInstructions}\n\n  【书籍信息】\n  书名：${bookInfo.title}\n  主题：${bookInfo.themes.join('、')}\n  大纲：${bookInfo.outline}\n  世界观：${bookInfo.worldbuilding}";

if(regex.test(content)){
  content = content.replace(regex, newPrompt);
  fs.writeFileSync(path, content, 'utf8');
  console.log("Success with pure string literal replacement.");
} else {
  console.log("Still failed.");
}
