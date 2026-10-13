# AI Onboarding Notes — 实验 2（novel）问题日志

> 实验：用 Autional AI onboarding skill（https://www.autional.com/ai）给 [novel](https://github.com/steven-tey/novel) 接入 Autional 登录 + 多用户改造 + Vercel 平台存储。
> 本文件记录接入全过程中的问题、根因与处置。按发生顺序，分类归档。参照实验 1（takenote）口径。

## 状态（进行中）

| 步骤                       | 状态 | 备注 |
| -------------------------- | ---- | ---- |
| 选型 + fork                | ✅   | `autional-demo/novel`（上游 `steven-tey/novel`，Apache-2.0），2026-10-13 |
| 本地骨架（submodule）      | ✅   | `D:\ws\ai-onboarding-lab\novel`（turborepo：`apps/web` + `packages/headless`） |
| 本地跑通（pnpm dev/build） | ✅   | 2026-10-13：修 6 项基线问题（D1-D6）后 **dev 浏览器实测 + `turbo build` 4/4 双绿**（tweet 卡/KaTeX/编辑器全渲染，console 0 error） |
| SSO 接入（skill）          | ✅¹  | 区域固定 `.cn`；Phase 3-5 全通：真机 SSO E2E（授权→同意→回调→会话→登出）；新缺陷 C7-C11 记录在案；Phase 6-8（测试/文档/退出门）进行中 |
| 多用户改造（登录门 + 隔离）| ✅   | **单人多文档**（用户拍板，覆盖单文档建议）；浏览器 E2E（新建/切换/刷新持久化/登出/换号隔离）+ 探针 19/19 |
| Vercel 存储接入（Blob）    | 🔄   | 代码完成：文档 = private blob + uid 命名空间（本地 fs 回退）；待 Vercel 账号 + `BLOB_READ_WRITE_TOKEN` |
| Vercel 部署                | ⏳   | |
| 安全审查（IDOR/XSS/JWT）   | 🔄   | 认证边界/IDOR/AI 端点探针 19/19 PASS；XSS/令牌面静查记录；见 §安全专项 |

> ¹ SSO 接入的"真机 E2E"指本地 `localhost:3000` 经真实 `auth.autional.cn`/`api.autional.cn` 全链登录；Vercel 线上部署后需复验（回调重定向 URI 需在 client 登记追加）。

## 环境与基线

| 项           | 值 |
| ------------ | -- |
| Fork         | https://github.com/autional-demo/novel |
| 本地         | `D:\ws\ai-onboarding-lab\novel` |
| 上游基线     | `fa95098e`（main，2026-10-13 fetch） |
| 技术栈       | Next.js 15.1.4 · React 18 · Tiptap（WYSIWYG）· AI SDK v3（`@ai-sdk/openai`）· Tailwind · pnpm workspace + turbo |
| 存储依赖     | `@vercel/blob` **^2.8.1**（基线 ^0.22.1，D7 升版）· `@vercel/kv` ^1.0.1（已有，KV 已停服，本实验未用——文档存储直接落 Blob） |
| 已知改造面   | 无认证共享文档（任何人可建/删）· 无用户模型 · AI 补全需 `OPENAI_API_KEY` |
| 本机         | Node v24.15.0（npm 11.12.1）· 网络：GitHub 经 v2rayN 代理（10808）/ SSH |

## 接入凭证（公开信息；密码不进本文件）

> 管理员密码 / 测试账号密码在 lab 单点台账 `D:\ws\ai-onboarding-lab\provision\novel-*.txt`（gitignored，永不入库）。

| 项 | 值 |
| --- | --- |
| 租户 | `novel-demo`（.cn，plan=free，试用 7 天 → 到期 **2026-10-20**） |
| tenantId | `01M4THMP5B6QHRFPHJH6JCRJQ7` |
| appId（OAuth public client） | `client-cXHzN7C6YN7Y`（PKCE；redirect `http://localhost:3000/oauth/callback`；cors `http://localhost:3000`） |
| issuer / apiUrl | `https://api.autional.cn` ／ `https://api.autional.cn/bff` |
| 管理员 | `novel+admin@autional.net` |
| 测试账号 | `novel-alice` / `novel-bob` / `novel-carol`（邮箱 `novel+<name>@autional.net`；hash 传输 `sha256hex(pwd\|tenantId)`） |

