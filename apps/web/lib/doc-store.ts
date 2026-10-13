import { promises as fs } from "node:fs";
import path from "node:path";
import { put, del, get, list } from "@vercel/blob";

export interface DocMeta {
  id: string;
  title: string;
  updatedAt: string;
}

export interface StoredDoc {
  id: string;
  content: string;
  updatedAt: string;
}

export const MAX_CONTENT_LENGTH = 1024 * 1024;

// userId 来自 /auth/me（服务端信任源），仍做格式校验防路径注入；docId 为服务端生成。
const USER_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const DOC_ID_RE = /^[a-z0-9-]{1,64}$/;

export function isValidUserId(id: string): boolean {
  return USER_ID_RE.test(id);
}

export function isValidDocId(id: string): boolean {
  return DOC_ID_RE.test(id);
}

// 主路径 Vercel Blob（private access：URL 不公开，仅服务端带令牌可读）；
// 本地开发未配 BLOB_READ_WRITE_TOKEN 时回退文件存储 .data/（gitignored）。
function blobEnabled(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

function docPathname(userId: string, docId: string): string {
  return `docs/${userId}/${docId}.json`;
}

function fsDir(userId: string): string {
  return path.join(process.cwd(), ".data", "docs", userId);
}

function fsFile(userId: string, docId: string): string {
  return path.join(fsDir(userId), `${docId}.json`);
}

export function deriveTitle(content: string): string {
  let text = content;
  try {
    const json = JSON.parse(content);
    const parts: string[] = [];
    const walk = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      const n = node as { text?: unknown; content?: unknown };
      if (typeof n.text === "string") parts.push(n.text);
      if (Array.isArray(n.content)) n.content.forEach(walk);
    };
    walk(json);
    text = parts.join(" ");
  } catch {
    // 非 JSON：按 HTML/纯文本处理
  }
  text = text
    .replace(/<[^>]*>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/[#*`>\-[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "未命名文档";
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

async function readStoredDoc(userId: string, docId: string): Promise<StoredDoc | null> {
  if (blobEnabled()) {
    try {
      const result = await get(docPathname(userId, docId), {
        access: "private",
        useCache: false,
      });
      if (!result) return null;
      const text = await new Response(result.stream).text();
      return JSON.parse(text) as StoredDoc;
    } catch {
      return null;
    }
  }
  try {
    const text = await fs.readFile(fsFile(userId, docId), "utf8");
    return JSON.parse(text) as StoredDoc;
  } catch {
    return null;
  }
}

async function writeStoredDoc(userId: string, docId: string, content: string): Promise<StoredDoc> {
  const doc: StoredDoc = { id: docId, content, updatedAt: new Date().toISOString() };
  const body = JSON.stringify(doc);
  if (blobEnabled()) {
    await put(docPathname(userId, docId), body, {
      access: "private",
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: "application/json",
    });
  } else {
    await fs.mkdir(fsDir(userId), { recursive: true });
    await fs.writeFile(fsFile(userId, docId), body, "utf8");
  }
  return doc;
}

async function listDocIds(userId: string): Promise<string[]> {
  if (blobEnabled()) {
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const result = await list({ prefix: `docs/${userId}/`, cursor });
      for (const blob of result.blobs) {
        const name = blob.pathname.split("/").pop() ?? "";
        const id = name.replace(/\.json$/, "");
        if (id && isValidDocId(id)) ids.push(id);
      }
      cursor = result.hasMore ? result.cursor : undefined;
    } while (cursor);
    return ids;
  }
  try {
    const names = await fs.readdir(fsDir(userId));
    return names
      .filter((n) => n.endsWith(".json"))
      .map((n) => n.replace(/\.json$/, ""))
      .filter((id) => isValidDocId(id));
  } catch {
    return [];
  }
}

export async function listDocs(userId: string): Promise<DocMeta[]> {
  const ids = await listDocIds(userId);
  const metas = await Promise.all(
    ids.map(async (docId): Promise<DocMeta | null> => {
      const doc = await readStoredDoc(userId, docId);
      if (!doc) return null;
      return { id: docId, title: deriveTitle(doc.content), updatedAt: doc.updatedAt };
    }),
  );
  return metas
    .filter((m): m is DocMeta => m !== null)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function createDoc(userId: string, content: string): Promise<StoredDoc & { title: string }> {
  const docId = crypto.randomUUID();
  const doc = await writeStoredDoc(userId, docId, content);
  return { ...doc, title: deriveTitle(content) };
}

export async function getDoc(userId: string, docId: string): Promise<(StoredDoc & { title: string }) | null> {
  const doc = await readStoredDoc(userId, docId);
  if (!doc) return null;
  return { ...doc, title: deriveTitle(doc.content) };
}

export async function saveDoc(
  userId: string,
  docId: string,
  content: string,
): Promise<(StoredDoc & { title: string }) | null> {
  const existing = await readStoredDoc(userId, docId);
  if (!existing) return null;
  const doc = await writeStoredDoc(userId, docId, content);
  return { ...doc, title: deriveTitle(content) };
}

export async function deleteDoc(userId: string, docId: string): Promise<boolean> {
  const existing = await readStoredDoc(userId, docId);
  if (!existing) return false;
  if (blobEnabled()) {
    await del(docPathname(userId, docId));
  } else {
    await fs.unlink(fsFile(userId, docId));
  }
  return true;
}
