import fs from 'fs';
const file = 'src/services/aiService.ts';
let code = fs.readFileSync(file, 'utf8');

// The hack for generateChapterContent prompt
const startGen = "let prompt = `你";
const endGen = "【书籍信息";

if (code.includes(startGen) && code.includes(endGen) && code.indexOf(endGen) > code.indexOf(startGen)) {
   const before = code.substring(0, code.indexOf(startGen));
   const after = code.substring(code.indexOf(endGen));
   
   const newPromptPart = `let prompt = \`你是一位专业网文作家。撰写第 \${tocItem.chapterNumber} 章：\${tocItem.title}。

  \${pacingContext}

  【核心要求】
  1. 严格把控字数：章节目标字数为 \${settings.minWordCount} 字，必须写出有营养的情节，绝对禁止用大量空洞重复的对话水字数！
  2. 【骨架扩写机制 (Beats)】：在你开始正文生成之前，不要用一两句话草草概括核心事件！必须在内部将刚才的章节摘要拆解成几个具体的小场景（如路途、相遇、冲突爆发等），然后逐一描绘画面和心理。
  3. 沉浸式创作与反AI套路：章节末尾绝对禁止添加“少年握紧双拳坚定了信念”、“一段新的旅程就此开启”等上帝视角的排比感叹总结句！
  4. 写作风格需要有针对小说题材的调整，并用动作来驱动剧情的发展。
  
  `;
   
   code = before + newPromptPart + after;
   console.log("Core rule updated");
}

fs.writeFileSync(file, code, 'utf8');
