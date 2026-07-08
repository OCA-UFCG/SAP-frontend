import { defineRouting } from "next-intl/routing";

// Keep this module Edge-safe. Middleware imports it directly, so it must not
// pull server translation loading or navigation helpers into the Edge bundle.
export const routing = defineRouting({
  locales: ["pt", "en", "es"],
  defaultLocale: "pt",
  localePrefix: "always",
});
