// Shared logins by username (Sammy, 11/10/2026): one for management, one for
// staff, no inbox behind them. The login system needs an email, so a username
// becomes <username>@logins.round1boxfit.co.uk, a subdomain with no mail, so
// nothing is ever delivered. Their passwords are set by management on the
// Staff page; Forgotten password doesn't apply to them.

export const LOGIN_DOMAIN = "logins.round1boxfit.co.uk";
export const MIN_PASSWORD = 8; // Sammy, 10/10/2026 (was 10)

/** What someone typed in the login box: an email, or a shared login's username. */
export const loginEmail = (typed: string) => {
  const t = typed.trim().toLowerCase();
  return t && !t.includes("@") ? `${t}@${LOGIN_DOMAIN}` : t;
};

export const isSharedLogin = (email: string | null | undefined) => !!email && email.toLowerCase().endsWith(`@${LOGIN_DOMAIN}`);

/** "staff@logins…" → "staff"; a real email stays as it is. */
export const loginName = (email: string | null | undefined) => (email && isSharedLogin(email) ? email.split("@")[0] : email ?? "");

/** Usernames: lower-case letters, numbers, dots, dashes; 3 to 30 long. */
export const validUsername = (u: string) => /^[a-z0-9][a-z0-9.-]{2,29}$/.test(u);
