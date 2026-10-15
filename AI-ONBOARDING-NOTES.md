# AI Onboarding Notes — 实验 2（novel）问题日志

> 实验：用 Autional AI onboarding skill（https://www.autional.com/ai）给 [novel](https://github.com/steven-tey/novel) 接入 Autional 登录 + 多用户改造 + Vercel 平台存储。
> 本文件记录接入全过程中的问题、根因与处置。按发生顺序，分类归档。参照实验 1（takenote）口径。

## 状态（进行中）

| 步骤                       | 状态 | 备注 |
| -------------------------- | ---- | ---- |
| 选型 + fork                | ✅   | `autional-demo/novel`（上游 `steven-tey/novel`，Apache-2.0），2026-10-13 |
| 本地骨架（submodule）      | ✅   | `D:\ws\ai-onboarding-lab\novel`（turborepo：`apps/web` + `packages/headless`） |
| 本地跑通（pnpm dev/build） | ✅   | 2026-10-13：修 6 项基线问题（D1-D6）后 **dev 浏览器实测 + `turbo build` 4/4 双绿**（tweet 卡/KaTeX/编辑器全渲染，console 0 error） |
| SSO 接入（skill）          | ✅¹  | 区域固定 `.cn`；**Phase 3-8 全通**：真机 SSO E2E（授权→同意→回调→会话→登出）；新缺陷 C7-C11 记录在案；Phase 6 单测 8/8 + Phase 7 文档（`AUTIONAL_SETUP.md`/`AUTIONAL_CHANGES.md`）+ Phase 8 退出门（lint/typecheck/build 全绿） |
| 多用户改造（登录门 + 隔离）| ✅   | **单人多文档**（用户拍板，覆盖单文档建议）；浏览器 E2E（新建/切换/刷新持久化/登出/换号隔离）+ 探针 19/19 |
| Vercel 存储接入（Blob）    | ✅   | 双店落地：文档 = private 店（uid 命名空间 + 本地 fs 回退）；图片 = public 店独立令牌（`IMAGES_BLOB_READ_WRITE_TOKEN`）；Vercel env 全量配置齐（含 AI 中转三键） |
| Vercel 部署                | ✅¹  | 生产 READY：**https://novel-demo-nine.vercel.app**（iad1，node 24.x）；部署摩擦 E1-E4 记录在案 |
| 生产 SSO 复验              | ✅   | **5/5 全绿**（2026-10-13 晚）：SSO 登录（干净态全链）/ 文档 CRUD / **隔离校验**（bob 跨用户 404 + 对照组 200）/ **AI generate**（200 + 87 token 流式 + 落稿）/ **图片上传**（Blob 渲染 + 保存）。E5 修复线已双区上线；E6 僵尸会话链于本轮根因闭环 |
| 安全审查（IDOR/XSS/JWT）   | ✅   | 探针 19/19 PASS + 生产隔离校验带对照复验；XSS/令牌面静查记录；见 §安全专项 |

> ¹ SSO 接入的"真机 E2E"指本地 `localhost:3000` 经真实 `auth.autional.cn`/`api.autional.cn` 全链登录；Vercel 线上部署 + **生产 SSO E2E 已完成**（状态见上表）。

## 环境与基线

| 项           | 值 |
| ------------ | -- |
| Fork         | https://github.com/autional-demo/novel |
| 本地         | `D:\ws\ai-onboarding-lab\novel` |
| 线上（生产） | **https://novel-demo-nine.vercel.app**（Vercel 项目 `novel-demo`；deployment `dpl_HfE8kgHbRpAVAKu5qY7icubZKmYM`） |
| 上游基线     | `fa95098e`（main，2026-10-13 fetch） |
| 技术栈       | Next.js 15.1.4 → **15.5.27**（E3 安全升版）· React 18 · Tiptap（WYSIWYG）· AI SDK v3（`@ai-sdk/openai`，走中转 `OPENAI_BASE_URL`）· Tailwind · pnpm workspace + turbo |
| 存储依赖     | `@vercel/blob` **^2.8.1**（基线 ^0.22.1，D7 升版）· `@vercel/kv` ^1.0.1（已有，KV 已停服，本实验未用——文档存储直接落 Blob） |
| 已知改造面   | 无认证共享文档（任何人可建/删）· 无用户模型 · AI 补全需 `OPENAI_API_KEY` |
| 本机         | Node v24.15.0（npm 11.12.1）· 网络：GitHub 经 v2rayN 代理（10808）/ SSH |

