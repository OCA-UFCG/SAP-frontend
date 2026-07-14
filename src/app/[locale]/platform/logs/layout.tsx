import { redirect } from "next/navigation";

export default async function PlatformLogsLayout() {
  redirect("/platform?view=logs");
}
