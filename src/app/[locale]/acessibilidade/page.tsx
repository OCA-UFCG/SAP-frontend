import { AccessibilityStatement } from "@/components/AccessibilityStatement/AccessibilityStatement";
import { pageTitleMetadata } from "@/lib/page-metadata";

export const generateMetadata = pageTitleMetadata("accessibility");

export default function AccessibilityPage() {
  return <AccessibilityStatement />;
}
