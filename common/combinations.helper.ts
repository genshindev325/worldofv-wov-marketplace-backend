const crossProduct = (xss: any) => {
  return xss.reduce(
    (xs: any, ys: any) => xs.flatMap((x: any) => ys.map((y: any) => [...x, y])),
    [[]],
  );
};

export const getCombinations = (
  o: any,
  keys = Object.keys(o),
  vals = Object.values(o),
) => {
  return crossProduct(vals).map((xs: any) =>
    Object.fromEntries(xs.map((x: any, i: any) => [keys[i], x])),
  );
};
