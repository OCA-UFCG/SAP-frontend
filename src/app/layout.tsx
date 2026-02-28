import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cache } from "react";
import { Header } from "@/components/Header/Header";
import { Footer } from "@/components/Footer/Footer";
import { FooterI, ISections } from "@/utils/interfaces";
import { getContent } from "@/utils/contentful";
import { GET_FOOTER_PAGE } from "@/utils/queries";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

interface FooterContent {
  footerCollection: {
    items: FooterEntry[];
  };
}

interface FooterEntry {
  sys: { id: string };
  name: string;
  path: string;
  appears: boolean;
}
export const metadata: Metadata = {
  title: "Portal SAP",
  description: "Portal SAP criado por OCA",
};

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
      name: "Mapa",
      path: "/mapa",
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

  function mapFooterItem(item: FooterEntry): FooterI {
    return {
      id: item.sys.id,
      name: item.name,
      path: item.path,
      appears: item.appears,
    };
  }

  const getFooterContent = cache(async (): Promise<FooterI[]> => {
    try {
      const data = await getContent<FooterContent>(GET_FOOTER_PAGE);

      return data?.footerCollection?.items.map(mapFooterItem) ?? [];
    } catch (error) {
      console.error("Erro ao buscar footer:", error);
      return [];
    }
  });

  const footerContent = await getFooterContent();

  return (
    <html lang="en">
      <meta name="apple-mobile-web-app-title" content="Portal SAP" />
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <Header content={Object.values(headerContent)}></Header>
        <main className="flex-1 w-full">{children}</main>
        {footerContent.length > 0 && <Footer content={footerContent} />}
      </body>
    </html>
  );
}