## 接入凭证（公开信息；密码不进本文件）

> 管理员密码 / 测试账号密码在 lab 单点台账 `D:\ws\ai-onboarding-lab\provision\novel-*.txt`（gitignored，永不入库）。

| 项 | 值 |
| --- | --- |
| 租户 | `novel-demo`（.cn，plan=free；原试用 7 天 → **2026-10-14 已转永久**：`trial=false` + `trial_expires_at=NULL`） |
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
| C7 | **middleware 引 `@autional/next` 直接编译失败**：`Attempted import error: 'useRef'/'createContext'/'useState' is not exported from 'react'` | dist 为**单文件 bundle**（middleware + Provider + hooks 混装）且构建**丢失 `"use client"` 指令**（`@autional/react` 同病）；`middleware.ts` 属 react-server 图，import 即把客户端 hooks 拉进 RSC 条件编译 | build 报错原文；dist 头 120 字节 = `// src/middleware.ts`（无任何指令，正则实证 false） | 本地重写 `middleware.ts` 等价实现（cookie 存在性门，语义同 SDK 注释在案）。**SDK 需修**：包粒化（next/middleware 独立入口）或构建保留指令。**已修（2026-10-15 跟版）**：next 0.4.0 子路径导出粒化（`./middleware` 零 react 引用且保留 `"use client"`）→ 本仓 middleware 换回官方 `autionalMiddleware`；换回后经 C6N 探针全链实证（未登录跳 `/login?callbackUrl=%2F` 与持 cookie 放行两分支） |
| C8 | 服务端会话校验不可用：SDK 服务端校验器（`getServerSession`）的 `authUrl`/路径语义与 .cn 区 **`/bff` 前缀强制要求**对不上，按直觉拼路径即 404 | .cn 区全部业务面须走 `/bff`（探针实证：无前缀 404 / 有前缀 200）；SDK 对 baseUrl 是否含 `/bff` 无文档、无报错提示 | exp1 C6 复习 + `provision/novel-probe-me.mjs`（`/identity/...` 404 vs `/bff/identity/...` 200） | 自写 `lib/server-auth.ts` 直调 `/bff/identity/api/v1/auth/me`（逐请求权威校验、可感知吊销）。**SDK 需修**：`/bff` 语义文档化 + 误配时明确报错 |
| C9 | **cookie 契约只读不写**：`@autional/next` 的 middleware / `getServerSession` / Provider 均以 `autional_token` cookie 为会话载体（`readCookie`→`seedStorage`），但**登录后没有任何 SDK 代码会写入该 cookie** → 服务端门永远视为未登录（重定向环） | 三层拆裂：`core` TokenManager 仅写 localStorage（`cookieMode` 只关闭本地持久化，**不落 cookie**）；`react` 无 cookie 代码；`next` 只读 cookie。写入桥缺失 | dist 静态核查：`core`/`react` 中 `document.cookie` **0 处**；`next` 有 `readCookie`/`getTokenFromCookies`/`seedStorage`（单向 cookie→localStorage），写入模式检索 false | 应用层桥 `components/session-cookie-sync.tsx`（订阅 provider READY/USER_CHANGED/TOKEN_CHANGED → 写 cookie；LOGGED_OUT → 清）。**SDK 需修**：官方桥接或登录后自动落 cookie。**保留判定（2026-10-15，任务 #36 收口）**：next 0.4.0 dist 实证 cookie 仍只读不写（唯一 `document.cookie` 引用 = `readCookie`，无写路径）→ 桥**保留**，属契约补位而非兜底（middleware cookie 门与 provider seed 都依赖它）；同期拆除的仅为 C12/C13 时代应用侧兜底（`/login` 自动重放，C12 行在案） |
| C10 | OAuth `userinfo` 仅回 `{sub, client_id, scope}` —— 无 email/username，登录后头部展示名空白 | userinfo 端点极简设计；`sub` 是平台内部 ID（ULID），非可读名 | `provision/novel-probe-me.mjs`：userinfo 200 响应体实证 | 额外请求 `/bff/identity/api/v1/auth/me`（Bearer）取 `username/email` 作展示名。**SDK 建议**：`user` 对象自动补全或文档明示"userinfo 不携带资料" |
| C11 | （观察·集成注意）**IdP 会话独立保持**：应用内登出只清本地 token；再点登录**直接跳同意页**（沿用同账号）；换号须先访问 auth 平面 `/logout` 端点（实测 `https://auth.autional.cn/logout` → 回租户登录页） | 标准 OIDC 行为（IdP SSO 会话 ≠ RP 会话）；未见 RP-initiated logout（`end_session`）面 | 浏览器实测：同意页直出无凭据步 → `/logout` 后正常出现登录页可换号 | 文档化换号/登出语义；**产品建议**：OIDC `end_session` 端点 + 文档 |
| C12 | **闲置 5 分钟 + 刷新页面 = 会话必失效弹登录**（access token TTL=300s 实测；bob 12:18 登录 → 12:24 刷新被弹回 /login） | `core.initialize()` 启动恢复**无过期分支**：`getAccessToken()` 对过期 token 返 `null` → 用户水合整段被跳过，**且不尝试 refresh**（刷新令牌完全闲置）；此路径连 `onTokenChange` 监听都不注册 | dist 源码实证（`initialize()`：`const accessToken = getAccessToken(); if (accessToken) {...}` 无 else；`getAccessToken()` 内含 `isTokenExpired→null`）；浏览器实测复现（token `exp-iat=300s`） | 应用侧缓解：`/login` 检测会话 cookie 残迹 → **自动重走 SSO**（IdP 会话在则免点击秒回，实测全链通过）。**SDK 需修**：`initialize()` 过期分支应调用 `refreshToken()`。**已修（2026-10-15 跟版）**：core 0.3.5 `initialize()` 过期恢复（无 access 且有 refresh → 先 `refreshSession()` 再水合，失败降级；会话桥恒注册）；应用侧缓解已拆（`/login` 自动重放删除）。C6N 闭环探针 `provision/novel-c6n-refresh-e2e.mjs` **12/12**（本地真机：合成过期 access → reload → 静默刷新 expIn≈296s、无弹跳、无 SSO 重放）；**生产复测（2026-10-15，fork `642e24d3` 推送 → 部署 `bhw4xbq3y`）同探针 12/12**（`APP=https://novel-demo-nine.vercel.app`） |
| C13 | **每次带 cookie 的页面加载，localStorage 会话被覆写**：`{accessToken, refreshToken:null, user:null, expiresAt:null}` —— refresh 令牌被抹掉（即便修复 C12 也无令牌可刷） | `@autional/next` `AutionalProvider` 首次渲染**无条件** `seedStorage(token)`（cookie → localStorage 全量覆写）；播种模板除 accessToken 外全 null，覆盖 core 持久化的富会话（refreshToken/user/expiresAt/authMode） | dist 源码实证（`if (token) { seedStorage(token); }` 无现存会话检查）；浏览器 localStorage 实测恰为播种形状（bob: `hasRefresh=false, user=null, expiresAt=null`） | 应用侧缓解同 C12（自动 SSO 免 token 刷新链）；**SDK 需修**：仅无现存会话时播种，或合并保留 refresh/user 字段。**已修（2026-10-15 跟版）**：next 0.4.0 `seedStorage` 降覆写（现存富会话 refresh/user/tenantId/expiresAt 任一在 → 跳过播种）；探针 T2.3（refresh/user 保留）实证。同版 `@autional/next` 子路径粒化（`./middleware` 零 react 引用）→ 本仓 middleware 换回官方实现，**C7 一并关闭** |

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

