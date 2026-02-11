import { StatusItemI } from "@/utils/interfaces";

type Props = {
  item: StatusItemI;
};

export const StatusRow = ({ item }: Props) => {
  return (
    <div className="flex justify-between items-center h-[40px] pl-2 pr-0 bg-white rounded-[8px]">
      
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={item.checked}
          readOnly
          className="w-4 h-4 rounded-[4px] accent-[#5B612A]"
        />

        <span className="text-[12px] font-semibold leading-6 text-[#292829]">
          {item.label}
        </span>
      </div>

      <div
        className={`flex items-center justify-center w-[48px] h-[40px] rounded-[8px] text-[14px] font-semibold ${item.color}`}
      >
        {item.value}%
      </div>
    </div>
  );
};