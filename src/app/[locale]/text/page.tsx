import { GoogleDocsRegexReader } from "@/components/GoogleDocsRegexReader/GoogleDocsRegexReader";

export default function TextPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <GoogleDocsRegexReader />
    </main>
  );
}
