"use client";

// A "Show passwords" tick box for the set-password form, so typing on a
// phone can be checked before saving.
export function ShowPasswords() {
  return (
    <label className="small" style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--muted)" }}>
      <input type="checkbox" onChange={(e) => document.querySelectorAll<HTMLInputElement>("input[data-pw]").forEach((i) => { i.type = e.target.checked ? "text" : "password"; })} />
      Show passwords
    </label>
  );
}
