"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAutional } from "@autional/react";
import {
  AUTIONAL_APP_ID,
  AUTIONAL_AUTHORIZE_URL,
  AUTIONAL_CALLBACK_PATH,
} from "@/lib/autional";

export default function LoginPage() {
  const { isAuthenticated, isLoading, loginWithOAuth } = useAutional();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/");
    }
  }, [isLoading, isAuthenticated, router]);

  const handleLogin = useCallback(async () => {
    setError(null);
    setPending(true);
    try {
      const callbackUrl = new URLSearchParams(window.location.search).get("callbackUrl");
      if (callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//")) {
        sessionStorage.setItem("autional_callback_url", callbackUrl);
      }
      await loginWithOAuth({
        clientId: AUTIONAL_APP_ID,
        redirectUri: `${window.location.origin}${AUTIONAL_CALLBACK_PATH}`,
        authorizeUrl: AUTIONAL_AUTHORIZE_URL,
      });
    } catch (e) {
      setPending(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [loginWithOAuth]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-stone-900">
      <div className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-8 shadow-sm dark:border-stone-700 dark:bg-stone-800">
        <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
          Novel · 多用户演示
        </h1>
        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
          使用 Autional 账号登录。你的文档按账号隔离保存。
        </p>
        {error ? (
          <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleLogin}
          disabled={pending || isLoading}
          className="mt-6 w-full rounded-md bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-300"
        >
          {pending ? "跳转中…" : "使用 Autional 登录"}
        </button>
      </div>
    </div>
  );
}
