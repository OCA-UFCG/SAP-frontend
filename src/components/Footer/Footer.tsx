import { ISection } from "@/utils/interfaces";
import { channels } from "@/utils/constants";
import Image from "next/image";
import { Link } from "@/translations/routing";
import SocialChannels from "../ContactSection/SocialChannels";
import { useTranslations } from "next-intl";
import { AccessibilitySymbol } from "../AccessibilitySymbol/AccessibilitySymbol";
import { SKIP_TARGETS } from "../SkipLinks/skipTargets";
import { CookiePreferencesButton } from "../CookieConsent/CookiePreferencesButton";

// O mesmo ID que liga o aviso de cookies no layout: sem Analytics, não há o
// que escolher.
const HAS_ANALYTICS = Boolean(process.env.NEXT_PUBLIC_GA_ID);

export const Footer = ({ content }: { content: ISection[] }) => {
  const t = useTranslations("Footer");

  return (
    <footer
      id={SKIP_TARGETS.footer.id}
      tabIndex={-1}
      className="flex justify-center w-full bg-[#646B2D] focus:outline-none"
    >
      <div className="mx-auto flex w-full max-w-[1440px] flex-col items-start justify-between gap-6 box-border px-6 py-10 md:px-10 md:py-12 lg:flex-row lg:items-center lg:gap-[60px] lg:px-20 lg:py-12">
        <div className="flex justify-center w-full lg:w-auto">
          <Image
            width={136}
            height={46}
            src="/logo-sedes.svg"
            alt="SEDES"
            className="h-[57px] w-auto"
          />
        </div>
        <div className="flex w-full flex-col items-center gap-2 lg:min-h-8 lg:flex-1 lg:items-start lg:px-2">
          <div className="hidden flex-row items-center gap-6 lg:flex lg:min-h-8 lg:items-center">
            {content.map(({ id, name, path }) => (
              <Link
                key={id}
                href={path}
                className="text-sm font-bold leading-5 text-white transition-opacity hover:opacity-60"
              >
                {name}
              </Link>
            ))}
          </div>
          <p className="text-center text-xs leading-4 text-white lg:text-left">
            {t("institutions")}
          </p>
          {/* Fora da linha de links, que some no celular: o símbolo de
              acessibilidade precisa estar em destaque em qualquer tela
              (LBI, art. 63, §1º). */}
          <div className="mt-1 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 lg:justify-start">
            <Link
              href="/acessibilidade"
              className="flex items-center gap-2 rounded text-sm font-bold leading-5 text-white transition-opacity hover:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <AccessibilitySymbol className="h-6 w-6 shrink-0" />
              {t("accessibility")}
            </Link>
            {HAS_ANALYTICS && (
              <CookiePreferencesButton
                className="cursor-pointer rounded text-sm font-bold leading-5 text-white transition-opacity hover:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                label={t("cookies")}
              />
            )}
          </div>
        </div>

        {/* Logos e redes ficam na mesma linha porque o Figma prevê um rodapé de
            uma faixa só (153px): empilhá-los somava a altura das duas linhas e
            era o que fazia o rodapé roubar a tela na plataforma. */}
        <div className="flex w-full flex-wrap items-center justify-center gap-6 lg:ml-auto lg:w-auto lg:justify-end">
          <Image
            width="1004"
            height="325"
            src="/partners/mma-logo.png"
            alt="Ministério do Meio Ambiente e Mudança do Clima"
            className="h-10 w-auto brightness-0 invert"
          />
          <Image
            width="1485"
            height="755"
            src="/partners/oca.png"
            alt="Observatório da Caatinga e Desertificação"
            className="h-10 w-auto"
          />
          <SocialChannels channels={channels} size={32} />
        </div>
      </div>
    </footer>
  );
};

export default Footer;
