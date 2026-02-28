import { channels } from "@/utils/constants";
import SocialChannels from "./SocialChannels";

const ContactSection = () => {
  return (
    <section id="contact" className="w-full bg-white">
      <div className="w-full bg-[#E1E2B4]">
        <div className="w-full max-w-[1440px] mx-auto">
          <div className="bg-[#E1E2B4] h-[117px] px-6 sm:px-10 lg:px-[80px] flex items-center">
            <h2 className="font-bold text-[32px] sm:text-[40px] lg:text-[48px] leading-tight text-[#3F4324]">
              Contatos
            </h2>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-[80px] pt-[36px] pb-[36px] flex flex-col gap-[36px]">
        <div className="flex flex-col gap-[32px]">
          <p className="text-[18px] sm:text-[20px] lg:text-[24px] font-semibold text-[#292829]">
            Nos acompanhe nas redes sociais!
          </p>
          <SocialChannels channels={channels} size={32} displayName={true} />
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
