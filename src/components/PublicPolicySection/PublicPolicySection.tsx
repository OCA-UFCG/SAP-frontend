import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/translations/routing";

type Props = {
  id?: string;
};

// Fotos recortadas do design da home (Figma), duas colunas de duas fotos.
// width/height são o tamanho do arquivo; a proporção é a do design.
const COLUMNS = [
  [
    { src: "/home/colagem-1.jpg", width: 872, height: 346 },
    { src: "/home/colagem-2.jpg", width: 872, height: 520 },
  ],
  [
    { src: "/home/colagem-3.jpg", width: 648, height: 574 },
    { src: "/home/colagem-4.jpg", width: 648, height: 292 },
  ],
];

/** "Um instrumento de política pública": colagem de fotos e o texto da lei. */
export const PublicPolicySection = ({ id }: Props) => {
  const t = useTranslations("PublicPolicySection");

  return (
    <section id={id} className="w-full scroll-mt-16.5 bg-white">
      <div className="mx-auto grid w-full max-w-[1440px] items-center gap-6 px-4 py-12 md:px-10 lg:grid-cols-[790fr_466fr] lg:px-20">
        <div className="grid grid-cols-[439fr_327fr] gap-6">
          {COLUMNS.map((photos, column) => (
            <div key={column} className="flex flex-col gap-6">
              {photos.map((photo) => (
                <Image
                  key={photo.src}
                  src={photo.src}
                  alt=""
                  width={photo.width}
                  height={photo.height}
                  sizes="(max-width: 1024px) 50vw, 440px"
                  className="h-auto w-full rounded-md object-cover"
                />
              ))}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4 font-inter text-[#292829]">
          <h2 className="text-[30px] font-semibold leading-9 tracking-[-0.0075em]">
            {t("title")}
          </h2>
          <p className="text-sm leading-6">{t("text")}</p>
          <Link
            href="/platform"
            className="mt-2 flex h-10 w-full items-center justify-center rounded-md bg-[#989F43] px-4 py-2 text-sm font-medium leading-6 text-[#F8F7F8] transition-colors hover:bg-[#5B612A]"
          >
            {t("button")}
          </Link>
        </div>
      </div>
    </section>
  );
};

export default PublicPolicySection;
