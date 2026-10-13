"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "novel";
import { useAutional } from "@autional/react";
import TailwindAdvancedEditor from "@/components/tailwind/advanced-editor";
import { getClientAccessToken } from "@/lib/autional-client";
import { Button } from "@/components/tailwind/ui/button";
import Menu from "@/components/tailwind/ui/menu";
import { FilePlus, FileText, GithubIcon, Trash2 } from "lucide-react";

interface DocMeta {
  id: string;
  title: string;
  updatedAt: string;
}

interface DocPayload extends DocMeta {
  content: string;
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getClientAccessToken();
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  return fetch(path, { ...init, headers });
}

function parseContent(content: string): JSONContent {
  try {
    const json = JSON.parse(content);
    if (json && typeof json === "object" && typeof json.type === "string") {
      return json as JSONContent;
    }
  } catch {
    // fallthrough → 空文档
  }
  return EMPTY_DOC;
}

const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

export default function Page() {
  const { user, isLoading, isAuthenticated, logout } = useAutional();
  const router = useRouter();

  const [docs, setDocs] = useState<DocMeta[] | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [initialContent, setInitialContent] = useState<JSONContent | null>(null);
  const [saveStatus, setSaveStatus] = useState("已保存");
  const [displayName, setDisplayName] = useState("");

  const currentIdRef = useRef<string | null>(null);
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  const openDoc = useCallback(async (id: string) => {
    setSaveStatus("加载中…");
    try {
      const res = await apiFetch(`/api/docs/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { doc } = (await res.json()) as { doc: DocPayload };
      currentIdRef.current = doc.id;
      setCurrentId(doc.id);
      setInitialContent(parseContent(doc.content));
      setSaveStatus("已保存");
      window.history.replaceState(null, "", `/?doc=${doc.id}`);
    } catch {
      setSaveStatus("加载失败");
    }
  }, []);

  const createDoc = useCallback(async () => {
    try {
      const res = await apiFetch("/api/docs", {
        method: "POST",
        body: JSON.stringify({ content: JSON.stringify(EMPTY_DOC) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { doc } = (await res.json()) as { doc: DocPayload };
      setDocs((prev) => [
        { id: doc.id, title: doc.title, updatedAt: doc.updatedAt },
        ...(prev ?? []),
      ]);
      await openDoc(doc.id);
    } catch {
      setSaveStatus("创建失败");
    }
  }, [openDoc]);

  useEffect(() => {
    if (!isAuthenticated || bootstrapped.current) return;
    bootstrapped.current = true;
    void (async () => {
      // SSO 的 userinfo 仅回 sub；展示名走 /auth/me（同源 /bff 反代）
      try {
        const meRes = await apiFetch("/bff/identity/api/v1/auth/me");
        if (meRes.ok) {
          const me = (await meRes.json()) as { data?: { username?: string; email?: string } };
          setDisplayName(me.data?.username ?? me.data?.email ?? "");
        }
      } catch {
        // 拿不到就不显示
      }
      try {
        const res = await apiFetch("/api/docs");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { docs: list } = (await res.json()) as { docs: DocMeta[] };
        if (list.length === 0) {
          await createDoc();
          return;
        }
        setDocs(list);
        const requested = new URLSearchParams(window.location.search).get("doc");
        const target = list.some((d) => d.id === requested) ? requested : list[0].id;
        await openDoc(target as string);
      } catch {
        setDocs([]);
        setSaveStatus("加载失败");
      }
    })();
  }, [isAuthenticated, createDoc, openDoc]);

  const handleContentChange = useCallback(async (json: JSONContent) => {
    const id = currentIdRef.current;
    if (!id) return;
    setSaveStatus("保存中…");
    try {
      const res = await apiFetch(`/api/docs/${id}`, {
        method: "PUT",
        body: JSON.stringify({ content: JSON.stringify(json) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { doc } = (await res.json()) as { doc: DocPayload };
      if (currentIdRef.current === id) {
        setSaveStatus("已保存");
        setDocs((prev) =>
          (prev ?? []).map((d) =>
            d.id === doc.id ? { id: d.id, title: doc.title, updatedAt: doc.updatedAt } : d,
          ),
        );
      }
    } catch {
      if (currentIdRef.current === id) setSaveStatus("保存失败");
    }
  }, []);

  const removeDoc = useCallback(
    async (id: string) => {
      if (!window.confirm("删除这篇文档？此操作不可恢复。")) return;
      try {
        const res = await apiFetch(`/api/docs/${id}`, { method: "DELETE" });
        if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
        const remaining = (docs ?? []).filter((d) => d.id !== id);
        setDocs(remaining);
        if (currentIdRef.current === id) {
          if (remaining.length > 0) {
            await openDoc(remaining[0].id);
          } else {
            currentIdRef.current = null;
            setCurrentId(null);
            setInitialContent(null);
            await createDoc();
          }
        }
      } catch {
        setSaveStatus("删除失败");
      }
    },
    [docs, createDoc, openDoc],
  );

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch {
      // 即使 API 失败也强制回登录页
    }
    router.replace("/login");
  }, [logout, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">正在加载…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex w-full items-center gap-3 border-b px-4 py-3">
        <FileText className="h-5 w-5" />
        <span className="font-semibold">Novel</span>
        <span className="text-xs text-muted-foreground">多用户演示</span>
        <div className="ml-auto flex items-center gap-3">
          <a
            href="https://github.com/steven-tey/novel"
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground"
          >
            <GithubIcon className="h-4 w-4" />
          </a>
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {displayName || user?.email || user?.username || ""}
          </span>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            退出登录
          </Button>
          <Menu />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-screen-xl flex-1 flex-col gap-6 px-4 py-5 md:flex-row">
        <aside className="w-full shrink-0 md:w-64">
          <Button className="mb-3 w-full gap-2" onClick={createDoc}>
            <FilePlus className="h-4 w-4" />
            新建文档
          </Button>
          <div className="flex flex-col gap-1">
            {docs === null ? (
              <p className="px-2 text-sm text-muted-foreground">正在加载列表…</p>
            ) : docs.length === 0 ? (
              <p className="px-2 text-sm text-muted-foreground">暂无文档</p>
            ) : (
              docs.map((doc) => (
                <div
                  key={doc.id}
                  className={`group flex items-center gap-1 rounded-md text-sm ${
                    doc.id === currentId
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50"
                  }`}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
                    onClick={() => void openDoc(doc.id)}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span className="truncate">{doc.title}</span>
                  </button>
                  <button
                    type="button"
                    className="mr-1.5 hidden shrink-0 text-muted-foreground hover:text-red-500 group-hover:block"
                    onClick={() => void removeDoc(doc.id)}
                    aria-label="删除文档"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 justify-center">
          {currentId !== null && initialContent !== null ? (
            <TailwindAdvancedEditor
              key={currentId}
              initialContent={initialContent}
              saveStatus={saveStatus}
              onDirty={() => setSaveStatus("编辑中…")}
              onContentChange={handleContentChange}
            />
          ) : (
            <p className="mt-24 text-sm text-muted-foreground">正在加载文档…</p>
          )}
        </main>
      </div>
    </div>
  );
}
