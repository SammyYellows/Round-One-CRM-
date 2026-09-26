import { Brand } from "../Brand";
import { QUESTIONS } from "@/lib/config";
import ApplyForm from "./ApplyForm";

export const dynamic = "force-dynamic";

const SOURCES: Record<string, string> = { ig: "Instagram", instagram: "Instagram", fb: "Facebook", facebook: "Facebook", meta: "Meta Ads" };

export default async function ApplyPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const rawSource = (sp.utm_source || sp.src || "instagram").toLowerCase();
  const source = SOURCES[rawSource] ?? rawSource;
  return (
    <main className="public">
      <Brand />
      <ApplyForm questions={QUESTIONS} source={source} campaign={sp.utm_campaign ?? ""} />
    </main>
  );
}
