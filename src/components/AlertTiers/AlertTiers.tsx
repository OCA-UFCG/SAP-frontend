'use client';

import { StatusItemI } from "@/utils/interfaces";
import { StatusRow } from "../StatusRow/StatusRow";

type Props = {
  items: StatusItemI[];
};

export const AlertTiers = ({ items }: Props) => {
  return (
    <div className="w-[464px] p-4 bg-[#F6F7F6] border border-[#E4E5E2] rounded-[8px]">
      <h1>Teste</h1>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <StatusRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
};