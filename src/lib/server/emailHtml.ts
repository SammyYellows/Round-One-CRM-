// The branded look for emails to leads and members (Sammy, 15/10/2026): the
// Round One logo on a black bar, the words on white, and every link on a line
// of its own turned into a red button with its address small underneath.
// The plain text still goes with it, for mail apps that don't show HTML.
// Staff alerts, mailouts and enquiry replies stay plain.

import { GYM } from "@/lib/gym";

// Email apps can't read CSS variables, so the brand tokens from globals.css
// are copied here.
const C = { black: "#0A0A0A", white: "#FFFFFF", cream: "#FFF5F0", red: "#EC2024", redBtn: "#D01B20", grey: "#5F605F", rule: "#E8DED9" };
const FONT = "Poppins, Helvetica, Arial, sans-serif";

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

const linkify = (line: string) =>
  esc(line).replace(/https?:\/\/[^\s<>"]+/g, (u) => `<a href="${u}" style="color:${C.redBtn};word-break:break-all">${u}</a>`);

function button(url: string): string {
  const u = esc(url);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px"><tr><td bgcolor="${C.redBtn}" style="background:${C.redBtn}">`
    + `<a href="${u}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:14px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:${C.white};text-decoration:none">${esc(buttonLabel(url))}</a>`
    + `</td></tr></table>`
    + `<p style="margin:-14px 0 22px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.grey};word-break:break-all">Or copy this link: <a href="${u}" style="color:${C.grey}">${u}</a></p>`;
}

const para = (lines: string[], bold = false) =>
  `<p style="margin:0 0 18px;font-family:${FONT};font-size:16px;line-height:1.6;color:${C.black}">`
  + lines.map((l, i) => (bold && i === 0 ? `<strong>${linkify(l)}</strong>` : linkify(l))).join("<br>")
  + `</p>`;

/** A short first line with no full stop, over more lines, reads as a heading ("Commitment fee"). */
const headed = (lines: string[]) =>
  lines.length > 1 && lines[0].length <= 40 && !/[.,:;!?)]$/.test(lines[0]) && !/^(hi|hey|dear)\b/i.test(lines[0]);

/** The body of the email: paragraphs, with each link that ends a line pulled out into a button. */
function bodyHtml(text: string): string {
  const out: string[] = [];
  for (const block of text.trim().split(/\n\s*\n/)) {
    const lines = block.split("\n").map((l) => l.trimEnd());
    const bold = headed(lines);
    let run: string[] = [];
    const flush = (first: boolean) => { if (run.length) out.push(para(run, bold && first)); run = []; };
    let first = true;
    for (const line of lines) {
      const m = line.match(/^(.*?)\s*(https?:\/\/[^\s<>"]+)$/);
      if (m) {
        if (m[1]) run.push(m[1]);
        flush(first);
        first = false;
        out.push(button(m[2]));
      } else run.push(line);
    }
    flush(first);
  }
  return out.join("\n");
}

/** The whole email as HTML. `unsubscribe` adds the stop-these-emails line (marketing emails). */
export function emailHtml(subject: string, text: string, opts: { logoUrl: string; unsubscribe?: string }): string {
  const foot = [
    `${esc(GYM.name)}, ${esc(GYM.address)}`,
    `WhatsApp ${esc(GYM.whatsappDisplay)} · <a href="${GYM.website}" style="color:${C.grey}">roundonefitness.co.uk</a>`,
    ...(opts.unsubscribe ? [`You’re getting this because you’re a member of Round One or have been in touch with us. <a href="${esc(opts.unsubscribe)}" style="color:${C.grey}">Stop these emails</a>`] : []),
  ];
  return `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.cream}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.cream}" style="background:${C.cream}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px">
<tr><td align="center" bgcolor="${C.black}" style="background:${C.black};padding:22px 24px"><img src="${esc(opts.logoUrl)}" width="96" alt="Round One" style="display:block;width:96px;height:auto;border:0"></td></tr>
<tr><td bgcolor="${C.red}" style="background:${C.red};height:4px;line-height:4px;font-size:0">&nbsp;</td></tr>
<tr><td bgcolor="${C.white}" style="background:${C.white};padding:32px 32px 14px">
${bodyHtml(text)}
</td></tr>
<tr><td style="padding:18px 32px 8px;border-top:1px solid ${C.rule}">
${foot.map((l) => `<p style="margin:0 0 6px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.grey}">${l}</p>`).join("\n")}
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}
