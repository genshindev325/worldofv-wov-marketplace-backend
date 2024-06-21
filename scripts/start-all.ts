import concurrently from 'concurrently';

// Note: the services should be ordered such that dependent services are started
// after their dependencies.

const SERVICES = [
  'business',
  'price-conversion',
  'activity',
  'admin',
  'image-thumbnail',
  'offer',
  'user',
  'auction',
  'auth',
  'nft',
  'metadata',
  'nft-import',
  'sale',
  'marketplace',
  'marketplace-sync',
  'aplos-stats',
  'gateway',
  'email',
  'blockchain-sync-auction',
  'blockchain-sync-nft',
  'blockchain-sync-offer',
  'blockchain-sync-pfp',
  'blockchain-sync-sale',
  'blockchain-sync-user',
  'blockchain-sync-stake',
  'blockchain-stats',
];

/**
 * Generate vibrant, "evenly spaced" colours.
 *
 * See https://stackoverflow.com/a/62040442
 */
function rainbow(steps: number, step: number) {
  const h = step / steps;
  const i = ~~(h * 6);
  const f = h * 6 - i;
  const q = 1 - f;

  const toPartialRGB = (v: number) => {
    return ('00' + (~~(v * 255)).toString(16)).slice(-2);
  };

  const [r, g, b] = [
    [1, f, 0],
    [q, 1, 0],
    [0, 1, f],
    [0, q, 1],
    [f, 0, 1],
    [1, 0, q],
  ][i % 6];

  return '#' + toPartialRGB(r) + toPartialRGB(g) + toPartialRGB(b);
}

const commands = SERVICES.map((name, i) => ({
  command: `sleep ${i} && npm run start:dev ${name}`,
  prefixColor: rainbow(SERVICES.length, i),
  name,
}));

concurrently(commands, { prefix: 'name', killOthers: 'failure' });
