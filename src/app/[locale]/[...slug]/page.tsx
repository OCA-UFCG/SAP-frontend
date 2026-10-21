import { EmptyState } from "@/components/EmptyState/EmptyState";
import { pageTitleMetadata } from "@/lib/page-metadata";

export const generateMetadata = pageTitleMetadata("comingSoon");

export default function CatchAllNotReadyPage() {
  return <EmptyState />;
}
