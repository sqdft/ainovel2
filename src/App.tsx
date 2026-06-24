import { useState, useEffect, useRef } from 'react';
import { BookOpen, Settings as SettingsIcon, Users, List, FileText, Download, Loader2, Wand2, Play, Feather, RefreshCw, Globe, Upload } from 'lucide-react';
import { Settings, BookInfo, Character, TOCItem, Provider, ShortStoryInfo, Realm, SubRealm, RealmProgress, ModelInfo, NovelMemory } from './types';
import { dualGet, dualSet } from './lib/storage';
import { generateBookInfo, generateCharacters, generateRealms, generateTOC, generateChapterContent, generateShortStoryContent, generateShortStoryTitles, generateShortStoryOutlineFromTitle, generateShortStorySegments, generateBookTitles, updateNovelMemory } from './services/aiService';
import { PROVIDERS, getProviderConfig } from './config/providers';
import { MALE_THEME_NAMES, FEMALE_THEME_NAMES, SHORT_STORY_THEME_NAMES } from './config/themes';
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } from 'docx';
import { saveAs } from 'file-saver';

type Tab = 'settings' | 'book' | 'characters' | 'realms' | 'toc' | 'chapters' | 'examples';
type Mode = 'novel' | 'shortStory';

const LENGTHS = [
  { label: '短篇 (100章)', value: '100', count: 100 },
  { label: '中短篇 (200章)', value: '200', count: 200 },
  { label: '中篇 (300章)', value: '300', count: 300 },
  { label: '中长篇 (400章)', value: '400', count: 400 },
  { label: '长篇 (500章)', value: '500', count: 500 },
  { label: '自定义', value: 'custom', count: 100 },
];

function useDualStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [loaded, setLoaded] = useState(false);
  const storedValueRef = useRef(storedValue);
  storedValueRef.current = storedValue;

  // 首次加载：从 IndexedDB/localStorage 读取
  useEffect(() => {
    dualGet<T>(key, initialValue).then(val => {
      setStoredValue(val);
      storedValueRef.current = val;
      setLoaded(true);
    });
  }, [key]);

  const setValue = (value: T | ((val: T) => T)) => {
    const valueToStore = value instanceof Function ? value(storedValueRef.current) : value;
    setStoredValue(valueToStore);
    storedValueRef.current = valueToStore;
    dualSet(key, valueToStore);
  };

  // 未加载完时返回初始值
  return [loaded ? storedValue : initialValue, setValue];
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
  
  // 防御性检查：确保 selectedThemes 是数组
  const safeSelectedThemes = Array.isArray(selectedThemes) ? selectedThemes : [];
  const availableThemes = type === 'shortStory' ? SHORT_STORY_THEME_NAMES : (gender === 'male' ? MALE_THEME_NAMES : FEMALE_THEME_NAMES);
  // 防御性检查：确保 availableThemes 是数组
  const safeAvailableThemes = Array.isArray(availableThemes) ? availableThemes : [];
  const displayThemes = showAll ? safeAvailableThemes : safeAvailableThemes.slice(0, 15);

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
            已选 {safeSelectedThemes.length}/5 个主题
          </span>
        </div>
      )}
      
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-zinc-700">
          主题 {type === 'shortStory' && '(可多选，最多5个)'}
        </label>
        {safeAvailableThemes.length > 15 && (
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
          const isSelected = safeSelectedThemes.includes(theme);
          return (
            <button
              key={theme}
              onClick={() => {
                if (isSelected) {
                  onChange(safeSelectedThemes.filter(t => t !== theme));
                } else {
                  if (safeSelectedThemes.length < 5) onChange([...safeSelectedThemes, theme]);
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
      
      {safeSelectedThemes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-xs text-zinc-500">已选:</span>
          {safeSelectedThemes.map(theme => (
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
                onClick={() => onChange(safeSelectedThemes.filter(t => t !== theme))}
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
  const [mode, setMode] = useDualStorage<Mode>('ai_novel_mode', 'novel');
  const [activeTab, setActiveTab] = useDualStorage<Tab>('ai_novel_activeTab', 'settings');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingChapterNum, setGeneratingChapterNum] = useState<number | null>(null);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const stopBatchRef = useRef(false);

  // Settings State
  const [settings, setSettings] = useDualStorage<Settings>('ai_novel_settings', {
    provider: 'gemini',
    apiKey: '',
    apiKeys: [], // 多密钥轮询列表
    currentKeyIndex: 0, // 当前使用的密钥索引
    baseUrl: PROVIDERS['gemini'].baseUrl,
    model: PROVIDERS['gemini'].model,
    availableModels: [], // 可用模型列表
    minWordCount: 2000,
    temperature: 0.9, // 默认 0.9，较高的创作自由度
  });

  // 确保旧数据也有所有必需字段
  useEffect(() => {
    const needsUpdate = 
      settings.temperature === undefined ||
      !settings.apiKeys ||
      !settings.availableModels;

    if (needsUpdate) {
      setSettings({
        ...settings,
        temperature: settings.temperature ?? 0.9,
        apiKeys: settings.apiKeys ?? [],
        availableModels: settings.availableModels ?? [],
        currentKeyIndex: settings.currentKeyIndex ?? 0,
      });
    }
  }, []);

  // Novel State
  const [bookInfo, setBookInfo] = useDualStorage<BookInfo>('ai_novel_bookInfo', {
    title: '',
    themes: [MALE_THEME_NAMES[0]],
    lengthType: '100',
    targetChapterCount: 100,
    outline: '',
    worldbuilding: '',
    endingOutline: '',
    titleOptions: [],
    isTitleSelected: false,
    enableRealms: true // 默认启用境界体系
  });
  const [characters, setCharacters] = useDualStorage<Character[]>('ai_novel_characters', []);
  const [realmProgress, setRealmProgress] = useDualStorage<RealmProgress>('ai_novel_realmProgress', {
    realms: [],
    protagonistCurrentRealmIndex: 0,
    protagonistCurrentSubRealmIndex: 0,
    chapterRealmMap: {}
  });
  const [toc, setToc] = useDualStorage<TOCItem[]>('ai_novel_toc', []);
  const [chapters, setChapters] = useDualStorage<Record<number, string>>('ai_novel_chapters', {});
  const [activeChapterNum, setActiveChapterNum] = useDualStorage<number | null>('ai_novel_activeChapterNum', null);
  const [novelMemory, setNovelMemory] = useDualStorage<NovelMemory>('ai_novel_memory', {
    storySoFar: '',
    characterStates: '',
    openThreads: [],
    resolvedThreads: [],
    importantItems: [],
    lastUpdatedChapter: 0
  });

  // Short Story State
  const [shortStoryInfo, setShortStoryInfo] = useDualStorage<ShortStoryInfo>('ai_novel_shortStoryInfo', {
    title: '',
    themes: [SHORT_STORY_THEME_NAMES[0]],
    targetWordCount: 3000,
    outline: '',
    content: '',
    segments: [],
    currentSegment: 0,
    isOutlineGenerated: false
  });
  const [shortStoryTitleOptions, setShortStoryTitleOptions] = useDualStorage<string[]>('ai_novel_shortStoryTitleOptions', []);

  // Handlers
  const handleProviderChange = (provider: Provider) => {
    const providerConfig = PROVIDERS[provider];
    if (!providerConfig) {
      console.error('Provider config not found:', provider);
      return;
    }

    const newSettings: Partial<Settings> = {
      provider,
      baseUrl: providerConfig.baseUrl,
      model: providerConfig.model,
    };

    // 切换到免费提供商时，将单密钥复制到多密钥列表（如果多密钥为空）
    if (provider === 'free' && (!settings.apiKeys || settings.apiKeys.length === 0) && settings.apiKey) {
      newSettings.apiKeys = [settings.apiKey];
    }

    // 从免费提供商切换回其他时，将第一个多密钥复制到单密钥
    if (provider !== 'free' && settings.provider === 'free' && settings.apiKeys && settings.apiKeys.length > 0) {
      newSettings.apiKey = settings.apiKeys[0];
    }

    setSettings({ ...settings, ...newSettings });
  };

  const handleDetectModels = async () => {
    if (settings.provider === 'gemini') {
      alert('Gemini 不支持模型检测，请手动输入模型名称');
      return;
    }

    if (!settings.baseUrl) {
      alert('请先设置 Base URL');
      return;
    }

    const apiKey = settings.provider === 'free' && settings.apiKeys && settings.apiKeys.length > 0
      ? settings.apiKeys[settings.currentKeyIndex || 0] || settings.apiKeys[0]
      : settings.apiKey;

    if (!apiKey && settings.provider !== 'kilo') {
      alert('请先设置 API Key');
      return;
    }

    setIsGenerating(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const res = await fetch(`${settings.baseUrl}/models`, {
        method: 'GET',
        headers
      });

      if (!res.ok) {
        throw new Error(`API 请求失败 (${res.status})`);
      }

      const data = await res.json();
      
      if (!data.data || !Array.isArray(data.data)) {
        throw new Error('API 返回格式异常');
      }

      const models: ModelInfo[] = data.data.map((m: any) => ({
        id: m.id,
        name: m.id,
        provider: settings.provider,
        contextLength: m.context_window
      }));

      setSettings({ ...settings, availableModels: models });
      alert(`检测成功！共发现 ${models.length} 个可用模型`);
    } catch (error: any) {
      alert(`模型检测失败: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const emptyNovelMemory: NovelMemory = {
    storySoFar: '',
    characterStates: '',
    openThreads: [],
    resolvedThreads: [],
    importantItems: [],
    lastUpdatedChapter: 0
  };

  const hasNovelDownstreamData = () => {
    return characters.length > 0 || realmProgress.realms.length > 0 || toc.length > 0 || Object.keys(chapters).length > 0 || !!novelMemory.storySoFar;
  };

  const clearNovelDownstream = (level: 'book' | 'toc' | 'chapters') => {
    if (level === 'book') {
      setCharacters([]);
      setRealmProgress({ realms: [], protagonistCurrentRealmIndex: 0, protagonistCurrentSubRealmIndex: 0, chapterRealmMap: {} });
      setToc([]);
    }
    if (level === 'toc') {
      setRealmProgress({ realms: [], protagonistCurrentRealmIndex: 0, protagonistCurrentSubRealmIndex: 0, chapterRealmMap: {} });
      setToc([]);
    }
    setChapters({});
    setActiveChapterNum(null);
    setNovelMemory(emptyNovelMemory);
  };

  const confirmAndClearNovelDownstream = (message: string, level: 'book' | 'toc' | 'chapters') => {
    if (!hasNovelDownstreamData()) return true;
    if (!confirm(message)) return false;
    clearNovelDownstream(level);
    return true;
  };

  const handleLengthChange = (lengthType: string) => {
    if (!confirmAndClearNovelDownstream('修改篇幅会影响目录、境界推进和已生成正文。是否清空这些下游内容？', 'toc')) {
      return;
    }
    const count = LENGTHS.find(l => l.value === lengthType)?.count || 100;
    setBookInfo({ ...bookInfo, lengthType, targetChapterCount: count });
  };

  const handleBookThemesChange = (themes: string[]) => {
    if (!confirmAndClearNovelDownstream('修改主题会影响书籍设定、人物、目录和正文。是否清空这些下游内容？', 'book')) {
      return;
    }
    setBookInfo({ ...bookInfo, themes, titleOptions: [], isTitleSelected: false, title: '', outline: '', worldbuilding: '' });
  };

  const handleBookTitleInput = (title: string) => {
    if (title !== bookInfo.title && !confirmAndClearNovelDownstream('修改书名会影响人物、目录和正文。是否清空这些下游内容？', 'book')) {
      return;
    }
    setBookInfo({...bookInfo, title, isTitleSelected: !!title});
  };

  const handleBookPlanningFieldChange = (field: 'outline' | 'worldbuilding', value: string) => {
    if (value !== bookInfo[field] && !confirmAndClearNovelDownstream('修改大纲或世界观会影响人物、目录和正文。是否清空这些下游内容？', 'book')) {
      return;
    }
    setBookInfo({ ...bookInfo, [field]: value });
  };

  // 生成书名选项（新增）
  const handleGenerateBookTitles = async () => {
    if (!bookInfo.themes || bookInfo.themes.length === 0) {
      alert('请先选择至少一个主题！');
      return;
    }
    setIsGenerating(true);
    try {
      const titles = await generateBookTitles(bookInfo.themes, bookInfo.lengthType, settings, bookInfo.targetChapterCount);
      setBookInfo({ ...bookInfo, titleOptions: titles, isTitleSelected: false, title: '' });
      alert(`成功生成 ${titles.length} 个书名选项！请选择一个您喜欢的书名。`);
    } catch (error: any) {
      alert(error.message || '生成书名失败');
    } finally {
      setIsGenerating(false);
    }
  };

  // 选择书名（新增）
  const handleSelectBookTitle = (title: string) => {
    if (title !== bookInfo.title && !confirmAndClearNovelDownstream('切换书名会清空人物、目录和正文，避免新旧设定混用。是否继续？', 'book')) {
      return;
    }
    setBookInfo({ ...bookInfo, title, isTitleSelected: true, titleOptions: [] }); // 选择后清空选项，让卡片消失
  };

  const handleGenerateBookInfo = async () => {
    // 检查是否已选择书名
    if (!bookInfo.isTitleSelected || !bookInfo.title) {
      alert('请先生成并选择一个书名！');
      return;
    }
    setIsGenerating(true);
    try {
      const info = await generateBookInfo(bookInfo, settings);
      clearNovelDownstream('book');
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
      clearNovelDownstream('toc');
      setCharacters(chars);
      setActiveTab('characters');
    } catch (error: any) {
      alert(error.message || '生成人物关系失败');
    } finally {
      setIsGenerating(false);
    }
  };

  // 生成境界体系
  const handleGenerateRealms = async () => {
    if (!bookInfo.title || !characters || characters.length === 0) {
      alert('请先生成书籍信息和人物！');
      return;
    }
    setIsGenerating(true);
    try {
      const realms = await generateRealms(bookInfo, characters, settings);
      // 自动分配突破节点：大境界+小境界，前期快后期慢
      const totalChapters = bookInfo.targetChapterCount;
      // 计算总突破节点数：每个大境界的小境界数之和（不含起始大境界的第0个小境界）
      const totalBreakpoints = realms.reduce((sum, r, idx) => {
        if (idx === 0) return sum + (r.subRealms?.length ? r.subRealms.length - 1 : 0); // 起始大境界跳过第0个小境界
        return sum + (r.subRealms?.length || 1); // 其他大境界包含所有小境界
      }, 0);
      const chapterRealmMap: Record<number, { realmIndex: number; subRealmIndex: number }> = {};
      let bpIdx = 0;
      const usedChapters = new Set<number>();
      if (totalBreakpoints > 0) {
        realms.forEach((realm, rIdx) => {
          const subCount = realm.subRealms?.length || 1;
          const startSub = rIdx === 0 ? 1 : 0; // 起始大境界从第1个小境界开始
          for (let sIdx = startSub; sIdx < subCount; sIdx++) {
            bpIdx++;
            const t = bpIdx / totalBreakpoints;
            const curvedT = Math.pow(t, 1.3);
            let chapter = Math.min(Math.max(Math.round(curvedT * totalChapters), bpIdx * 3), totalChapters);
            while (usedChapters.has(chapter) && chapter < totalChapters) chapter++;
            while (usedChapters.has(chapter) && chapter > 1) chapter--;
            usedChapters.add(chapter);
            chapterRealmMap[chapter] = { realmIndex: rIdx, subRealmIndex: sIdx };
          }
        });
      } else {
        realms.slice(1).forEach((_, idx) => {
          const chapter = Math.min(totalChapters, Math.max(1, Math.round(((idx + 1) / realms.length) * totalChapters)));
          chapterRealmMap[chapter] = { realmIndex: idx + 1, subRealmIndex: 0 };
        });
      }
      setRealmProgress({
        realms,
        protagonistCurrentRealmIndex: 0,
        protagonistCurrentSubRealmIndex: 0,
        chapterRealmMap
      });
      setActiveTab('realms');
    } catch (error: any) {
      alert(error.message || '生成境界体系失败');
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
    if (!characters || characters.length <= 1) {
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
    if (!bookInfo.title || !characters || characters.length === 0) {
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
    if (!bookInfo.title || !characters || characters.length === 0) {
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
    if (!bookInfo.title || !characters || characters.length === 0) {
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

  const countTextLength = (text: string) => text.replace(/\s/g, '').length;

  const findDuplicateRisk = (content: string, previousContent?: string) => {
    if (!previousContent) return false;
    const cleanCurrent = content.replace(/\s/g, '');
    const cleanPrevious = previousContent.replace(/\s/g, '');
    if (cleanCurrent.length < 120 || cleanPrevious.length < 120) return false;
    for (let i = 0; i <= Math.min(cleanCurrent.length - 80, 800); i += 20) {
      const sample = cleanCurrent.slice(i, i + 80);
      if (sample && cleanPrevious.includes(sample)) return true;
    }
    return false;
  };

  const validateChapterContent = (content: string, tocItem: TOCItem, previousContent?: string) => {
    const warnings: string[] = [];
    const textLength = countTextLength(content);
    const min = settings.minWordCount || 2000;
    if (textLength < min * 0.7) warnings.push(`正文偏短：约 ${textLength} 字，低于目标 ${min} 字较多`);
    if (textLength > min * 1.6) warnings.push(`正文偏长：约 ${textLength} 字，明显超过目标 ${min} 字`);
    if (content.trim().startsWith(`第${tocItem.chapterNumber}章`) || content.trim().startsWith(tocItem.title)) {
      warnings.push('正文开头疑似包含章节标题，建议删除标题后再导出');
    }
    if (findDuplicateRisk(content, previousContent)) {
      warnings.push('正文与上一章存在较长重复片段，建议检查衔接处');
    }
    if (tocItem.chapterNumber === bookInfo.targetChapterCount && /刚刚开始|真正的风暴|新的征程|未完待续/.test(content.slice(-300))) {
      warnings.push('最终章结尾仍像悬念钩子，建议重新生成或手动收尾');
    }
    return warnings;
  };

  const generateChapterWithQualityGate = async (tocItem: TOCItem, currentChapters: Record<number, string>, memory: NovelMemory = novelMemory) => {
    const previousContents: string[] = [];
    for (let i = 1; i < tocItem.chapterNumber; i++) {
      if (currentChapters[i]) previousContents.push(currentChapters[i]);
    }
    const previousContent = previousContents[previousContents.length - 1];
    const activeRealmProgress = bookInfo.enableRealms !== false ? realmProgress : undefined;
    const content = await generateChapterContent(bookInfo, characters, tocItem, previousContents, settings, toc, activeRealmProgress, memory);
    if (!content.trim()) {
      throw new Error('AI 返回的章节正文为空，请重试。');
    }
    const warnings = validateChapterContent(content, tocItem, previousContent);
    if (warnings.length > 0) {
      alert(`第${tocItem.chapterNumber}章已生成，但发现质量提醒：\n${warnings.join('\n')}`);
    }
    let nextMemory = memory;
    try {
      nextMemory = await updateNovelMemory(memory, bookInfo, tocItem, content, settings);
      setNovelMemory(nextMemory);
    } catch (error) {
      console.warn('更新全书记忆失败，本章正文已保留:', error);
    }
    return { content, nextMemory };
  };

  const handleGenerateChapter = async (chapterNum: number) => {
    const tocItem = toc.find(t => t.chapterNumber === chapterNum);
    if (!tocItem) return;

    setIsGenerating(true);
    setGeneratingChapterNum(chapterNum);
    try {
      const { content } = await generateChapterWithQualityGate(tocItem, chapters);
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
    setIsBatchGenerating(true);
    stopBatchRef.current = false;
    
    let currentChapters = { ...chapters };
    let currentMemory = novelMemory;

    for (const item of toGenerate) {
      if (stopBatchRef.current) break;
      setGeneratingChapterNum(item.chapterNumber);
      setActiveChapterNum(item.chapterNumber);
      try {
        const { content, nextMemory } = await generateChapterWithQualityGate(item, currentChapters, currentMemory);
        currentMemory = nextMemory;
        currentChapters = { ...currentChapters, [item.chapterNumber]: content };
        setChapters(prev => ({ ...prev, [item.chapterNumber]: content }));
      } catch (error: any) {
        alert(`生成第${item.chapterNumber}章失败: ${error.message}`);
        break;
      }
    }
    setGeneratingChapterNum(null);
    setIsBatchGenerating(false);
    setIsGenerating(false);
  };

  const handleStopBatchGenerate = () => {
    stopBatchRef.current = true;
  };

  // Short Story Handlers
  const handleGenerateShortStoryTitles = async () => {
    if (!shortStoryInfo.themes || shortStoryInfo.themes.length === 0) {
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
      // 生成分段大纲
      const segments = await generateShortStorySegments(shortStoryInfo, settings);
      const outlineText = segments.map(s => `${s.segmentNumber}. ${s.title}：${s.summary}`).join('\n');
      setShortStoryInfo({
        ...shortStoryInfo,
        segments,
        isOutlineGenerated: true,
        outline: shortStoryInfo.outline ? `${shortStoryInfo.outline}\n\n【AI 分段规划】\n${outlineText}` : outlineText
      });
    } catch (error: any) {
      alert(error.message || '生成大纲失败');
    } finally {
      setIsGenerating(false);
    }
  };

  // 检测并去除新生成内容与已有内容的重复部分（增强版）
  const removeDuplicateContent = (existingContent: string, newContent: string): string => {
    if (!existingContent) return newContent;
    
    // 将内容按段落分割
    const existingParagraphs = existingContent.split(/\n\n+/).filter(p => p.trim().length > 10);
    const newParagraphs = newContent.split(/\n\n+/).filter(p => p.trim().length > 10);
    
    // 检查新内容的每个段落是否与已有内容高度相似
    const uniqueParagraphs: string[] = [];
    let foundDuplicate = false;
    
    // 计算两个字符串的相似度（Levenshtein距离的简化版）
    const calculateSimilarity = (str1: string, str2: string): number => {
      const len1 = str1.length;
      const len2 = str2.length;
      if (len1 === 0 || len2 === 0) return 0;
      
      // 使用滑动窗口找最长公共子串
      let maxMatch = 0;
      const minLen = Math.min(len1, len2);
      
      for (let i = 0; i < len1 - 20; i++) {
        const substr = str1.slice(i, i + 20);
        if (str2.includes(substr)) {
          maxMatch = Math.max(maxMatch, 20);
        }
      }
      
      return maxMatch / minLen;
    };
    
    for (const newPara of newParagraphs) {
      const newParaClean = newPara.trim().replace(/\s+/g, '');
      let isDuplicate = false;
      
      // 与已有内容的最后10个段落比较（扩大检测范围）
      const recentExisting = existingParagraphs.slice(-10);
      for (const existPara of recentExisting) {
        const existParaClean = existPara.trim().replace(/\s+/g, '');
        
        // 跳过太短的段落
        if (newParaClean.length < 20 || existParaClean.length < 20) continue;
        
        // 方法1: 检查前50字是否重复（提高检测长度）
        const prefixLen = Math.min(50, newParaClean.length, existParaClean.length);
        if (prefixLen >= 30) {
          const newPrefix = newParaClean.slice(0, prefixLen);
          const existPrefix = existParaClean.slice(0, prefixLen);
          if (newPrefix === existPrefix) {
            isDuplicate = true;
            foundDuplicate = true;
            break;
          }
        }
        
        // 方法2: 检查是否有长度超过30的公共子串
        if (newParaClean.length >= 30 && existParaClean.length >= 30) {
          for (let i = 0; i <= newParaClean.length - 30; i++) {
            const substr = newParaClean.slice(i, i + 30);
            if (existParaClean.includes(substr)) {
              isDuplicate = true;
              foundDuplicate = true;
              break;
            }
          }
          if (isDuplicate) break;
        }
        
        // 方法3: 计算整体相似度（相似度超过60%认为重复）
        const similarity = calculateSimilarity(newParaClean, existParaClean);
        if (similarity > 0.6) {
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

  // 生成/续写短篇故事
  const handleGenerateShortStoryContent = async (isFinalBatch: boolean = false) => {
    if (!shortStoryInfo.outline) {
      alert('请先填写故事核心脑洞/大纲！');
      return;
    }
    
    setIsGenerating(true);
    try {
      // 限制上下文长度，避免超过4096 token限制
      // 最多保留1500字（约3000 token）作为上下文
      const MAX_CONTEXT_LENGTH = 1500;
      let context = shortStoryInfo.content;
      
      if (context.length > MAX_CONTEXT_LENGTH) {
        // 只保留最后1500字作为上下文
        context = context.slice(-MAX_CONTEXT_LENGTH);
      }
      
      const newContent = await generateShortStoryContent(shortStoryInfo, context, settings, isFinalBatch);
      
      // 检测并去除重复内容
      const cleanedContent = removeDuplicateContent(shortStoryInfo.content, newContent);
      
      // 如果清理后内容为空或太少，提示用户
      if (cleanedContent.trim().length < 50 && newContent.trim().length > 100) {
        alert('检测到生成内容与已有内容高度重复，已跳过重复部分。建议点击"清空正文"重新生成，或继续生成下一部分。');
      }
      
      // 更新分段计数
      const currentSegment = shortStoryInfo.currentSegment || 0;
      
      setShortStoryInfo({ 
        ...shortStoryInfo, 
        content: shortStoryInfo.content ? shortStoryInfo.content + '\n\n' + cleanedContent : cleanedContent,
        currentSegment: currentSegment + 1
      });
      setActiveTab('chapters');
    } catch (error: any) {
      alert(error.message || '生成故事内容失败');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (format: 'txt' | 'docx' = 'txt') => {
    if (mode === 'novel') {
      if (Object.keys(chapters).length === 0) return;
      
      if (format === 'docx') {
        await downloadNovelAsWord();
      } else {
        let fullText = `《${bookInfo.title || '未命名小说'}》\n\n`;
        toc.forEach(item => {
          if (chapters[item.chapterNumber]) {
            fullText += `第${item.chapterNumber}章 ${item.title}\n\n${chapters[item.chapterNumber]}\n\n`;
          }
        });
        downloadText(fullText, `${bookInfo.title || '小说'}.txt`);
      }
    } else {
      if (!shortStoryInfo.content) return;
      
      if (format === 'docx') {
        await downloadShortStoryAsWord();
      } else {
        let fullText = `《${shortStoryInfo.title || '未命名短篇'}》\n\n${shortStoryInfo.content}`;
        downloadText(fullText, `${shortStoryInfo.title || '短篇故事'}.txt`);
      }
    }
  };

  const downloadNovelAsWord = async () => {
    const paragraphs: Paragraph[] = [];
    
    // 添加标题
    paragraphs.push(
      new Paragraph({
        text: bookInfo.title || '未命名小说',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      })
    );
    
    // 添加每一章
    toc.forEach(item => {
      if (chapters[item.chapterNumber]) {
        // 章节标题
        paragraphs.push(
          new Paragraph({
            text: `第${item.chapterNumber}章 ${item.title}`,
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 200 }
          })
        );
        
        // 章节内容 - 按段落分割
        const content = chapters[item.chapterNumber];
        const contentParagraphs = content.split(/\n+/).filter(p => p.trim());
        
        contentParagraphs.forEach(para => {
          paragraphs.push(
            new Paragraph({
              text: para.trim(),
              spacing: { after: 200 },
              indent: { firstLine: 480 } // 首行缩进2字符
            })
          );
        });
        
        // 章节之间添加空行
        paragraphs.push(new Paragraph({ text: '' }));
      }
    });
    
    const doc = new Document({
      sections: [{
        properties: {},
        children: paragraphs
      }]
    });
    
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${bookInfo.title || '小说'}.docx`);
  };

  const downloadShortStoryAsWord = async () => {
    const paragraphs: Paragraph[] = [];
    
    // 添加标题
    paragraphs.push(
      new Paragraph({
        text: shortStoryInfo.title || '未命名短篇',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      })
    );
    
    // 添加内容 - 按段落分割
    const contentParagraphs = shortStoryInfo.content.split(/\n+/).filter(p => p.trim());
    
    contentParagraphs.forEach(para => {
      paragraphs.push(
        new Paragraph({
          text: para.trim(),
          spacing: { after: 200 },
          indent: { firstLine: 480 } // 首行缩进2字符
        })
      );
    });
    
    const doc = new Document({
      sections: [{
        properties: {},
        children: paragraphs
      }]
    });
    
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${shortStoryInfo.title || '短篇故事'}.docx`);
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
                value={settings.baseUrl || ''}
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
                href="https://pan.quark.cn/s/12ccdf62ccd8" 
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
                {(!settings.apiKeys || settings.apiKeys.length === 0) ? (
                  <div className="text-sm text-zinc-500 italic">点击下方按钮添加密钥，支持添加多个密钥自动轮询</div>
                ) : (
                  settings.apiKeys.map((key, index) => (
                    <div key={index} className="flex gap-2">
                      <input 
                        type="password" 
                        value={key}
                        onChange={(e) => {
                          const newKeys = [...(settings.apiKeys || [])];
                          newKeys[index] = e.target.value;
                          setSettings({...settings, apiKeys: newKeys});
                        }}
                        placeholder={`密钥 ${index + 1}`}
                        className="flex-1 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                      <button
                        onClick={() => {
                          const newKeys = (settings.apiKeys || []).filter((_, i) => i !== index);
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
                  onClick={() => setSettings({...settings, apiKeys: [...(settings.apiKeys || []), '']})}
                  className="w-full py-2 text-sm text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors"
                >
                  + 添加密钥
                </button>
                <p className="text-xs text-zinc-500">
                  已添加 {settings.apiKeys?.length || 0} 个密钥，系统会自动轮询使用。当某个密钥过期时会自动切换到下一个。
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
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-zinc-700">模型名称</label>
              {settings.provider !== 'gemini' && (
                <button
                  onClick={handleDetectModels}
                  disabled={isGenerating}
                  className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 disabled:opacity-50"
                >
                  {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  检测可用模型
                </button>
              )}
            </div>
            {settings.availableModels && settings.availableModels.length > 0 ? (
              <select
                value={settings.model}
                onChange={(e) => setSettings({...settings, model: e.target.value})}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                {settings.availableModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                    {model.contextLength && ` (${model.contextLength})`}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={settings.model || ''}
                onChange={(e) => setSettings({...settings, model: e.target.value})}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            )}
            {settings.availableModels && settings.availableModels.length > 0 && (
              <p className="text-xs text-zinc-500 mt-1">检测到 {settings.availableModels.length} 个可用模型</p>
            )}
          </div>
        </div>
      </div>

      {mode === 'novel' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100">
          <h2 className="text-xl font-semibold text-zinc-900 mb-6">生成偏好 (长篇小说)</h2>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">每章最低字数</label>
              <input 
                type="number" 
                value={settings.minWordCount || 2000}
                onChange={(e) => setSettings({...settings, minWordCount: parseInt(e.target.value) || 2000})}
                min={500}
                step={500}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <p className="text-xs text-zinc-500 mt-1">AI 会尽量满足此字数要求，建议设置在 1000 - 3000 之间。</p>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-zinc-700">创作自由度 (Temperature)</label>
                <span className="text-sm font-semibold text-indigo-600">{(settings.temperature ?? 0.9).toFixed(1)}</span>
              </div>
              <input 
                type="range" 
                value={settings.temperature ?? 0.9}
                onChange={(e) => setSettings({...settings, temperature: parseFloat(e.target.value)})}
                min={0}
                max={2}
                step={0.1}
                className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-xs text-zinc-500 mt-1">
                <span>0.0 (保守)</span>
                <span>1.0 (平衡)</span>
                <span>2.0 (激进)</span>
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                <span className="font-medium">说明：</span>
                {(settings.temperature ?? 0.9) < 0.5 && '保守模式，内容更规范但可能缺乏创意'}
                {(settings.temperature ?? 0.9) >= 0.5 && (settings.temperature ?? 0.9) < 1.2 && '平衡模式，适合大多数创作场景'}
                {(settings.temperature ?? 0.9) >= 1.2 && '激进模式，内容更自由大胆，可能包含成人内容'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 rounded-2xl shadow-sm border border-pink-100/50 overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #fce4ec, #f8bbd0, #fce4ec, #f3e5f5, #fce4ec)', backgroundSize: '400% 400%', animation: 'pinkFlow 8s ease infinite' }}>
        <div className="text-center mb-5 relative z-10">
          <h2 className="text-lg font-semibold text-zinc-800 mb-1">☕ 赞助支持</h2>
          <p className="text-sm text-zinc-500">你的赞助是支持小羊老师创作的动力</p>
        </div>
        <div className="flex gap-5 justify-center relative z-10">
          <div className="flex flex-col items-center gap-2 bg-white/80 backdrop-blur-sm p-3 rounded-xl shadow-sm border border-white/50">
            <img src="/微信.png" alt="微信支付" className="w-32 h-32 rounded-lg" />
            <span className="text-xs font-medium text-zinc-600 bg-green-50 text-green-700 px-2 py-0.5 rounded-full">微信</span>
          </div>
          <div className="flex flex-col items-center gap-2 bg-white/80 backdrop-blur-sm p-3 rounded-xl shadow-sm border border-white/50">
            <img src="/支付宝.png" alt="支付宝支付" className="w-32 h-32 rounded-lg" />
            <span className="text-xs font-medium text-zinc-600 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">支付宝</span>
          </div>
        </div>
      </div>
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
                    disabled={isGenerating || !shortStoryInfo.themes || shortStoryInfo.themes.length === 0}
                    className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 disabled:opacity-50"
                  >
                    {isGenerating && (!shortStoryTitleOptions || shortStoryTitleOptions.length === 0) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    AI 构思标题
                  </button>
                </div>
                <input 
                  type="text" 
                  value={shortStoryInfo.title}
                  onChange={(e) => setShortStoryInfo({...shortStoryInfo, title: e.target.value})}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                {shortStoryTitleOptions && shortStoryTitleOptions.length > 0 && (
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
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-zinc-900">书籍设定</h2>
          <button
            onClick={handleGenerateBookInfo}
            disabled={isGenerating || !bookInfo.isTitleSelected}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            AI 生成大纲设定
          </button>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-zinc-100 space-y-6">
          <ThemeSelector 
            selectedThemes={bookInfo.themes} 
            onChange={handleBookThemesChange}
          />
          
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">小说篇幅</label>
              <div className="flex gap-2">
                <select 
                  value={bookInfo.lengthType}
                  onChange={(e) => handleLengthChange(e.target.value)}
                  className="flex-1 px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
                      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      placeholder="章数"
                    />
                    <span className="text-sm text-zinc-500">章</span>
                  </div>
                )}
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-zinc-700">书名</label>
                <button
                  onClick={handleGenerateBookTitles}
                  disabled={isGenerating || !bookInfo.themes || bookInfo.themes.length === 0}
                  className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 disabled:opacity-50"
                >
                  {isGenerating && (!bookInfo.titleOptions || bookInfo.titleOptions.length === 0) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  AI 构思书名
                </button>
              </div>
              <input 
                type="text" 
                value={bookInfo.title}
                onChange={(e) => handleBookTitleInput(e.target.value)}
                placeholder="请先生成书名或手动输入"
                className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>
          
          {/* 书名卡片选择区域 - 选择后自动消失 */}
          {bookInfo.titleOptions && bookInfo.titleOptions.length > 0 && (
            <div className="border-t border-zinc-100 pt-6 -mx-8 px-8">
              <p className="text-sm text-zinc-600 mb-4 font-medium">📚 请选择一个书名（点击卡片）：</p>
              <div className="grid grid-cols-1 gap-3">
                {bookInfo.titleOptions.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectBookTitle(option.title)}
                    className="text-left p-5 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 border border-indigo-200 rounded-xl transition-all hover:shadow-md group"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-10 h-10 bg-indigo-600 text-white rounded-lg flex items-center justify-center font-bold text-base group-hover:scale-110 transition-transform">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-zinc-900 text-base mb-1.5 group-hover:text-indigo-700 transition-colors">
                          《{option.title}》
                        </h3>
                        <p className="text-sm text-zinc-600 leading-relaxed">
                          {option.intro}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-indigo-400 group-hover:text-indigo-600 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* 已选择书名提示 */}
          {bookInfo.isTitleSelected && bookInfo.title && (
            <div className="border-t border-zinc-100 pt-6">
              <p className="text-sm text-green-600 flex items-center gap-2 mb-4">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                已选择书名：《{bookInfo.title}》
              </p>
              
              {/* 境界体系开关 */}
              <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex-1">
                  <label className="text-sm font-medium text-amber-900 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bookInfo.enableRealms ?? true}
                      onChange={(e) => {
                        const enableRealms = e.target.checked;
                        setBookInfo({...bookInfo, enableRealms});
                        if (!enableRealms) {
                          setRealmProgress({ realms: [], protagonistCurrentRealmIndex: 0, protagonistCurrentSubRealmIndex: 0, chapterRealmMap: {} });
                        }
                      }}
                      className="w-4 h-4 text-indigo-600 border-amber-300 rounded focus:ring-indigo-500"
                    />
                    启用境界体系
                  </label>
                  <p className="text-xs text-amber-700 mt-1 ml-6">
                    {bookInfo.enableRealms 
                      ? '适合修仙、玄幻、武侠等题材，会生成完整的力量等级体系' 
                      : '适合都市、现代、悬疑等题材，不生成境界划分'}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* 大纲和世界观 - 始终显示 */}
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">故事大纲</label>
              <textarea 
                value={bookInfo.outline}
                onChange={(e) => handleBookPlanningFieldChange('outline', e.target.value)}
                placeholder={bookInfo.isTitleSelected ? "点击右上角按钮生成，或手动填写..." : "请先选择书名后再填写大纲"}
                disabled={!bookInfo.isTitleSelected}
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 h-40 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">世界观设定</label>
              <textarea 
                value={bookInfo.worldbuilding}
                onChange={(e) => handleBookPlanningFieldChange('worldbuilding', e.target.value)}
                placeholder={bookInfo.isTitleSelected ? "点击右上角按钮生成，或手动填写..." : "请先选择书名后再填写世界观"}
                disabled={!bookInfo.isTitleSelected}
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 h-40 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>
          
          {/* 引导提示 */}
          {!bookInfo.isTitleSelected && (
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
              <p className="text-sm text-amber-800">
                💡 提示：请先选择主题和篇幅，然后点击"AI 构思书名"生成多个书名选项，选择您喜欢的书名后再继续生成大纲设定。
              </p>
            </div>
          )}
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

      {(!characters || characters.length === 0) ? (
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

  const renderRealms = () => {
    if (mode === 'shortStory') return null;
    const protagonist = characters.find(c => c.role === '主角');
    const protagName = protagonist?.name || '主角';

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-zinc-900">境界体系</h2>
          <button
            onClick={handleGenerateRealms}
            disabled={isGenerating || !bookInfo.title || !characters || characters.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            AI 生成境界
          </button>
        </div>

        {realmProgress.realms.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-zinc-100 border-dashed">
            <Globe className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
            <p className="text-zinc-500">暂无境界体系，请先生成人物后点击右上角生成。</p>
            <p className="text-xs text-zinc-400 mt-1">境界体系将贯穿全文，主角随剧情提升境界。</p>
          </div>
        ) : (
          <>
            {/* 当前境界概览 */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-indigo-600">主角{protagName}境界体系</span>
                  <div className="text-2xl font-bold text-indigo-900 mt-1">
                    {realmProgress.realms.length} 阶境界
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm text-indigo-600">自动分配</span>
                  <div className="text-lg font-semibold text-indigo-900 mt-1">
                    {Object.keys(realmProgress.chapterRealmMap).length} 个突破节点
                  </div>
                </div>
              </div>
              <div className="mt-2 text-xs text-indigo-500">
                境界按章节进度自动推进，生成章节时AI自动识别当前境界并融入剧情
              </div>
            </div>

            {/* 境界列表 */}
            <div className="space-y-3">
              {realmProgress.realms.map((realm, idx) => {
                const isStarting = idx === 0;
                // 找到该大境界对应的所有突破章节
                const realmBreakpoints = Object.entries(realmProgress.chapterRealmMap)
                  .filter(([, val]) => (val as any).realmIndex === idx)
                  .map(([ch, val]) => ({ ch: Number(ch), subIdx: (val as any).subRealmIndex }))
                  .sort((a, b) => a.ch - b.ch);
                const bigBreakthrough = realmBreakpoints.find(bp => bp.subIdx === 0);
                return (
                  <div key={realm.id} className={`p-4 rounded-xl border transition-all ${
                    isStarting ? 'bg-green-50 border-green-200' :
                    bigBreakthrough ? 'bg-amber-50 border-amber-200' :
                    'bg-white border-zinc-100'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          isStarting ? 'bg-green-600 text-white' :
                          bigBreakthrough ? 'bg-amber-500 text-white' :
                          'bg-zinc-100 text-zinc-500'
                        }`}>
                          {realm.level}
                        </span>
                        <div>
                          <span className={`font-semibold ${isStarting ? 'text-green-900' : bigBreakthrough ? 'text-amber-900' : 'text-zinc-700'}`}>
                            {realm.name}
                          </span>
                          {isStarting && <span className="ml-2 text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">起始</span>}
                          {bigBreakthrough && <span className="ml-2 text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full">第{bigBreakthrough.ch}章突破</span>}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 ml-11 text-sm text-zinc-600">{realm.description}</div>
                    {/* 小境界列表 */}
                    {realm.subRealms && realm.subRealms.length > 0 && (
                      <div className="mt-2 ml-11 flex flex-wrap gap-1.5">
                        {realm.subRealms.map((sub, si) => {
                          const subBp = realmBreakpoints.find(bp => bp.subIdx === si);
                          const isStartSub = isStarting && si === 0;
                          return (
                            <span key={si} className={`text-xs px-2 py-1 rounded-full border ${
                              isStartSub ? 'bg-green-100 text-green-700 border-green-300' :
                              subBp ? 'bg-amber-100 text-amber-700 border-amber-300' :
                              'bg-zinc-50 text-zinc-500 border-zinc-200'
                            }`}>
                              {sub.name}{subBp ? `·第${subBp.ch}章` : isStartSub ? '·起始' : ''}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {realm.breakthroughCondition && idx < realmProgress.realms.length - 1 && (
                      <div className="mt-1 ml-11 text-xs text-amber-600">
                        大境界突破条件：{realm.breakthroughCondition}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 章节境界映射 */}
            {Object.keys(realmProgress.chapterRealmMap).length > 0 && (
              <div className="bg-white p-4 rounded-xl border border-zinc-100">
                <h3 className="font-semibold text-zinc-800 mb-3">章节突破记录</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(realmProgress.chapterRealmMap)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([ch, val]) => {
                      const bp = val as any;
                      const realm = realmProgress.realms[bp.realmIndex ?? bp];
                      const subRealm = realm?.subRealms?.[bp.subRealmIndex ?? 0];
                      const fullName = subRealm ? `${realm?.name}·${subRealm.name}` : realm?.name || '未知';
                      const isBig = bp.subRealmIndex === 0 && bp.realmIndex > 0;
                      return (
                        <span key={ch} className={`text-xs px-2 py-1 rounded-full border ${
                          isBig ? 'bg-amber-100 text-amber-800 border-amber-300 font-medium' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          第{ch}章 → {fullName}{isBig ? ' ★大境界' : ''}
                        </span>
                      );
                    })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

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
              disabled={isGenerating || !characters || characters.length === 0 || isComplete}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-700 bg-zinc-100 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              生成单章
            </button>
            <button
              onClick={handleGenerateTOC}
              disabled={isGenerating || !characters || characters.length === 0 || isComplete}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              {isComplete ? '目录已全部生成' : `批量生成 (${nextStart}-${nextEnd}章)`}
            </button>
          </div>
        </div>

        {(!toc || toc.length === 0) ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-zinc-100 border-dashed">
            <List className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
            <p className="text-zinc-500">暂无目录大纲，请确保已生成人物后点击生成。</p>
          </div>
        ) : (
          <div className="space-y-3">
            {toc.map((item, idx) => (
              <div key={item.chapterNumber} className="bg-white p-5 rounded-2xl shadow-sm border border-zinc-100 flex gap-4 group">
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
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-zinc-100 flex flex-col">
          <div className="p-4 border-b border-zinc-100 flex justify-between items-center bg-white shrink-0">
            <h3 className="font-semibold text-lg text-zinc-900">
              {shortStoryInfo.title || '未命名短篇'}
            </h3>
            <div className="flex items-center gap-2">
              {/* 下拉菜单式按钮组 */}
              <div className="relative group">
                <button
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-600 bg-zinc-100 rounded-lg hover:bg-zinc-200 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  重置
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {/* 下拉选项 */}
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-zinc-200 hidden group-hover:block z-10">
                  <button
                    onClick={() => {
                      if (confirm('确定要清空当前正文内容吗？保留标题和大纲。')) {
                        setShortStoryInfo({ ...shortStoryInfo, content: '', currentSegment: 0 });
                      }
                    }}
                    className="w-full px-4 py-2 text-sm text-left text-zinc-700 hover:bg-zinc-50 first:rounded-t-lg"
                  >
                    仅清空正文
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('确定要重置整个故事吗？这将清空标题、大纲、正文等所有内容，但保留API设置。')) {
                        setShortStoryInfo({
                          title: '',
                          themes: [SHORT_STORY_THEME_NAMES[0]],
                          targetWordCount: 10000,
                          outline: '',
                          content: '',
                          segments: [],
                          currentSegment: 0,
                          isOutlineGenerated: false
                        });
                        setShortStoryTitleOptions([]);
                      }
                    }}
                    className="w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50 last:rounded-b-lg border-t border-zinc-100"
                  >
                    重置所有故事信息
                  </button>
                </div>
              </div>
              {!shortStoryInfo.content ? (
                // 第一次生成
                <button
                  onClick={() => handleGenerateShortStoryContent(false)}
                  disabled={isGenerating || !shortStoryInfo.outline}
                  className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-70"
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  开始生成（第一批）
                </button>
              ) : (
                // 已有内容，显示两个按钮
                <div className="flex gap-2">
                  <button
                    onClick={() => handleGenerateShortStoryContent(false)}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-indigo-700 bg-indigo-100 rounded-lg hover:bg-indigo-200 transition-colors disabled:opacity-70"
                  >
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Feather className="w-4 h-4" />}
                    继续写（不结尾）
                  </button>
                  <button
                    onClick={() => handleGenerateShortStoryContent(true)}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-70"
                  >
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    生成结局（收尾）
                  </button>
                </div>
              )}
            </div>
          </div>
          {/* 分段进度显示 */}
          {shortStoryInfo.content && (
            <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
              <span className="text-sm text-indigo-700">
                已生成 {shortStoryInfo.currentSegment || 1} 段 | 总字数 {shortStoryInfo.content.length} 字
              </span>
              <span className="text-xs text-indigo-500">
                每段限制上下文1500字，避免超过4096token限制
              </span>
            </div>
          )}
          
          <div className="p-6 bg-zinc-50/50">
            <textarea
              value={shortStoryInfo.content}
              onChange={(e) => setShortStoryInfo({ ...shortStoryInfo, content: e.target.value })}
              placeholder={isGenerating ? "AI 正在奋笔疾书，请稍候..." : "点击右上角「开始生成」，或者在此处手动输入内容..."}
              className="w-full min-h-[600px] p-6 bg-white border border-zinc-200 rounded-xl shadow-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-zinc-800 leading-relaxed"
            />
          </div>
        </div>
      );
    }

    return (
      <div className="flex gap-6 bg-white rounded-2xl shadow-sm border border-zinc-100 p-6 min-h-[600px]">
        <div className="w-64 border-r border-zinc-100 pr-6 flex flex-col">
          <div className="pb-4 border-b border-zinc-100 flex justify-between items-center">
            <h3 className="font-medium text-zinc-900">章节列表</h3>
          </div>
          <div className="flex-1 pt-4 space-y-1 overflow-y-auto max-h-[800px]">
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
                    onClick={isBatchGenerating ? handleStopBatchGenerate : handleBatchGenerateChapters}
                    disabled={isGenerating && !isBatchGenerating}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-70"
                  >
                    <Play className="w-4 h-4" />
                    {isBatchGenerating ? '暂停批量' : '批量生成下20章'}
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
              <div className="p-8">
                {chapters[activeChapterNum] ? (
                  <textarea
                    value={chapters[activeChapterNum]}
                    onChange={(e) => setChapters(prev => ({ ...prev, [activeChapterNum]: e.target.value }))}
                    className="w-full min-h-[560px] max-w-3xl mx-auto block p-6 bg-zinc-50 border border-zinc-200 rounded-xl resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-zinc-800 leading-relaxed"
                  />
                ) : (
                  <div className="min-h-[400px] flex flex-col items-center justify-center text-zinc-400">
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
            <div className="min-h-[400px] flex flex-col items-center justify-center text-zinc-400">
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

  // 备份所有数据到JSON文件
  const handleExportData = () => {
    const data = {
      _version: 1,
      _exportTime: new Date().toISOString(),
      mode,
      settings,
      bookInfo,
      characters,
      realmProgress,
      toc,
      chapters,
      novelMemory,
      activeChapterNum,
      shortStoryInfo,
      shortStoryTitleOptions,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `小说数据备份_${bookInfo.title || '未命名'}_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 从JSON文件恢复数据
  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data._version) {
          alert('无效的备份文件！');
          return;
        }
        if (!confirm(`确认恢复备份？\n备份时间：${data._exportTime || '未知'}\n书名：${data.bookInfo?.title || '未命名'}\n\n此操作将覆盖当前所有数据！`)) return;
        if (data.mode !== undefined) setMode(data.mode);
        if (data.settings) setSettings(data.settings);
        if (data.bookInfo) setBookInfo(data.bookInfo);
        if (data.characters) setCharacters(data.characters);
        if (data.realmProgress) setRealmProgress(data.realmProgress);
        if (data.toc) setToc(data.toc);
        if (data.chapters) setChapters(data.chapters);
        if (data.novelMemory) setNovelMemory(data.novelMemory);
        if (data.activeChapterNum !== undefined) setActiveChapterNum(data.activeChapterNum);
        if (data.shortStoryInfo) setShortStoryInfo(data.shortStoryInfo);
        if (data.shortStoryTitleOptions) setShortStoryTitleOptions(data.shortStoryTitleOptions);
        alert('数据恢复成功！');
      } catch (err) {
        alert('恢复失败：文件格式错误');
      }
    };
    input.click();
  };

  const handleResetBookInfo = () => {
    if (confirm('确定要重置书籍信息吗？这将清空书籍设定、人物、目录和章节内容，但保留API设置。')) {
      // 重置长篇小说数据
      setBookInfo({
        title: '',
        themes: [MALE_THEME_NAMES[0]],
        lengthType: '100',
        targetChapterCount: 100,
        outline: '',
        worldbuilding: '',
        endingOutline: '',
        titleOptions: [],
        isTitleSelected: false,
        enableRealms: true
      });
      setCharacters([]);
      setRealmProgress({ realms: [], protagonistCurrentRealmIndex: 0, protagonistCurrentSubRealmIndex: 0, chapterRealmMap: {} });
      setToc([]);
      setChapters({});
      setNovelMemory(emptyNovelMemory);
      setActiveChapterNum(null);
      
      // 重置短篇故事数据
      setShortStoryInfo({
        title: '',
        themes: [SHORT_STORY_THEME_NAMES[0]],
        targetWordCount: 10000,
        outline: '',
        content: '',
        segments: [],
        currentSegment: 0,
        isOutlineGenerated: false
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
        ...(bookInfo.enableRealms !== false ? [{ id: 'realms', icon: Globe, label: '境界体系' }] : []),
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
      <div className="w-20 md:w-64 bg-white border-r border-zinc-200 flex flex-col overflow-y-auto">
        <div className="h-16 flex items-center justify-center md:justify-start md:px-6 border-b border-zinc-100 shrink-0">
          <BookOpen className="w-6 h-6 text-indigo-600 shrink-0" />
          <h1 className="font-semibold text-lg tracking-tight ml-3 hidden md:block">AI 小说家</h1>
        </div>
        
        <div className="p-4 border-b border-zinc-100 shrink-0">
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

        <nav className="py-4 px-3 space-y-1">
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
          
          <div className="relative">
            <button
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              disabled={(mode === 'novel' && Object.keys(chapters).length === 0) || (mode === 'shortStory' && !shortStoryInfo.content)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span className="hidden md:block">导出全书</span>
            </button>
            
            {showDownloadMenu && (
              <div className="absolute bottom-full mb-2 left-0 w-full bg-white border border-zinc-200 rounded-lg shadow-lg overflow-hidden z-50">
                <button
                  onClick={() => {
                    handleDownload('txt');
                    setShowDownloadMenu(false);
                  }}
                  className="w-full px-4 py-2 text-sm text-left hover:bg-zinc-50 transition-colors"
                >
                  导出为 TXT
                </button>
                <button
                  onClick={() => {
                    handleDownload('docx');
                    setShowDownloadMenu(false);
                  }}
                  className="w-full px-4 py-2 text-sm text-left hover:bg-zinc-50 transition-colors border-t border-zinc-100"
                >
                  导出为 Word (.docx)
                </button>
              </div>
            )}
          </div>
          
          <button
            onClick={handleExportData}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="hidden md:block">备份数据</span>
          </button>
          
          <button
            onClick={handleImportData}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-green-600 bg-green-50 border border-green-100 rounded-lg hover:bg-green-100 transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden md:block">恢复数据</span>
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
            {activeTab === 'realms' && '境界体系'}
            {activeTab === 'toc' && '分章目录大纲'}
            {activeTab === 'chapters' && (mode === 'novel' ? '小说正文生成' : '故事正文生成')}
            {activeTab === 'examples' && '小说范文参考'}
          </h2>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {activeTab === 'settings' && renderSettings()}
          {activeTab === 'book' && renderBookInfo()}
          {activeTab === 'characters' && renderCharacters()}
          {activeTab === 'realms' && renderRealms()}
          {activeTab === 'toc' && renderTOC()}
          {activeTab === 'chapters' && renderChapters()}
          {activeTab === 'examples' && renderExamples()}
        </main>
      </div>
    </div>
  );
}
