const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const os = require('os');

/**
 * @param {import('webpack').Configuration} options
 */
module.exports = function (options) {
  // Disable type checking on linux since it uses a very high amount of memory.
  if (os.platform() === 'linux') {
    options.plugins = options.plugins.filter(
      (p) => !(p instanceof ForkTsCheckerWebpackPlugin),
    );
  }

  return options;
};
