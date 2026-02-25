import { DataCardsValueProps } from "@/utils/interfaces";
import DoneSvg from "../../../public/Done";
import InfoSvg from "../../../public/Info";
import LeafSvg from "../../../public/Leaf";

const DataCards = ({
  noDroughtAreaValue,
  watchAreaValue,
  recoveryAreaValue,
}: DataCardsValueProps) => {
  return (
    <>
    <div className="flex flex-col gap-3">
      <div className="w-full flex max-w-3xl rounded-lg overflow-hidden shadow-sm bg[#F6F7F6] ">
       <div className="flex items-stretch overflow-hidden">
          <div className="bg-[#F0F0D7] w-20 flex items-center justify-center">
            <DoneSvg />
          </div>

          <div className="flex-1 px-8 py-6 bg-neutral-200 flex flex-col justify-center">
            <p className="text-xl font-medium text-neutral-800">
              Região majoritariamente Sem seca
            </p>

           <p className="text-3xl font-bold text-[#5B612A] mt-2 self-center">
              {noDroughtAreaValue}%
            </p>
          </div>
        </div>
      </div>

      <div className="w-full max-w-3xl rounded-lg shadow-sm bg-[#FEE6C7] overflow-hidden">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 flex items-center justify-center bg-[#FECB89] rounded-lg border-2 border-black">
            <InfoSvg />
          </div>

          <div>
            <p className="text-lg font-medium text-neutral-800">
              {watchAreaValue}% em observação
            </p> 
          </div>
        </div>
      </div>

      <div className="w-full max-w-3xl rounded-lg shadow-sm bg-[#E1E2B4] overflow-hidden">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 flex items-center justify-center bg-[#B4BA61] rounded-lg border-2 border-black">
            <LeafSvg />
          </div>

          <div>
            <p className="text-lg font-medium text-neutral-800">
               {recoveryAreaValue}% em recuperação
            </p>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default DataCards;
