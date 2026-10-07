"use client";

import { Footer } from "./Footer";
import type { FooterI } from "@/utils/interfaces";

export function FooterSlot({ content }: { content: FooterI[] }) {
  if (content.length === 0) {
    return null;
  }

  return <Footer content={content} />;
}
