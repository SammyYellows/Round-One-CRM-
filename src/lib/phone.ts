// Mobile numbers as WhatsApp wants them: country code and digits, no plus,
// e.g. 447700900101. People type UK numbers as "07700 900101".

export function waNumber(phone: string): string {
  let d = phone.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return d.slice(1);
  if (d.startsWith("00")) return d.slice(2);
  if (d.startsWith("0")) d = "44" + d.slice(1);
  return d;
}

/** True when two typed numbers are the same phone. */
export const samePhone = (a: string, b: string) => !!a && !!b && waNumber(a) === waNumber(b);