## 问题日志

（接入开始后按序追加；分类同实验 1：A 环境 / B skill 部署 / C 租户账号 / D 依赖配置运行时 / S 安全专项）

### C 组（租户账号）——Phase 3（skill 开始）

| # | 现象 | 根因 | 证据 | 处置 |
| - | ---- | ---- | ---- | ---- |
| C1R | SDK `createTrialTenant()` 在 .cn 直连 **404**（exp1 C1 **复发**：npm 最新版仍未修） | `@autional/core` `src/auth-client.ts` 请求 `${baseUrl}/tenant/api/v1/public/tenants` —— 缺 `/bff` 前缀 + 缺 `tenant/` 一段；body 亦无 `invitation_code`（邀请码路径 SDK 不可达） | ① 线上探针：SDK 形态 404 ／ 真实形态 400（列必填 3 字段）② 今日 npm pack `@autional/core@0.3.2`（latest）源码 auth-client.ts:506 实证路径未变 | 原始 fetch 直调真实端点 `POST /bff/tenant/api/v1/tenant/public/tenants` → **201**（`provision/novel-trial-register.mjs`）。skill §3.1「SDK 提供则编程驱动」在"SDK 有但坏了"场景无分支——AI 照做的 100% 卡 404 |
| C2R | 公开试用注册**免邀请码**可用（与 exp1 的邀请码路径不同） | 10-10 产品修复后公开注册链可用；限流按 client_ip（30 天 ≤10） | 201 建租户成功；空体探针 400 报 3 必填（无 invitation_code）；takenote exp1 台账确认为邀请码路径 | 直接注册；**试用 7 天**（exp1 C2 语义再证）——到期 2026-10-20 需注意 |
| C3R | 管理面链全通（exp1 C5/C6 P0 **未复现**）：api 登录 200 / admin 平面（`x-entry-plane: admin`）登录 200 / check-role `super_admin`=true 且 `member`=true | 10-10 三仓修复（hash 注册 + RBAC bootstrap + initial_role）已上 prod 生效 | `provision/novel-admin-verify.mjs` **4/4 PASS**；3 测试账号注册 201 + alice hash 登录 200 | 无处置；修复效果再证（好消息） |
| C4R | （观察·非缺陷）admin 平面 token 调 user 受众路由（check-role）→ 403 `40000503` "not accessible from this entry plane" | 平面隔离设计：user 受众路由拒 admin 平面 token；与 host（auth./user. 均通）无关 | 同管理员换 **api 平面 token** 后 auth./user. 双 host 全 200 | 集成方注意：check-role 等 user 面调用须用 api 平面 token |

### C 组（续）——Phase 4-5（SDK 缺陷，接入实现阶段）

