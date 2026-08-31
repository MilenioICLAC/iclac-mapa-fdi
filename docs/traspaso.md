# Traspaso: qué queda en manos de ICLAC

Lista de lo que hay que hacer una vez para que el sitio quede completamente bajo control de ICLAC, y
de lo que conviene saber después. Cada punto dice **quién** puede hacerlo: varios son configuraciones
de administrador que solo alguien de la organización tiene.

---

## 1. Hosting en Netlify

Montado. El sitio está publicado en **https://app.iclac.cl**, desde este repositorio y en la cuenta
de Netlify de ICLAC. La configuración está versionada en `netlify.toml`, así que no hay nada que
ajustar a mano:

- Build command: `npm run etl && npm run build`
- Publish directory: `dist`
- Variable de entorno: `VITE_WEB3FORMS_KEY` (ver punto 2)

**Cada push al repositorio reconstruye el sitio solo.** Subir una planilla corregida es todo lo que
hace falta para actualizar los datos publicados.

El dominio apunta con un registro **CNAME** de `app` a `map-fdi.netlify.app`, en la zona DNS de
`iclac.cl`, que se administra en iHosting junto al sitio institucional. El certificado HTTPS lo emite
y lo renueva Netlify solo.

Si más adelante se quiere otro subdominio, se agrega en *Domain management* y se repite ese CNAME en
el Zone Editor del cPanel. **No usar la herramienta de subdominios del cPanel:** crea un registro A
apuntando al servidor de iHosting, que no puede convivir con el CNAME.

## 2. Clave del formulario de Contacto

Montado. La vista de Contacto usa Web3Forms, que reenvía el formulario a una dirección de correo sin
necesidad de servidor propio. La clave está cargada en Netlify como `VITE_WEB3FORMS_KEY` y los
mensajes llegan a `comunicaciones.iclac@gmail.com`.

Dos cosas para cuando haya que cambiarla:

**La clave queda atada a la dirección de destino.** Cambiar el destinatario significa generar una
clave nueva en web3forms.com desde el buzón nuevo, no editar la variable. La clave se saca del panel
de la cuenta en ese sitio; el correo con que se supone que llega no siempre aparece.

**Editar la variable no basta: hay que volver a desplegar.** El valor se hornea dentro del JavaScript
en el momento de construir el sitio, así que un despliegue ya hecho no la toma, por más que la
variable esté correcta en el panel. En Netlify: *Deploys* → *Trigger deploy* → *Clear cache and
deploy site*.

Si la variable falta, la vista no se rompe: muestra un enlace de correo directo en lugar del
formulario.

## 3. Informe de validación en GitHub Pages

Ya está funcionando: cada vez que se sube un archivo de datos, la validación corre y publica el
informe en

**https://milenioiclac.github.io/iclac-mapa-fdi/**

No hay que hacer nada, salvo saber que ese enlace es fijo y siempre muestra el estado más reciente.

## 4. El enlace desde iclac.cl

El sitio institucional corre **WordPress** en iHosting, y desde ahí se llega al mapa por el ítem
«Mapa Inversiones Chinas», dentro del bloque «Datos» del menú principal.

Ese ítem no apuntaba a `app.iclac.cl` sino a una página del propio WordPress
(`iclac.cl/mapa-repositorio-regional-de-inversiones-chinas/`, id **5411**), cuyo contenido era una
sola cosa: un iframe al mapa del proveedor anterior, `https://china-latam.iclac.cl/`.

Por eso hacen falta **dos** cambios y no uno:

- **El ítem del menú** pasó a ser un enlace directo a `https://app.iclac.cl/`. Un ítem de tipo página
  está atado al id de esa página y no admite una URL externa, así que hubo que borrar el viejo (5414)
  y crear uno de tipo «enlace personalizado» (**7439**), reponiéndole la posición (29) y el padre
  (6020, «Datos»). El título se mantuvo **idéntico**: TranslatePress indexa las traducciones por el
  string original, y cambiarlo aunque sea una tilde deja el menú sin traducir en inglés y chino.
- **La página 5411 redirige** a `https://app.iclac.cl/` con un 301. El menú no alcanza: los enlaces a
  esa dirección ya circulan en publicaciones y están indexados, y esos no pasan por el menú.

La redirección vive en `wp-content/mu-plugins/iclac-redirect-mapa.php`, un archivo de cuatro líneas
que redirige por **id de página**:

```php
<?php
add_action('template_redirect', function () {
    if (!is_page(5411)) {
        return;
    }

    // Prefijo de idioma de TranslatePress -> etiqueta interna de la app.
    $idiomas = array('eng' => 'en', 'zh_cn' => 'cn');

    $ruta    = (string) wp_parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $primero = strtok(trim($ruta, '/'), '/');
    $destino = 'https://app.iclac.cl/';

    if (isset($idiomas[$primero])) {
        $destino = add_query_arg('lng', $idiomas[$primero], $destino);
    }

    wp_redirect($destino, 301);
    exit;
});
```

