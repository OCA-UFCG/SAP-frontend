/** `htmlFor` liga o rótulo ao campo: o leitor de tela lê o nome ao focar. */
const InputLabel = ({ title, htmlFor }: { title: string; htmlFor?: string }) => {
  return (
    <label htmlFor={htmlFor} className="text-sm-400 font-bold">
      {title}
    </label>
  );
};

export default InputLabel;
