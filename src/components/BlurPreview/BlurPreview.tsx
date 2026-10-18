/**
 * A foto em 6 px, ampliada e borrada, no lugar dela enquanto ela chega: no
 * celular lento, em vez de um buraco cinza (ou preto, no banner), aparecem na
 * hora as cores e a forma da foto. Vai antes da `<Image fill>` no mesmo
 * contêiner, que precisa ter `relative` e `overflow-hidden`; a foto, quando
 * chega, cobre a prévia.
 *
 * @example
 * <div className="relative overflow-hidden">
 *   <BlurPreview src={previews[photo]} />
 *   <Image src={photo} fill alt="" />
 * </div>
 */
export function BlurPreview({ src }: { src?: string }) {
  if (!src) return null;

  return (
    <div
      aria-hidden
      // `scale-125` esconde a borda clara que o desfoque cria nas beiradas.
      className="absolute inset-0 scale-125 bg-cover bg-center blur-xl"
      style={{ backgroundImage: `url(${src})` }}
    />
  );
}
