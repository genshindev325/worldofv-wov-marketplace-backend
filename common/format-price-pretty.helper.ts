import BigNumber from 'bignumber.js';

export const formatPricePretty = (n?: any, asWei = true): string => {
  const formattedNumber = n
    ? (n instanceof BigNumber ? n : new BigNumber(n.toString()))
        .dividedBy(asWei ? 10 ** 18 : 1)
        .toFormat(2, {
          groupSize: 3,
          groupSeparator: '.',
          decimalSeparator: ',',
        })
    : '0';

  if (formattedNumber.endsWith(',00')) {
    return formattedNumber.slice(0, -3);
  }

  return formattedNumber;
};
