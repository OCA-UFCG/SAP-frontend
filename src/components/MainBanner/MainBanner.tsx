import Image from "next/image";

export function MainBanner() {
  return (
    <section className="relative w-full max-w-[1440px] mx-auto h-auto lg:h-[492px] pt-[48px] lg:pt-[64px] pb-[48px] lg:pb-[64px] px-6 lg:px-[80px] overflow-hidden">
      <div className="absolute inset-0 w-full h-full z-0 overflow-hidden">
        <Image
          src="/banner.png"
          alt="Sistema de Alerta Precoce"
          fill
          priority
          unoptimized 
          className="object-cover object-center"
        />

        <div 
          className="absolute inset-0 z-10"
          style={{
            background: "linear-gradient(270deg, rgba(0, 0, 0, 0.05) 19.23%, #4A4E26 65.38%)"
          }}
        />
      </div>

      <div className="absolute opacity-[0.05] right-[55%] top-[-30%]">
        <Image
          src="/solar_icon.png" 
          alt=""
          width={750} 
          height={750}
          className="max-w-none w-[800px] lg:w-[1000px] h-auto"
        />
      </div>

      <div className="relative z-20 w-full h-full flex items-center">
        <div className="w-full">
          <div className="flex flex-col gap-[24px] max-w-[800px] items-start text-left">
            <h1 className="font-open font-[700] text-white text-3xl md:text-5xl lg:text-[64px] leading-tight drop-shadow-sm">
              Sistema de Alerta Precoce de Seca e Desertificação
            </h1>

            <p className="font-open font-[400] text-white text-base md:text-[16px] leading-relaxed max-w-[600px]">
              O SAP integra dados climáticos, ambientais e socioeconômicos para monitorar, analisar e antecipar riscos de seca e desertificação, 
              apoiando decisões estratégicas e ações de resposta.
            </p>

            <button
              type="button"
              className="mt-4 flex items-center justify-center w-full md:w-[302px] h-[40px] px-4 py-2 rounded-[8px] bg-[#989F43] hover:bg-[#5B612A] text-white transition-all duration-200 shadow-md active:scale-95"
            >
              <span className="font-open text-[14px] font-[500] leading-[24px] tracking-normal">
                Explorar o Mapa Interativo
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
