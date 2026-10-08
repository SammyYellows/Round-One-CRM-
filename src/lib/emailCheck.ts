// A proper look at an email address typed into a form (improvement list
// item 11, Sammy 08/10/2026). Shared by the form in the browser and the
// submit route on the server, so both agree. Tidies the address (spaces,
// case), says what's wrong in plain words, and spots the common typos.

export interface EmailCheck {
  ok: boolean;
  value: string; // tidied: trimmed, lower-case
  reason?: string; // when not ok
  suggestion?: string; // a likely correction, e.g. gmail.com for gmial.com
}

const TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com", "gmal.com": "gmail.com", "gamil.com": "gmail.com", "gnail.com": "gmail.com", "gmail.co": "gmail.com", "gmail.cm": "gmail.com", "gmail.con": "gmail.com", "gmaill.com": "gmail.com", "gmail.com.com": "gmail.com", "googlemail.co.uk": "googlemail.com",
  "hotmal.com": "hotmail.com", "hotmai.com": "hotmail.com", "hotmial.com": "hotmail.com", "hotmail.con": "hotmail.com", "hotmail.cm": "hotmail.com", "hotmail.co": "hotmail.com", "hotmail.couk": "hotmail.co.uk", "hotmail.uk": "hotmail.co.uk",
  "outlok.com": "outlook.com", "outlook.con": "outlook.com", "outllok.com": "outlook.com",
  "yahooo.com": "yahoo.com", "yaho.com": "yahoo.com", "yahoo.con": "yahoo.com", "yahoo.couk": "yahoo.co.uk",
  "icloud.con": "icloud.com", "iclould.com": "icloud.com", "icoud.com": "icloud.com",
  "btinernet.com": "btinternet.com", "btintenet.com": "btinternet.com", "btinternet.co": "btinternet.com",
  "live.couk": "live.co.uk", "sky.con": "sky.com",
};

export function checkEmail(raw: string): EmailCheck {
  const value = raw.trim().replace(/\s+/g, "").toLowerCase();
  if (!value) return { ok: false, value, reason: "Please enter your email address." };
  const at = value.split("@");
  if (at.length !== 2) return { ok: false, value, reason: at.length < 2 ? "An email address needs an @ in it." : "There’s more than one @ in that address." };
  const [local, domain] = at;
  if (!local || !/^[a-z0-9._%+'-]+$/.test(local) || local.startsWith(".") || local.endsWith(".") || local.includes("..")) return { ok: false, value, reason: "The part before the @ doesn’t look right." };
  if (!domain.includes(".")) return { ok: false, value, reason: "The part after the @ needs a dot in it, like gmail.com." };
  const labels = domain.split(".");
  if (labels.some((l) => !l || !/^[a-z0-9-]+$/.test(l) || l.startsWith("-") || l.endsWith("-"))) return { ok: false, value, reason: "The part after the @ doesn’t look like a web address." };
  const tld = labels[labels.length - 1];
  if (tld.length < 2 || /\d/.test(tld)) return { ok: false, value, reason: "The ending doesn’t look right (it should be something like .com or .co.uk)." };
  const fix = TYPOS[domain];
  if (fix) return { ok: true, value, suggestion: `${local}@${fix}` };
  if (/\.(con|cmo|ocm|comm)$/.test(domain)) return { ok: true, value, suggestion: `${local}@${domain.replace(/\.(con|cmo|ocm|comm)$/, ".com")}` };
  return { ok: true, value };
}
