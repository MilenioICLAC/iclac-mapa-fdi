// Build de la página del validador (validador/ → site/validador/), que se publica
// en GitHub Pages junto al informe. Config aparte del sitio del mapa: son dos
// aplicaciones distintas y no comparten ni entrada ni dependencias.
//
// `base: './'` para que sirva bajo /validador/ sin saber el nombre del repositorio.
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  root: fileURLToPath(new URL('./validador', import.meta.url)),
  base: './',
  build: {
    outDir: fileURLToPath(new URL('./site/validador', import.meta.url)),
    emptyOutDir: true,
    // Un solo archivo por tipo: la página es autocontenida y el registro va
    // empaquetado adentro (ver el comentario de los imports ?raw en main.js).
    assetsInlineLimit: 0
  }
})
