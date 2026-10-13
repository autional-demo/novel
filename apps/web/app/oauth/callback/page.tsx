"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAutionalContext } from "@autional/react";
import { setSessionCookie } from "@/lib/session-cookie";

export default function OAuthCallbackPage() {
  const { autional } = useAutionalContext();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const run = async () => {
      try {
        await autional.handleOAuthCallback(window.location.href);
        const token = await autional.getAccessToken();
        if (token) setSessionCookie(token);
        const callbackUrl = sessionStorage.getItem("autional_callback_url");
        sessionStorage.removeItem("autional_callback_url");
        router.replace(
          callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
            ? callbackUrl
            : "/",
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    };
    void run();
  }, [autional, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 dark:bg-stone-900">
      <div className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-8 text-center shadow-sm dark:border-stone-700 dark:bg-stone-800">
        {error ? (
          <>
            <h1 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
              登录未完成
            </h1>
            <p className="mt-2 break-all text-sm text-red-600 dark:text-red-400">{error}</p>
            <Link
              href="/login"
              className="mt-6 inline-block rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white dark:bg-stone-100 dark:text-stone-900"
            >
              返回登录
            </Link>
          </>
        ) : (
          <p className="text-sm text-stone-500 dark:text-stone-400">正在完成登录…</p>
        )}
      </div>
    </div>
  );
}
