import { useTranslations } from "next-intl";
import { Link } from "@/translations/routing";
import { SKIP_TARGETS, type SkipTargetName } from "./skipTargets";

const ORDER: SkipTargetName[] = ["content", "menu", "footer"];

// Fora da tela até receber foco: quem usa o mouse não vê a barra, e quem chega
// pelo Tab encontra os atalhos antes do cabeçalho.
const LINK_CLASS =
  "fixed left-2 top-2 z-[100] -translate-y-[200%] rounded-md bg-[#292829] px-4 py-2 text-sm font-semibold text-white shadow-lg focus:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#292829]";

/**
 * A barra de acessibilidade do eMAG: "Ir para o conteúdo [1]", "Ir para o
 * menu [2]", "Ir para o rodapé [4]" e o link da página de acessibilidade. É o
 * primeiro item da página na ordem do Tab.
 *
 * @example
 * <body><SkipLinks />...</body>
 */
export const SkipLinks = () => {
  const t = useTranslations("SkipLinks");

  return (
    <nav aria-label={t("label")}>
      {ORDER.map((name) => {
        const { id, accessKey } = SKIP_TARGETS[name];
        return (
          <a key={id} href={`#${id}`} accessKey={accessKey} className={LINK_CLASS}>
            {t(name)} <span aria-hidden="true">[{accessKey}]</span>
          </a>
        );
      })}
      <Link href="/acessibilidade" className={LINK_CLASS}>
        {t("accessibility")}
      </Link>
    </nav>
  );
};
