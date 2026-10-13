import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/server-auth";
import { MAX_CONTENT_LENGTH, createDoc, listDocs } from "@/lib/doc-store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await verifyAccessToken(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const docs = await listDocs(user.id);
  return NextResponse.json({ docs });
}

export async function POST(req: Request) {
  const user = await verifyAccessToken(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let content = "";
  try {
    const body = (await req.json()) as { content?: unknown };
    if (typeof body?.content === "string") content = body.content;
  } catch {
    // 空 body → 新空文档
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ error: "content too large" }, { status: 413 });
  }

  const doc = await createDoc(user.id, content);
  return NextResponse.json({ doc }, { status: 201 });
}
