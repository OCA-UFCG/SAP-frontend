import { FunctionComponent as FC } from "react";

interface IProps {
  toggle: () => void;
}

export const Hamburguer: FC<IProps> = ({ toggle }) => {
  return (
    <div className="flex flex-col w-[30px] h-[20px] gap-1 items-center justify-center" onClick={toggle}>
      <span className="bg-black h-[4px] w-full"></span>
      <span className="bg-black h-[4px] w-full"></span>
      <span className="bg-black h-[4px] w-full"></span>
    </div>
  );
};
