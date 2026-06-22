import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  verifyFirebaseSessionCookie,
} from "@/lib/server-session";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessionCookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    redirect("/login");
  }

  const isAuthenticated = await verifyFirebaseSessionCookie(sessionCookie);

  if (!isAuthenticated) {
    redirect("/login");
  }

  return <>{children}</>;
}
