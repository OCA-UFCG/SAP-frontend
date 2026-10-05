import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isSignupOffered } from "@/lib/access-flag";
import PlatformLoading from "@/app/[locale]/platform/loading";
import { ConfirmationPageClient } from "./ConfirmationPageClient";

export default function SignupConfirmationPage() {
  if (!isSignupOffered()) {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <main className="flex min-h-[calc(100vh-4.125rem)] w-full">
          <PlatformLoading />
        </main>
      }
    >
      <ConfirmationPageClient />
    </Suspense>
  );
}
