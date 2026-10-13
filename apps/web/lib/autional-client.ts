"use client";

import type { Autional } from "@autional/core";

// Provider 单例引用：供非 hooks 上下文（编辑器 uploadFn、AI 流式请求）取 access token。
let client: Autional | null = null;

export function setAutionalClient(instance: Autional): void {
  client = instance;
}

export async function getClientAccessToken(): Promise<string | null> {
  try {
    return (await client?.getAccessToken()) ?? null;
  } catch {
    return null;
  }
}
