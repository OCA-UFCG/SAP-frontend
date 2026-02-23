export const sortContentByDesiredOrder = <T extends { id: string }>(
  content: T[],
  desiredOrder: string[],
): T[] => {
  return [...content].sort((a, b) => {
    const aIndex = desiredOrder.indexOf(a.id);
    const bIndex = desiredOrder.indexOf(b.id);

    return (
      (aIndex === -1 ? Infinity : aIndex) - (bIndex === -1 ? Infinity : bIndex)
    );
  });
};