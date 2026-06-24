import assert from 'node:assert/strict';
import { __test__ } from './aiService';

const { extractJSON, validateBookTitles, validateCharacters, validateTOC, validateSegments } = __test__;

assert.deepEqual(extractJSON('```json\n{"ok":true}\n```'), { ok: true });

assert.deepEqual(
  validateBookTitles({
    titles: [
      { title: '逆天归来', intro: '废柴少年重回巅峰，横扫宿敌' },
      { title: '', intro: '无效' },
    ],
  }),
  [{ title: '逆天归来', intro: '废柴少年重回巅峰，横扫宿敌' }]
);

assert.equal(
  validateCharacters({
    characters: [
      { id: 'char1', name: '林澈', role: '主角', description: '背负家族秘密，性格坚韧。' },
      { id: 'char2', name: '林澈', role: '配角', description: '重复姓名会被过滤。' },
    ],
  }).length,
  1
);

assert.deepEqual(
  validateTOC(
    {
      chapters: [
        { chapterNumber: 1, title: '风起青山', summary: '主角发现旧案线索，踏出第一步。' },
        { chapterNumber: 2, title: '夜探祠堂', summary: '主角潜入祠堂，确认仇敌仍在布局。' },
      ],
    },
    1,
    2,
    []
  ).map(item => item.chapterNumber),
  [1, 2]
);

assert.throws(() =>
  validateTOC(
    {
      chapters: [
        { chapterNumber: 1, title: '重复标题', summary: '这一章标题已经存在。' },
        { chapterNumber: 2, title: '新标题', summary: '第二章有效。' },
      ],
    },
    1,
    2,
    ['重复标题']
  )
);

assert.throws(
  () =>
    validateTOC(
      {
        chapters: [
          { chapterNumber: 20, title: '最后的决战', summary: '过早使用结局感标题。' },
        ],
      },
      20,
      20,
      [],
      100
    ),
  /标题节奏不合理/
);

assert.equal(
  validateTOC(
    {
      chapters: [
        { chapterNumber: 100, title: '最终大结局', summary: '所有伏笔收束，故事完成。' },
      ],
    },
    100,
    100,
    [],
    100
  )[0].title,
  '最终大结局'
);

assert.equal(
  validateSegments([
    { segmentNumber: 1, title: '开端', wordCount: 1500, summary: '主角陷入危机。' },
  ])[0].isGenerated,
  false
);

console.log('aiService quality tests passed');
