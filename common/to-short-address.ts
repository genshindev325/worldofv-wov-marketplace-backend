export const toShortAddress = (address: string): string | undefined => {
  const regex = /(0x.{4}).*(.{4})$/;
  const regexResult = regex.exec(address);

  if (regexResult) {
    const [, start, end] = regexResult;
    return `${start}…${end}`;
  }

  return undefined;
};
