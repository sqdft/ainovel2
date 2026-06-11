# AI小说生成器 - 技术框架总结

## 项目概述

**项目名称**: 小羊老师的小说生成器 (Teacher Xiaoyang's Novel Generator)

**项目描述**: 一个基于人工智能的强大网络小说生成工具，专为创作者设计。无论是百万字的长篇巨制，还是几万字的爆款短篇，都能通过本工具轻松生成高质量的大纲、角色设定和正文内容。

---

## 技术栈

### 前端框架
| 技术 | 版本 | 用途 |
|------|------|------|
| **React** | 19.0.0 | 核心UI框架 |
| **TypeScript** | ~5.8.2 | 类型安全的JavaScript超集 |
| **Vite** | 6.2.0 | 现代化前端构建工具 |

### 样式与UI
| 技术 | 版本 | 用途 |
|------|------|------|
| **Tailwind CSS** | 4.1.14 | 实用优先的CSS框架 |
| **@tailwindcss/vite** | 4.1.14 | Tailwind Vite插件 |
| **Lucide React** | 0.546.0 | 现代化图标库 |
| **Motion** | 12.23.24 | React动画库 |

### AI集成
| 技术 | 版本 | 用途 |
|------|------|------|
| **@google/genai** | 1.29.0 | Google Gemini AI SDK |

### 工具库
| 技术 | 版本 | 用途 |
|------|------|------|
| **docx** | 9.6.1 | Word文档生成 |
| **file-saver** | 2.0.5 | 文件下载 |
| **dotenv** | 17.2.3 | 环境变量管理 |
| **better-sqlite3** | 12.4.1 | SQLite数据库 |
| **express** | 4.21.2 | Node.js Web框架 |

### 开发工具
| 技术 | 版本 | 用途 |
|------|------|------|
| **@vitejs/plugin-react** | 5.0.4 | React Vite插件 |
| **@types/node** | 22.14.0 | Node.js类型定义 |
| **@types/express** | 4.17.21 | Express类型定义 |
| **autoprefixer** | 10.4.21 | CSS前缀自动添加 |
| **tsx** | 4.21.0 | TypeScript执行器 |

---

## 项目结构

`
ai_novel2/
├── src/
│   ├── App.tsx              # 主应用组件（核心业务逻辑）
│   ├── main.tsx             # 应用入口
│   ├── index.css            # 全局样式
│   ├── types.ts             # TypeScript类型定义
│   ├── config/
│   │   ├── models.ts        # AI模型配置
│   │   ├── providers.ts     # AI提供商配置
│   │   └── themes.ts        # 小说主题配置
│   ├── lib/
│   │   └── storage.ts       # 存储工具（IndexedDB + localStorage）
│   └── services/
│       └── aiService.ts     # AI服务（API调用、JSON解析等）
├── public/
│   ├── 微信.png             # 微信支付二维码
│   └── 支付宝.png            # 支付宝支付二维码
├── index.html               # HTML入口
├── package.json             # 项目依赖配置
├── tsconfig.json            # TypeScript配置
├── vite.config.ts           # Vite构建配置
└── .env.example             # 环境变量示例
`

---

## 核心架构

### 1. 应用入口 (main.tsx)
- 使用React 18+的createRoot API
- 严格模式(StrictMode)启用
- 挂载到#root DOM元素

### 2. 主应用组件 (App.tsx)
**状态管理**:
- 使用React Hooks (useState, useEffect, useRef)
- 自定义Hook useDualStorage 实现双层存储

**功能模块**:
- 设置面板 (Settings)
- 书籍信息管理 (Book)
- 角色设定 (Characters)
- 境界体系 (Realms)
- 章节目录 (TOC)
- 章节内容 (Chapters)
- 示例展示 (Examples)

**创作模式**:
- 长篇小说模式 (novel)
- 短篇故事模式 (shortStory)

### 3. AI服务层 (aiService.ts)
**核心功能**:
- 多AI提供商支持（Gemini、OpenAI、DeepSeek等）
- JSON自动修复解析器
- 多密钥轮询机制
- 错误重试与降级

**API调用**:
- Google GenAI SDK (Gemini)
- OpenAI兼容API (其他提供商)

### 4. 存储层 (storage.ts)
**双层存储架构**:
- 主存储: IndexedDB (大容量)
- 备份存储: localStorage (快速回退)

**操作**:
- dualGet: 双层读取（优先IndexedDB，回退localStorage）
- dualSet: 双层写入（同时写入两个存储）

### 5. 配置层
**提供商配置** (providers.ts):
- Google Gemini
- DeepSeek (深度求索)
- 智谱清言 (Zhipu)
- Kimi (月之暗面)
- OpenAI
- 自定义 (OpenAI兼容)
- Kilo (自定义代理)
- 免费模型

**模型配置** (models.ts):
- 按提供商分组的模型列表
- 默认模型选择

**主题配置** (themes.ts):
- 男频主题
- 女频主题
- 短篇故事主题

---

## 类型系统

### 核心类型 (types.ts)
`	ypescript
Provider          // AI提供商类型
Settings          // 应用设置
BookInfo          // 书籍信息
StorySegment      // 故事片段
ShortStoryInfo    // 短篇故事信息
Character         // 角色
SubRealm          // 小境界
Realm             // 大境界
RealmProgress     // 境界进度
TOCItem           // 目录项
ModelInfo         // 模型信息
`

---

## 构建配置

### Vite配置 (vite.config.ts)
- **插件**: React、Tailwind CSS
- **路径别名**: @/* 映射到根目录
- **环境变量**: 注入GEMINI_API_KEY
- **HMR**: 支持热模块替换（可通过DISABLE_HMR禁用）

### TypeScript配置 (tsconfig.json)
- **目标**: ES2022
- **模块**: ESNext
- **JSX**: react-jsx
- **库**: ES2022, DOM, DOM.Iterable
- **路径映射**: @/* → ./*

---

## npm脚本

| 命令 | 描述 |
|------|------|
| 
pm run dev | 启动开发服务器 (端口3000, 监听0.0.0.0) |
| 
pm run build | 生产构建 |
| 
pm run preview | 预览生产构建 |
| 
pm run clean | 清理dist目录 |
| 
pm run lint | TypeScript类型检查 |

---

## AI提供商支持

| 提供商 | 基础URL | 默认模型 |
|--------|---------|----------|
| Google Gemini | - | gemini-3.1-pro-preview |
| DeepSeek | https://api.deepseek.com | deepseek-chat |
| 智谱清言 | https://open.bigmodel.cn/api/paas/v4 | glm-4 |
| Kimi | https://api.moonshot.cn/v1 | moonshot-v1-8k |
| OpenAI | https://api.openai.com/v1 | gpt-4o |
| 自定义 | https://api.openai.com/v1 | gpt-3.5-turbo |
| 免费模型 | https://api-ai.7e.ink/v1 | Qwen3.5 |

---

## 数据存储

### 浏览器端存储
- **IndexedDB**: 主存储，适合大容量数据
- **localStorage**: 备份存储，快速回退

### 数据库配置
`javascript
DB_NAME: 'ai_novel_db'
DB_VERSION: 1
STORE_NAME: 'app_data'
`

---

## 核心功能

### 长篇小说生成模式
1. 智能大纲与世界观生成
2. 角色设定系统
3. 章节目录批量生成
4. 正文连载生成

### 短篇故事生成模式
1. 网感标题生成
2. 短篇大纲构思
3. 正文一键生成

### 通用功能
1. 多主题选择（男频/女频/短篇）
2. 多模型支持
3. 一键导出 (.txt文本文件)

---

## 部署

- **开发**: 
pm run dev (localhost:3000)
- **生产**: 
pm run build → dist/ 目录
- **托管**: Cloudflare AI Studio / Cloud Run

---

## 技术亮点

1. **多AI提供商支持**: 支持8种AI提供商，灵活切换
2. **双层存储架构**: IndexedDB + localStorage，兼顾容量和性能
3. **JSON自动修复**: 智能修复AI返回的JSON格式错误
4. **多密钥轮询**: 支持多个API密钥轮询使用
5. **类型安全**: 全面使用TypeScript，编译时类型检查
6. **现代化构建**: Vite + React 19 + TypeScript 5.8
7. **响应式设计**: Tailwind CSS实现现代化UI

---

*文档生成时间: 2026-06-02*
