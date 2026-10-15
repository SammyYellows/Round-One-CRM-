// Emails to leads and members as very light HTML (Sammy, 15/10/2026): it
// should read like an email from a person, as far from a Mailchimp email as
// possible, so it lands in the main inbox. No banner, no coloured bars, no
// designed footer: just the words, a small logo under the sign-off like an
// email signature (Sammy, 15/10), with each link that ends a line turned
// into a simple red button and its address underneath. The plain text goes
// too. Only the Program emails for now; the rest stay plain text (deliver.ts).

const RED = "#D01B20"; // --red-btn: passes contrast under white text
const GREY = "#5F605F";
const FONT = "Arial, Helvetica, sans-serif";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** What the button says, from where the link goes. */
export function buttonLabel(url: string): string {
  if (/goteamup\.com\/.*\/memberships\//.test(url)) return "Choose your membership";
  if (/\/book\//.test(url)) return "Book your meeting";
  if (/\/f\/check-in/.test(url)) return "Fill in your check-in";
  if (/\/f\/accountability/.test(url)) return "Join the programme";
  if (/goteamup\.com/.test(url)) return "Open TeamUp";
  return "Open the link";
}

const linkify = (line: string) => esc(line).replace(/https?:\/\/[^\s<>"]+/g, (u) => `<a href="${u}">${u}</a>`);

function button(url: string): string {
  const u = esc(url);
  return `<p style="margin:0 0 6px"><a href="${u}" style="display:inline-block;padding:14px 26px;background:${RED};color:#FFFFFF;text-decoration:none;font-weight:bold;font-size:16px">${esc(buttonLabel(url))}</a></p>`
    + `<p style="margin:0 0 16px;font-size:12px;color:${GREY}">${linkify(url)}</p>`;
}

const para = (lines: string[], bold: boolean) =>
  `<p style="margin:0 0 16px">${lines.map((l, i) => (bold && i === 0 ? `<b>${linkify(l)}</b>` : linkify(l))).join("<br>")}</p>`;

/** A short first line with no full stop, over more lines, reads as a heading ("Commitment fee"). */
const headed = (lines: string[]) =>
  lines.length > 1 && lines[0].length <= 40 && !/[.,:;!?)]$/.test(lines[0]) && !/^(hi|hey|dear)\b/i.test(lines[0]);

/** The email as HTML. `logoUrl` is the small signature logo; `unsubscribe` adds the stop-these-emails line (marketing emails). */
export function emailHtml(text: string, opts: { logoUrl?: string; unsubscribe?: string } = {}): string {
  const out: string[] = [];
  for (const block of text.trim().split(/\n\s*\n/)) {
    const lines = block.split("\n").map((l) => l.trimEnd());
    const bold = headed(lines);
    let run: string[] = [];
    let first = true;
    const flush = () => { if (run.length) out.push(para(run, bold && first)); run = []; };
    for (const line of lines) {
      const m = line.match(/^(.*?)\s*(https?:\/\/[^\s<>"]+)$/);
      if (!m) { run.push(line); continue; }
      if (m[1]) run.push(m[1]);
      flush();
      first = false;
      out.push(button(m[2]));
    }
    flush();
  }
  if (opts.logoUrl) {
    out.push(`<p style="margin:4px 0 0"><img src="${esc(opts.logoUrl)}" width="72" height="48" alt="Round One" style="display:block;width:72px;height:48px;border:0"></p>`);
  }
  if (opts.unsubscribe) {
    out.push(`<p style="margin:24px 0 0;font-size:12px;color:${GREY}">You’re getting this because you’re a member of Round One or have been in touch with us. <a href="${esc(opts.unsubscribe)}" style="color:${GREY}">Stop these emails</a></p>`);
  }
  return `<div style="font-family:${FONT};font-size:14px;line-height:1.5;color:#222222">\n${out.join("\n")}\n</div>`;
}
