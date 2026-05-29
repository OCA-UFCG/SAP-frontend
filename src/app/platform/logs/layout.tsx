import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { resolveLogsViewerAccess } from "@/lib/logs-access";
import { SESSION_COOKIE_NAME } from "@/lib/server-session";

export default async function PlatformLogsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessionCookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const access = await resolveLogsViewerAccess(sessionCookie);

  if (access === "unauthenticated") {
    redirect("/login");
  }

  if (access === "forbidden") {
    notFound();
  }

  return <>{children}</>;
}
