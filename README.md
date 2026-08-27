# Spark · 便签速记

搜索框即入口的轻量便签速记工具。多工作区数据隔离，支持账号登录与云端同步，灵感、待办、想法与日记随手捕捉。

## 功能特性

- **速记即所得**：搜索框直接输入，回车保存；分类随选，标签着色
- **多工作区**：工作区之间相互隔离，各自独立的分类与便签，可随时切换
- **完成态**：便签可标记为已完成（划线弱化显示），状态跨设备同步
- **控制面板**：统一管理账号、云同步、工作区与分类，支持行内重命名
- **首次使用引导**：仿 Windows OOBE 的分步引导（注册 → 建工作区 → 欢迎页）
- **云同步**：注册用户自动建立基线对账，本地变更防抖推送，拉取乱序守卫
- **暗色模式**：基于 `next-themes` 的明暗主题适配

## 技术栈

| 层 | 选型 |
| --- | --- |
| 框架 | Next.js 16（App Router）· React 19 · TypeScript |
| UI | Tailwind CSS 4 · shadcn/ui（radix-ui）· lucide-react |
| 数据 | Turso（libsql）· localStorage 本地持久化 |
| 鉴权 | jose（JWT） |

## 快速开始

### 1. 准备环境变量

在项目根目录创建 `.env.local`：

```bash
TURSO_DATABASE_URL=libsql://<your-db>.turso.io
TURSO_AUTH_TOKEN=<your-token>
```

数据库表结构会在首次请求时自动建好并迁移，无需手动执行 SQL。

### 2. 启动开发服务

```bash
npm install
npm run dev
```

打开 <http://localhost:3000>，注册一个账号即可开始使用。

### 3. 生产构建

```bash
npm run build
npm run start
```

## 项目结构

```
src/
├── app/
│   ├── api/auth/        # 注册 / 登录 / 登出 / 会话
│   ├── api/sync/        # 全量推送拉取（PUT/GET）
│   └── page.tsx         # 入口页面
├── components/
│   ├── spark/           # 业务组件（主界面、控制面板、引导等）
│   └── ui/              # shadcn/ui 基础组件
├── hooks/
│   └── use-cloud-sync.ts # 登录态与推拉同步的核心 hook
└── lib/
    ├── notes.ts         # 工作区/分类/便签的本地存储层
    ├── db.ts            # libsql 连接与建表迁移
    └── auth.ts          # JWT 会话签发与校验
```

## 同步机制概要

- 未登录时所有数据仅保存在浏览器 localStorage；登录后执行一次**基线对账**：本地有历史数据则以本地上传覆盖云端，全新环境则拉取云端初始化
- 之后的每次变更先落库、再经 1.2s 防抖推送到云端；切换工作区时「先推后拉」，并用请求序号丢弃乱序返回的旧响应
