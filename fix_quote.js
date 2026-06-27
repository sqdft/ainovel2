import fs from 'fs';
let text = fs.readFileSync('src/services/aiService.ts', 'utf8');

const lines = text.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('【全书记忆】')) {
     lines[i] = "  ${novelMemory ? `\\n【全书记忆】\\n故事进展：${novelMemory.storySoFar || '暂无'}\\n人物状态：${novelMemory.characterStates || '暂无'}\\n未回收伏笔：${novelMemory.openThreads.join('、') || '暂无'}\\n已解决线索：${novelMemory.resolvedThreads.join('、') || '暂无'}\\n重要物品设定：${novelMemory.importantItems.join('、') || '暂无'}\\n请严格延续这些状态，不要让角色关系、伏笔、物品归属和已发生事件前后矛盾。\\n` : ''}";
     console.log("Memory line forcefully replaced!");
  }
}
fs.writeFileSync('src/services/aiService.ts', lines.join('\n'), 'utf8');
