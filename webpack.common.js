const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');
require('dotenv').config();

module.exports = {
  entry: {
    app: path.resolve(__dirname, 'src/scripts/index.js'),
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.(png|jpe?g|gif)$/i,
        type: 'asset/resource',
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.VITE_API_BASE_URL': JSON.stringify(
        process.env.VITE_API_BASE_URL || 'https://story-api.dicoding.dev/v1'
      ),
      'process.env.VITE_MAP_SERVICE_API_KEY': JSON.stringify(
        process.env.VITE_MAP_SERVICE_API_KEY || 'x02r9WSjHseBBp4yxRmy'
      ),
      'process.env.VITE_VAPID_PUBLIC_KEY': JSON.stringify(
        process.env.VITE_VAPID_PUBLIC_KEY || 'BCCs2eonMI-6H2ctvFaWg-UYdDv387Vno_bzUzALpB442r2lCnsHmtrx8biyPi_E-1fSGABK_Qs_GlvPoJJqxbk'
      ),
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'src/index.html'),
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'src/public/'),
          to: path.resolve(__dirname, 'dist/'),
        },
      ],
    }),
  ],
};
