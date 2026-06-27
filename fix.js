import fs from 'fs';

const path = 'src/services/aiService.ts';
let content = fs.readFileSync(path, 'utf-8');

const regex = /let prompt = \你是一位专业网文作家[\s\S]*?主题：\$\{bookInfo\.themes\.join\('、'\)\}/;

const newStr = "const styleInstructions = getThemeStyles(bookInfo.themes);\n  let prompt = \你是一位专业网文作家。撰写第  章：。\n\n  \n\n  【核心要求】\n  1. 严格控制字数：本章目标字数控制在  字左右，必须写出情节推进而不是用废话注水。\n  2. 【剧情拆解机制】：写正文时，要在内心将本章剧情拆成几个具体的画面来描写，绝不允许一笔带过重要情节。\n  3. 反AI套路味道：绝不可以在章末使用总结归纳性废话（例如：少年坚定了信念...），保持情节本身的张力。\n\n  \n\n  【书籍信息】\n  书名：\n  主题：";

content = content.replace(regex, newStr);
fs.writeFileSync(path, content, 'utf-8');
console.log('done');
