import { redirect } from "next/navigation";

// The old address for Train Champ (renamed 10/10/2026).
export default function OldKnowledgePage() {
  redirect("/champ/train");
}
