import Image from "next/image";
import { ISectionHeader, IDemonstrationVideo } from "@/utils/interfaces";

interface DemonstrationSectionProps {
  header: ISectionHeader; 
  video: IDemonstrationVideo;
}

const DemonstrationSection = ({ header, video }: DemonstrationSectionProps) => {
  return (
    <section className="w-full bg-[#3F4324] relative overflow-hidden flex justify-center">
      <div
        className="absolute top-1/2 right-0 -translate-y-[78%] translate-x-[73%] opacity-[0.2] pointer-events-none"
      >
        <Image
          src="/solar_icon.png"
          alt=""
          width={1400}
          height={1400}
          className="w-[80vw] max-w-[1200px] min-w-[900px] h-auto scale-y-180 scale-x-150 max-w-none"
        />
      </div>

      <div className="relative z-10 flex flex-col items-start w-full max-w-[1440px] px-6 md:px-20 py-12 gap-6">
        <h2 className="text-white font-inter font-semibold text-[30px] leading-tight">
          {header.title}
        </h2>

        <p className="text-white font-inter font-medium text-[16px] max-w-[800px]">
          {header.description}
        </p>
        
        <div className="w-full flex justify-center mt-2"> 
          <div className="w-full max-w-[954px] aspect-video min-h-[200px]">
            <iframe
              className="w-full h-full rounded-[15px] shadow-2xl bg-[#D9D9D9]"
              src={video.linkDoVideo} 
              title="SAP Demonstration Video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default DemonstrationSection;