"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

export function ProtectedRoute({
  children,
  redirectTo = "/platform",
}: {
  children: ReactNode;
  redirectTo?: string;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push(`/login?redirect=${encodeURIComponent(redirectTo)}`);
    }
  }, [user, loading, redirectTo, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#777E32]" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
