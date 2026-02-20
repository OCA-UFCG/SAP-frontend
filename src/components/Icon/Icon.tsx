import Image from 'next/image';

export const Icon = ({
  id,
  size,
  width,
  height,
  onClick,
  ...props
}: {
  id: string;
  size?: number;
  width?: number;
  height?: number;
  props?: object;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onClick?: (arg0: any) => void;
  className?: string;
}) => {
  const dimensions = {
    width: size || width || 24,
    height: size || height || 24,
  };
  return (
    <Image
      src={`/${id}.svg`}
      alt={id}
      onClick={onClick}
      width={dimensions.width}
      height={dimensions.height}
      {...props}
    />
  );
};
