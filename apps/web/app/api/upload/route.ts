import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/server-auth";

export const runtime = "edge";

export async function POST(req: Request) {
  const user = await verifyAccessToken(req.headers.get("authorization"));
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 图片走 public 店独立令牌（主店 BLOB_READ_WRITE_TOKEN 为 private，店模式互斥不可混用）
  const uploadToken = process.env.IMAGES_BLOB_READ_WRITE_TOKEN ?? process.env.BLOB_READ_WRITE_TOKEN;
  if (!uploadToken) {
    return new Response("Missing IMAGES_BLOB_READ_WRITE_TOKEN. Don't forget to add that to your .env file.", {
      status: 401,
    });
  }

  const file = req.body || "";
  const filename = req.headers.get("x-vercel-filename") || "file.txt";
  const contentType = req.headers.get("content-type") || "text/plain";
  const fileType = `.${contentType.split("/")[1]}`;

  // construct final filename based on content-type if not provided
  const finalName = filename.includes(fileType) ? filename : `${filename}${fileType}`;
  const blob = await put(finalName, file, {
    contentType,
    access: "public",
    token: uploadToken,
  });

  return NextResponse.json(blob);
}
