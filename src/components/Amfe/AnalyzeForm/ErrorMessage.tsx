const ErrorMessage = ({
  children,
  id,
}: {
  children: React.ReactNode;
  id?: string;
}) => {
  return (
    <p id={id} className="mt-2 mr-1 text-sm text-red-600">
      {children}
    </p>
  );
};

export default ErrorMessage;
