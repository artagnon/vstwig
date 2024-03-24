const path = require('path');

module.exports = {
  mode: 'development',
  target: 'node',
  externals: {
    vscode: 'commonjs vscode'
  },
  entry: './src/extension.ts',
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'extension.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
    libraryTarget: 'commonjs2'
  },
};
