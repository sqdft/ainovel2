# 小羊老师的小说生成器

一个基于 AI 的智能小说创作工具，支持长篇小说和短篇故事的自动生成。

## ✨ 功能特性

- 📚 **长篇小说生成**：支持 100-300 章的长篇小说创作
- 📝 **短篇故事生成**：支持 7k-12k 字的短篇故事创作
- 🎭 **智能人物设定**：自动生成人物关系和角色设定
- 📖 **目录大纲生成**：批量生成章节目录和剧情摘要
- 🤖 **多 AI 模型支持**：支持 Google Gemini、DeepSeek、智谱清言、Kimi、OpenAI 等
- 💾 **一键导出**：支持将生成的内容导出为 TXT 文件

## 🚀 快速开始

### 前置要求

- Node.js (推荐 v18 或更高版本)
- npm 或 yarn

### 本地运行

1. 克隆项目
```bash
git clone <your-repo-url>
cd <project-folder>
```

2. 安装依赖
```bash
npm install
```

3. 配置 API Key
   - 复制 `.env.example` 为 `.env.local`
   - 在应用的设置页面配置你的 API Key

4. 启动开发服务器
```bash
npm run dev
```

5. 在浏览器中打开 `http://localhost:3000`

## 📦 构建部署

### 构建生产版本
```bash
npm run build
```

### 部署到 Cloudflare Pages

1. 推送代码到 GitHub
2. 在 Cloudflare Dashboard 中创建新项目
3. 连接 GitHub 仓库
4. 配置构建设置：
   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Build output directory: `dist`
5. 添加环境变量（如需要）

## 🎯 使用说明

### 长篇小说模式

1. 在设置页面配置 AI 供应商和 API Key
2. 选择小说主题和篇幅
3. 点击"AI 一键生成设定"生成书籍信息
4. 生成人物关系
5. 批量生成目录大纲
6. 逐章或批量生成章节内容

### 短篇故事模式

1. 选择故事主题
2. 使用 AI 构思标题或手动输入
3. 生成故事大纲
4. 点击"开始生成"创作故事内容
5. 可多次点击"继续生成"完成长篇内容

## 🛠️ 技术栈

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Google Generative AI SDK
- Lucide React Icons

## 📝 可用脚本

- `npm run dev` - 启动开发服务器
- `npm run build` - 构建生产版本
- `npm run preview` - 预览生产构建
- `npm run lint` - 类型检查

## 🔑 支持的 AI 供应商

- Google Gemini
- DeepSeek (深度求索)
- 智谱清言 (Zhipu)
- Kimi (月之暗面)
- OpenAI
- 自定义 OpenAI 兼容接口

## 📄 许可证

MIT

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
