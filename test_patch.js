const fs = require('fs');

const path = 'src/services/aiService.ts';
let content = fs.readFileSync(path, 'utf-8');

const regex = /let prompt = \你是一位专业网文作家[\\s\\S]*?【书籍信息】\\s*书名：\\\$\\{bookInfo\\.title\\}\\s*主题：\\\$\\{bookInfo\\.themes\\.join\\('、'\\)\\}/g;

const newPrompt = \const styleInstructions = getThemeStyles(bookInfo.themes);
  let prompt = \\\你是一位专业网文作家。撰写第 \\\ 章：\\\。

  \\\

  【核心要求】
  1. 严格控制字数：本章目标字数严格控制在 \\\ 字左右。严禁用大量无意义的感叹、景色描写或废话对话注水！
  2. 【骨架剧情拆解机制 (Beats)】：在你开始输出正文前，你需要在内心把本章的情节拆分为 4 到 5 个子场景(Beats)。然后，你需要用饱满的动作描述、冲突和对话把这几个场景扎实地写出来，绝对不可以把核心事件用一两句话草草概括！
  3. 沉浸式创作与反AI总结味道：只输出正文内容。章节末尾绝对禁止出现类似于“未来的路还很长”、“新的篇章开启了”等狗血且俗套的总结式排比句！

  \\\

  【书籍信息】
  书名：\\\
  主题：\\\\;

if(regex.test(content)) {
    content = content.replace(regex, newPrompt);
    fs.writeFileSync(path, content, 'utf-8');
    console.log("Successfully replaced the prompt.");
} else {
    console.log("Regex did not match.");
}
