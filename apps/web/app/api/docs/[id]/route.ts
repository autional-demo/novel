import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/server-auth";
import {
  MAX_CONTENT_LENGTH,
  deleteDoc,
  getDoc,
  isValidDocId,
  saveDoc,
} from "@/lib/doc-store";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// 隔离设计：所有读写都以 token 派生的 userId 前缀构造路径，
// 请求的 docId 永远不会落到他人目录（跨用户 id 天然 404）。
export async function GET(req: Request, { params }: RouteContext) {
  const user = await verifyAccessToken(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!isValidDocId(id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const doc = await getDoc(user.id, id);
  if (!doc) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ doc });
}

export async function PUT(req: Request, { params }: RouteContext) {
  const user = await verifyAccessToken(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!isValidDocId(id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  let content: string | null = null;
  try {
    const body = (await req.json()) as { content?: unknown };
    if (typeof body?.content === "string") content = body.content;
  } catch {
    // fallthrough → 400
  }
  if (content === null) {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ error: "content too large" }, { status: 413 });
  }

  const doc = await saveDoc(user.id, id, content);
  if (!doc) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ doc });
}

export async function DELETE(req: Request, { params }: RouteContext) {
  const user = await verifyAccessToken(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!isValidDocId(id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const deleted = await deleteDoc(user.id, id);
  if (!deleted) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
