import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import fs from "fs";
import path from "path";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !(routing.locales as readonly string[]).includes(locale)) {
    locale = routing.defaultLocale;
  }

  const messages: Record<string, unknown> = {};
  try {
    const localeDir = path.join(process.cwd(), "src/translations", locale);
    const files = fs.readdirSync(localeDir).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
      const filePath = path.join(localeDir, file);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(fileContent);
      Object.assign(messages, data);
    }
  } catch (err) {
    console.error(`Failed to load messages for locale ${locale}`, err);
  }

  return {
    locale,
    messages,
  };
});
