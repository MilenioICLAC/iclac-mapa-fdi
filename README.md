# Repositorio Regional de Inversiones Chinas en América Latina

Sitio del repositorio de inversiones de ICLAC. Publica la base como dos instrumentos sobre los mismos
datos y los mismos filtros: un **mapa** y un diagrama de **tendencias**. En español, inglés y chino.

Este mismo repositorio contiene **los datos, el validador y la aplicación**. Subir una planilla
corregida es lo único que hace falta para actualizar el sitio.

---

## Para quien mantiene los datos

No hace falta programar ni instalar nada. El trabajo es sobre archivos de Excel.

### Actualizar un país

1. Editar el archivo del país en `data/sources/countries/` (por ejemplo `chile.xlsx`) y subirlo al
   repositorio, reemplazando el anterior.
2. Al subirlo, la validación corre sola y publica un **informe** con el resultado país por país:

   **https://nucleomilenioiclac.github.io/iclac-mapa-fdi/**

   El informe dice qué está correcto, qué conviene revisar y qué impide que un país entre al sitio.
   Está escrito para leerse sin conocimientos técnicos.
3. Si el país pasa y está marcado para publicar, el sitio se reconstruye solo con los datos nuevos.

Qué columnas debe tener cada archivo y qué se espera en cada una: `data/schema/schema.md`.

### Publicar o retener un país

Que un archivo esté **correcto** y que se **publique** son dos cosas distintas, a propósito: un país
puede estar listo y no querer mostrarse todavía.

Se decide en `data/schema/countries.csv`, en la columna `publish`:

```
alpha3,numeric,name,aliases,filename,publish
CHL,152,Chile,,CHILE,yes        ← se publica
HND,340,Honduras,,HONDURAS,no   ← validado, pero no sale en el sitio
```

Los países retenidos aparecen en el informe como **PASA · RETENIDO**, para que se distinga de un
error. Para publicar uno, cambiar su celda a `yes`.

> **Ese archivo se edita en el navegador, desde GitHub. No en Excel.** Excel lo guarda con punto y
> coma en vez de coma y le quita los ceros a la izquierda a los códigos de país; con cualquiera de
> las dos cosas el sistema deja de reconocer los países. Hay una validación que avisa si ocurre, pero
> es más fácil no pisar el palito.

---

## Para quien desarrolla

```bash
npm install
npm run etl      # convierte los XLSX a los JSON que consume el sitio
npm run dev      # http://localhost:5173
```

| Comando | Qué hace |
|---|---|
| `npm run etl` | XLSX → `public/data/*.json`. Corre también en cada build de producción |
| `npm run build` | Chequeo de tipos y build de producción a `dist/` |
| `npm run preview` | Sirve `dist/` para verificar contra el build real |
| `npm test` | Tests de la lógica de filtros y de los validadores |
| `npm run lint` | eslint. **La CI lo corre sin tolerancia a warnings** |
| `npm run validate` | Valida los XLSX por país |
| `npm run validate:countries` | Valida el registro de países |
| `npm run validate:investors` | Valida la tabla de inversores |
| `npm run validate:report` | Genera el informe HTML de validación |

**Antes de dar por terminado un cambio visible, verificarlo en el navegador.** Varios problemas de
esta clase solo aparecen a cierto ancho de pantalla. Receta en `.claude/skills/verify`.

### Cómo está organizado

```
src/            la aplicación (React + TypeScript)
data/sources/   los archivos que sube el equipo de datos
data/schema/    el contrato de datos, el registro de países y la tabla de inversores
scripts/        ETL y validadores; en one-off/, herramientas de auditorías puntuales
public/data/    lo que consume el navegador (los JSON los genera el ETL)
docs/estado.md  qué quedó pendiente y de quién depende
```

`.claude/CLAUDE.md` explica **por qué** el código está como está: las reglas que no caducan y las
trampas ya conocidas. Vale leerlo antes de tocar el mapa, los filtros o el Sankey.

### Despliegue

Netlify, construyendo con `npm run etl && npm run build` y publicando `dist/` (ver `netlify.toml`).

Una sola variable de entorno, `VITE_WEB3FORMS_KEY`, para el formulario de Contacto. Se genera en
web3forms.com escribiendo la dirección de destino, y **la clave queda atada a esa dirección**:
cambiar el destinatario obliga a generar una clave nueva, no a editar la variable. Sin ella, la vista
de Contacto degrada sola a un enlace de correo directo.

## Datos

La base es de ICLAC. La cita sugerida está en la pestaña Metodología del sitio, y la base completa se
descarga desde la pestaña Datos.
