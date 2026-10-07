export const getErrorMessage = (error: unknown): string => {
  if (typeof error === "string") return error;

  if (Array.isArray(error)) {
    return error.map(getErrorMessage).join("; ");
  }

  if (error && typeof error === "object") {
    const {
      msg,
      message,
      detail,
      error: nestedError,
    } = error as Record<string, unknown>;

    if (typeof msg === "string") return msg;
    if (message !== undefined) return getErrorMessage(message);
    if (detail !== undefined) return getErrorMessage(detail);
    if (nestedError !== undefined) return getErrorMessage(nestedError);
  }

  return "Unknown backend error";
};
