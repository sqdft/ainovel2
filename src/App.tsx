import { useState, useEffect, useRef } from 'react';
import { BookOpen, Settings as SettingsIcon, Users, List, FileText, Download, Loader2, Wand2, Play, Feather, RefreshCw, Globe } from 'lucide-react';
import { Settings, BookInfo, Character, TOCItem, Provider, ShortStoryInfo } from './types';
import { generateBookInfo, generateCharacters, generateTOC, generateChapterContent, generateShortStoryContent, generateShortStoryTitles, generateShortStoryOutlineFromTitle } from './services/aiService';

type Tab = 'settings' | 'book' | 'characters' | 'toc' | 'chapters' | 'examples';
type Mode = 'novel' | 'shortStory';

const PROVIDERS: Record<Provider, { label: string, baseUrl: string, model: string }> = {
  gemini: { label: 'Google Gemini', baseUrl: '', model: 'gemini-3.1-pro-preview' },
  deepseek: { label: 'DeepSeek (深度求索)', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  zhipu: { label: '智谱清言 (Zhipu)', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4' },
  moonshot: { label: 'Kimi (月之暗面)', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
  custom: { label: '自定义 (OpenAI 兼容)', baseUrl: 'https://api.openai.com/v1', model: 'gpt-3.5-turbo' },
  kilo: { label: '自定义代理', baseUrl: '', model: '' },
  free: { label: '免费模型 ', baseUrl: 'https://api-ai.7e.ink/v1', model: 'Qwen3.5' },
};

// 男频主题
const MALE_THEMES = [
  '玄幻修仙', '都市异能', '系统无敌', '重生复仇', '灵气复苏', '末世求生',
  '战神赘婿', '神豪暴富', '脑洞大开', '无敌爽文', '诡异流', '规则怪谈',
  '历史穿越', '科幻未来', '游戏竞技', '恐怖惊悚', '武侠仙侠', '轻小说',
  '凡人流', '苟道流', '模拟器', '聊天群', '综漫同人', '四合院', '诸天万界',
  '洪荒封神', '西游同人', '大唐大明', '盗墓探险', '赶海日常', '直播带货',
  '游戏制作', '体育竞技', '鉴宝捡漏', '风水相术', '国运直播', '学霸科技',
  '军工强国', '美食经营', '荒野求生', '刑侦破案', '医生文', '律师文'
];

// 女频主题
const FEMALE_THEMES = [
  '重生复仇', '真假千金', '虐恋情深', '甜宠高甜', '追妻火葬场', '破镜重圆',
  '穿书女配', '快穿打脸', '宫斗宅斗', '种田经商', '娱乐圈', '团宠萌宝',
  '年代文', '军婚', '读心术', '替身白月光', '霸道总裁', '权谋天下',
  '婆媳斗法', '萌宝带球跑', '玄学大佬', '绝世美人', '空间灵泉', '重生囤货',
  '七零年代', '八零年代', '九零年代', '重生虐渣', '大女主逆袭', '闺蜜背叛',
  '先婚后爱', '契约婚姻', '隐婚秘爱', '高岭之花下神坛', '黑莲花女主',
  '病娇男主', '清冷女主', '双向救赎', '暗恋成真', '青梅竹马', '豪门恩怨'
];

// 短篇故事主题
const SHORT_STORY_THEMES = [
  '真假千金', '追妻火葬场', '全家火葬场', '替身觉醒', '重生复仇', '读心术',
  '规则怪谈', '玄学大佬', '绝症死遁', '穿书女配', '渣男悔过', '婆媳斗法',
  '职场爽文', '绿茶女配', '萌宝带球跑', '脑洞反转', '知乎风', '白月光',
  '复仇虐渣', '甜文日常', '现代爱情', '婚姻伦理', '都市生活', '青春校园',
  '悬疑惊悚', '现实百态', '童话寓言', '科幻脑洞', '奇幻冒险', '世情故事',
  '系统绑定', '直播算命', '灵异捉鬼', '鉴宝捡漏', '荒野求生', '末日囤货'
];

const LENGTHS = [
  { label: '短篇 (100章)', value: '100', count: 100 },
  { label: '中短篇 (200章)', value: '200', count: 200 },
  { label: '中篇 (300章)', value: '300', count: 300 },
  { label: '中长篇 (400章)', value: '400', count: 400 },
  { label: '长篇 (500章)', value: '500', count: 500 },
  { label: '自定义', value: 'custom', count: 100 },
];

function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn('Error reading localStorage', error);
      return initialValue;
    }
  });

  const storedValueRef = useRef(storedValue);
  storedValueRef.current = storedValue;

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValueRef.current) : value;
      setStoredValue(valueToStore);
      storedValueRef.current = valueToStore;
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.warn('Error setting localStorage', error);
    }
  };

  return [storedValue, setValue];
}

