# 小羊老师的 AI 小说生成器

一个基于 React + Vite 构建的 AI 写作工具，面向小说与短篇故事创作场景。项目支持多家模型提供商接入，可在浏览器中完成题材设定、人物生成、目录规划、正文续写与整书导出。

## 项目功能

- 支持两种创作模式：长篇连载、短篇故事
- 支持生成小说基础设定，包括书名、大纲、世界观
- 支持自动生成人物设定与角色关系
- 支持分批生成长篇目录，并逐章创作正文
- 支持短篇故事标题、大纲与正文续写
- 支持导出 TXT 文本
- 支持将设置与创作进度保存到浏览器 `localStorage`

## 支持的模型接口

项目当前内置以下提供商配置：

- Google Gemini
- OpenAI
- DeepSeek
- Zhipu
- Moonshot
- 自定义 OpenAI 兼容接口

其中：

- `Gemini` 可通过环境变量 `GEMINI_API_KEY` 或界面输入的 API Key 调用
- 其他提供商通过 OpenAI 兼容的 `chat/completions` 接口调用，需要在界面中配置 `API Key`、`Base URL` 和模型名

## 技术栈

- React 19
- TypeScript
- Vite
- Tailwind CSS
- `@google/genai`
- `lucide-react`

## 本地运行

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 并按需填写：

```bash
cp .env.example .env.local
```

至少需要配置：

```env
GEMINI_API_KEY=你的_Gemini_API_Key
```

如果你不使用 Gemini，也可以在应用界面中直接填写其他提供商的 API Key、Base URL 和模型名称。

### 3. 启动开发环境

```bash
npm run dev
```

默认开发地址：

```text
http://localhost:3000
```

## 构建与预览

```bash
npm run build
npm run preview
```

## 使用流程建议

### 长篇小说模式

1. 在“设置”中选择模型提供商并填写密钥
2. 在“书籍信息”中选择题材、篇幅并生成基础设定
3. 在“人物关系”中生成或修改主要角色
4. 在“目录大纲”中分批生成章节目录
5. 在“章节内容”中逐章或批量生成正文
6. 完成后导出整书 TXT

### 短篇故事模式

1. 选择题材并生成标题
2. 基于标题生成故事大纲
3. 在正文页开始生成，并可持续续写
4. 完成后导出 TXT

## 项目结构

```text
src/
  App.tsx                 主界面与主要交互流程
  main.tsx                应用入口
  index.css               样式入口
  types.ts                类型定义
  services/
    aiService.ts          AI 调用与文本生成逻辑
index.html                页面入口
vite.config.ts            Vite 配置
```

## 注意事项

- 章节与故事内容会保存在当前浏览器本地缓存中，清空浏览器数据或点击应用内重置后会丢失
- 长篇模式下每章最少字数可在设置中调整
- 批量生成功能会按当前目录顺序继续写作，建议先确认目录和人物设定

## 后续可扩展方向

- 增加服务端存档与多设备同步
- 增加章节版本管理与回滚
- 增加更多导出格式，如 Markdown、EPUB、Word
- 增加提示词模板和风格预设
