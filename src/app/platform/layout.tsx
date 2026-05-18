import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = (await cookies()).get("token")?.value;

  if (!token) 
    redirect("/login");
  
  return <>{children}</>;
}