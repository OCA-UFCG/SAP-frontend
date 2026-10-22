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
  // Decorativo por padrão: quase sempre vem ao lado de um texto ou dentro de
  // um botão que já tem nome. Quem passa `aria-label` torna o ícone legível.
  return (
    <svg
      aria-hidden={props["aria-label"] ? undefined : true}
      {...props}
      width={size ?? width}
      height={size ?? height}
    >
      <use href={`/sprite.svg#${id}`} />
    </svg>
  );
};
