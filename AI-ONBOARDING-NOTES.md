# AI Onboarding Notes — 实验 2（novel）问题日志

> 实验：用 Autional AI onboarding skill（https://www.autional.com/ai）给 [novel](https://github.com/steven-tey/novel) 接入 Autional 登录 + 多用户改造 + Vercel 平台存储。
> 本文件记录接入全过程中的问题、根因与处置。按发生顺序，分类归档。参照实验 1（takenote）口径。

## 状态（进行中）

| 步骤                       | 状态 | 备注 |
| -------------------------- | ---- | ---- |
| 选型 + fork                | ✅   | `autional-demo/novel`（上游 `steven-tey/novel`，Apache-2.0），2026-10-13 |
| 本地骨架（submodule）      | ✅   | `D:\ws\ai-onboarding-lab\novel`（turborepo：`apps/web` + `packages/headless`） |
| 本地跑通（pnpm dev/build） | ✅   | 2026-10-13：修 6 项基线问题（D1-D6）后 **dev 浏览器实测 + `turbo build` 4/4 双绿**（tweet 卡/KaTeX/编辑器全渲染，console 0 error） |
| SSO 接入（skill）          | ⏳   | 区域固定 `.cn` |
| 多用户改造（登录门 + 隔离）| ⏳   | 现状：无认证共享文档 |
| Vercel 存储接入（Blob）    | ⏳   | `@vercel/blob` 已在依赖中 |
| Vercel 部署                | ⏳   | |
| 安全审查（IDOR/XSS/JWT）   | ⏳   | 用户点名要求 |

## 环境与基线

| 项           | 值 |
| ------------ | -- |
| Fork         | https://github.com/autional-demo/novel |
| 本地         | `D:\ws\ai-onboarding-lab\novel` |
| 上游基线     | `fa95098e`（main，2026-10-13 fetch） |
| 技术栈       | Next.js 15.1.4 · React 18 · Tiptap（WYSIWYG）· AI SDK v3（`@ai-sdk/openai`）· Tailwind · pnpm workspace + turbo |
| 存储依赖     | `@vercel/blob` ^0.22.1（已有）· `@vercel/kv` ^1.0.1（已有，**注意 KV 已停服**——待实验核实） |
| 已知改造面   | 无认证共享文档（任何人可建/删）· 无用户模型 · AI 补全需 `OPENAI_API_KEY` |
| 本机         | Node v24.15.0（npm 11.12.1）· 网络：GitHub 经 v2rayN 代理（10808）/ SSH |

## 问题日志

（接入开始后按序追加；分类同实验 1：A 环境 / B skill 部署 / C 租户账号 / D 依赖配置运行时 / S 安全专项）

### D 组（依赖/配置/运行时）——基线阶段（skill 开始前）

