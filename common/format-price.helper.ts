import BigNumber from 'bignumber.js';

export const formatPrice = (price: any) =>
  Number(price) ? new BigNumber(price).toFormat({ groupSeparator: '' }) : null;
