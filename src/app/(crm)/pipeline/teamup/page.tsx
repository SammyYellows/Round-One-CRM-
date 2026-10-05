import { PipelineBoard } from "@/components/PipelineBoard";

// Everyone synced from TeamUp: members, ex-members and the people who made
// an account and never joined, by when they came in.
export default function TeamUpPipelinePage() {
  return <PipelineBoard kind="teamup" />;
}
