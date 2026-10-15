const ErrorMessage = ({ children }: { children: React.ReactNode }) => {
  return <p className="mt-1 text-xs text-red-700">{children}</p>;
};

export default ErrorMessage;
