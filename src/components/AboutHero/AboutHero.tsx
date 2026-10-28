import Image from "next/image";
import { useTranslations } from "next-intl";
import { documentToReactComponents } from "@contentful/rich-text-react-renderer";
import { AboutPageSectionI } from "@/repositories/content/siteContentRepository";

type Props = {
  /** Entrada "topo" do Contentful; as fotos vão na ordem do design. */
  content: Pick<AboutPageSectionI, "title" | "text" | "images">;
};

/** Faixa escura do topo da página "Sobre Nós": texto à esquerda e colagem à direita. */
export const AboutHero = ({ content }: Props) => {
  // Português vem do Contentful; inglês e espanhol, das traduções.
  const t = useTranslations("AboutPage.hero");
  const [main, top, bottom] = content.images.map((image) => image.url);

  return (
    <section className="w-full bg-[#21240F]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-12 md:px-10 lg:flex-row lg:items-center lg:px-20 lg:py-16">
        <div className="flex flex-col gap-4 font-open-sans text-[#F8F7F8] lg:w-[628px] lg:shrink-0">
          <h1 className="text-[2rem] font-bold leading-9">
            {t.has("title") ? t("title") : content.title}
          </h1>
          <div className="flex flex-col gap-4 text-base leading-6">
            {t.has("text") ? (
              <p>
                {t.rich("text", { b: (chunks) => <strong>{chunks}</strong> })}
              </p>
            ) : (
              content.text && documentToReactComponents(content.text.json)
            )}
          </div>
        </div>

        {/* As fotos são decorativas: o texto ao lado já diz tudo. */}
        <div className="flex h-[268px] w-full gap-6 lg:flex-1">
          <div className="relative flex-1 overflow-hidden rounded-lg">
            {main && (
              <Image
                src={main}
                alt=""
                fill
                priority
                sizes="(max-width: 1024px) 50vw, 25vw"
                className="object-cover"
              />
            )}
          </div>
          <div className="flex flex-1 flex-col gap-6">
            <div className="relative flex-1 overflow-hidden rounded-lg">
              {top && (
                <Image
                  src={top}
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 50vw, 25vw"
                  className="object-cover"
                />
              )}
            </div>
            <div className="relative h-[146px] shrink-0 overflow-hidden rounded-lg">
              {bottom && (
                <Image
                  src={bottom}
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 50vw, 25vw"
                  className="object-cover"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutHero;
