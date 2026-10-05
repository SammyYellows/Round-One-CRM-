import { PipelineBoard } from "@/components/PipelineBoard";

// Everyone who came in through ads, the form, walk-ins, referrals, WhatsApp
// or email. TeamUp people have their own pipeline at /pipeline/teamup.
export default function MetaPipelinePage() {
  return <PipelineBoard kind="meta" />;
}
