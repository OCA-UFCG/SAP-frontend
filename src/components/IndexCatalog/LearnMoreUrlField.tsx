"use client";

/**
 * O link do botão "Saiba mais", que aparece no quadro de informações do índice
 * no Monitoramento.
 *
 * Tem botão próprio de gravar pelo mesmo motivo do texto do relatório: no
 * formulário completo, "Salvar rascunho" derruba a validação, e trocar um link
 * não pode obrigar a conferir os assets de novo. Os botões de salvar de cada
 * formulário também gravam o link, para nada que está na tela ficar para trás.
 *
 * Vive num componente próprio porque os dois formulários do catálogo — o
 * completo e o do índice legado adotado — editam o mesmo campo.
 */
export function LearnMoreUrlField({
  value,
  onChange,
  onSave,
  disabled,
  inputClass,
  buttonClass,
}: {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  disabled: boolean;
  inputClass: string;
  buttonClass: string;
}) {
  const trimmed = value.trim();
  const invalid = trimmed !== "" && !/^https?:\/\/\S+$/iu.test(trimmed);

  return (
    <div className="md:col-span-2">
      <label className="text-sm font-medium">
        Link do Saiba mais
        <input
          className={inputClass}
          type="url"
          inputMode="url"
          placeholder="https://"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      {invalid ? (
        <p className="mt-1 text-xs text-red-700">
          Use o endereço completo, começando com https:// — copie da barra do
          navegador.
        </p>
      ) : (
        <p className="mt-1 text-xs text-stone-500">
          Página de fora da plataforma com mais informações sobre o índice
          (metodologia, fonte dos dados). O botão “Saiba mais” do quadro de
          informações abre esse endereço numa aba nova. Vazio tira o botão. Como
          a plataforma lê a versão publicada do índice, o link novo aparece lá
          na próxima publicação.
        </p>
      )}
      <button
        type="button"
        className={`${buttonClass} mt-2 border border-stone-300`}
        disabled={disabled || invalid}
        onClick={onSave}
      >
        Salvar link
      </button>
    </div>
  );
}
