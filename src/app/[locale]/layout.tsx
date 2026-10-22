import type { Metadata } from "next";
import { Inter, Open_Sans } from "next/font/google";
import { Header } from "@/components/Header/Header";
import { FooterSlot } from "@/components/Footer/FooterSlot";
import { ISections } from "@/utils/interfaces";
import { AuthProvider } from "@/contexts/AuthContext";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { SkipLinks } from "@/components/SkipLinks/SkipLinks";
import { SKIP_TARGETS } from "@/components/SkipLinks/skipTargets";
import { VLibras } from "@/components/VLibras/VLibras";
import { siteTitleMetadata } from "@/lib/page-metadata";
import "../globals.css";

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { ...(await siteTitleMetadata(locale)), icons: SITE_ICONS };
}

const SITE_ICONS: Metadata["icons"] = {
  icon: [
    { url: "/favicon.svg", type: "image/svg+xml" },
    { url: "/favicon-512x512.png", sizes: "512x512", type: "image/png" },
    { url: "/favicon.ico", sizes: "any" },
  ],
  apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
};

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
      name: t("aboutShort"),
      path: "/",
      appears: true,
      childrenCollection: {
        items: [
          {
            id: "3-2",
            name: t("aboutMenu.aPlataforma"),
            path: "/#a-plataforma",
            appears: true,
          },
          {
            id: "3-3",
            name: t("aboutMenu.politicaPublica"),
            path: "/#politica-publica",
            appears: true,
          },
          {
            id: "3-1",
            name: t("aboutMenu.novidades"),
            path: "/#novidades",
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
            name: t("aboutMenu.instituicoes"),
            path: "/#instituicoes",
            appears: true,
          },
        ],
      },
    },
    "about-section": {
      id: "3",
      name: t("about"),
      path: "/sobre-o-sedes",
      appears: true,
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

  const navigation = Object.values(headerContent).filter(
    (item) => item.appears,
  );

  return (
    <html lang={locale} data-scroll-behavior="smooth">
      <meta name="apple-mobile-web-app-title" content="Portal SEDES" />
      <body
        className={`${inter.variable} ${openSans.variable} antialiased min-h-screen flex flex-col`}
      >
        <NextIntlClientProvider messages={messages}>
          <SkipLinks />
          <AuthProvider>
            <Header content={navigation}></Header>
            {/* Sem `min-h-0`: o rodapé fica depois do `main`, então encolher o
                conteúdo abaixo da altura que ele pede faria o rodapé subir por
                cima da plataforma em vez de esperar a rolagem. */}
            {/* `tabIndex={-1}` deixa o "Ir para o conteúdo" pôr o foco aqui:
                sem ele o navegador rola a página, mas o próximo Tab volta ao
                cabeçalho. */}
            <main
              id={SKIP_TARGETS.content.id}
              tabIndex={-1}
              className="flex flex-col flex-1 w-full focus:outline-none"
            >
              {children}
            </main>
            <FooterSlot content={navigation} />
          </AuthProvider>
        </NextIntlClientProvider>
        <VLibras />
      </body>
    </html>
  );
}