### E 组（Vercel 部署 + 平台回调域白名单）——Phase 9+（部署阶段）

| # | 现象 | 根因 | 证据 | 处置 |
| - | ---- | ---- | ---- | ---- |
| E1 | CLI 从 `apps/web` 目录部署失败：`The specified Root Directory 'apps/web' does not exist` | monorepo 双因：CLI 上传的是**当前目录内容**，项目 `rootDirectory=apps/web` 会被二次拼接；且 `apps/web` 依赖 `workspace:^` 本地包（`novel`/`tsconfig`），单目录上传缺 workspace 根 | 部署错误原文；Vercel 项目设置 rootDirectory=apps/web | 在 **monorepo 根** link + deploy（上传全仓，rootDirectory 生效剥离 apps/web）。集成注记：turborepo 单应用部署的标准姿势 |
| E2 | 第二次失败：`No Output Directory named 'public' found` | CLI 新建的项目 `framework=null`（未识别 Next.js），回退静态站假设 | 项目 JSON framework 字段实证 | `PATCH /v9/projects/novel-demo {"framework":"nextjs"}` → 复部署通过 |
| E3 | 部署被安全**硬阻断**：`Vulnerable version of Next.js detected, please update immediately`（响应体含 CVE-2025-66478） | 上游 pinned `next@15.1.4` 命中 Vercel 平台级漏洞版本阻断（与 W1 同源） | 部署日志原文（平台拒绝构建） | 升 `next@15.5.27`（15.x 回移版；peerDeps 与 react 18.2 兼容实证）→ 本地 lint/typecheck/build 全绿 → 复部署 READY。**W1 就此关闭** |
| E4 | （网络，环境非代码）本机 `*.vercel.app` **DNS 污染**：解析到 Facebook IPv6/`128.242.250.155` → curl 直连超时、探针不可达 | 本机跨境黑洞（与 D5 同族，域不同） | curl direct 超时 vs `-x http://127.0.0.1:10809` 200；系统代理已启用（浏览器自动走） | 探针/验收一律走本机代理；**产品侧零改动**（用户所在网络决定） |
| E5 | **生产回调注册被拒**：PUT client 追加 `https://novel-demo-nine.vercel.app/oauth/callback` → `400 61050001 redirect_uri domain not allowed` | oauth-service 的 redirect URI 校验 = **平台全局域白名单**（`buildAllowedRedirectDomains`：平台根域族 + 门户覆写 + localhost，构造期解析），**非租户配置**。租户管理台**已有** redirect_uri 自助编辑 UI（admin-console oauth-clients 页）→ 租户隔离 API（handler_client.go 隔离完备）→ 被此门拒绝 | PUT 响应体原文；白名单源码 `service.go:1586-1634`（构建）/`:235`/`:337`（Create/Update 调用点）；精确匹配门已有（`hasRedirectURI`，authorize 时） | **判定：平台产品缺口（多租户自助缺失），非集成方问题**。设计结论见下。**已修复上线（2026-10-13 晚）**：修复 = 客户端 redirect_uris 自持（ADR-01 废除注册侧域白名单）+ 语法护栏 + **跨租户硬门**（`cross_tenant_gate.go`：会话租户≠客户端租户且非平台家族域 → 拦截）+ 平台家族域豁免。`service-oauth@60d193a` → dev 自动部署 + prod 提升（双区同物，oauth 二进制 sha256 `49e417ab…`）；novel 生产回调注册 **PATCH 200**（`provision/novel-update-client.mjs`）→ 生产 E2E 5/5 |
| E6 | **僵尸会话链**（生产 E2E 撞见）：UI 显示"已登录"（用户名在）但 userinfo / auth/me / docs **全 401**（掩码 "token validation failed"），页面空白停滞 | 五连锁：① 先前登出路径触发**全舰队会话撤销**（写 `jwt:bls:{sessionID}`，TTL≈26min）② auth 域 localStorage（`autional-auth-v1`）登出后**残留** ③ 应用静默重登走 IdP refresh **200（未拒绝已撤销会话）** ④ authorize 正常发码 ⑤ token 交换铸出**绑定已撤销 session_id** 的 AT → 所有面 `IsBlacklisted` 命中 → 401 | Redis 实锤（dev 机）：`jwt:bls:01M4TTR4Z3DMZW25C96TNNQR48`=**1**（TTL 1552）；对照 `jwt:bl:{sha256(AT)}`=0（排除单 token 撤销）；JWT 解出 `sid` 与登出会话一致；8 连发确定性 401；dev monolith 日志 request_id `01M4TVD9B3P79FGHZ3HC01VWNM` | **平台侧三问（修复方向）**：① refresh 应拒绝已撤销会话（撤销需同步 refresh 路径）② authorize/铸证不应绑定已撤销 session ③ "token validation failed" 掩码吞掉真实原因，诊断性受损（建议 reason code / 审计日志富化）。**恢复**：清两域 cookies+storage 重登即愈 |
| E7 | （契约观察，低危）token 响应 `expires_in:1800`，AT 的 JWT 实测 `exp-iat=300s` | 两值来源不同：`expires_in` 报 `token.access_token_expiry`（30m）；JWT 实际用 `jwt.short_access_expiry=5m`（**有意设计**，jwt.go access 类型优先 short；`access_expiry:30m` 兜底） | `configs/service/oauth-service.yaml:43-50`（`short_access_expiry: "5m"` 注释"access token 实际使用值"）；捕获 token 解码 `exp-iat=300`；`handler.go:170-175`（expires_in 取值路径） | 集成注记：**以 JWT exp 为准**，勿按 expires_in 缓存 token；平台可考虑对齐两值（低优先） |
| E8 | （管理面观察，低危）OAuth client 管理 GET 响应**不含 `cors_origins`**（写入成功但读回缺失） | `toOAuthClientItem` DTO 未映射 cors_origins + `omitempty`；非写入失败（`service.UpdateClient` 已存） | `provision/novel-update-client.mjs` 验证输出（GET 缺字段；PUT→GET `redirect_uris` 在案）；10-12 会话实证 | 已按"只断言 redirect_uris"绕过；**平台侧**：管理 DTO 补齐（低优先） |
| E9 | **登出不终结 SSO 会话 → 用户无法切换账号**（用户实测）：novel 点「退出登录」→ 再点登录 → 免密免弹窗**静默回原用户**（alice）；无痕窗口才换得掉 | 三缺口连锁：① novel 登出 = SDK `logout()`（`sdk/packages/core/src/auth-client.ts:462-477`）只清本域 token；注释明说 SSO 会话需 RP-Initiated Logout"由应用自行发起"——novel 未发起 ② auth 域会话残留 → authorize 正常发码 ③ consent 已存在（`oauth_consents` 表实锤：alice 2026-10-13 23:01:02Z 一条）→ 同意页 `oauth/authorize/page.tsx:216-233` 自动提交（设计内，业界惯例）→ 直达应用 | consent 记录：云 dev PG `autional_oauth.oauth_consents`（novel client 2 条：alice `01M4THRS…` + 另一账号 `01M4THRW…`）；代码锚点：`page.tsx:216-233`（自动同意）/ `auth-client.ts:462-477`（登出范围）；OIDC discovery 宣传 `end_session_endpoint=https://api.autional.cn/oauth/api/v1/oauth/logout` 但 auth 域 `/oauth/logout` **404**（实测）；门户侧机制 = auth 域 `/?logout=1` 入口路由（`@autional/shared` `useLogout`/`buildLogoutUrl` + `EntryRouter.tsx:88-115`，唯一登出实现 AuthService.logout + 有界 loading）——novel 未接 | **行业标准（OIDC RP-Initiated Logout 1.0）**：RP 本地先登出 → 整页跳 OP `end_session_endpoint`，带 `id_token_hint`（Recommended，含 `sid` 供 OP 校验待终止会话，防 DoS）+ `post_logout_redirect_uri`（须预注册）+ `state`；OP **SHOULD 询问用户是否也登出 OP**（确认面）。平台现状全部缺失：无确认面、无 id_token_hint、无 post_logout_redirect_uri 注册面、`/oauth/logout` 404。**修复方向（平台侧）**：auth 面实现标准 end_session_endpoint（确认面 + sid 校验 + post_logout_redirect_uri 注册）；**portal 现行 `/?logout=1` 可视为平台自定义兼容形态**。**novel 侧修法（应用半）**：登出 = 清本域（SDK `logout()` + 显式清 session cookie）→ 整页跳 auth 域 `/?logout=1&redirect=<novel 首页>` → 从根上消除"登出后静默重登"（E6 僵尸链的最简复现路径随之关闭）；动画/过渡：跨域整页跳转无法做转场，本地侧给过渡反馈（按钮 loading/淡出）即可。**勘误（2026-10-13 迟测）**：本行原「auth 域 `/oauth/logout` 404」措辞有误——404 系探测**前端域**路径所致；标准端点实测在 **API 域** `api.autional.cn/oauth/api/v1/oauth/logout`，路由**存在且活着**（GET 401 = 需会话/参数）。E9 修复线按「API 域端点活 + 确认面缺失 + 注册面缺失」口径推进（细节见 butler 产物 `01/02-20261013-233321`）。**已修复（2026-10-14，E9 修复线全链）**：平台侧 = oauth 实现标准 end_session_endpoint（API 域；id_token_hint RSA 验签 + 无会话浏览器流 302 确认/完成页 + `post_logout_redirect_uris` **独立注册面**〔migration 000012，精确命中才 302〕+ state 透传）；SDK `@autional/core@0.3.3` = `idToken` 落 localStorage + `logout()` 升级（discovery 标准端点整页跳转，identity 模式向后兼容）；novel 侧 = 登出改「先清本域（SDK `logout()` → LOGGED_OUT 同步清 cookie）→ 整页跳标准端点（`id_token_hint` + `client_id` + `post_logout_redirect_uri=<origin>/` + `state`）」+ 按钮 loading 态（`apps/web/lib/autional.ts` `buildStandardLogoutUrl()`）；novel client `post_logout_redirect_uris` 已注册（`https://novel-demo-nine.vercel.app/` + `http://localhost:3000/`；`provision/novel-update-client.mjs`）。dev 后端已上线；生产换号 E2E 随 novel 推送验收 |

