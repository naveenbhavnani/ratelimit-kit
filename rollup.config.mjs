import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: {
    index: 'dist/index.js',
    'middleware/express': 'dist/middleware/express.js',
    'middleware/hono': 'dist/middleware/hono.js',
    'store/memory': 'dist/store/memory.js',
    'store/redis': 'dist/store/redis.js',
  },
  output: [
    { dir: 'dist', format: 'esm', entryFileNames: '[name].js', preserveModules: false },
    { dir: 'dist', format: 'cjs', entryFileNames: '[name].cjs', exports: 'named' }
  ],
  plugins: [resolve(), commonjs()],
  external: ['express', 'hono']
}
