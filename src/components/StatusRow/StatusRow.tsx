import { StatusItemI } from "../../utils/interfaces";
import { getContrastTextColor } from "@/utils/functions";

type Props = {
  item: StatusItemI;
};

export const StatusRow = ({ item }: Props) => {
  return (
    <div className="flex justify-between items-center min-h-10 pl-2 pr-0 bg-white rounded-lg gap-4 w-full">
      <div className="flex items-center gap-2">
        <span className="text-[14px] font-semibold">{item.label}</span>
      </div>

      <div
        style={{
          backgroundColor: item.color,
          color: getContrastTextColor(item.color),
        }}
        className="flex items-center justify-center min-w-17 min-h-10 rounded-lg text-[16px] font-semibold font-['Open_Sans']"
      >
        {item.value}%
      </div>
    </div>
  );
};
