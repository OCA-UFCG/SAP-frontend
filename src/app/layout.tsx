import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Open_Sans } from "next/font/google";
import { cache } from "react";
import { Header } from "@/components/Header/Header";
import { Footer } from "@/components/Footer/Footer";
import { getFooterContent } from "@/repositories/content/siteContentRepository";
import { ISections } from "@/utils/interfaces";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Portal SAP",
  description: "Portal SAP criado por OCA",
};

const getCachedFooterContent = cache(getFooterContent);

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerContent: ISections = {
    "home-section": {
      id: "1",
      name: "Home",
      path: "/",
      appears: true,
    },
    "map-section": {
      id: "2",
      name: "Plataforma",
      path: "/platform",
      appears: true,
    },
    "about-section": {
      id: "3",
      name: "Sobre o SAP",
      path: "/sobre-o-sap",
      appears: true,
    },
    "contact-section": {
      id: "4",
      name: "Contatos",
      path: "/contact",
      appears: true,
    },
  };

  const footerContent = await getCachedFooterContent();

  return (
    <html lang="en">
      <meta name="apple-mobile-web-app-title" content="Portal SAP" />
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${openSans.variable} antialiased min-h-screen flex flex-col`}
      >
        <Header content={Object.values(headerContent)}></Header>
        <main className="flex-1 w-full">{children}</main>
        {footerContent.length > 0 && <Footer content={footerContent} />}
      </body>
    </html>
  );
}