| # | 现象 | 根因 | 证据 | 处置 |
| - | ---- | ---- | ---- | ---- |
| D1 | `pnpm install` 直接拒绝：`ERR_PNPM_BAD_PM_VERSION`（要求 9.5.0，实际 12.5.1） | 项目 `packageManager: pnpm@9.5.0`，但本机 pnpm 是 **corepack 垫片**（`/c/Program Files/nodejs/pnpm`），corepack 用 Last-Known-Good 12.5.1 顶掉项目引脚，且"pnpm 在 corepack 下不自行切换版本" | 首次 install 报错原文（含 corepack 0.34.6 提示） | `corepack prepare pnpm@9.5.0 --activate` → 复跑成功（693 包，42.8s） |
| D1b | （工具教训）首次 install 失败但**误判成功**：`pnpm install 2>&1 \| tail -40` 管道吞掉退出码（`$?` 是 tail 的） | bash 管道语义 | — | 后续命令一律裸跑或 `; echo EXIT:$?` |
| D2 | dev server 500：`Cannot find module 'postcss-import'`（react-tweet CSS 触发） | **上游未声明依赖**：`apps/web/postcss.config.js` 引用 `postcss-import`，但无 package.json 声明（仅 tailwindcss 传递依赖）；Next `loadPlugin()` 用 `require.resolve(name, {paths:[apps/web]})` → pnpm 严格布局不可见 | `require.resolve('postcss-import', {paths:[apps/web]})` = MODULE_NOT_FOUND；tailwindcss/autoprefixer OK 对照 | `apps/web` devDependencies 加 `postcss-import@15.1.0`（与传递版同版） |
| D3 | 修复 D2 后 500 换错：`Can't resolve 'katex/dist/katex.min.css'`（app/layout.tsx:3） | **上游未声明依赖 ×2**：`katex` 只在 `packages/headless` 声明，apps/web 直接 import 其 CSS | layout.tsx:3；`packages/headless/package.json:50` 有 katex | `apps/web` dependencies 加 `katex@^0.16.20`（同版对齐）；另写扫描脚本 `.temp/scan-web-deps.js` 全量核对 → 修后 0 未声明（仅此 2 项） |
| D4 | 浏览器打开首页：**Unhandled Runtime Error `TypeError: entities is not iterable`**（react-tweet `EmbeddedTweet`），dev error overlay 盖满页面（curl 200 掩盖不了） | 双因叠加：① demo 默认内容含 tweet 节点（lib/content.ts:145）→ `<Tweet>` 的 `useTweet` **从浏览器直连** `https://react-tweet.vercel.app/api/tweet/<id>`（库硬编码 host）② 该 API 现对无实体推文返回 `"entities":{}`（空对象），**react-tweet@3.2.1** `enrichTweet` 对对象做迭代 → 崩 | 浏览器 console 栈（utils.js enrichTweet/addEntities）；curl 实测代理 200 且 `"entities":{}`；**源码对比 3.3.1**：改读 `entities.hashtags/user_mentions/...` 命名属性 + `addEntities` 加 `!entities?.length` 守卫 | `packages/headless` 升 `react-tweet@^3.3.1` → 复验：tweet 卡正常渲染，console 0 error |
| D5 | （网络，环境非代码）`react-tweet.vercel.app` **直连超时**，经代理 `socks5h://127.0.0.1:10808` 200 | 本机跨境黑洞（与 github.com:443 同族） | curl direct HTTP:000 (timeout 15s) vs proxy HTTP:200 | 浏览器腿依赖系统代理（v2rayN）；产品部署后由用户所在网络决定 |
| D6 | （工具链）停止 dev（TaskStop）后 **Next 子进程存活成孤儿**占住 3000 → 新实例静默落 3001 | Windows 下杀 wrapper 不杀进程树 | netstat 双绑 PID 实证；新实例日志 "Port 3000 is in use, trying 3001" | 每次重启前 `netstat -ano + taskkill`（按 PID 核实 node 再杀）；与 takenote 实验工具链坑同族 |

### 非阻断告警（留档）

| # | 告警 | 说明 | 处置 |
| - | ---- | ---- | ---- |
| W1 | **`next@15.1.4` 安全告警**：pnpm 装依赖时警告 "This version has a security vulnerability... CVE-2025-66478" | 上游 pinned 15.1.4；属**存量安全债**（可能牵动构建/运行时行为） | 记入安全专项待评（升版 vs 留档，集成期定） |
| W2 | Tiptap SSR 警告：`immediatelyRender` 应显式 false（hydration 风险提示） | SSR × Tiptap 已知提示 | 留档（上游行为） |
| W3 | Tiptap 扩展重名：`['image','codeBlock']` duplicate extension names | 扩展注册重复 | 留档（上游行为，暂不影响） |
| W4 | husky install deprecated / caniuse-lite 22 个月旧 | 工具链陈旧提示 | 留档 |

## 安全专项（用户点名）

> 改造引入的每个新面都要过：登录门（会话/JWT 服务端验证）· 文档所有权（IDOR）· 富文本渲染（XSS）· Blob 存储访问控制 · AI 端点滥用（无认证的 `/api/generate` 计费面）。

| # | 面 | 风险 | 检查 | 结论 |
| - | -- | ---- | ---- | ---- |
| — | —  | （待接入开始） | | |
