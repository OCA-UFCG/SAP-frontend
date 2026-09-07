import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Open_Sans } from "next/font/google";
import { cache } from "react";
import { Header } from "@/components/Header/Header";
import { FooterSlot } from "@/components/Footer/FooterSlot";
import { getFooterContent } from "@/repositories/content/siteContentRepository";
import { ISections } from "@/utils/interfaces";
import { AuthProvider } from "@/contexts/AuthContext";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import "../globals.css";

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
  title: "Portal SEDES",
  description: "Portal SEDES criado por OCA",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-512x512.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

const getCachedFooterContent = cache(getFooterContent);

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();
  const t = await getTranslations("Footer");

  const headerContent: ISections = {
    "home-section": {
      id: "1",
      name: t("home"),
      path: "/",
      appears: true,
      childrenCollection: {
        items: [
          {
            id: "3-1",
            name: t("aboutMenu.planoDeAcaoBrasileiro"),
            path: "/#plano-de-acao-brasileiro",
            appears: true,
          },
          {
            id: "3-2",
            name: t("aboutMenu.grupoDeTrabalho"),
            path: "/#grupo-de-trabalho",
            appears: true,
          },
          {
            id: "3-3",
            name: t("aboutMenu.aPlataforma"),
            path: "/#a-plataforma",
            appears: true,
          },
          {
            id: "3-4",
            name: t("aboutMenu.usuarios"),
            path: "/#usuarios",
            appears: true,
          },
          {
            id: "3-5",
            name: t("aboutMenu.financiamento"),
            path: "/#financiamento",
            appears: true,
          },
        ],
      },
    },
    "glossary-section": {
      id: "5",
      name: t("glossary"),
      path: "/glossary",
      appears: true,
    },
    "map-section": {
      id: "2",
      name: t("platform"),
      path: "/platform",
      appears: true,
    },
    "contact-section": {
      id: "4",
      name: t("contact"),
      path: "/contact",
      appears: false,
    },
  };

  const footerContent = await getCachedFooterContent();

  return (
    <html lang={locale}>
      <meta name="apple-mobile-web-app-title" content="Portal SEDES" />
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${openSans.variable} antialiased min-h-screen flex flex-col`}
      >
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <Header
              content={Object.values(headerContent).filter(
                (item) => item.appears,
              )}
            ></Header>
            {/* Sem `min-h-0`: o rodapé fica depois do `main`, então encolher o
                conteúdo abaixo da altura que ele pede faria o rodapé subir por
                cima da plataforma em vez de esperar a rolagem. */}
            <main className="flex flex-col flex-1 w-full">{children}</main>
            <FooterSlot content={footerContent} />
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
