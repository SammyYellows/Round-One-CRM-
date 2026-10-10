// Champ's knowledge (Sammy, 10/10/2026): notes management write and text
// read from documents they upload, for Champ to read before every answer.
// Owners and managers only (staff role), until management logins arrive.
// Server-only.
//
// Documents: .txt, .md, .csv are read as they are; .docx is unzipped here
// (no library: a Word file is a zip with the text in word/document.xml);
// PDFs are read by Claude once, at upload, and the text is kept.

import { inflateRawSync } from "node:zlib";
import { db } from "./supabase";

export const BUCKET = "champ-docs";
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
/** All of Champ's knowledge together, so every question stays quick and cheap (about 100,000 tokens). */
export const MAX_TOTAL_CHARS = 400_000;
const PDF_MODEL = process.env.CHAMP_MODEL || "claude-sonnet-5-5";

export interface KnowledgeRow { id: string; title: string; body: string; kind: "note" | "document"; file_name: string | null; file_path: string | null; mime: string | null; size: number | null; status: "ready" | "failed"; error: string | null; active: boolean; created_by: string; created_at: string; updated_at: string }

export async function listKnowledge(): Promise<KnowledgeRow[]> {
  const { data, error } = await db().from("champ_knowledge").select("*").order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as KnowledgeRow[];
}

/** The text Champ reads: every active, ready entry, in the order they were added. */
export async function knowledgeForChamp(): Promise<string> {
  const { data } = await db().from("champ_knowledge").select("title, body, kind, file_name").eq("active", true).eq("status", "ready").order("created_at");
  const rows = (data ?? []) as Pick<KnowledgeRow, "title" | "body" | "kind" | "file_name">[];
  if (!rows.length) return "";
  return rows.map((r) => `## ${r.title}${r.kind === "document" && r.file_name ? ` (from ${r.file_name})` : ""}\n\n${r.body.trim()}`).join("\n\n---\n\n");
}

export async function totalChars(exceptId?: string): Promise<number> {
  const rows = await listKnowledge();
  return rows.filter((r) => r.active && r.id !== exceptId).reduce((n, r) => n + r.body.length, 0);
}

// ---- reading documents

/** The text of a Word (.docx) file: find word/document.xml in the zip and strip the XML. */
function docxText(buf: Buffer): string {
  // End of central directory record: the last 22+ bytes, signature 0x06054b50.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("This doesn't look like a Word file");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32), local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    if (name === "word/document.xml") {
      const lNameLen = buf.readUInt16LE(local + 26), lExtraLen = buf.readUInt16LE(local + 28);
      const start = local + 30 + lNameLen + lExtraLen;
      const raw = buf.subarray(start, start + csize);
      const xml = (method === 8 ? inflateRawSync(raw) : raw).toString("utf8");
      return xml
        .replace(/<w:tab\/>/g, "\t").replace(/<w:br[^>]*\/>/g, "\n")
        .replace(/<\/w:p>\s*<\/w:tc>/g, " | ").replace(/<\/w:tc>/g, " | ").replace(/( \| )?<\/w:tr>/g, "\n").replace(/<\/w:p>/g, "\n")
        .replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error("No text found in this Word file");
}

/** A PDF's text, read by Claude (streamed, so long documents don't time out). */
async function pdfText(buf: Buffer): Promise<{ text: string; cut: boolean }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Reading PDFs needs the Claude API key");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: PDF_MODEL, max_tokens: 24000, stream: true, output_config: { effort: "low" },
      system: "You turn documents into plain text for a gym's staff assistant to read. Copy the document's words faithfully: every heading, paragraph, list, table row, number, time and name. Don't summarise, shorten, correct or add anything. Write tables as one line per row with cells separated by \" | \". Describe a diagram or photo in one short line in square brackets only if it carries information (for example an exercise demonstration). Output only the document's text.",
      messages: [{ role: "user", content: [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") } }, { type: "text", text: "Write out this document's text." }] }],
    }),
  });
  if (!res.ok || !res.body) throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 200)}`);
  let text = "", stop = "", pending = "";
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    pending += dec.decode(value, { stream: true });
    const lines = pending.split("\n");
    pending = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const ev = JSON.parse(line.slice(6)) as { type: string; delta?: { type?: string; text?: string; stop_reason?: string }; error?: { message?: string } };
      if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") text += ev.delta.text ?? "";
      if (ev.type === "message_delta" && ev.delta?.stop_reason) stop = ev.delta.stop_reason;
      if (ev.type === "error") throw new Error(ev.error?.message ?? "Claude stopped reading the PDF");
    }
  }
  if (stop === "refusal") throw new Error("Claude wouldn't read this document");
  return { text: text.trim(), cut: stop === "max_tokens" };
}

/** Reads a file's text by its type. */
export async function extractText(buf: Buffer, fileName: string, mime: string): Promise<{ text: string; note?: string }> {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf" || mime === "application/pdf") {
    const r = await pdfText(buf);
    return { text: r.text, note: r.cut ? "This PDF was too long to read in full; only the first part is included. Split it into smaller files to include the rest." : undefined };
  }
  if (ext === "docx") return { text: docxText(buf) };
  if (["txt", "md", "csv", "text"].includes(ext) || mime.startsWith("text/")) return { text: buf.toString("utf8").replace(/\r\n/g, "\n").trim() };
  if (ext === "doc") throw new Error("Old Word files (.doc) can't be read. Save it as .docx or PDF and upload that.");
  throw new Error("Upload a PDF, Word (.docx) or text file");
}
