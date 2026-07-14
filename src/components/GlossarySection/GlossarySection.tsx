import { useTranslations } from "next-intl";
import { GlossaryTermI } from "@/repositories/content/siteContentRepository";

type Props = {
  terms: GlossaryTermI[];
};

export const GlossarySection = ({ terms }: Props) => {
  const t = useTranslations("Glossary");

  return (
    <section className="w-full bg-white">
      <div className="w-full bg-[#E1E2B4]">
        <div className="w-full max-w-[1440px] mx-auto">
          <div className="w-full bg-[#E1E2B4] h-[117px] px-6 sm:px-10 lg:px-[80px] flex items-center">
            <h1 className="font-bold text-[32px] sm:text-[40px] lg:text-[48px] leading-tight text-[#3F4324]">
              {t("title")}
            </h1>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-[80px] pt-[36px] pb-[36px]">
        {terms.length === 0 ? (
          <p className="text-[16px] text-[#292829]">{t("empty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#E4E5E2]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F6F7F6]">
                  <th className="px-5 py-4 text-sm font-bold uppercase tracking-wide text-[#989F43] w-1/3">
                    {t("term")}
                  </th>
                  <th className="px-5 py-4 text-sm font-bold uppercase tracking-wide text-[#989F43]">
                    {t("definition")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {terms.map((term) => (
                  <tr key={term.id} className="border-t border-[#E4E5E2]">
                    <td className="px-5 py-4 align-top font-bold text-[#21240F]">
                      {term.term}
                    </td>
                    <td className="px-5 py-4 align-top text-[15px] leading-[150%] text-[#292829]">
                      {term.definition}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

export default GlossarySection;
