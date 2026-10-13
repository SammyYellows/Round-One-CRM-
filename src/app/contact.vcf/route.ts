// The gym's contact card as a .vcf file (Sammy, 13/10/2026): tapping it on a
// phone offers "Add to contacts". Linked from /contact and the "new number"
// WhatsApp and email.

import { GYM } from "@/lib/gym";

export const dynamic = "force-static";

export function GET() {
  const [street, rest] = [GYM.address.split(", ").slice(0, 2).join(", "), GYM.address.split(", ").slice(2).join(", ")];
  const city = rest.replace(/\s+[A-Z]{1,2}\d[\dA-Z]?\s*\d[A-Z]{2}$/, "");
  const postcode = rest.match(/[A-Z]{1,2}\d[\dA-Z]?\s*\d[A-Z]{2}$/)?.[0] ?? "";
  const card = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "N:;Round One Gym;;;",
    "FN:Round One Gym",
    "ORG:Round One",
    `TEL;TYPE=CELL,VOICE,PREF:${GYM.whatsapp.replace(/\s/g, "")}`,
    `TEL;TYPE=WORK,VOICE:${GYM.phone.replace(/\s/g, "")}`,
    `EMAIL;TYPE=WORK:${GYM.email}`,
    `ADR;TYPE=WORK:;;${street};${city};;${postcode};United Kingdom`,
    `URL:${GYM.website}`,
    "NOTE:WhatsApp us on " + GYM.whatsappDisplay,
    "END:VCARD",
    "",
  ].join("\r\n");
  return new Response(card, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": 'attachment; filename="Round One Gym.vcf"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