| E10 | **Git 自动部署首测失败**：接通 Vercel Git 自动部署后首推 → `main` 生产部署与 `feature/autional` 预览部署双双构建 ERROR | Git 构建在**全仓图**上执行 `turbo run build`；`novel-next-app#typecheck` 声明 `dependsOn: ["^topo"]`（`topo` 无任何 package 定义 = 空依赖）→ typecheck 与 `novel#build`（tsup 产出 `packages/headless/dist`）**并发竞态**：tsc 在 dist 落盘前解析 `novel` 类型 → `TS2305: Module '"novel"' has no exported member 'JSONContent'`（×3）→ turbo 退出 2。此前 CLI 部署未暴露 = Vercel 对 CLI 上传的 turbo 构建做单包裁剪（构建日志 `Packages in scope: novel-next-app`），全图竞态从未被执行 | 构建日志原文：`Error: Command "turbo run build" exited with 2` + tsc TS2305 三行（app/page.tsx / advanced-editor.tsx）+ 与 tsup 并发输出交错；本地对照：dist 在场 `typecheck exit 0`；`"topo"` 全仓唯一引用 = turbo.json 自身（grep 实证） | 修复 = `turbo.json` `typecheck.dependsOn: ["^topo"] → ["^build"]`（顺序边 `novel#build → app#typecheck → app#build`；`--dry=json` 图实证）→ 推送主分支复测 |
| E11 | **登出兜底丢租户上下文**（用户实测，10-14）：novel 点退出 → 被推到 `brand.autional.cn/` **裸选租户页**（无 `/<slug>/`、无回程）；用户要求「退出应还在 novel；做不到也应保留 /<slug>/」 | 登出链两级丢失：① hint 失效（idToken 30m 过期；或 refresh 后本地 idToken 被清空——`handler_token.go` refresh 响应无 id_token + `auth-client.ts:990` 见 null 即清）→ 应用省略 hint → 服务端无会话浏览器支 302 **确认页** ② 确认页 XHR 无会话 → 支 4 **401** → 兜底 `FALLBACK_LANDING='/'` ③ EntryRouter（无回程、无会话、无候选 slug）→ `funnel-logout` 落 **brand 裸根**。会话活着时（hint 有效或 XHR 200 带 location）本已有「回 app」理想路径——丢 slug 只发生在会话已死的兜底 | 代码链四锚点：`auth-pages .../logout-confirm/page.tsx`（兜底常量 + 注释自述「品牌裸根」）/ `service-oauth handler.go:831-850`（支 3/支 4）、`:906-926`（location 仅注册白名单出）/ `EntryRouter.tsx:101-115`（funnel-logout 落 brand 裸根）/ `apps/web/lib/autional.ts:46`（hint 过期即省略） | **已修复（10-14，auth `420ea3a` 推 main + Vercel 双区部署）**：确认页兜底链改为**保租户反查**——404/401/无 location/网络失败时用 `client_id` 走**与同意页冷启动（TASK-07）同一套** `fetchTenantSlugByClientId` → 落同源 `auth.autional.cn/<slug>/login`；反查失败才回 `'/'`（开放重定向闭合不变：仍不采信 URL 上的 `post_logout_redirect_uri`）。验证：单测 8/8（含反查失败/重复点击）+ 全量 481/481 + **生产浏览器 E2E**（确认页点确认 → 实测落回 `novel-demo-nine.vercel.app/login?callbackUrl=…`，state/rt 全链透传）；bundle 元数据 `VITE_VERCEL_GIT_COMMIT_SHA=420ea3ac` 实证部署。**效应**：会话在 = 回 app；会话死 = 至少落 `/<slug>/login`（重新登录本租户），不再落 brand 裸根 |

