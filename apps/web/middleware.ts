import { autionalMiddleware } from "@autional/next/middleware";

// 2026-10-15 跟版：@autional/next 0.4.0 起 ./middleware 子路径零 react 引用且保留
// "use client"，C7/C3N 缺陷已修，本地等价实现（cookie 存在性门）弃用。

export const middleware = autionalMiddleware({
  protectedPaths: ["/"],
  loginPath: "/login",
  publicPaths: ["/oauth/callback", "/api/:path*"],
});
