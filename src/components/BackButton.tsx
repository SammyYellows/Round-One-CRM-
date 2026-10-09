"use client";

import { usePathname, useRouter } from "next/navigation";

// A back button on every staff screen except Today (Sammy, 09/10/2026).
// Goes back in the browser's history when there is somewhere to go, else to Today.

export function BackButton() {
  const path = usePathname();
  const router = useRouter();
  if (path === "/") return null;
  const back = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/");
  };
  return (
    <button type="button" className="back-btn" onClick={back} aria-label="Back">
      ‹ Back
    </button>
  );
}
