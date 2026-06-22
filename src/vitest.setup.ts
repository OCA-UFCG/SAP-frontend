import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
import fs from "fs";
import path from "path";
import React from "react";

type TranslationMessage = string | { [key: string]: TranslationMessage };
type TranslationDictionary = Record<string, TranslationMessage>;

function getNestedValue(
  obj: TranslationMessage | TranslationDictionary | undefined,
  keyPath: string,
): TranslationMessage | undefined {
  if (!obj) return undefined;
  const keys = keyPath.split(".");
  let current: TranslationMessage | TranslationDictionary | undefined = obj;
  for (const k of keys) {
    if (current && typeof current === "object" && k in current) {
      current = (current as Record<string, TranslationMessage>)[k];
    } else {
      return undefined;
    }
  }
  return current as TranslationMessage | undefined;
}

const ptMessages: TranslationDictionary = {};
try {
  const localeDir = path.join(__dirname, "translations/pt");
  const files = fs.readdirSync(localeDir).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const filePath = path.join(localeDir, file);
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(fileContent) as TranslationDictionary;
    Object.assign(ptMessages, data);
  }
} catch (err) {
  console.error("Failed to load pt messages in vitest setup", err);
}

vi.mock("next-intl", () => {
  return {
    useTranslations: (namespace?: string) => {
      const translateFn = (key: string, values?: Record<string, string | number | boolean>) => {
        let message = key;
        
        const namespaceObj = namespace ? ptMessages[namespace] : ptMessages;
        const resolved = getNestedValue(namespaceObj, key);
        
        if (resolved !== undefined && typeof resolved === "string") {
          message = resolved;
        }

        if (values) {
          let result = message;
          for (const [k, v] of Object.entries(values)) {
            result = result.replace(`{${k}}`, String(v));
          }
          return result;
        }
        return message;
      };

      translateFn.has = (key: string) => {
        const namespaceObj = namespace ? ptMessages[namespace] : ptMessages;
        return getNestedValue(namespaceObj, key) !== undefined;
      };

      return translateFn;
    },
    useLocale: () => "pt",
  };
});

vi.mock("next-intl/server", () => {
  const translateFn = (key: string, values?: Record<string, string | number | boolean>) => {
    let message = key;
    
    const resolved = getNestedValue(ptMessages, key);
    if (resolved !== undefined && typeof resolved === "string") {
      message = resolved;
    }

    if (values) {
      let result = message;
      for (const [k, v] of Object.entries(values)) {
        result = result.replace(`{${k}}`, String(v));
      }
      return result;
    }
    return message;
  };

  return {
    getTranslations: async (namespace?: string) => {
      if (namespace) {
        return (key: string, values?: Record<string, string | number | boolean>) => translateFn(`${namespace}.${key}`, values);
      }
      return translateFn;
    },
    getLocale: async () => "pt",
  };
});

vi.mock("@/translations/routing", () => {
  return {
    Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
      return React.createElement("a", { href, ...props }, children);
    },
    usePathname: () => "/",
    useRouter: () => ({
      push: () => {},
      replace: () => {},
      prefetch: () => {},
      back: () => {},
    }),
    redirect: (url: string) => {
      throw new Error(`redirect:${url}`);
    },
  };
});