const ThemeSelector = ({ 
  selectedThemes, 
  onChange,
  type = 'novel'
}: { 
  selectedThemes: string[], 
  onChange: (themes: string[]) => void,
  type?: 'novel' | 'shortStory'
}) => {
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [showAll, setShowAll] = useState(false);
  
  const availableThemes = type === 'shortStory' ? SHORT_STORY_THEMES : (gender === 'male' ? MALE_THEMES : FEMALE_THEMES);
  const displayThemes = showAll ? availableThemes : availableThemes.slice(0, 15);

  // 当切换男女频时，清空已选主题
  const handleGenderChange = (newGender: 'male' | 'female') => {
    setGender(newGender);
    onChange([]); // 切换时清空选择
  };

  return (
    <div>
      {type === 'novel' && (
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => handleGenderChange('male')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              gender === 'male'
                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                : 'bg-zinc-50 text-zinc-600 border border-zinc-200 hover:bg-zinc-100'
            }`}
          >
            男频
          </button>
          <button
            onClick={() => handleGenderChange('female')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              gender === 'female'
                ? 'bg-pink-100 text-pink-700 border border-pink-200'
                : 'bg-zinc-50 text-zinc-600 border border-zinc-200 hover:bg-zinc-100'
            }`}
          >
            女频
          </button>
          <span className="text-xs text-zinc-400 ml-2">
            已选 {selectedThemes.length}/5 个主题
          </span>
        </div>
      )}
      
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-zinc-700">
          主题 {type === 'shortStory' && '(可多选，最多5个)'}
        </label>
        {availableThemes.length > 15 && (
          <button 
            onClick={() => setShowAll(!showAll)}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
          >
            {showAll ? '收起' : '展示全部'}
          </button>
        )}
      </div>
      
      <div className="flex flex-wrap gap-2">
        {displayThemes.map(theme => {
          const isSelected = selectedThemes.includes(theme);
          return (
            <button
              key={theme}
              onClick={() => {
                if (isSelected) {
                  onChange(selectedThemes.filter(t => t !== theme));
                } else {
                  if (selectedThemes.length < 5) onChange([...selectedThemes, theme]);
                  else alert('最多只能选择5个主题');
                }
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isSelected 
                  ? gender === 'female' && type !== 'shortStory'
                    ? 'bg-pink-100 text-pink-700 border border-pink-200'
                    : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                  : 'bg-zinc-50 text-zinc-600 border border-zinc-200 hover:bg-zinc-100'
              }`}
            >
              {theme}
            </button>
          );
        })}
      </div>
      
      {selectedThemes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-xs text-zinc-500">已选:</span>
          {selectedThemes.map(theme => (
            <span 
              key={theme} 
              className={`px-2 py-0.5 rounded text-xs ${
                gender === 'female' && type !== 'shortStory'
                  ? 'bg-pink-50 text-pink-700'
                  : 'bg-indigo-50 text-indigo-700'
              }`}
            >
              {theme}
              <button 
                onClick={() => onChange(selectedThemes.filter(t => t !== theme))}
                className="ml-1 hover:text-red-500"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [mode, setMode] = useLocalStorage<Mode>('ai_novel_mode', 'novel');
  const [activeTab, setActiveTab] = useLocalStorage<Tab>('ai_novel_activeTab', 'settings');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingChapterNum, setGeneratingChapterNum] = useState<number | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Settings State
  const [settings, setSettings] = useLocalStorage<Settings>('ai_novel_settings', {
    provider: 'gemini',
    apiKey: '',
    apiKeys: [], // 多密钥轮询列表
    currentKeyIndex: 0, // 当前使用的密钥索引
    baseUrl: PROVIDERS['gemini'].baseUrl,
    model: PROVIDERS['gemini'].model,
    minWordCount: 2000,
  });

  // Novel State
  const [bookInfo, setBookInfo] = useLocalStorage<BookInfo>('ai_novel_bookInfo', {
    title: '',
    themes: [MALE_THEMES[0]],
    lengthType: '100',
    targetChapterCount: 100,
    outline: '',
    worldbuilding: '',
  });
  const [characters, setCharacters] = useLocalStorage<Character[]>('ai_novel_characters', []);
  const [toc, setToc] = useLocalStorage<TOCItem[]>('ai_novel_toc', []);
  const [chapters, setChapters] = useLocalStorage<Record<number, string>>('ai_novel_chapters', {});
  const [activeChapterNum, setActiveChapterNum] = useLocalStorage<number | null>('ai_novel_activeChapterNum', null);

  // Short Story State
  const [shortStoryInfo, setShortStoryInfo] = useLocalStorage<ShortStoryInfo>('ai_novel_shortStoryInfo', {
    title: '',
    themes: [SHORT_STORY_THEMES[0]],
    targetWordCount: 10000,
    outline: '',
    content: ''
  });
  const [shortStoryTitleOptions, setShortStoryTitleOptions] = useLocalStorage<string[]>('ai_novel_shortStoryTitleOptions', []);

  // Handlers
  const handleProviderChange = (provider: Provider) => {
    const newSettings: Partial<Settings> = {
      provider,
      baseUrl: PROVIDERS[provider].baseUrl,
      model: PROVIDERS[provider].model,
    };
    
    // 切换到免费提供商时，将单密钥复制到多密钥列表（如果多密钥为空）
    if (provider === 'free' && settings.apiKeys.length === 0 && settings.apiKey) {
      newSettings.apiKeys = [settings.apiKey];
    }
    
    // 从免费提供商切换回其他时，将第一个多密钥复制到单密钥
    if (provider !== 'free' && settings.provider === 'free' && settings.apiKeys.length > 0) {
      newSettings.apiKey = settings.apiKeys[0];
    }
    
    setSettings({ ...settings, ...newSettings });
  };

  const handleLengthChange = (lengthType: string) => {
    const count = LENGTHS.find(l => l.value === lengthType)?.count || 100;
    setBookInfo({ ...bookInfo, lengthType, targetChapterCount: count });
  };

  const handleGenerateBookInfo = async () => {
    setIsGenerating(true);
    try {
      const info = await generateBookInfo(bookInfo, settings);
      setBookInfo({ ...bookInfo, ...info });
      setActiveTab('book');
    } catch (error: any) {
      alert(error.message || '生成书籍信息失败');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateCharacters = async () => {
    if (!bookInfo.title || !bookInfo.outline) {
      alert('请先生成或填写书籍信息！');
      return;
    }
    setIsGenerating(true);
    try {
      const chars = await generateCharacters(bookInfo, settings);
      setCharacters(chars);
      setActiveTab('characters');
    } catch (error: any) {
      alert(error.message || '生成人物关系失败');
    } finally {
      setIsGenerating(false);
    }
  };

  // 手动添加人物
  const handleAddCharacter = () => {
    const newCharacter: Character = {
      id: Date.now().toString(),
      name: '',
      role: '配角',
      description: ''
    };
    setCharacters([...characters, newCharacter]);
  };

  // 删除人物
  const handleDeleteCharacter = (id: string) => {
    if (characters.length <= 1) {
      alert('至少保留一个角色');
      return;
    }
    setCharacters(characters.filter(c => c.id !== id));
  };

  // 更新人物
  const handleUpdateCharacter = (id: string, field: keyof Character, value: string) => {
    setCharacters(characters.map(c => 
      c.id === id ? { ...c, [field]: value } : c
    ));
  };

  const handleGenerateTOC = async () => {
    if (!bookInfo.title || characters.length === 0) {
      alert('请先生成或填写书籍信息！');
      return;
    }
    
    const startIndex = toc.length + 1;
    if (startIndex > bookInfo.targetChapterCount) {
      alert('已生成全部目录！');
      return;
    }

    setIsGenerating(true);
    try {
      const batchSize = 30;
      const existingTitles = toc.map(item => item.title);
      const newChapters = await generateTOC(bookInfo, characters, settings, startIndex, batchSize, existingTitles);
      setToc([...toc, ...newChapters]);
      setActiveTab('toc');
    } catch (error: any) {
      alert(error.message || '生成目录大纲失败');
    } finally {
      setIsGenerating(false);
    }
  };

  // 只生成单章目录（接在末尾）
  const handleGenerateSingleChapterOutline = async () => {
    if (!bookInfo.title || characters.length === 0) {
      alert('请先生成或填写书籍信息！');
      return;
    }
    
    const nextChapterNum = toc.length + 1;
    if (nextChapterNum > bookInfo.targetChapterCount) {
      alert('已生成全部目录！');
      return;
    }

    setIsGenerating(true);
    try {
      const existingTitles = toc.map(item => item.title);
      // 只生成1章
      const newChapters = await generateTOC(bookInfo, characters, settings, nextChapterNum, 1, existingTitles);
      if (newChapters.length > 0) {
        setToc([...toc, ...newChapters]);
        alert(`第${nextChapterNum}章目录生成成功！`);
      }
    } catch (error: any) {
      alert(error.message || '生成单章目录失败');
    } finally {
      setIsGenerating(false);
    }
  };

  // 删除指定目录项
  const handleDeleteTOCItem = (chapterNum: number) => {
    if (!confirm(`确定要删除第${chapterNum}章的目录标题和大纲吗？\n删除后该章节的内容也会被清空。`)) {
      return;
    }
    
    // 删除目录项（不重新编号，保持原有章节号）
    const updatedTOC = toc.filter(item => item.chapterNumber !== chapterNum);
    setToc(updatedTOC);
    
    // 删除对应章节内容
    const updatedChapters = { ...chapters };
    delete updatedChapters[chapterNum];
    setChapters(updatedChapters);
  };

  // 重新生成指定章节的目录
  const handleRegenerateChapterOutline = async (chapterNum: number) => {
    if (!bookInfo.title || characters.length === 0) {
      alert('请先生成或填写书籍信息！');
      return;
    }

    setIsGenerating(true);
    try {
      // 获取其他章节的标题（不包括当前要重新生成的）
      const existingTitles = toc
        .filter(item => item.chapterNumber !== chapterNum)
        .map(item => item.title);
      
      // 生成新标题
      const newChapters = await generateTOC(bookInfo, characters, settings, chapterNum, 1, existingTitles);
      if (newChapters.length > 0) {
        // 替换原目录项
        const updatedTOC = toc.map(item => 
          item.chapterNumber === chapterNum ? newChapters[0] : item
        );
        setToc(updatedTOC);
        
        // 清空该章内容（因为大纲变了）
        const updatedChapters = { ...chapters };
        delete updatedChapters[chapterNum];
        setChapters(updatedChapters);
        
        alert(`第${chapterNum}章目录已重新生成！`);
      }
    } catch (error: any) {
      alert(error.message || '重新生成目录失败');
    } finally {
      setIsGenerating(false);
    }
  };

  // 编辑目录标题
  const handleEditChapterTitle = (chapterNum: number, newTitle: string) => {
    const updatedTOC = toc.map(item => 
      item.chapterNumber === chapterNum ? { ...item, title: newTitle } : item
    );
    setToc(updatedTOC);
  };

  const handleGenerateChapter = async (chapterNum: number) => {
    const tocItem = toc.find(t => t.chapterNumber === chapterNum);
    if (!tocItem) return;

    setIsGenerating(true);
    setGeneratingChapterNum(chapterNum);
    try {
      const previousContents: string[] = [];
      for (let i = 1; i < chapterNum; i++) {
        if (chapters[i]) previousContents.push(chapters[i]);
      }

      const content = await generateChapterContent(bookInfo, characters, tocItem, previousContents, settings, toc);
      setChapters(prev => ({ ...prev, [chapterNum]: content }));
      setActiveChapterNum(chapterNum);
      setActiveTab('chapters');
    } catch (error: any) {
      alert(error.message || '生成章节内容失败');
    } finally {
      setGeneratingChapterNum(null);
      setIsGenerating(false);
    }
  };

  // 删除指定章节
  const handleDeleteChapter = (chapterNum: number) => {
    if (!confirm(`确定要删除第${chapterNum}章及其内容吗？\n删除后将无法恢复，该章节后续章节编号不会自动调整。`)) {
      return;
    }
    
    // 删除章节内容
    const updatedChapters = { ...chapters };
    delete updatedChapters[chapterNum];
    setChapters(updatedChapters);
    
    // 如果删除的是当前显示的章节，重置显示状态
    if (activeChapterNum === chapterNum) {
      const remainingKeys = Object.keys(updatedChapters).map(Number).sort((a, b) => a - b);
      if (remainingKeys.length > 0) {
        setActiveChapterNum(remainingKeys[0]);
      } else {
        setActiveChapterNum(1);
      }
    }
  };

  // 删除所有章节内容
  const handleDeleteAllChapters = () => {
    if (!confirm('确定要删除所有已生成的章节内容吗？\n这将清空所有章节正文，但保留目录大纲。')) {
      return;
    }
    setChapters({});
    setActiveChapterNum(1);
  };

  const handleBatchGenerateChapters = async () => {
    const ungenerated = toc.filter(t => !chapters[t.chapterNumber]);
    const toGenerate = ungenerated.slice(0, 20);
    
    if (toGenerate.length === 0) {
      alert('当前目录中的所有章节都已生成！请先生成更多目录。');
      return;
    }

    setIsGenerating(true);
    
    let currentChapters = { ...chapters };

    for (const item of toGenerate) {
      setGeneratingChapterNum(item.chapterNumber);
      setActiveChapterNum(item.chapterNumber);
      try {
        const previousContents: string[] = [];
        for (let i = 1; i < item.chapterNumber; i++) {
          if (currentChapters[i]) previousContents.push(currentChapters[i]);
        }
        const content = await generateChapterContent(bookInfo, characters, item, previousContents, settings, toc);
        currentChapters = { ...currentChapters, [item.chapterNumber]: content };
        setChapters(prev => ({ ...prev, [item.chapterNumber]: content }));
      } catch (error: any) {
        alert(`生成第${item.chapterNumber}章失败: ${error.message}`);
        break;
      }
    }
    setGeneratingChapterNum(null);
    setIsGenerating(false);
  };

  // Short Story Handlers
  const handleGenerateShortStoryTitles = async () => {
    if (shortStoryInfo.themes.length === 0) {
      alert('请先选择至少一个主题！');
      return;
    }
    setIsGenerating(true);
    try {
      const titles = await generateShortStoryTitles(shortStoryInfo.themes, settings);
      setShortStoryTitleOptions(titles);
    } catch (error: any) {
      alert(error.message || '生成标题失败');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateShortStoryOutline = async () => {
    if (!shortStoryInfo.title) {
      alert('请先填写或选择一个故事标题！');
      return;
    }
    setIsGenerating(true);
    try {
      const outline = await generateShortStoryOutlineFromTitle(shortStoryInfo.title, shortStoryInfo.themes, settings);
      setShortStoryInfo({ ...shortStoryInfo, outline });
    } catch (error: any) {
      alert(error.message || '生成大纲失败');
    } finally {
      setIsGenerating(false);
    }
  };

  // 检测并去除新生成内容与已有内容的重复部分
  const removeDuplicateContent = (existingContent: string, newContent: string): string => {
    if (!existingContent) return newContent;
    
    // 将内容按段落分割
    const existingParagraphs = existingContent.split(/\n\n+/).filter(p => p.trim().length > 10);
    const newParagraphs = newContent.split(/\n\n+/).filter(p => p.trim().length > 10);
    
    // 检查新内容的每个段落是否与已有内容高度相似
    const uniqueParagraphs: string[] = [];
    let foundDuplicate = false;
    
    for (const newPara of newParagraphs) {
      const newParaClean = newPara.trim().replace(/\s+/g, '');
      let isDuplicate = false;
      
      // 与已有内容的最后几个段落比较（避免重复续写）
      const recentExisting = existingParagraphs.slice(-5);
      for (const existPara of recentExisting) {
        const existParaClean = existPara.trim().replace(/\s+/g, '');
        
        // 计算相似度：如果新段落与已有段落的相似度超过70%，认为是重复
        const longerLen = Math.max(newParaClean.length, existParaClean.length);
        if (longerLen === 0) continue;
        
        // 简单判断：如果新段落完全包含在已有段落中，或反之
        if (existParaClean.includes(newParaClean.slice(0, 30)) || 
            newParaClean.includes(existParaClean.slice(0, 30))) {
          isDuplicate = true;
          foundDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        uniqueParagraphs.push(newPara);
      }
    }
    
    // 如果检测到重复，提示用户
    if (foundDuplicate) {
      console.warn('检测到重复内容，已自动去除');
    }
    
    return uniqueParagraphs.join('\n\n');
  };

  const handleGenerateShortStoryContent = async () => {
    if (!shortStoryInfo.outline) {
      alert('请先填写故事核心脑洞/大纲！');
      return;
    }
    setIsGenerating(true);
    try {
      const newContent = await generateShortStoryContent(shortStoryInfo, shortStoryInfo.content, settings);
      
      // 检测并去除重复内容
      const cleanedContent = removeDuplicateContent(shortStoryInfo.content, newContent);
      
      // 如果清理后内容为空或太少，提示用户
      if (cleanedContent.trim().length < 50 && newContent.trim().length > 100) {
        alert('检测到生成内容与已有内容高度重复，已跳过重复部分。建议点击"清空正文"重新生成，或继续生成下一部分。');
      }
      
      setShortStoryInfo({ 
        ...shortStoryInfo, 
        content: shortStoryInfo.content ? shortStoryInfo.content + '\n\n' + cleanedContent : cleanedContent 
      });
      setActiveTab('chapters');
    } catch (error: any) {
      alert(error.message || '生成故事内容失败');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (mode === 'novel') {
      if (Object.keys(chapters).length === 0) return;
      let fullText = `《${bookInfo.title || '未命名小说'}》\n\n`;
      toc.forEach(item => {
        if (chapters[item.chapterNumber]) {
          fullText += `第${item.chapterNumber}章 ${item.title}\n\n${chapters[item.chapterNumber]}\n\n`;
        }
      });
      downloadText(fullText, `${bookInfo.title || '小说'}.txt`);
    } else {
      if (!shortStoryInfo.content) return;
      let fullText = `《${shortStoryInfo.title || '未命名短篇'}》\n\n${shortStoryInfo.content}`;
      downloadText(fullText, `${shortStoryInfo.title || '短篇故事'}.txt`);
    }
  };

  const downloadText = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Renderers
  const renderSettings = () => (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100">
        <h2 className="text-xl font-semibold text-zinc-900 mb-6">API & 模型设置</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">AI 供应商</label>
            <select 
              value={settings.provider}
              onChange={(e) => handleProviderChange(e.target.value as Provider)}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              {Object.entries(PROVIDERS).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {settings.provider !== 'gemini' && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Base URL</label>
              <input 
                type="text" 
                value={settings.baseUrl}
                onChange={(e) => setSettings({...settings, baseUrl: e.target.value})}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-zinc-700">
                {settings.provider === 'free' ? 'API Keys (轮询)' : 'API Key'}
              </label>
              <a 
                href="https://pan.quark.cn/s/c9e7e024012a?pwd=as5Y" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                获取免费 Token
              </a>
            </div>
            
            {settings.provider === 'free' ? (
              // 免费提供商：多密钥输入
              <div className="space-y-2">
                {settings.apiKeys.length === 0 ? (
                  <div className="text-sm text-zinc-500 italic">点击下方按钮添加密钥，支持添加多个密钥自动轮询</div>
                ) : (
                  settings.apiKeys.map((key, index) => (
                    <div key={index} className="flex gap-2">
                      <input 
                        type="password" 
                        value={key}
                        onChange={(e) => {
                          const newKeys = [...settings.apiKeys];
                          newKeys[index] = e.target.value;
                          setSettings({...settings, apiKeys: newKeys});
                        }}
                        placeholder={`密钥 ${index + 1}`}
                        className="flex-1 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                      <button
                        onClick={() => {
                          const newKeys = settings.apiKeys.filter((_, i) => i !== index);
                          setSettings({...settings, apiKeys: newKeys});
                        }}
                        className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                      >
                        删除
                      </button>
                    </div>
                  ))
                )}
                <button
                  onClick={() => setSettings({...settings, apiKeys: [...settings.apiKeys, '']})}
                  className="w-full py-2 text-sm text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors"
                >
                  + 添加密钥
                </button>
                <p className="text-xs text-zinc-500">
                  已添加 {settings.apiKeys.length} 个密钥，系统会自动轮询使用。当某个密钥过期时会自动切换到下一个。
                </p>
              </div>
            ) : (
              // 其他提供商：单密钥输入
              <>
                <input 
                  type="password" 
                  value={settings.apiKey}
                  onChange={(e) => setSettings({...settings, apiKey: e.target.value})}
                  placeholder={settings.provider === 'gemini' ? "留空则使用系统默认 Key" : "sk-..."}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                {settings.provider === 'gemini' && !settings.apiKey && (
                  <p className="text-xs text-zinc-500 mt-1">当前正在使用 AI Studio 平台自动注入的安全密钥。</p>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">模型名称</label>
            <input 
              type="text" 
              value={settings.model}
              onChange={(e) => setSettings({...settings, model: e.target.value})}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {mode === 'novel' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100">
          <h2 className="text-xl font-semibold text-zinc-900 mb-6">生成偏好 (长篇小说)</h2>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">每章最低字数</label>
            <input 
              type="number" 
              value={settings.minWordCount}
              onChange={(e) => setSettings({...settings, minWordCount: parseInt(e.target.value) || 2000})}
              min={500}
              step={500}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            <p className="text-xs text-zinc-500 mt-1">AI 会尽量满足此字数要求，建议设置在 1000 - 3000 之间。</p>
          </div>
        </div>
      )}
    </div>
  );

  const renderBookInfo = () => {
    if (mode === 'shortStory') {
      return (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-zinc-900">短篇故事设定</h2>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100 space-y-6">
            <ThemeSelector 
              type="shortStory"
              selectedThemes={shortStoryInfo.themes} 
              onChange={(themes) => setShortStoryInfo({...shortStoryInfo, themes})} 
            />
            
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 md:col-span-1">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-zinc-700">故事标题</label>
                  <button
                    onClick={handleGenerateShortStoryTitles}
                    disabled={isGenerating || shortStoryInfo.themes.length === 0}
                    className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 disabled:opacity-50"
                  >
                    {isGenerating && shortStoryTitleOptions.length === 0 ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    AI 构思标题
                  </button>
                </div>
                <input 
                  type="text" 
                  value={shortStoryInfo.title}
                  onChange={(e) => setShortStoryInfo({...shortStoryInfo, title: e.target.value})}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                {shortStoryTitleOptions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {shortStoryTitleOptions.map((t, idx) => (
                      <button
                        key={idx}
                        onClick={() => setShortStoryInfo({...shortStoryInfo, title: t})}
                        className="px-2 py-1 text-xs bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-colors"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-zinc-700 mb-1">目标总字数 (7k-12k)</label>
                <input 
                  type="number" 
                  value={shortStoryInfo.targetWordCount}
                  onChange={(e) => setShortStoryInfo({...shortStoryInfo, targetWordCount: parseInt(e.target.value) || 10000})}
                  min={1000}
                  step={1000}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-zinc-700">核心脑洞 / 故事大纲</label>
                <button
                  onClick={handleGenerateShortStoryOutline}
                  disabled={isGenerating || !shortStoryInfo.title}
                  className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 disabled:opacity-50"
                >
                  {isGenerating && shortStoryInfo.title && !shortStoryInfo.outline ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  AI 生成大纲
                </button>
              </div>
              <textarea 
                value={shortStoryInfo.outline}
                onChange={(e) => setShortStoryInfo({...shortStoryInfo, outline: e.target.value})}
                placeholder="描述这个短篇故事的核心创意、主要情节和结局..."
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 h-40 resize-none"
              />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-zinc-900">书籍设定</h2>
          <button
            onClick={handleGenerateBookInfo}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            AI 一键生成设定
          </button>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100 space-y-6">
          <ThemeSelector 
            selectedThemes={bookInfo.themes} 
            onChange={(themes) => setBookInfo({...bookInfo, themes})} 
          />
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">小说篇幅</label>
              <div className="flex gap-2">
                <select 
                  value={bookInfo.lengthType}
                  onChange={(e) => handleLengthChange(e.target.value)}
                  className="flex-1 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  {LENGTHS.map(l => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
                {bookInfo.lengthType === 'custom' && (
                  <div className="flex items-center gap-2 w-32">
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      value={bookInfo.targetChapterCount}
                      onChange={(e) => setBookInfo({ ...bookInfo, targetChapterCount: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      placeholder="章数"
                    />
                    <span className="text-sm text-zinc-500">章</span>
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">书名</label>
              <input 
                type="text" 
                value={bookInfo.title}
                onChange={(e) => setBookInfo({...bookInfo, title: e.target.value})}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">故事大纲</label>
            <textarea 
              value={bookInfo.outline}
              onChange={(e) => setBookInfo({...bookInfo, outline: e.target.value})}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 h-32 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">世界观设定</label>
            <textarea 
              value={bookInfo.worldbuilding}
              onChange={(e) => setBookInfo({...bookInfo, worldbuilding: e.target.value})}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 h-32 resize-none"
            />
          </div>
        </div>
      </div>
    );
  };

  const renderCharacters = () => (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-zinc-900">人物关系</h2>
        <div className="flex gap-2">
          <button
            onClick={handleAddCharacter}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-700 bg-zinc-100 rounded-lg hover:bg-zinc-200 transition-colors"
          >
            <Users className="w-4 h-4" />
            添加人物
          </button>
          <button
            onClick={handleGenerateCharacters}
            disabled={isGenerating || !bookInfo.title}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            AI 生成人物
          </button>
        </div>
      </div>

      {characters.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-zinc-100 border-dashed">
          <Users className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
          <p className="text-zinc-500">暂无人物设定，请点击右上角生成或手动添加。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {characters.map((char, idx) => (
            <div key={char.id || idx} className="bg-white p-5 rounded-2xl shadow-sm border border-zinc-100">
              <div className="flex items-center justify-between mb-3">
                <input 
                  type="text" 
                  value={char.name}
                  onChange={(e) => handleUpdateCharacter(char.id, 'name', e.target.value)}
                  placeholder="角色姓名"
                  className="font-semibold text-lg text-zinc-900 bg-transparent border-none focus:ring-0 p-0 w-32"
                />
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    value={char.role}
                    onChange={(e) => handleUpdateCharacter(char.id, 'role', e.target.value)}
                    placeholder="角色定位"
                    className="text-xs font-medium px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full border-none focus:ring-0 text-right w-24"
                  />
                  <button
                    onClick={() => handleDeleteCharacter(char.id)}
                    className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                    title="删除人物"
                  >
                    ×
                  </button>
                </div>
              </div>
              <textarea 
                value={char.description}
                onChange={(e) => handleUpdateCharacter(char.id, 'description', e.target.value)}
                placeholder="角色描述（性格、背景、关系等）"
                className="w-full text-sm text-zinc-600 bg-zinc-50 border border-zinc-100 rounded-lg p-3 h-24 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderTOC = () => {
    if (mode === 'shortStory') return null;

    const nextStart = toc.length + 1;
    const nextEnd = Math.min(nextStart + 29, bookInfo.targetChapterCount);
    const isComplete = toc.length >= bookInfo.targetChapterCount;

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-zinc-900">目录大纲</h2>
            <p className="text-sm text-zinc-500 mt-1">
              已生成 {toc.length} / {bookInfo.targetChapterCount} 章
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleGenerateSingleChapterOutline}
              disabled={isGenerating || characters.length === 0 || isComplete}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-700 bg-zinc-100 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              生成单章
            </button>
            <button
              onClick={handleGenerateTOC}
              disabled={isGenerating || characters.length === 0 || isComplete}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              {isComplete ? '目录已全部生成' : `批量生成 (${nextStart}-${nextEnd}章)`}
            </button>
          </div>
        </div>

        {toc.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-zinc-100 border-dashed">
            <List className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
            <p className="text-zinc-500">暂无目录大纲，请确保已生成人物后点击生成。</p>
          </div>
        ) : (
          <div className="space-y-3">
            {toc.map((item, idx) => (
              <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-zinc-100 flex gap-4 group">
                <div className="flex-shrink-0 w-12 h-12 bg-zinc-50 rounded-xl flex items-center justify-center font-serif text-xl text-zinc-400">
                  {item.chapterNumber}
                </div>
                <div className="flex-1 space-y-2">
                  <input 
                    type="text" 
                    value={item.title}
                    onChange={(e) => {
                      const newToc = [...toc];
                      newToc[idx].title = e.target.value;
                      setToc(newToc);
                    }}
                    className="w-full font-semibold text-zinc-900 bg-transparent border-none focus:ring-0 p-0"
                    placeholder="章节标题"
                  />
                  <textarea 
                    value={item.summary}
                    onChange={(e) => {
                      const newToc = [...toc];
                      newToc[idx].summary = e.target.value;
                      setToc(newToc);
                    }}
                    className="w-full text-sm text-zinc-600 bg-zinc-50 border border-zinc-100 rounded-lg p-3 h-20 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="章节内容摘要"
                  />
                </div>
                <div className="flex-shrink-0 flex flex-col gap-2">
                  <button
                    onClick={() => {
                      setActiveChapterNum(item.chapterNumber);
                      setActiveTab('chapters');
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                  >
                    前往正文
                  </button>
                  <button
                    onClick={() => handleRegenerateChapterOutline(item.chapterNumber)}
                    disabled={isGenerating}
                    className="px-3 py-1.5 text-xs font-medium text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-70"
                  >
                    {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : '重新生成'}
                  </button>
                  <button
                    onClick={() => handleDeleteTOCItem(item.chapterNumber)}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderExamples = () => (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-zinc-900">小说范文参考</h2>
        <p className="text-sm text-zinc-500">点击下方链接阅读优秀小说示例</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {EXAMPLE_LINKS.map((link, idx) => (
          <a
            key={idx}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white p-5 rounded-2xl shadow-sm border border-zinc-100 hover:border-amber-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                <BookOpen className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-zinc-900 group-hover:text-amber-700 transition-colors">{link.title}</h3>
                <p className="text-xs text-zinc-500 truncate">{link.url}</p>
              </div>
              <Globe className="w-4 h-4 text-zinc-400 group-hover:text-amber-500 transition-colors" />
            </div>
          </a>
        ))}
      </div>

      <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 mt-6">
        <p className="text-sm text-amber-800">
          💡 提示：阅读优秀范文可以帮助你更好地理解小说结构、人物塑造和情节设计。建议在创作前先浏览这些示例获取灵感。
        </p>
      </div>
    </div>
  );

  const renderChapters = () => {
    if (mode === 'shortStory') {
      return (
        <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-sm border border-zinc-100 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-zinc-100 flex justify-between items-center bg-white shrink-0">
            <h3 className="font-semibold text-lg text-zinc-900">
              {shortStoryInfo.title || '未命名短篇'}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (confirm('确定要清空当前内容重新开始吗？')) {
                    setShortStoryInfo({ ...shortStoryInfo, content: '' });
                  }
                }}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-600 bg-zinc-100 rounded-lg hover:bg-zinc-200 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                清空重来
              </button>
              <button
                onClick={handleGenerateShortStoryContent}
                disabled={isGenerating}
                className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-70"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {shortStoryInfo.content ? '继续生成 (续写)' : '开始生成'}
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 bg-zinc-50/50">
            <textarea
              value={shortStoryInfo.content}
              onChange={(e) => setShortStoryInfo({ ...shortStoryInfo, content: e.target.value })}
              placeholder={isGenerating ? "AI 正在奋笔疾书，请稍候..." : "点击右上角「开始生成」，或者在此处手动输入内容..."}
              className="w-full h-full min-h-[500px] p-6 bg-white border border-zinc-200 rounded-xl shadow-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-zinc-800 leading-relaxed"
            />
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
        <div className="w-64 border-r border-zinc-100 bg-zinc-50/50 flex flex-col">
          <div className="p-4 border-b border-zinc-100 flex justify-between items-center">
            <h3 className="font-medium text-zinc-900">章节列表</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {toc.length === 0 ? (
              <p className="text-xs text-zinc-400 p-4 text-center">请先生成目录</p>
            ) : (
              toc.map(item => (
                <div
                  key={item.chapterNumber}
                  className={`group flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                    activeChapterNum === item.chapterNumber 
                      ? 'bg-indigo-50 text-indigo-700 font-medium' 
                      : 'text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  <button
                    onClick={() => setActiveChapterNum(item.chapterNumber)}
                    className="flex-1 text-left truncate flex items-center gap-2"
                  >
                    {generatingChapterNum === item.chapterNumber && <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />}
                    第{item.chapterNumber}章 {item.title}
                  </button>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!chapters[item.chapterNumber] && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGenerateChapter(item.chapterNumber);
                        }}
                        disabled={isGenerating}
                        className="p-1 text-indigo-600 hover:bg-indigo-100 rounded"
                        title="生成内容"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {chapters[item.chapterNumber] && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteChapter(item.chapterNumber);
                        }}
                        className="p-1 text-red-400 hover:bg-red-50 hover:text-red-600 rounded"
                        title="删除内容"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  {chapters[item.chapterNumber] && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 ml-1" />}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-white">
          {activeChapterNum ? (
            <>
              <div className="p-4 border-b border-zinc-100 flex justify-between items-center bg-white">
                <h3 className="font-semibold text-lg text-zinc-900">
                  第{activeChapterNum}章 {toc.find(t => t.chapterNumber === activeChapterNum)?.title}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBatchGenerateChapters}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-70"
                  >
                    <Play className="w-4 h-4" />
                    批量生成下20章
                  </button>
                  {chapters[activeChapterNum] && (
                    <button
                      onClick={() => handleDeleteChapter(activeChapterNum)}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      删除本章
                    </button>
                  )}
                  <button
                    onClick={() => handleGenerateChapter(activeChapterNum)}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-70"
                  >
                    {isGenerating && generatingChapterNum === activeChapterNum ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    {chapters[activeChapterNum] ? '重新生成' : '生成本章'}
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-8">
                {chapters[activeChapterNum] ? (
                  <div className="prose prose-zinc max-w-2xl mx-auto">
                    {chapters[activeChapterNum].split('\n').map((paragraph, idx) => (
                      paragraph.trim() ? <p key={idx} className="mb-4 leading-relaxed text-zinc-800 text-justify">{paragraph}</p> : <br key={idx} />
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                    {generatingChapterNum === activeChapterNum ? (
                      <>
                        <Loader2 className="w-12 h-12 mb-3 animate-spin text-indigo-400" />
                        <p>正在奋笔疾书中...</p>
                      </>
                    ) : (
                      <>
                        <FileText className="w-12 h-12 mb-3 opacity-20" />
                        <p>点击右上角生成本章内容</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400">
              <BookOpen className="w-12 h-12 mb-3 opacity-20" />
              <p>请在左侧选择一个章节</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleReset = () => {
    if (showResetConfirm) {
      window.localStorage.clear();
      window.location.reload();
    } else {
      setShowResetConfirm(true);
      setTimeout(() => setShowResetConfirm(false), 3000);
    }
  };

  const handleResetBookInfo = () => {
    if (confirm('确定要重置书籍信息吗？这将清空书籍设定、人物、目录和章节内容，但保留API设置。')) {
      // 重置长篇小说数据
      setBookInfo({
        title: '',
        themes: [MALE_THEMES[0]],
        lengthType: '100',
        targetChapterCount: 100,
        outline: '',
        worldbuilding: '',
      });
      setCharacters([]);
      setToc([]);
      setChapters({});
      setActiveChapterNum(null);
      
      // 重置短篇故事数据
      setShortStoryInfo({
        title: '',
        themes: [SHORT_STORY_THEMES[0]],
        targetWordCount: 10000,
        outline: '',
        content: ''
      });
      setShortStoryTitleOptions([]);
      
      // 切换到设置页
      setActiveTab('settings');
      alert('书籍信息已重置，API设置保持不变');
    }
  };

  const navItems = mode === 'novel' 
    ? [
        { id: 'settings', icon: SettingsIcon, label: '设置' },
        { id: 'book', icon: BookOpen, label: '书籍信息' },
        { id: 'characters', icon: Users, label: '人物关系' },
        { id: 'toc', icon: List, label: '大纲目录' },
        { id: 'chapters', icon: FileText, label: '章节内容' },
      ]
    : [
        { id: 'settings', icon: SettingsIcon, label: '设置' },
        { id: 'book', icon: Feather, label: '短篇设定' },
        { id: 'chapters', icon: FileText, label: '故事正文' },
      ];

  // 范文参考链接（去重）
  const EXAMPLE_LINKS = [
    { url: 'https://fanqienovel.com/page/7610270375947013144', title: '范文示例 1' },
    { url: 'https://fanqienovel.com/page/7546082508601822233', title: '范文示例 2' },
    { url: 'https://fanqienovel.com/page/7614757506149010457', title: '范文示例 3' },
    { url: 'https://fanqienovel.com/page/7612519494467996697', title: '范文示例 4' },
    { url: 'https://fanqienovel.com/page/7603258880004475928', title: '范文示例 5' },
  ];

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900 font-sans">
      {/* Main Sidebar */}
      <div className="w-20 md:w-64 bg-white border-r border-zinc-200 flex flex-col">
        <div className="h-16 flex items-center justify-center md:justify-start md:px-6 border-b border-zinc-100 shrink-0">
          <BookOpen className="w-6 h-6 text-indigo-600 shrink-0" />
          <h1 className="font-semibold text-lg tracking-tight ml-3 hidden md:block">AI 小说家</h1>
        </div>
        
        <div className="p-4 border-b border-zinc-100">
          <div className="flex bg-zinc-100 p-1 rounded-lg">
            <button
              onClick={() => { setMode('novel'); setActiveTab('book'); }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${mode === 'novel' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              长篇连载
            </button>
            <button
              onClick={() => { setMode('shortStory'); setActiveTab('book'); }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${mode === 'shortStory' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              短篇故事
            </button>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as Tab)}
              className={`w-full flex items-center justify-center md:justify-start px-3 py-3 rounded-xl transition-colors ${
                activeTab === item.id 
                  ? 'bg-indigo-50 text-indigo-700 font-medium' 
                  : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="ml-3 hidden md:block">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-zinc-100 space-y-3">
          <button
            onClick={() => setActiveTab('examples')}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'examples'
                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                : 'text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden md:block">范文参考</span>
          </button>
          <a
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            <Globe className="w-4 h-4" />
            <span className="hidden md:block">我的博客</span>
          </a>
          
          <button
            onClick={handleDownload}
            disabled={(mode === 'novel' && Object.keys(chapters).length === 0) || (mode === 'shortStory' && !shortStoryInfo.content)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span className="hidden md:block">导出全书</span>
          </button>
          
          <div className="flex items-center justify-end px-1 mt-1 gap-2">
            <button
              onClick={handleResetBookInfo}
              className="text-[11px] flex items-center gap-1 px-1.5 py-1 rounded transition-colors text-zinc-400 hover:text-amber-600 hover:bg-amber-50"
              title="重置书籍信息（保留API设置）"
            >
              <RefreshCw className="w-3 h-3" />
              <span className="hidden md:block">重开新书</span>
            </button>
            <button
              onClick={handleReset}
              className={`text-[11px] flex items-center gap-1 px-1.5 py-1 rounded transition-colors ${
                showResetConfirm 
                  ? 'bg-red-100 text-red-700 font-medium' 
                  : 'text-zinc-400 hover:text-red-600 hover:bg-red-50'
              }`}
              title="重置所有数据"
            >
              <RefreshCw className={`w-3 h-3 ${showResetConfirm ? 'animate-spin' : ''}`} />
              <span className="hidden md:block">{showResetConfirm ? '确认?' : '重置'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-zinc-200 flex items-center px-6 shrink-0">
          <h2 className="font-medium text-zinc-800">
            {activeTab === 'settings' && '系统设置'}
            {activeTab === 'book' && (mode === 'novel' ? '书籍基本信息' : '短篇故事设定')}
            {activeTab === 'characters' && '主要人物设定'}
            {activeTab === 'toc' && '分章目录大纲'}
            {activeTab === 'chapters' && (mode === 'novel' ? '小说正文生成' : '故事正文生成')}
            {activeTab === 'examples' && '小说范文参考'}
          </h2>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {activeTab === 'settings' && renderSettings()}
          {activeTab === 'book' && renderBookInfo()}
          {activeTab === 'characters' && renderCharacters()}
          {activeTab === 'toc' && renderTOC()}
          {activeTab === 'chapters' && renderChapters()}
          {activeTab === 'examples' && renderExamples()}
        </main>
      </div>
    </div>
  );
}
