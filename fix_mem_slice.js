import fs from 'fs';
const file = 'src/services/aiService.ts';
let code = fs.readFileSync(file, 'utf8');

const sKeyword = "export async function updateNovelMemory";
const startGen = 'const prompt = `你';
const endGen = "请严格";

const sIndex = code.indexOf(sKeyword);
if (sIndex !== -1) {
    const codeChunk = code.substring(sIndex);
    const mStartPart = codeChunk.indexOf(startGen);
    const mEndPart = codeChunk.indexOf(endGen);
    
    if (mStartPart !== -1 && mEndPart !== -1 && mEndPart > mStartPart) {
        const absoluteStart = sIndex + mStartPart;
        const absoluteEnd = sIndex + mEndPart;
        
        const before = code.substring(0, absoluteStart);
        const after = code.substring(absoluteEnd);
        
        const newMemoryPromptPart = `const prompt = \`你是小说长线连续性大纲整理官。请根据刚才最新章节的正文内容，更新覆盖全书记忆。如果有伏笔被填坑，你必须明确将它从未回收名单移入已解决中！
  【书籍信息】书名：\${bookInfo.title}
  总大纲：\${bookInfo.outline}
  
  【原有全书记忆】
  故事进展：\${previousMemory.storySoFar || '暂无'}
  人物状态：\${previousMemory.characterStates || '暂无'}
  未回收伏笔：\${previousMemory.openThreads.join('、') || '暂无'}
  已解决线索：\${previousMemory.resolvedThreads.join('、') || '暂无'}
  重要物品/设定：\${previousMemory.importantItems.join('、') || '暂无'}
  
  【最新完成的章节】第\${tocItem.chapterNumber}章 \${tocItem.title}
  章节摘要：\${tocItem.summary}
  章节正文：\${chapterContent.slice(0, 6000)}
  
  `;
        
        code = before + newMemoryPromptPart + after;
        console.log("Memory rule updated");
    }
}

fs.writeFileSync(file, code, 'utf8');
