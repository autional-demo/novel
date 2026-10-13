// Unit + local-fs integration tests for the doc store (node:test, type-stripping).
// Runs with BLOB_READ_WRITE_TOKEN unset → exercises the fs fallback under .data/.
//   pnpm --filter novel-next-app test
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  createDoc,
  deleteDoc,
  deriveTitle,
  getDoc,
  isValidDocId,
  isValidUserId,
  listDocs,
  saveDoc,
} from "../lib/doc-store.ts";

// biome's noDelete fix would assign undefined — which Node coerces to the string "undefined" (truthy). Empty string is the safe falsy.
process.env.BLOB_READ_WRITE_TOKEN = "";

const TEST_UID_A = `test-unit-a-${crypto.randomUUID().slice(0, 8)}`;
const TEST_UID_B = `test-unit-b-${crypto.randomUUID().slice(0, 8)}`;

after(async () => {
  for (const uid of [TEST_UID_A, TEST_UID_B]) {
    await fs.rm(path.join(process.cwd(), ".data", "docs", uid), { recursive: true, force: true });
  }
});

test("deriveTitle: extracts text from Tiptap JSON", () => {
  const doc = JSON.stringify({
    type: "doc",
    content: [
      { type: "heading", content: [{ type: "text", text: "Hello" }] },
      { type: "paragraph", content: [{ type: "text", text: "world" }] },
    ],
  });
  assert.equal(deriveTitle(doc), "Hello world");
});

test("deriveTitle: strips HTML tags from non-JSON content", () => {
  assert.equal(deriveTitle("<h1>Title</h1><p>Body text</p>"), "Title Body text");
});

test("deriveTitle: empty or tag-only content falls back to 未命名文档", () => {
  assert.equal(deriveTitle(""), "未命名文档");
  assert.equal(deriveTitle('{"type":"doc","content":[{"type":"paragraph"}]}'), "未命名文档");
  assert.equal(deriveTitle("<p></p>"), "未命名文档");
});

test("deriveTitle: truncates long titles to 60 chars + ellipsis", () => {
  const long = "字".repeat(100);
  const title = deriveTitle(long);
  assert.equal(title.length, 61);
  assert.ok(title.endsWith("…"));
});

test("id validation: rejects path traversal and separators", () => {
  assert.equal(isValidUserId("01M4THRSZA0KD1997E1ZMP4E07"), true);
  assert.equal(isValidUserId("../../etc"), false);
  assert.equal(isValidUserId("a/b"), false);
  assert.equal(isValidUserId(""), false);
  assert.equal(isValidUserId("x".repeat(65)), false);
  assert.equal(isValidDocId("571cd22a-7cf9-4e81-b72c-319c38ea0940"), true);
  assert.equal(isValidDocId("../secret"), false);
  assert.equal(isValidDocId("UPPER"), false);
  assert.equal(isValidDocId("a/../b"), false);
});

test("fs store: create → get → list → save → delete round trip", async () => {
  const created = await createDoc(TEST_UID_A, JSON.stringify({ type: "doc", content: [{ type: "text", text: "first version" }] }));
  assert.equal(created.title, "first version");

  const fetched = await getDoc(TEST_UID_A, created.id);
  assert.equal(fetched?.content, created.content);

  const listed = await listDocs(TEST_UID_A);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, created.id);

  const saved = await saveDoc(TEST_UID_A, created.id, JSON.stringify({ type: "doc", content: [{ type: "text", text: "second version" }] }));
  assert.equal(saved?.title, "second version");
  assert.equal((await getDoc(TEST_UID_A, created.id))?.title, "second version");

  assert.equal(await deleteDoc(TEST_UID_A, created.id), true);
  assert.equal(await getDoc(TEST_UID_A, created.id), null);
});

test("fs store: save/delete of non-existent doc returns null/false (no create-on-write)", async () => {
  assert.equal(await saveDoc(TEST_UID_A, "00000000-0000-0000-0000-000000000000", "{}"), null);
  assert.equal(await deleteDoc(TEST_UID_A, "00000000-0000-0000-0000-000000000000"), false);
});

test("fs store: same docId under two userIds is isolated (namespace semantics)", async () => {
  const a = await createDoc(TEST_UID_A, "A-doc");
  // docId collision across users is impossible via API (uuid), but the store must
  // scope by uid regardless — a foreign id resolves to null, not another user's doc.
  assert.equal(await getDoc(TEST_UID_B, a.id), null);
  assert.equal(await deleteDoc(TEST_UID_B, a.id), false);
  assert.notEqual(await getDoc(TEST_UID_A, a.id), null);
});
