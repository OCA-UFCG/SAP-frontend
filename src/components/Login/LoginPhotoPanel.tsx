// Gradiente do node 3182:7440 do Figma: escurece só o canto inferior direito,
// onde a foto encosta no painel branco do formulário.
const PHOTO_OVERLAY =
  "linear-gradient(129.48deg, rgba(0, 0, 0, 0) 20.57%, rgba(0, 0, 0, 0.8) 89.12%)";

const FALLBACK_PHOTO = "linear-gradient(129.48deg, #989F43, #4A4E26)";

export const LoginPhotoPanel = ({ photoUrl }: { photoUrl?: string }) => {
  const backgroundImage = photoUrl
    ? `${PHOTO_OVERLAY}, url("${photoUrl}")`
    : `${PHOTO_OVERLAY}, ${FALLBACK_PHOTO}`;

  return (
    <div
      aria-hidden
      className="hidden min-w-px flex-1 self-stretch bg-[#4A4E26] bg-cover bg-center lg:block"
      style={{ backgroundImage }}
    />
  );
};

export default LoginPhotoPanel;
