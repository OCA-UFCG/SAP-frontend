const ErrorMessage = ({ children }: { children: React.ReactNode }) => {
  return <p className="mt-2 mr-1 text-sm text-red-600">{children}</p>;
};

export default ErrorMessage;
