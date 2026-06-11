/**
 * FlowOS mobile - webpack config for running the app in a browser via React Native Web.
 * Aliases react-native -> react-native-web, transpiles app + RN-ecosystem packages
 * with the RN babel preset, and serves at http://localhost:8080.
 */
const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const root = __dirname;
const nm = (p) => path.resolve(root, 'node_modules', p);

// App code + RN-ecosystem packages that ship untranspiled JSX/Flow must go through babel.
const babelInclude = [
  path.resolve(root, 'index.web.js'),
  path.resolve(root, 'App.tsx'),
  path.resolve(root, 'src'),
  nm('react-native-web'),
  nm('react-native-paper'),
  nm('react-native-vector-icons'),
  nm('react-native-safe-area-context'),
  nm('react-native-gesture-handler'),
  nm('react-native-screens'),
  nm('@react-navigation'),
  nm('@react-native/normalize-colors'),
];

// Mode-aware: `webpack serve` (no --mode) runs development; `npm run web:build`
// passes --mode production, which also flips __DEV__ so src/config.ts targets the
// deployed backend instead of localhost.
module.exports = (_env, argv = {}) => {
  const isProd = argv.mode === 'production';
  return {
  mode: isProd ? 'production' : 'development',
  entry: path.resolve(root, 'index.web.js'),
  output: {
    path: path.resolve(root, 'dist-web'),
    // Content hash in prod so redeploys bust browser/CDN caches.
    filename: isProd ? 'bundle.[contenthash].js' : 'bundle.js',
    publicPath: '/',
    clean: true,
  },
  resolve: {
    extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js'],
    alias: {
      'react-native$': 'react-native-web',
      // Keep the native keychain module out of the web bundle.
      'react-native-keychain': path.resolve(root, 'src/shims/keychain.web.js'),
      // Optional native animation deps (gesture-handler probes for them) — not used on web.
      'react-native-reanimated': false,
      'react-native-worklets': false,
      // Optional Paper icon providers we don't use (we use react-native-vector-icons + the font).
      '@react-native-vector-icons/material-design-icons': false,
      '@expo/vector-icons/MaterialCommunityIcons': false,
    },
  },
  module: {
    rules: [
      {
        // ESM packages ("type":"module", e.g. @react-navigation) use extensionless
        // relative imports; webpack 5 otherwise rejects them as not "fully specified".
        test: /\.[cm]?jsx?$/,
        resolve: { fullySpecified: false },
      },
      {
        test: /\.[jt]sx?$/,
        include: babelInclude,
        use: {
          loader: 'babel-loader',
          options: {
            babelrc: false,
            configFile: false,
            // Keep ES modules intact (don't rewrite to CommonJS) — webpack handles ESM,
            // and some deps (@react-navigation v7) are "type":"module" so a CJS rewrite
            // breaks with "exports is not defined".
            presets: [['module:@react-native/babel-preset', { disableImportExportTransform: true }]],
          },
        },
      },
      {
        test: /\.(png|jpe?g|gif|svg|ttf|woff2?)$/,
        type: 'asset/resource',
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({ template: path.resolve(root, 'web/index.html') }),
    new webpack.DefinePlugin({
      __DEV__: JSON.stringify(!isProd),
      'process.env.NODE_ENV': JSON.stringify(isProd ? 'production' : 'development'),
    }),
  ],
  devServer: {
    static: { directory: path.resolve(root, 'web') },
    port: 8080,
    historyApiFallback: true,
    hot: true,
    open: false,
  },
  };
};
