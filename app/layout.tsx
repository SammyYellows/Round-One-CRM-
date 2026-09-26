import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Round 1 Fitness",
  description: "Round 1 Fitness – free consultation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