**E5 设计结论（多租户视角）**：

- **问题形状**：任何租户把应用部署到自有域（vercel.app / 自有域名）→ 都需 **平台侧**逐个加白名单 → "每来一个租户加 1 条"，不可规模化。租户自助 UI 已存在，堵点在服务端一个全平台常量。
- **行业对照**：GitHub OAuth app 回调 URL 完全自助（无平台域白名单；authorize 时对已注册 URI 精确匹配即安全边界）；Google 为"应用域 + 所有权验证"。平台现行做法两者皆非（平台代管）。
- **安全语义（关键）**：该白名单实际承担"防跨租户钓鱼"的**粗保护**——攻击者租户拿不到平台域，故无法接收他人授权码。放开前必须补硬门：**授权时校验"会话租户 = 客户端租户"**（平台门户客户端跨租户是**设计内**用法，需按客户端标记区分；现状 `handler_authorize.go` GET/POST 与 token 步均无此比对，consent 页仅展示客户端租户品牌不强制）。
- **推荐修复方向**：**客户端 redirect_uris 自持（GitHub 模型）+ 语法护栏**（https-only〔localhost 例外〕· 禁通配符 · 禁裸 IP · 禁 userinfo/fragment · 数量/长度上限）+ 跨租户硬门。改动面 = service-oauth 单仓（控制台 UI 与租户隔离已就绪）；dev 云验证 → prod 提升。