| # | 现象 | 根因 | 证据 | 处置 |
| - | ---- | ---- | ---- | ---- |
| C7 | **middleware 引 `@autional/next` 直接编译失败**：`Attempted import error: 'useRef'/'createContext'/'useState' is not exported from 'react'` | dist 为**单文件 bundle**（middleware + Provider + hooks 混装）且构建**丢失 `"use client"` 指令**（`@autional/react` 同病）；`middleware.ts` 属 react-server 图，import 即把客户端 hooks 拉进 RSC 条件编译 | build 报错原文；dist 头 120 字节 = `// src/middleware.ts`（无任何指令，正则实证 false） | 本地重写 `middleware.ts` 等价实现（cookie 存在性门，语义同 SDK 注释在案）。**SDK 需修**：包粒化（next/middleware 独立入口）或构建保留指令 |
| C8 | 服务端会话校验不可用：SDK 服务端校验器（`getServerSession`）的 `authUrl`/路径语义与 .cn 区 **`/bff` 前缀强制要求**对不上，按直觉拼路径即 404 | .cn 区全部业务面须走 `/bff`（探针实证：无前缀 404 / 有前缀 200）；SDK 对 baseUrl 是否含 `/bff` 无文档、无报错提示 | exp1 C6 复习 + `provision/novel-probe-me.mjs`（`/identity/...` 404 vs `/bff/identity/...` 200） | 自写 `lib/server-auth.ts` 直调 `/bff/identity/api/v1/auth/me`（逐请求权威校验、可感知吊销）。**SDK 需修**：`/bff` 语义文档化 + 误配时明确报错 |
| C9 | **cookie 契约只读不写**：`@autional/next` 的 middleware / `getServerSession` / Provider 均以 `autional_token` cookie 为会话载体（`readCookie`→`seedStorage`），但**登录后没有任何 SDK 代码会写入该 cookie** → 服务端门永远视为未登录（重定向环） | 三层拆裂：`core` TokenManager 仅写 localStorage（`cookieMode` 只关闭本地持久化，**不落 cookie**）；`react` 无 cookie 代码；`next` 只读 cookie。写入桥缺失 | dist 静态核查：`core`/`react` 中 `document.cookie` **0 处**；`next` 有 `readCookie`/`getTokenFromCookies`/`seedStorage`（单向 cookie→localStorage），写入模式检索 false | 应用层桥 `components/session-cookie-sync.tsx`（订阅 provider READY/USER_CHANGED/TOKEN_CHANGED → 写 cookie；LOGGED_OUT → 清）。**SDK 需修**：官方桥接或登录后自动落 cookie |
| C10 | OAuth `userinfo` 仅回 `{sub, client_id, scope}` —— 无 email/username，登录后头部展示名空白 | userinfo 端点极简设计；`sub` 是平台内部 ID（ULID），非可读名 | `provision/novel-probe-me.mjs`：userinfo 200 响应体实证 | 额外请求 `/bff/identity/api/v1/auth/me`（Bearer）取 `username/email` 作展示名。**SDK 建议**：`user` 对象自动补全或文档明示"userinfo 不携带资料" |
| C11 | （观察·集成注意）**IdP 会话独立保持**：应用内登出只清本地 token；再点登录**直接跳同意页**（沿用同账号）；换号须先访问 auth 平面 `/logout` 端点（实测 `https://auth.autional.cn/logout` → 回租户登录页） | 标准 OIDC 行为（IdP SSO 会话 ≠ RP 会话）；未见 RP-initiated logout（`end_session`）面 | 浏览器实测：同意页直出无凭据步 → `/logout` 后正常出现登录页可换号 | 文档化换号/登出语义；**产品建议**：OIDC `end_session` 端点 + 文档 |

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
| D7 | `@vercel/blob` ^0.22.3 **无 `allowOverwrite`**（覆盖保存文档所必需），亦无 private access | 上游 novel 钉的旧版 API 面窄 | 0.22.3 `index.d.ts` 实证（仅 addRandomSuffix）；2.8.1 有 `allowOverwrite`/`ifMatch`/`access:'private'` | `pnpm add @vercel/blob@^2.8.1 --filter novel-next-app` 升版（`--filter web` 会报 "No projects matched"——包名是 **novel-next-app**）；private access 落地文档存储（S4） |
| D8 | （工具链）后台 Bash 任务跑 `pnpm dev` **中途"完成"（exit 0）死亡**：登录回调 token 交换瞬间 `ERR_CONNECTION_REFUSED`（服务端已死） | Windows 下后台任务生命周期与 node 子进程脱钩（D6 同族） | dev 任务日志断流转；浏览器侧回调请求失败 | PowerShell `Start-Process -WindowStyle Hidden` 分离启动 + 日志落 `D:\tmp\novel-dev.log`（本实验全程验证稳定） |

### 非阻断告警（留档）

