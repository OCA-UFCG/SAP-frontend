
const DemonstrationSection = () => {
  return (
    <section className="w-full bg-[#3F4324] relative overflow-hidden flex justify-center">
      <div 
        className="absolute inset-0 z-0 opacity-20 pointer-events-none"
        style={{ 
          backgroundImage: "url('/assets/mask-group-1.png')", 
          backgroundPosition: 'center',
          backgroundSize: 'cover' 
        }}
      />

      <div className="relative z-10 flex flex-col items-start w-full max-w-[1440px] px-20 py-12 gap-6">
        
        <h2 className="text-white font-inter font-semibold text-[30px] leading-tight">
          Demonstração
        </h2>

        <p className="text-white font-inter font-medium text-[16px] max-w-[800px]">
          O vídeo abaixo apresenta uma demonstração do funcionamento da ferramenta do SAP, 
          para mais detalhes entre em contato conosco através do e-mail no rodapé da nossa página!
        </p>
        
        <div className="w-full flex justify-center mt-2"> 
          <div className="w-full max-w-[954px] aspect-[954/515]">
            <iframe
              className="w-full h-full rounded-[15px] shadow-2xl bg-[#D9D9D9]"
              src="https://www.youtube.com/embed/placeholder-video-id"
              title="SAP Demonstration Video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default DemonstrationSection;