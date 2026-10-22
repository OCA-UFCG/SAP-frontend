import type { ReactNode } from "react";
import Image from "next/image";
import { LoginPhotoPanel } from "../Login/LoginPhotoPanel";

const BELOW_HEADER = "min-h-[calc(100vh-4.125rem)]";

export const PRIMARY_BUTTON =
  "font-open-sans flex h-[33px] w-full cursor-pointer items-center justify-center rounded-md bg-[#646B2D] px-3 py-1.5 text-[0.7281rem] leading-5 text-white transition hover:bg-[#4F5424] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B612A] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70";

export const SECONDARY_BUTTON =
  "font-open-sans flex h-[33px] w-full cursor-pointer items-center justify-center rounded-md border border-[#DBE0CC] px-3 py-1.5 text-[0.7281rem] leading-5 text-[#50554C] transition hover:bg-[#F3F5EE] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B612A] disabled:cursor-not-allowed disabled:opacity-70";

export const TEXT_LINK =
  "text-[0.75rem] leading-4 font-medium text-[#5B612A] underline underline-offset-2 hover:text-[#4F5424]";

export const ERROR_ALERT =
  "rounded-[7px] bg-[#FCE8E6] px-2.5 py-2 text-[0.8125rem] leading-5 text-[#B3261E]";

type PasswordResetLayoutProps = {
  backgroundImageUrl?: string;
  logoAlt: string;
  title: string;
  children: ReactNode;
};

/**
 * A moldura do login — foto à esquerda, coluna branca à direita — para as duas
 * telas do "esqueci minha senha". Quem sai do login para cá não deve sentir que
 * mudou de site.
 */
export function PasswordResetLayout({
  backgroundImageUrl,
  logoAlt,
  title,
  children,
}: PasswordResetLayoutProps) {
  return (
    <section className={`flex w-full items-stretch ${BELOW_HEADER}`}>
      <LoginPhotoPanel photoUrl={backgroundImageUrl} />

      <div className="flex w-full shrink-0 items-center justify-center bg-white px-[42px] py-16 lg:w-[495px] lg:border-l-4 lg:border-solid lg:border-[#EFEFEF]">
        <div className="flex w-[342px] max-w-full flex-col items-center gap-6">
          <div className="flex w-full flex-col items-center gap-16">
            <Image
              src="/green-sedes-logo.svg"
              alt={logoAlt}
              width={136}
              height={46}
              priority
              className="h-[110px] w-auto"
            />
            <h1 className="font-inter w-full text-[1.5rem] font-medium leading-7 tracking-[-0.36px] text-[#50554C]">
              {title}
            </h1>
          </div>

          {children}
        </div>
      </div>
    </section>
  );
}