| # | 告警 | 说明 | 处置 |
| - | ---- | ---- | ---- |
| W1 | **`next@15.1.4` 安全告警**：pnpm 装依赖时警告 "This version has a security vulnerability... CVE-2025-66478" | 上游 pinned 15.1.4；属**存量安全债**（可能牵动构建/运行时行为） | 记入安全专项待评（升版 vs 留档，集成期定） |
| W2 | Tiptap SSR 警告：`immediatelyRender` 应显式 false（hydration 风险提示） | SSR × Tiptap 已知提示 | 留档（上游行为） |
| W3 | Tiptap 扩展重名：`['image','codeBlock']` duplicate extension names | 扩展注册重复 | 留档（上游行为，暂不影响） |
| W4 | husky install deprecated / caniuse-lite 22 个月旧 | 工具链陈旧提示 | 留档 |

## 安全专项（用户点名）

> 改造引入的每个新面都要过：登录门（会话/JWT 服务端验证）· 文档所有权（IDOR）· 富文本渲染（XSS）· Blob 存储访问控制 · AI 端点滥用（无认证的 `/api/generate` 计费面）。

**探针证据锚点**：`provision/novel-probe-idor.mjs`（双账号登录 + 跨用户读写删 + 无/坏 token 边界，**19/19 PASS**，2026-10-13）。

| # | 面 | 风险 | 设计/检查 | 证据 | 结论 |
| - | -- | ---- | ---- | ---- | ---- |
| S1 | 登录门 | 未认证访问全部 API / 假 token | 逐请求 `Bearer` → `/bff/identity/api/v1/auth/me` **权威校验**（能感知吊销）；middleware cookie 门仅作 UX 跳转（真伪不靠 cookie 内容） | 探针：no-token / bad-token 对 `/api/docs`(GET/POST)、`/api/upload`、`/api/generate` 全 **401** | ✅ PASS |
| S2 | 文档所有权（IDOR） | 跨用户读/改/删/列举 | pathname = `docs/<uid>/<docId>.json`，**uid 恒取自 token**（绝不来自客户端）；外部 id 自然落回调用者命名空间 → 404；列表只含本 uid 前缀 | 探针：**双向** GET/PUT/DELETE 跨用户全 **404**；两账号列表不相交；交叉尝试后双方数据完好 | ✅ PASS |
| S3 | 富文本渲染（XSS） | 内容/标题注入 | 内容 = Tiptap **JSON**（非 HTML 存储）；标题经 React 文本节点渲染；改造面**未引入** `dangerouslySetInnerHTML`；`deriveTitle` 仅做文本抽取 | 静态核查（`app/page.tsx` / `lib/doc-store.ts`）；未做模糊测试 | ✅ 静查通过 |
| S4 | Blob 存储访问控制 | 文档 URL 公开可读 / 跨用户列举 | 文档 = **private** blob（URL 不匿名可取）；blob 前缀含 uid 命名空间；上传图片 = public（编辑器 `<img>` 渲染必需）但**已加登录门**；上传文件名来自客户端 header（仅登录用户可利用、落在 blob 域、无应用 cookie） | 代码级（`doc-store.ts` `access:'private'`）+ 401 探针 | ✅ PASS |
| S5 | AI 端点滥用 | 无认证计费面（`/api/generate`）| `verifyAccessToken` 置于计费逻辑之前（`/api/generate`、`/api/upload` 皆然） | 探针 401 PASS；本地无 `OPENAI_API_KEY`（生成功能待 Vercel 环境键） | ✅ PASS（门生效） |
| S6 | 令牌持久面 | XSS 可读取 token | SDK 设计 = JS 可读 cookie + localStorage（C9 桥、`readCookie` 使 **httpOnly 不可行**）；缓解：`SameSite=Lax`、https 下 `Secure`、服务端不信任 cookie 内容（只做存在性门 + Bearer 权威校验） | 代码级（`lib/session-cookie.ts`） | ⚠️ 接受（SDK 设计使然，记录在案） |

**运维注记**：租户 `novel-demo` 试用期至 **2026-10-20**，Vercel 部署前须确认续期或转正，否则线上登录全断。
