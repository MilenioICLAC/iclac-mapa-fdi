/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        // Solo para el encabezado, que es lo que se compara con iclac.cl. El cuerpo
        // sigue en la fuente del sistema: es un instrumento de lectura densa, no una
        // página institucional.
        display: ['Raleway', 'system-ui', 'sans-serif']
      },
      colors: {
        // Highlight color for hover across the app. Two shades because contrast
        // depends on what sits underneath:
        //   brand      on a light control  -> pair with text-gray-900 (5.8:1)
        //   brand-dark on an active/dark control -> keeps text-white (5.4:1)
        // White text on `brand` is only 2.96:1, below AA for the small type used in
        // the filter panel, so it must not be used that way.
        brand: {
          DEFAULT: '#00A89C',
          dark: '#00776E'
        }
      }
    }
  },
  plugins: []
}