### 非阻断告警（留档）

| # | 告警 | 说明 | 处置 |
| - | ---- | ---- | ---- |
| W1 | **`next@15.1.4` 安全告警**：pnpm 装依赖时警告 "This version has a security vulnerability... CVE-2025-66478" | 上游 pinned 15.1.4；属**存量安全债**（可能牵动构建/运行时行为） | **已处置（E3）**：升 `15.5.27`（Vercel 硬阻断迫升）；本地三闸全绿 + 生产 READY 实证；**关闭** |
| W2 | Tiptap SSR 警告：`immediatelyRender` 应显式 false（hydration 风险提示） | SSR × Tiptap 已知提示 | 留档（上游行为） |
| W3 | Tiptap 扩展重名：`['image','codeBlock']` duplicate extension names | 扩展注册重复 | 留档（上游行为，暂不影响） |
| W4 | husky install deprecated / caniuse-lite 22 个月旧 | 工具链陈旧提示 | 留档 |
| W5 | （上游基线）biome lint 1 warning：`components/tailwind/selectors/math-selector.tsx:16` 未用参数 `evt` | 上游代码；警告级不阻断（lint 退出码 0） | 留档（不改上游文件） |
| W6 | （工具链）运行中 dev 被 `next build` 覆盖 `.next/` → dev 报 `Cannot find module './187.js'`（500） | dev/prod 共用 `.next` 产物目录 | 杀 dev → 重启 dev 自愈（本次未删 `.next` 即恢复）；规范：build 验证前先停 dev 或接受一重启 |
| W7 | （平台观测，非实验缺陷）mycloudos 生产机 gateway `/ready`=503（组件健康明细指向 captcha3d-service 不健康） | 生产机自身观测 | 2026-10-13 排查副产品；dev/.cn 面 `/ready` 全 200 对照 | 转平台运维跟踪（与本实验无关，记录防丢） |

