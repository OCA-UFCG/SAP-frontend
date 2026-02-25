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
      <div className="w-full max-w-3xl rounded-2xl overflow-hidden shadow-sm bg[#F6F7F6]">
        <div className="flex items-center">
          <div className="bg-[#F0F0D7] w-full h-10 flex items-center justify-center">
            <DoneSvg />
          </div>

          <div className="flex-1 px-8 py-6 bg-neutral-200">
            <p className="text-xl font-medium text-neutral-800">
              Região majoritariamente Sem seca
            </p>

            <p className="text-4xl font-bold text-lime-800 mt-2">
              {noDroughtAreaValue}%
            </p>
          </div>
        </div>
      </div>

      <div className="w-full max-w-3xl rounded-lg shadow-sm bg-[#FEE6C7] overflow-hidden">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 flex items-center justify-center bg-[#FECB89] rounded-full border border-black-500">
            <InfoSvg />
          </div>

          <div>
            <p className="text-lg font-medium text-neutral-800">
              Em observação {watchAreaValue}%
            </p> 
          </div>
        </div>
      </div>

      <div className="w-full max-w-3xl rounded-lg shadow-sm bg-[#E1E2B4] overflow-hidden">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 flex items-center justify-center bg-[#B4BA61] rounded-full border border-black-500">
            <LeafSvg />
          </div>

          <div>
            <p className="text-lg font-medium text-neutral-800">
              Em recuperação     {recoveryAreaValue}%
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default DataCards;
