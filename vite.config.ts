import { defineConfig } from 'vite';

export default defineConfig({
  // Caminhos relativos: a build estática funciona em qualquer subdiretório.
  base: './',
  build: {
    target: 'es2022',
    assetsInlineLimit: 0, // sprites nunca viram data-URI: quebra o cache de textura
    rollupOptions: {
      output: {
        // Phaser sozinho em um chunk: muda raramente, então o cache do usuário
        // sobrevive a deploys do código do jogo.
        manualChunks: (id) => (id.includes('node_modules/phaser') ? 'phaser' : undefined),
      },
    },
  },
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
});
