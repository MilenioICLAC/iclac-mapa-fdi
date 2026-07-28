# Traspaso: qué queda en manos de ICLAC

Lista de lo que hay que hacer una vez para que el sitio quede completamente bajo control de ICLAC, y
de lo que conviene saber después. Cada punto dice **quién** puede hacerlo: varios son configuraciones
de administrador que solo alguien de la organización tiene.

---

## 1. Hosting en Netlify

El sitio se construye desde este repositorio. La configuración ya está versionada en `netlify.toml`,
así que no hay nada que ajustar a mano.

**Lo hace un administrador de ICLAC:**

1. Crear una cuenta en netlify.com con una dirección institucional (no personal: la cuenta es la
   dueña del sitio).
2. *Add new site* → *Import an existing project* → GitHub → autorizar → elegir este repositorio.
3. Netlify lee `netlify.toml` y propone la configuración correcta. Verificar que diga:
   - Build command: `npm run etl && npm run build`
   - Publish directory: `dist`
4. Antes del primer deploy, agregar la variable de entorno del formulario de contacto (punto 2).
5. Desplegar.

Desde ahí, **cada push al repositorio reconstruye el sitio solo**. Subir una planilla corregida es
todo lo que hace falta para actualizar los datos publicados.

Si más adelante se quiere un dominio propio (por ejemplo `repositorio.iclac.cl`), se configura en
*Domain management* y requiere agregar un registro DNS donde esté alojado el dominio de ICLAC.

## 2. Clave del formulario de Contacto

La vista de Contacto usa Web3Forms, que envía el formulario a una dirección de correo sin necesidad
de servidor propio.

**Lo hace un administrador de ICLAC:**

1. Entrar a web3forms.com y escribir la dirección que debe **recibir** los mensajes (por ejemplo
   `comunicaciones.iclac@gmail.com`). La clave llega por correo a esa misma dirección.
2. En Netlify: *Site configuration* → *Environment variables* → agregar
   `VITE_WEB3FORMS_KEY` con esa clave.
3. Volver a desplegar para que tome la variable.

**La clave queda atada a la dirección de destino.** Cambiar el destinatario más adelante significa
generar una clave nueva, no editar la variable. Anotarlo donde se guarden las credenciales de la
organización.

Mientras la variable no exista, la vista no se rompe: muestra un enlace de correo directo en lugar
del formulario.

## 3. Informe de validación en GitHub Pages

Ya está funcionando: cada vez que se sube un archivo de datos, la validación corre y publica el
informe en

**https://nucleomilenioiclac.github.io/iclac-mapa-fdi/**

No hay que hacer nada, salvo saber que ese enlace es fijo y siempre muestra el estado más reciente.

## 4. Accesos que conviene revisar

- **Quién puede escribir en el repositorio.** Hoy alcanza con quien sube los datos y quien
  desarrolla; conviene que exista más de un administrador para no depender de una sola persona.
- **La cuenta de Netlify**, con el mismo criterio.
- **Dónde se guardan las credenciales** de las dos cosas anteriores más la clave de Web3Forms.

---

## Lo que hay que saber después

### Quién decide qué se publica

El repositorio distingue **validado** de **publicado**. Un país puede estar impecable y no salir en
el sitio: eso se controla en la columna `publish` de `data/schema/countries.csv`, y es una decisión
editorial de ICLAC, no del sistema. Detalle en el README.

### La tabla de inversores necesita quién la mantenga

`data/schema/investors_map.csv` traduce el nombre del inversor tal como viene de la fuente a una
empresa canónica con su tipo de propiedad. Es lo que alimenta el diagrama de Tendencias y el filtro
de propiedad.

Mantenerla no es trabajo de quien carga los datos: implica saber de estructura corporativa china.
**Hace falta designar a alguien.** Mientras tanto el sitio no se rompe: un inversor que no esté en la
tabla se muestra igual, con propiedad desconocida, y queda listado en el informe de validación y en
`node scripts/check_investor_coverage.mjs` para que quien tome esa tarea sepa por dónde empezar.

### Qué queda pendiente

`docs/estado.md`, que se mantiene borrando lo que se cierra.

### Si hay que retomar el desarrollo

`.claude/CLAUDE.md` explica por qué el código está como está: las reglas que no caducan, las trampas
ya conocidas y qué se rompe si se cambian sin saber. Está escrito para que alguien (o un agente) pueda
retomar el trabajo sin arqueología.
