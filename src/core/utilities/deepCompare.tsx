// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const arraysEqual = (a: any[], b: any[]) => {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    const objA = a[i];
    const objB = b[i];

    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (objA[key] !== objB[key]) return false;
    }
  }

  return true;
};
