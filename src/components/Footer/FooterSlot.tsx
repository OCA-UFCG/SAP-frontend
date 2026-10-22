"use client";

import { Footer } from "./Footer";
import type { ISection } from "@/utils/interfaces";

export function FooterSlot({ content }: { content: ISection[] }) {
  return <Footer content={content} />;
}
