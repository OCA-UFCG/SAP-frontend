import Image from "next/image";
import { Link } from "@/translations/routing";
import { Reveal } from "@/components/HomeMotion/HomeMotion";
import { revealOrder } from "@/components/HomeMotion/revealOrder";
import { BlurPreview } from "@/components/BlurPreview/BlurPreview";
import type { BlurPreviews } from "@/services/blurPreviews";

type Props = {
  id?: string;
  title: string;
  text: string;
  buttonText: string;
  /** Fotos do Contentful, na ordem dos espaços; o que faltar usa a do código. */
  images?: string[];
  /** Prévias borradas das fotos, por endereço (`getBlurPreviews`). */
  previews?: BlurPreviews;
};

// Fotos recortadas do design da home (Figma), duas colunas de duas fotos.
// width/height dão a proporção de cada espaço; uma foto do Contentful com
// outra proporção é cortada para caber.
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
export const PublicPolicySection = ({
  id,
  title,
  text,
  buttonText,
  images = [],
  previews = {},
}: Props) => {
  return (
    <section id={id} className="w-full scroll-mt-16.5 bg-white">
      <Reveal className="mx-auto grid w-full max-w-[1440px] items-center gap-6 px-4 py-12 md:px-10 lg:grid-cols-[790fr_466fr] lg:px-20">
        <div className="grid grid-cols-[439fr_327fr] gap-6">
          {COLUMNS.map((photos, column) => (
            <div key={column} className="flex flex-col gap-6">
              {photos.map((photo, row) => (
                <div
                  key={photo.src}
                  className="reveal-item group relative w-full overflow-hidden rounded-lg border border-[#EFEFEF] bg-[#E4E5E2] transition-[translate,box-shadow] duration-300 hover:shadow-[0_16px_32px_rgba(63,67,36,0.2)] motion-safe:hover:-translate-y-1"
                  style={{
                    aspectRatio: `${photo.width} / ${photo.height}`,
                    ...revealOrder(column + row * 2),
                  }}
                >
                  <BlurPreview
                    src={previews[images[column * photos.length + row] ?? ""]}
                  />
                  <Image
                    src={images[column * photos.length + row] ?? photo.src}
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 50vw, 440px"
                    className="object-cover transition-[scale] duration-700 ease-out motion-safe:group-hover:scale-110"
                  />
                </div>
              ))}
            </div>
          ))}
        </div>

        <div
          className="reveal-item flex flex-col gap-6 font-inter text-[#292829]"
          style={revealOrder(2)}
        >
          <h2 className="text-[1.875rem] font-semibold leading-9 tracking-[-0.0075em]">
            {title}
          </h2>
          <p className="text-sm leading-6">{text}</p>
          <Link
            href="/platform"
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#646B2D] px-4 py-2 text-sm leading-6 text-[#F8F7F8] transition-[background-color,box-shadow,scale] hover:bg-[#4F5424] hover:shadow-[0_8px_24px_rgba(152,159,67,0.45)] active:scale-[0.97] motion-safe:hover:scale-[1.02]"
          >
            {buttonText}
          </Link>
        </div>
      </Reveal>
    </section>
  );
};

export default PublicPolicySection;
