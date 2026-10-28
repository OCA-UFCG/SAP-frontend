import Image from "next/image";
import { useTranslations } from "next-intl";

/** Fotos da colagem do topo, na ordem do design: a grande e as duas da direita. */
const PHOTOS = {
  main: "/sobre/topo-abraco.jpg",
  top: "/sobre/topo-roda.jpg",
  bottom: "/sobre/grupo-de-trabalho.jpg",
};

/** Faixa escura do topo da página "Sobre Nós": texto à esquerda e colagem à direita. */
export const AboutHero = () => {
  const t = useTranslations("AboutPage.hero");

  return (
    <section className="w-full bg-[#21240F]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-12 md:px-10 lg:flex-row lg:items-center lg:px-20 lg:py-16">
        <div className="flex flex-col gap-4 font-open-sans text-[#F8F7F8] lg:w-[628px] lg:shrink-0">
          <h1 className="text-[2rem] font-bold leading-9">{t("title")}</h1>
          <p className="text-base leading-6">
            {t.rich("text", { b: (chunks) => <strong>{chunks}</strong> })}
          </p>
        </div>

        {/* As fotos são decorativas: o texto ao lado já diz tudo. */}
        <div className="flex h-[268px] w-full gap-6 lg:flex-1">
          <div className="relative flex-1 overflow-hidden rounded-lg">
            <Image
              src={PHOTOS.main}
              alt=""
              fill
              priority
              sizes="(max-width: 1024px) 50vw, 25vw"
              className="object-cover"
            />
          </div>
          <div className="flex flex-1 flex-col gap-6">
            <div className="relative flex-1 overflow-hidden rounded-lg">
              <Image
                src={PHOTOS.top}
                alt=""
                fill
                sizes="(max-width: 1024px) 50vw, 25vw"
                className="object-cover"
              />
            </div>
            <div className="relative h-[146px] shrink-0 overflow-hidden rounded-lg">
              <Image
                src={PHOTOS.bottom}
                alt=""
                fill
                sizes="(max-width: 1024px) 50vw, 25vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutHero;
