import { Suspense } from "react";
import { ConfirmationPageClient } from "./ConfirmationPageClient";

export default function SignupConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-4.125rem)] items-center justify-center bg-white">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-[#989F43]" />
        </div>
      }
    >
      <ConfirmationPageClient />
    </Suspense>
  );
}
