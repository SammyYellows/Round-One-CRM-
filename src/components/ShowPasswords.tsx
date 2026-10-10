"use client";

import { useState } from "react";

// A password box with a Show / Hide button inside it (Sammy, 10/10/2026: so
// typing on a phone can be checked). Used on login and set-password.
export function PasswordInput(props: { id: string; name: string; autoComplete: string; minLength?: number; autoFocus?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input {...props} type={show ? "text" : "password"} className="input" required style={{ paddingRight: 76 }} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-pressed={show}
        aria-label={show ? "Hide password" : "Show password"}
        style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 70, background: "transparent", border: 0, color: "var(--muted)", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}
