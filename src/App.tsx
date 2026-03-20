import { useState, useEffect, useRef } from 'react';
import { BookOpen, Settings as SettingsIcon, Users, List, FileText, Download, Loader2, Wand2, Play, Feather, RefreshCw, Globe } from 'lucide-react';
import { Settings, BookInfo, Character, TOCItem, Provider, ShortStoryInfo } from './types';
import { generateBookInfo, generateCharacters, generateTOC, generateChapterContent, generateShortStoryContent, generateShortStoryTitles, generateShortStoryOutlineFromTitle } from './services/aiService';

type Tab = 'settings' | 'book' | 'characters' | 'toc' | 'chapters';
type Mode = 'novel' | 'shortStory';

const PROVIDERS: Record<Provider, { label: string, baseUrl: string, model: string }> = {
  gemini: { label: 'Google Gemini', baseUrl: '', model: 'gemini-3.1-pro-preview' },
  deepseek: { label: 'DeepSeek (深度求索)', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  zhipu: { label: '智谱清言 (Zhipu)', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4' },
  moonshot: { label: 'Kimi (月之暗面)', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
  custom: { label: '自定义 (OpenAI 兼容)', baseUrl: 'https://api.openai.com/v1', model: 'gpt-3.5-turbo' },
};

const NOVEL_THEMES = [
  '玄幻修仙', '重生复仇', '系统无敌', '科幻未来', '都市异能', '悬疑推理', '浪漫言情', '历史穿越', '游戏竞技', '恐怖惊悚', '武侠仙侠', '轻小说',
  '脑洞大开', '无敌爽文', '战神赘婿', '神豪暴富', '灵气复苏', '末世求生', '规则怪谈', '诡异流', '历史脑洞',
  '甜宠高甜', '虐恋情深', '穿书女配', '种田经商', '娱乐圈', '团宠萌宝', '宫斗宅斗', '快穿打脸', '真假千金', '霸道总裁'
];
const SHORT_STORY_THEMES = ['现代爱情', '婚姻伦理', '白月光', '都市生活', '青春校园', '悬疑惊悚', '现实百态', '童话寓言', '科幻脑洞', '奇幻冒险', '脑洞反转', '知乎风', '复仇虐渣', '甜文日常', '世情故事'];

const LENGTHS = [
  { label: '短篇 (100章)', value: '100', count: 100 },
  { label: '中短篇 (200章)', value: '200', count: 200 },
  { label: '中篇 (300章)', value: '300', count: 300 },
  { label: '中长篇 (400章)', value: '400', count: 400 },
  { label: '长篇 (500章)', value: '500', count: 500 },
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
    baseUrl: PROVIDERS['gemini'].baseUrl,
    model: PROVIDERS['gemini'].model,
    minWordCount: 2000,
  });

  // Novel State
  const [bookInfo, setBookInfo] = useLocalStorage<BookInfo>('ai_novel_bookInfo', {
    title: '',
    themes: [NOVEL_THEMES[0]],
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
    setSettings({
      ...settings,
      provider,
      baseUrl: PROVIDERS[provider].baseUrl,
      model: PROVIDERS[provider].model,
    });
  };

  const handleLengthChange = (lengthType: '100' | '200' | '300' | '400' | '500') => {
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

  const handleGenerateTOC = async () => {
    if (!bookInfo.title || characters.length === 0) {
      alert('请先生成书籍信息和人物关系！');
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

  const handleGenerateShortStoryContent = async () => {
    if (!shortStoryInfo.outline) {
      alert('请先填写故事核心脑洞/大纲！');
      return;
    }
    setIsGenerating(true);
    try {
      const newContent = await generateShortStoryContent(shortStoryInfo, shortStoryInfo.content, settings);
      setShortStoryInfo({ 
        ...shortStoryInfo, 
        content: shortStoryInfo.content ? shortStoryInfo.content + '\n\n' + newContent : newContent 
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

  // Common UI
  const ThemeSelector = ({ availableThemes, selectedThemes, onChange }: { availableThemes: string[], selectedThemes: string[], onChange: (themes: string[]) => void }) => {
    const [showAll, setShowAll] = useState(false);
    const displayThemes = showAll ? availableThemes : availableThemes.slice(0, 12);

    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-zinc-700">主题 (可多选，最多3个)</label>
          {availableThemes.length > 12 && (
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
                    if (selectedThemes.length > 1) onChange(selectedThemes.filter(t => t !== theme));
                  } else {
                    if (selectedThemes.length < 3) onChange([...selectedThemes, theme]);
                    else alert('最多只能选择3个主题');
                  }
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isSelected 
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' 
                    : 'bg-zinc-50 text-zinc-600 border border-zinc-200 hover:bg-zinc-100'
                }`}
              >
                {theme}
              </button>
            );
          })}
        </div>
      </div>
    );
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
              <label className="block text-sm font-medium text-zinc-700">API Key</label>
              <a 
                href="https://pan.quark.cn/s/aaebbb079733" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                获取免费 Token
              </a>
            </div>
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
              availableThemes={SHORT_STORY_THEMES} 
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
            availableThemes={NOVEL_THEMES} 
            selectedThemes={bookInfo.themes} 
            onChange={(themes) => setBookInfo({...bookInfo, themes})} 
          />
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">小说篇幅</label>
              <select 
                value={bookInfo.lengthType}
                onChange={(e) => handleLengthChange(e.target.value as '100' | '200' | '300' | '400' | '500')}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                {LENGTHS.map(l => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
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
        <button
          onClick={handleGenerateCharacters}
          disabled={isGenerating || !bookInfo.title}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
        >
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          AI 生成人物
        </button>
      </div>

      {characters.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-zinc-100 border-dashed">
          <Users className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
          <p className="text-zinc-500">暂无人物设定，请点击右上角生成或手动添加。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {characters.map((char, idx) => (
            <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-zinc-100">
              <div className="flex items-center justify-between mb-3">
                <input 
                  type="text" 
                  value={char.name}
                  onChange={(e) => {
                    const newChars = [...characters];
                    newChars[idx].name = e.target.value;
                    setCharacters(newChars);
                  }}
                  className="font-semibold text-lg text-zinc-900 bg-transparent border-none focus:ring-0 p-0"
                />
                <input 
                  type="text" 
                  value={char.role}
                  onChange={(e) => {
                    const newChars = [...characters];
                    newChars[idx].role = e.target.value;
                    setCharacters(newChars);
                  }}
                  className="text-xs font-medium px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full border-none focus:ring-0 text-right w-24"
                />
              </div>
              <textarea 
                value={char.description}
                onChange={(e) => {
                  const newChars = [...characters];
                  newChars[idx].description = e.target.value;
                  setCharacters(newChars);
                }}
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
          <button
            onClick={handleGenerateTOC}
            disabled={isGenerating || characters.length === 0 || isComplete}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {isComplete ? '目录已全部生成' : `AI 生成目录 (${nextStart}-${nextEnd}章)`}
          </button>
        </div>

        {toc.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-zinc-100 border-dashed">
            <List className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
            <p className="text-zinc-500">暂无目录大纲，请确保已生成人物后点击生成。</p>
          </div>
        ) : (
          <div className="space-y-3">
            {toc.map((item, idx) => (
              <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-zinc-100 flex gap-4">
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
                  />
                  <textarea 
                    value={item.summary}
                    onChange={(e) => {
                      const newToc = [...toc];
                      newToc[idx].summary = e.target.value;
                      setToc(newToc);
                    }}
                    className="w-full text-sm text-zinc-600 bg-zinc-50 border border-zinc-100 rounded-lg p-3 h-20 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex-shrink-0 flex items-center">
                  <button
                    onClick={() => {
                      setActiveChapterNum(item.chapterNumber);
                      setActiveTab('chapters');
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                  >
                    前往正文
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

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
                <button
                  key={item.chapterNumber}
                  onClick={() => setActiveChapterNum(item.chapterNumber)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between group ${
                    activeChapterNum === item.chapterNumber 
                      ? 'bg-indigo-50 text-indigo-700 font-medium' 
                      : 'text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  <span className="truncate flex items-center gap-2">
                    {generatingChapterNum === item.chapterNumber && <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />}
                    第{item.chapterNumber}章 {item.title}
                  </span>
                  {chapters[item.chapterNumber] && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                </button>
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
          <a
            href="https://www.xiaoyang.zone.id"
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
          
          <div className="flex items-center justify-end px-1 mt-1">
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
          </h2>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {activeTab === 'settings' && renderSettings()}
          {activeTab === 'book' && renderBookInfo()}
          {activeTab === 'characters' && renderCharacters()}
          {activeTab === 'toc' && renderTOC()}
          {activeTab === 'chapters' && renderChapters()}
        </main>
      </div>
    </div>
  );
}
