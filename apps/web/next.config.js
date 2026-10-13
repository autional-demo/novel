/** @type {import('next').NextConfig} */
const nextConfig = {
  // 同源反代：浏览器侧 SDK 与 OAuth 换票全部经本域 /bff 转发到 Autional .cn 区，
  // 避免跨域并让 cookie 域保持同源（skill §5.2b 反代形态）。
  rewrites: async () => {
    return [
      {
        source: "/bff/:path*",
        destination: "https://api.autional.cn/bff/:path*",
      },
      {
        source: "/.well-known/:path*",
        destination: "https://api.autional.cn/.well-known/:path*",
      },
    ];
  },
  redirects: async () => {
    return [
      {
        source: "/github",
        destination: "https://github.com/steven-tey/novel",
        permanent: true,
      },
      {
        source: "/sdk",
        destination: "https://www.npmjs.com/package/novel",
        permanent: true,
      },
      {
        source: "/npm",
        destination: "https://www.npmjs.com/package/novel",
        permanent: true,
      },
      {
        source: "/svelte",
        destination: "https://github.com/tglide/novel-svelte",
        permanent: false,
      },
      {
        source: "/vue",
        destination: "https://github.com/naveennaidu/novel-vue",
        permanent: false,
      },
      {
        source: "/vscode",
        destination:
          "https://marketplace.visualstudio.com/items?itemName=bennykok.novel-vscode",
        permanent: false,
      },
      {
        source: "/feedback",
        destination: "https://github.com/steven-tey/novel/issues",
        permanent: true,
      },
      {
        source: "/deploy",
        destination: "https://vercel.com/templates/next.js/novel",
        permanent: true,
      },
    ];
  },
  productionBrowserSourceMaps: true,
};

module.exports = nextConfig;
