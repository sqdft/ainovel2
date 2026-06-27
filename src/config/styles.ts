export function getThemeStyles(themes: string[]): string {
  const allThemes = themes.join('、');
  let styleInstruction = '';

  if (allThemes.includes('规则怪谈') || allThemes.includes('悬疑') || allThemes.includes('恐怖')) {
    styleInstruction = \【行文风格强制指令：悬疑惊悚】
- 语调：压抑、冷峻、充满未知感。
- 细节：多用短句，刻画人物因极度恐惧而产生的生理反应（如冷汗、瞳孔收缩、粗重的呼吸）。
- 场景：强调环境的昏暗、死寂以及不合情理的诡异细节。
- 禁忌：禁止出现主角盲目阳光乐观的总结分析！全篇必须保留压迫感。\;
  } else if (allThemes.includes('沙雕') || allThemes.includes('搞笑') || allThemes.includes('喜剧')) {
    styleInstruction = \【行文风格强制指令：轻松搞笑】
- 语调：跳脱、反常规、充满戏剧性。
- 语言：可以适当运用现代网络梗，角色内心的吐槽要多且夸张。
- 情节：在眼看要发生正经危机时，立刻用极其荒诞的方式打破严肃气氛。
- 禁忌：禁止长篇大论的伤春悲秋，所有的危机感不用太深沉。\;
  } else if (allThemes.includes('玄幻修仙') || allThemes.includes('洪荒') || allThemes.includes('仙侠')) {
    styleInstruction = \【行文风格强制指令：仙侠玄幻】
- 语调：大气、苍凉、具有古风韵味。
- 战斗描写：要求描写功法的破坏力、灵力波动的宏大场面，以及周遭天地异象。
- 对白：语言要符合修仙界法则，带有上位者的威严或下位者的敬畏。\;
  } else if (allThemes.includes('言情') || allThemes.includes('甜' ) || allThemes.includes('虐')) {
    styleInstruction = \【行文风格强制指令：细腻言情】
- 语调：感性、细腻、情绪拉扯感强。
- 细节：重点放大男女主之间的眼神交汇、不经意的肢体接触，以及细腻百转的心理活动描写。
- 节奏：不要推进得过快，放慢相处时的空气暧昧感。\;
  } else {
    styleInstruction = \【行文风格强制指令：网文通用爽文】
- 语调：明快、直接、节奏感强。
- 视角：以主角视角体验为主，突出主角面临逆境时的果断，或者打脸时的利落。
- 禁忌：少写几百字的心理描写解释原理，多用剧情和动作推动发展。\;
  }

  return styleInstruction + \
【反AI公文味禁忌】
1. 绝对禁止在章节末尾写出宏大的感叹句，例如：“未来的路虽然艰险，但他坚定的眼神说明了一切”、“一段新的征程开启了”等排比句！一切总结性废话全部删除。
2. 情节要通过角色的对话和具体动作去展示（Show, don't tell），而不是用旁白去解释总结。\;
}
