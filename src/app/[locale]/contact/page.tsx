import ContactSection from "@/components/ContactSection/ContactSection";
import { pageTitleMetadata } from "@/lib/page-metadata";

export const generateMetadata = pageTitleMetadata("contact");

export default function ContactPage() {
  return (
    <div className="w-full flex justify-center bg-white">
      <ContactSection />
    </div>
  );
}
