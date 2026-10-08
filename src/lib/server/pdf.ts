// A very small PDF writer: A4 pages, Helvetica text, lines and filled boxes.
// Enough for a one- or two-page report with a line chart, with no library
// (CLAUDE.md: no new dependencies without agreeing it). Coordinates are in
// points from the top-left, like a screen, and flipped on output.

const W = 595.28, H = 841.89;

type Op = string;

export class Pdf {
  private pages: Op[][] = [];
  private ops: Op[] = [];
  y = 0;

  constructor() { this.newPage(); }

  newPage() { this.ops = []; this.pages.push(this.ops); this.y = 56; }

  /** Width of a string in Helvetica at `size`, close enough for layout. */
  static width(text: string, size: number) {
    let w = 0;
    for (const ch of text) w += ch === " " ? 0.278 : /[iljtfI.,:;'|!]/.test(ch) ? 0.3 : /[mwMW]/.test(ch) ? 0.85 : /[A-Z0-9£]/.test(ch) ? 0.68 : 0.55;
    return w * size;
  }

  private esc(s: string) { return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[^\x20-\x7e£]/g, (c) => (c === "’" ? "'" : c === "–" || c === "—" ? "-" : c === "…" ? "..." : "")).replace(/£/g, "\\243"); }

  text(x: number, yTop: number, s: string, size = 11, opts: { bold?: boolean; color?: [number, number, number]; align?: "left" | "right" | "center" } = {}) {
    const font = opts.bold ? "/F2" : "/F1";
    const c = opts.color ?? [0.1, 0.1, 0.1];
    let xx = x;
    if (opts.align === "right") xx = x - Pdf.width(s, size);
    if (opts.align === "center") xx = x - Pdf.width(s, size) / 2;
    this.ops.push(`BT ${font} ${size} Tf ${c.join(" ")} rg ${xx.toFixed(2)} ${(H - yTop - size * 0.78).toFixed(2)} Td (${this.esc(s)}) Tj ET`);
  }

  /** A paragraph, wrapped to `width`. Returns the y below it. */
  para(x: number, yTop: number, s: string, size: number, width: number, opts: { bold?: boolean; color?: [number, number, number]; lead?: number } = {}) {
    const lead = opts.lead ?? size * 1.4;
    let y = yTop;
    for (const raw of s.split("\n")) {
      let line = "";
      for (const word of raw.split(" ")) {
        const next = line ? `${line} ${word}` : word;
        if (Pdf.width(next, size) > width && line) { this.text(x, y, line, size, opts); y += lead; line = word; } else line = next;
      }
      this.text(x, y, line, size, opts); y += lead;
    }
    return y;
  }

  line(x1: number, y1: number, x2: number, y2: number, width = 1, color: [number, number, number] = [0.8, 0.8, 0.8]) {
    this.ops.push(`${color.join(" ")} RG ${width} w ${x1.toFixed(2)} ${(H - y1).toFixed(2)} m ${x2.toFixed(2)} ${(H - y2).toFixed(2)} l S`);
  }

  polyline(pts: [number, number][], width = 2, color: [number, number, number] = [0.93, 0.13, 0.14]) {
    if (pts.length < 2) return;
    const [first, ...rest] = pts;
    this.ops.push(`${color.join(" ")} RG ${width} w 1 J 1 j ${first[0].toFixed(2)} ${(H - first[1]).toFixed(2)} m ${rest.map((p) => `${p[0].toFixed(2)} ${(H - p[1]).toFixed(2)} l`).join(" ")} S`);
  }

  rect(x: number, yTop: number, w: number, h: number, color: [number, number, number]) {
    this.ops.push(`${color.join(" ")} rg ${x.toFixed(2)} ${(H - yTop - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  }

  get pageWidth() { return W; }

  bytes(): Uint8Array {
    const objects: string[] = [];
    const add = (s: string) => { objects.push(s); return objects.length; };
    const fontRegular = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    const fontBold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    const pagesId = objects.length + 1 + this.pages.length * 2; // placed after the page and content objects
    const pageIds: number[] = [];
    for (const ops of this.pages) {
      const stream = ops.join("\n");
      const contentId = add(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
      pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${W} ${H}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> >>`));
    }
    add(`<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
    const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
    const offsets: number[] = [];
    objects.forEach((o, i) => { offsets.push(Buffer.byteLength(out, "latin1")); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = Buffer.byteLength(out, "latin1");
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
    out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return new Uint8Array(Buffer.from(out, "latin1"));
  }
}