**Y arrastra el idioma.** iclac.cl publica tres: sin prefijo (español), `/eng/` y `/zh_cn/`. Sin esto,
quien venía leyendo en inglés o en chino aterrizaba en la app en español, porque el detector de
`src/i18n.ts` solo miraba `localStorage` y el idioma del navegador. Ahora los prefijos se traducen a
`?lng=en` y `?lng=cn`, y la app los lee porque `detection.order` arranca con `querystring`; como
`caches: ['localStorage']`, la elección queda pegada para las visitas siguientes.

El español **no** lleva parámetro a propósito: la URL sin prefijo es el default de TranslatePress, no
una elección del lector, así que forzar `?lng=es` le rompería el inglés a quien tiene el navegador en
inglés y nunca eligió nada. Los otros dos prefijos sí son elección explícita y por eso mandan.

Ojo con el mapeo: la app usa `cn` como etiqueta interna del chino (no es BCP-47, ver `.claude/CLAUDE.md`),
mientras que TranslatePress usa `zh_cn` en la URL. Los dos nombres son distintos a propósito y el
diccionario del mu-plugin es donde se cruzan.

**Por qué así y no en `.htaccess`.** El sitio tiene TranslatePress, así que la misma página se sirve
en varias URL con prefijo de idioma; `is_page()` las cubre todas porque es el mismo post, mientras que
una regla por ruta habría que escribirla idioma por idioma. Y All In One WP Security reescribe el
`.htaccess` para mantener su propio bloque, así que una regla nuestra ahí puede quedar pisada sin
aviso. Un mu-plugin se carga solo, ningún plugin lo pisa, y se deshace borrando el archivo.

**La página 5411 tiene que quedar publicada.** Si se manda a borrador o a la papelera, WordPress deja
de mostrar su ítem en el menú y desaparece «Mapa Inversiones Chinas». Sigue publicada; simplemente
nunca se renderiza. Su contenido se dejó como un enlace a la app, para que la página siga siendo
correcta si algún día el mu-plugin no está.

**Los dos apuntan a la raíz de `app.iclac.cl`, y eso depende de una decisión abierta.** Si las tres
herramientas terminan compartiendo host por rutas (`app.iclac.cl/mapa-fdi`, `/encuesta`,
`/mapa-malls`) en vez de por subdominios, el mapa deja de vivir en la raíz y hay que actualizar **los
dos lugares en el mismo gesto**, más una redirección en Netlify para los enlaces ya compartidos, que
llevan los filtros en el query string de la raíz. La decisión de enrutamiento está registrada como
abierta en el `CLAUDE.md` de la carpeta que orquesta los tres frentes.

**Un cambio en WordPress no se ve al instante.** iHosting tiene **nginx** delante de Apache cacheando
el HTML de los visitantes anónimos, y **cPanel no expone ninguna herramienta de purga** («Optimizar
sitio web» es la compresión gzip, no caché). Al publicar la redirección, la página siguió devolviendo
200 con el mapa viejo mientras la misma URL con un query string cualquiera ya devolvía el 301. Esa
diferencia es el diagnóstico: si con `?nocache=1` funciona y sin él no, el código está bien y lo que
falta es que expire la copia cacheada. Se resuelve solo con el TTL, o pidiéndole la purga a soporte de
iHosting. Para verificar sin depender del navegador:

```
curl -sI https://iclac.cl/mapa-repositorio-regional-de-inversiones-chinas/
```

Tiene que responder `301` con `Location: https://app.iclac.cl/` y `X-Redirect-By: WordPress`.

**Queda pendiente `china-latam.iclac.cl`**, el mapa del proveedor anterior. Redirigida la página, ese
subdominio queda huérfano pero sigue en pie y accesible por enlace directo. Apagarlo o redirigirlo es
una decisión de ICLAC y se toca en la zona DNS de iHosting, no en WordPress.

**Cómo se entra.** cPanel de iHosting (`hs39.ihosting.cl/cpanel`, usuario `iclaccl`) → WordPress
(WP Toolkit) → *Administrador de archivos* para el mu-plugin y *WP-CLI* para el menú y las páginas.
El botón *Iniciar sesión* del Toolkit **no** entra a wp-admin: abre un diálogo que resetea la
contraseña del administrador de WordPress, y dejaría fuera a quien hoy use esa cuenta. Para entrar a
wp-admin hay que pedirle la credencial a comunicaciones ICLAC.

Dos límites de ese WP-CLI, ya encontrados: `proc_open` está deshabilitado, así que `wp db export` y
`wp db import` no corren (los respaldos y restauraciones de base se hacen desde cPanel), y la consola
acepta únicamente comandos `wp`, sin redirecciones ni comandos de shell.

## 5. Accesos que conviene revisar

Nada de esto es urgente, pero conviene resolverlo antes de que el proyecto quede en régimen:

- **Quién puede escribir en el repositorio.** Hoy alcanza con quien sube los datos y quien
  desarrolla. Conviene que haya más de un administrador, para no depender de una sola persona para
  cambiar la rama por defecto o revisar la configuración.
- **La cuenta de Netlify**, con el mismo criterio.
- **Dónde se guardan las credenciales** de las dos anteriores más la clave de Web3Forms, que hoy no
  está en ninguna parte del repositorio (y no debe estarlo).

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