## 安全专项（用户点名）

> 改造引入的每个新面都要过：登录门（会话/JWT 服务端验证）· 文档所有权（IDOR）· 富文本渲染（XSS）· Blob 存储访问控制 · AI 端点滥用（无认证的 `/api/generate` 计费面）。

**探针证据锚点**：`provision/novel-probe-idor.mjs`（双账号登录 + 跨用户读写删 + 无/坏 token 边界，**19/19 PASS**，2026-10-13）。

| # | 面 | 风险 | 设计/检查 | 证据 | 结论 |
| - | -- | ---- | ---- | ---- | ---- |
| S1 | 登录门 | 未认证访问全部 API / 假 token | 逐请求 `Bearer` → `/bff/identity/api/v1/auth/me` **权威校验**（能感知吊销）；middleware cookie 门仅作 UX 跳转（真伪不靠 cookie 内容） | 探针：no-token / bad-token 对 `/api/docs`(GET/POST)、`/api/upload`、`/api/generate` 全 **401** | ✅ PASS |
| S2 | 文档所有权（IDOR） | 跨用户读/改/删/列举 | pathname = `docs/<uid>/<docId>.json`，**uid 恒取自 token**（绝不来自客户端）；外部 id 自然落回调用者命名空间 → 404；列表只含本 uid 前缀 | 探针：**双向** GET/PUT/DELETE 跨用户全 **404**；两账号列表不相交；交叉尝试后双方数据完好 | ✅ PASS |
| S3 | 富文本渲染（XSS） | 内容/标题注入 | 内容 = Tiptap **JSON**（非 HTML 存储）；标题经 React 文本节点渲染；改造面**未引入** `dangerouslySetInnerHTML`；`deriveTitle` 仅做文本抽取 | 静态核查（`app/page.tsx` / `lib/doc-store.ts`）；未做模糊测试 | ✅ 静查通过 |
| S4 | Blob 存储访问控制 | 文档 URL 公开可读 / 跨用户列举 | 文档 = **private** blob（URL 不匿名可取）；blob 前缀含 uid 命名空间；上传图片 = public（编辑器 `<img>` 渲染必需）但**已加登录门**；上传文件名来自客户端 header（仅登录用户可利用、落在 blob 域、无应用 cookie） | 代码级（`doc-store.ts` `access:'private'`）+ 401 探针 | ✅ PASS |
| S5 | AI 端点滥用 | 无认证计费面（`/api/generate`）| `verifyAccessToken` 置于计费逻辑之前（`/api/generate`、`/api/upload` 皆然） | 探针 401 PASS；**生产已验证全链**：`/api/generate` 200 + 流式 87 token + UI 采纳落稿（密钥走 Vercel env 中转三键） | ✅ PASS（门生效） |
| S6 | 令牌持久面 | XSS 可读取 token | SDK 设计 = JS 可读 cookie + localStorage（C9 桥、`readCookie` 使 **httpOnly 不可行**）；缓解：`SameSite=Lax`、https 下 `Secure`、服务端不信任 cookie 内容（只做存在性门 + Bearer 权威校验） | 代码级（`lib/session-cookie.ts`） | ⚠️ 接受（SDK 设计使然，记录在案） |

**运维注记**：租户 `novel-demo` 原试用期至 2026-10-20；**已于 2026-10-14 转永久**（`trial=false` + `trial_expires_at=NULL`，与平台「试用转正式」端点同态），演示链不再受到期影响。附审计：试用到期在代码中无执行链（无 scheduler job、无读侧拦截、门户无展示），本次为数据语义校正。
