export const Icon = ({
  id,
  size,
  width,
  height,
  ...props
}: {
  id: string;
  size?: number;
  width?: number;
  height?: number;
} & React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      {...props}
      width={size ?? width}
      height={size ?? height}
    >
      <use href={`/sprite.svg#${id}`} />
    </svg>
  );
};
