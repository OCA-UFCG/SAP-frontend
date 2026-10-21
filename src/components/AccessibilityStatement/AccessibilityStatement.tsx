import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { sedesEmail } from "@/utils/constants";
import { AccessibilitySymbol } from "../AccessibilitySymbol/AccessibilitySymbol";
import {
  SEARCH_ACCESS_KEY,
  SKIP_TARGETS,
} from "../SkipLinks/skipTargets";

const SHORTCUTS = [
  { key: SKIP_TARGETS.content.accessKey, label: "content" },
  { key: SKIP_TARGETS.menu.accessKey, label: "menu" },
  { key: SEARCH_ACCESS_KEY, label: "search" },
  { key: SKIP_TARGETS.footer.accessKey, label: "footer" },
] as const;

const RESOURCES = ["vlibras", "keyboard", "zoom", "contrast", "tables"] as const;
const LIMITATIONS = ["maps", "cms", "documents"] as const;

const Section = ({
  id,
  heading,
  children,
}: {
  id: string;
  heading: string;
  children: ReactNode;
}) => (
  <section aria-labelledby={id} className="flex flex-col gap-3">
    <h2 id={id} className="text-2xl font-bold text-[#3F4324]">
      {heading}
    </h2>
    {children}
  </section>
);

const BulletList = ({ items }: { items: string[] }) => (
  <ul className="flex list-disc flex-col gap-2 pl-6">
    {items.map((item) => (
      <li key={item}>{item}</li>
    ))}
  </ul>
);

const ShortcutTable = () => {
  const t = useTranslations("Accessibility.shortcuts");
  return (
    <table className="w-full max-w-2xl border-collapse text-left">
      <thead>
        <tr className="border-b-2 border-[#5B612A]">
          <th scope="col" className="py-2 pr-6 font-semibold">
            {t("keyColumn")}
          </th>
          <th scope="col" className="py-2 font-semibold">
            {t("actionColumn")}
          </th>
        </tr>
      </thead>
      <tbody>
        {SHORTCUTS.map(({ key, label }) => (
          <tr key={key} className="border-b border-[#E4E5E2]">
            <td className="py-2 pr-6">
              <kbd className="rounded border border-[#C8CED1] bg-[#F6F7F6] px-2 py-0.5 font-mono">
                {key}
              </kbd>
            </td>
            <td className="py-2">{t(label)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

/**
 * A declaração de acessibilidade do portal: o compromisso com a LBI e o eMAG,
 * os atalhos de teclado, os recursos, os limites conhecidos e o canal para
 * avisar de uma barreira. Os atalhos vêm de `skipTargets`, os mesmos da barra
 * do topo, para a página nunca prometer uma tecla que não existe.
 *
 * @example
 * <AccessibilityStatement />
 */
export const AccessibilityStatement = () => {
  const t = useTranslations("Accessibility");

  return (
    <article className="w-full bg-white text-[#292829]">
      <header className="w-full bg-[#E1E2B4]">
        <div className="mx-auto flex min-h-29 w-full max-w-360 items-center gap-4 px-6 py-6 sm:px-10 lg:px-20">
          <AccessibilitySymbol className="h-10 w-10 shrink-0 text-[#3F4324]" />
          <h1 className="text-[2rem] font-bold leading-tight text-[#3F4324] sm:text-[2.5rem] lg:text-5xl">
            {t("title")}
          </h1>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-360 flex-col gap-10 px-6 py-9 text-base leading-7 sm:px-10 lg:px-20">
        <p className="max-w-3xl text-lg">{t("intro")}</p>

        <Section id="compromisso" heading={t("commitment.heading")}>
          <p className="max-w-3xl">{t("commitment.body")}</p>
        </Section>

        <Section id="atalhos" heading={t("shortcuts.heading")}>
          <p className="max-w-3xl">{t("shortcuts.intro")}</p>
          <ShortcutTable />
          <p className="max-w-3xl">{t("shortcuts.browsers")}</p>
        </Section>

        <Section id="recursos" heading={t("resources.heading")}>
          <BulletList items={RESOURCES.map((key) => t(`resources.${key}`))} />
        </Section>

        <Section id="limitacoes" heading={t("limitations.heading")}>
          <BulletList
            items={LIMITATIONS.map((key) => t(`limitations.${key}`))}
          />
        </Section>

        <Section id="reportar" heading={t("report.heading")}>
          <p className="max-w-3xl">
            {t.rich("report.body", {
              email: (chunks) => (
                <a
                  href={`mailto:${sedesEmail}`}
                  className="font-semibold text-[#3F4324] underline underline-offset-2 hover:no-underline"
                >
                  {chunks}
                </a>
              ),
              // O e-mail entra como valor, não como texto traduzido: é o mesmo
              // endereço em qualquer idioma.
              address: sedesEmail,
            })}
          </p>
        </Section>
      </div>
    </article>
  );
};
