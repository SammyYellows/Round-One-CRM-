// How a message's words are shown (Sammy, 16/10/2026: "sometimes a reply is
// [reaction] or something else in brackets… I want to see emojis"). Messages
// with no words (a photo, a voice note, a reaction) are stored as a label in
// square brackets, which the AI drafts skip; this turns those labels into
// something friendlier on screen. Typed emojis are ordinary text and show as
// they are.

const ICON: Record<string, string> = {
  photo: "📷 Photo", image: "📷 Photo", video: "🎥 Video", "voice note": "🎤 Voice note", audio: "🎤 Voice note",
  sticker: "Sticker", document: "📄 Document", file: "📄 File", attachment: "📎 Attachment", location: "📍 Location",
  contacts: "👤 Contact card", "shared a post": "↗ Shared a post", "shared a reel": "↗ Shared a reel",
  "mentioned us in their story": "Mentioned us in their story", message: "A message with no words (Meta doesn't share what it was)",
  unsupported: "A message WhatsApp couldn't pass on", reaction: "Reacted to a message",
};

/** "[Photo] [Photo]" → "📷 Photo × 2"; "[Reacted 👍]" → "Reacted 👍"; "[Photo] Me today" → "📷 Photo: Me today"; anything else unchanged. */
export function showText(text: string): string {
  const m = text.trim().match(/^((?:\[[^\]]+\]\s*)+)([\s\S]*)$/);
  if (!m) return text;
  const counted = new Map<string, number>();
  for (const [, p] of m[1].matchAll(/\[([^\]]+)\]/g)) {
    const label = ICON[p.toLowerCase()] ?? p;
    counted.set(label, (counted.get(label) ?? 0) + 1);
  }
  const labels = [...counted].map(([label, n]) => (n > 1 ? `${label} × ${n}` : label)).join(", ");
  return m[2].trim() ? `${labels}: ${m[2].trim()}` : labels;
}
