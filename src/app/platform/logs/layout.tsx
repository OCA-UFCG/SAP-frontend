import { redirect } from "next/navigation";

export default async function PlatformLogsLayout({
  children: _children,
}: {
  children: React.ReactNode;
}) {
  redirect("/platform?view=logs");
}
