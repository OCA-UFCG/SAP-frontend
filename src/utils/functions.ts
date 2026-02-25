export const sortContentByDesiredOrder = <T extends { id: string }>(
  content: T[],
  desiredOrder: string[],
): T[] => {
  return [...content]
    .filter((item) => desiredOrder.includes(item.id))  // ← filtra antes
    .sort((a, b) => desiredOrder.indexOf(a.id) - desiredOrder.indexOf(b.id));
};