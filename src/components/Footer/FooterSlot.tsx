"use client";

import { usePathname } from "next/navigation";
import { Footer } from "./Footer";
import type { FooterI } from "@/utils/interfaces";

function shouldHideFooter(pathname: string) {
  return pathname === "/platform" || pathname.startsWith("/platform/");
}

export function FooterSlot({ content }: { content: FooterI[] }) {
  const pathname = usePathname();

  if (content.length === 0 || shouldHideFooter(pathname)) {
    return null;
  }

  return <Footer content={content} />;
}
