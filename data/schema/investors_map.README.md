# investors_map.csv — registro de empresas inversoras

Tabla de equivalencias mantenida de nuestro lado (fuera del contrato XLSX del cliente, decisión 04-07):
cada `investor_raw` del repositorio apunta a una empresa canónica con clasificación de propiedad.
La consumen el Sankey, el buscador de inversores y los filtros Propiedad/Consorcio
(vía `public/data/investors_map.json`, regenerado por `scripts/build_investors_map.mjs` y el ETL).

## Reglas del sistema de ids (`company_id`)

Formalizadas 2026-07-12; hasta entonces eran práctica implícita. Documento interno: la guía para
Yifang solo resume lo esencial en la fila `company_id` (decisión 14-07: las convenciones no le
conciernen a ella; si se busca validación externa, va con Francisco).

1. **Un id por empresa real**, definida por **control último** (no accionista inmediato).
   Todas las variantes de nombre (`investor_raw`) de la misma empresa comparten id.
2. **Formato:** slug kebab-case legible, derivado del nombre canónico *al momento de crearlo*
   (`china-three-gorges`, `state-grid`). El id es identificador, no display:
   **si el nombre canónico cambia, el id NO se renombra.**
3. **Un id nunca se reutiliza** para otra empresa, aunque quede retirado.
4. **Fusiones:** las filas se reapuntan al id sobreviviente (por defecto, el de la entidad que perdura).
   Si la fusión corporativa crea una entidad nueva (caso Sinochem+ChemChina), se acuña id nuevo
   y los anteriores se retiran.
5. **Ids retirados quedan registrados** en la tabla de abajo y no vuelven a usarse.
   Pendiente técnico: resolverlos en URLs antiguas (`inv=` con id retirado hoy filtra a 0 resultados).
6. **Consorcios:** el vehículo lleva id propio (`is_consortium=TRUE`); `members` referencia
   company_ids separados por `|`. Los members sin fila propia se permiten —la UI humaniza el slug—
   pero impiden calcular la propiedad del consorcio desde sus partes, así que **se les crea ficha**.
   De los 19 huérfanos que había, 18 se sembraron el 03-08 (`scripts/one-off/seed_member_companies.mjs`).
   El 19, `mcm`, recibió ficha el mismo día con `origin_country` y sin `ownership`, que es el
   tratamiento del socio no chino.

   **Y sigue abierto.** La revisión externa precisó el 05-08 que MCM es la filial panameña de Munilla
   Construction Management, **estadounidense**, no una empresa local, y propone sacarla del registro
   pero **dejarla como miembro del consorcio**. Ojo antes de hacerlo: un miembro sin ficha **sí aporta
   `UNKNOWN`** a la derivación, así que borrar la fila y dejarla en `members` devuelve `PAN-0015` a
   `UNKNOWN`, que es de donde vino. Ver `docs/sprint_5/respuesta_yifang_05082026.md`.
7. **Ownership es atributo del id** (por empresa), no de la variante de nombre: todas las filas
   de un mismo `company_id` deben llevar el mismo `ownership` (inconsistencia goldwind/chemchina
   corregida 2026-07-07 bajo esta regla).

   **Y es atributo de una EMPRESA, así que un consorcio lo lleva vacío** (03-08). Un consorcio es
   una relación entre empresas y no tiene dueño: lo tienen sus partes. Su propiedad se resuelve al
   leerla, desde `members` (`ownershipsOf` en `src/lib/sankey.ts`), y una inversión de consorcio
   entra en el filtro si **cualquiera** de sus miembros es del tipo pedido. Las dos reglas del
   validador son simétricas: `fila/consorcio-con-ownership` y `fila/ownership-vacio`.

   **El vacío está reservado** para marcar «esto no es una empresa». Si de una empresa no se conoce
   la propiedad, va `UNKNOWN`. Si un miembro de un consorcio no resuelve, el consorcio aparece
   además bajo `UNKNOWN`: la incompletitud tiene que verse, no hacer desaparecer la inversión.
8. **El joint venture del deal NO vive en este registro.** Es propiedad de la operación
   (`Joint_Venture` en la base de inversiones): la misma empresa puede hacer un JV en un proyecto y
   entrar sola en otro (PowerChina tiene ambos en los datos). El consorcio sí vive aquí porque el
   vehículo *es* el inversor registrado; su flag a nivel deal se deriva vía `investor_raw`. Nunca
   duplicar el hecho en ambas bases.

   **Matiz agregado el 03-08, y hay que leerlo entero para no reintroducir el problema.** Son *tres*
   hechos distintos que la palabra «joint venture» tiende a colapsar en uno:

   | Hecho | Es propiedad de | Dónde vive |
   |---|---|---|
   | Varias empresas chinas en una operación | la operación, derivable | acá, contando `members` |
   | La empresa **es** un vehículo de propiedad conjunta | **la empresa** | acá, `is_jv_vehicle`; quiénes son sus dueños va en `controllers`, como en cualquier empresa |
   | Hay un socio **no chino** | la operación | la base por país, `Joint_Venture` |

   `is_jv_vehicle` no contradice la regla: es un atributo de la empresa (Andes Petroleum *es* un
   vehículo de CNPC y CNOOC, siempre, en toda operación), no del deal. El tercer caso es el único que
   este registro **no puede** contestar, porque el socio no chino nunca va a tener ficha acá.

9. **Una matriz junto a sus propias filiales SÍ es un consorcio.** No es un inversor contado dos
   veces, y por eso CCCC con CHEC, CNEEC con CMEC y CTG con CWE se quedan con sus miembros separados.
   Que la matriz encabece el proyecto acompañada de sus filiales es una estrategia documentada de
   salida de las estatales chinas, la «flota» (舰队): confirmado por la revisión externa el 05-08,
   con <https://www.yicai.com/news/5287516.html>. Antes de «corregir» un consorcio de este tipo por
   parecer redundante, releer esto: la duda ya se levantó una vez y la respuesta fue que el dato
   está bien.

## Cómo se edita esta tabla (desde 2026-08-03)

**A mano, nunca.** Excel en configuración regional española rompe el CSV: punto y coma como
separador, `VERDADERO`/`FALSO`, ceros a la izquierda comidos. Y con 240 filas, texto en chino y
cadenas de control con comas adentro, la regla «se edita en el navegador» se rompe sola.

```bash
npm run investors:export                              # CSV -> docs/investors_table.xlsx
npm run investors:import -- docs/investors_table.xlsx # dry-run, imprime el diff
npm run investors:import -- docs/investors_table.xlsx --write
```

El editable sale a `docs/`, que está en el gitignore, **a propósito**: si se versiona, alguien va a
editar ese y subirlo, y perdemos el CSV como fuente.

**Prueba de regresión:** exportar e importar sin tocar nada tiene que dar **0 cambios**. Si da
distinto, algo se está perdiendo en el viaje.

**El editable deja fuera, por defecto, las empresas que solo invierten en países todavía no
publicados** (hoy 7, entre ellas AFECC en Costa Rica y Chaoyang Petroleum en Trinidad). Esas bases
siguen abiertas, así que pedir que las clasifiquen es trabajo sobre un dato que puede cambiar. La
lista de excluidas va escrita en el README del archivo, para que la ausencia no parezca un olvido, y
vuelven solas cuando el país se publique: la exclusión se **deriva de `countries.csv`**, no de una
lista fija. Con `--all` salen todas. Para importar un archivo así hace falta `--allow-missing`.

El editable trae una columna **`in_the_site`** que no está en el CSV: dice si la empresa aparece en el
mapa publicado, sea con inversiones propias o **como miembro de un consorcio publicado**. Existe porque
`investments = 0` se leía como fila muerta, y hoy **26 empresas están en ese caso sin estarlo**: sus
inversiones viven en el anexo de evidencia limitada o en países que todavía no se publican. Beijing
Limawei, uno de los tres vehículos JV de la revisión externa, es una de ellas, con US$1.200 MM.

El import machaca por `company_id`, aplica a todas las filas de esa empresa, no borra nunca, no
escribe si el resultado no pasa el validador, y absorbe lo que Excel le haga al archivo. Lo único que
no adivina es el enum de `ownership`: si viene un valor que no está en los cinco, se detiene y dice
qué fila.

## Columnas de evidencia (agregadas 2026-08-03)

Cargadas por `scripts/one-off/add_evidence_columns.mjs` desde la planilla de la revisión externa.
Antes esa evidencia vivía **solo** dentro de un xlsx en `docs/`, que está en el gitignore: era lo
único que respaldaba las clasificaciones publicadas y no estaba versionado.

| Columna | Qué guarda | Cobertura |
|---|---|---|
| `ownership_status` | Estado de la clasificación, **en inglés** porque el editable que se manda afuera lo es y el valor viaja tal cual. Cinco valores, ver abajo | 240 filas |
| `evidence_source` | de dónde salió la evidencia: `revision-externa-2026-07` o `iclac-propuesta-2026-08` | 216 |
| `chinese_name` | nombre en el registro chino | 155 |
| `firm_type` | forma jurídica del registro chino | 148 |
| `controllers` | controladores últimos, separados por `\|` | 135 |
| `control_paths` | cadenas de control con porcentaje por salto, separadas por `\|` | 134 |
| `is_jv_vehicle` | `TRUE` si la empresa es un vehículo de propiedad conjunta | 5 |
| `origin_country` | País de un socio **no chino**. **Vacío = China**, que es el default correcto en un registro de inversores chinos | 1 |

**Los cinco valores de `ownership_status`**, cada uno un estado distinto y verdadero:

| Valor | Qué significa | Hoy |
|---|---|---|
| `confirmed` | La revisión externa dio veredicto de propiedad | 156 |
| `proposed` | Clasificación nuestra, esperando auditoría externa | 16 |
| `derived` | Es un consorcio: su propiedad **no se guarda nunca**, se resuelve desde `members` al leerla. No hay nada que completar | 21 |
| `flagged-for-removal` | La revisión externa propuso **sacar la empresa** del repositorio. No es un veredicto de propiedad, es una decisión editorial que está con ICLAC | 3 |
| `unreviewed` | Nadie de afuera la miró nunca | 5 |

**La tabla también registra socios no chinos, desde el 03-08.** Antes tratábamos distinto dos cosas
que son la misma: un miembro chino de un consorcio era una fila, y un socio no chino era texto suelto
dentro de la prosa de `Detail`. Los dos son «otra empresa que participó en la operación».

`origin_country` los distingue, y **la propiedad no les aplica**: el enum describe estructura de
capital china. Así que su `ownership` va vacío, igual que en un consorcio. **El vacío significa «no
aplica», con dos razones posibles** —relación o empresa no china— que se distinguen por
`is_consortium` y `origin_country`. Reglas: `fila/no-china-con-ownership` y `fila/ownership-vacio`.

El socio **no se saca de `members`**: sí participó. Lo que cambia es que la derivación de propiedad lo
salta, en vez de contarlo como miembro desconocido. Eso resolvió el último caso: `PAN-0015` (CCA + MCM)
pasó de `UNKNOWN` a `Local SOE`, y **el filtro de propiedad ya no devuelve ninguna inversión sin
resolver**. Ojo con la distinción: un miembro **sin ficha** sí aporta `UNKNOWN`; un socio no chino
aporta nada. No son lo mismo.

Hoy hay **una sola fila así, MCM**. Los otros 28 socios que aparecen en la prosa salen de una
extracción por texto sin confirmar, así que entran cuando el equipo de datos devuelva la planilla
`socio_no_chino_03082026.xlsx`.

**`derived` no es un estado de trabajo.** Se llamó `pending-calculation` durante unas horas y estaba
mal: «pendiente» prometía un paso futuro que no llega nunca, porque la propiedad de un consorcio no se
calcula una vez y se guarda, se resuelve cada vez que se filtra. El validador exige `derived` en toda
fila con `is_consortium=TRUE` (`fila/consorcio-estado`).

Por lo mismo se sacó de las notas de esos 21 el sufijo `CALCULATED FROM MEMBERS: …` que habíamos
pegado: era un cálculo congelado dentro de la fuente, que se desactualiza en cuanto un miembro cambie
de clasificación. Es el mismo error de `_count` y `_musd`, y van tres. **Regla: si el código lo puede
calcular, no se escribe en el CSV.**

De paso se limpiaron dos restos que habrían hecho creer que hay preguntas abiertas: «Definir atribucion
de monto» (20 filas), que está resuelto —el monto se queda en la operación y nunca se reparte entre los
miembros—, y «aunque enum=MIXED» (1), que ya es falso. La evidencia no se tocó: los porcentajes de Las
Bambas y las fuentes citadas siguen enteros.

**`flagged-for-removal` existe por un error que cometimos.** Esas tres (CED Prometheus, Maverick Motos,
Ample Auto) venían marcadas **en rojo** en la planilla de julio y con la columna de veredicto vacía.
La primera asignación de estado miró solo esa columna y las dejó en `unreviewed`, o sea «nadie las
miró», cuando en realidad tienen la respuesta más categórica de todas. Es el mismo modo de falla que
en julio con los veredictos marcados `Ok`: **leer una columna e ignorar el resto de la señal.**

Las 34 columnas `controller1..17` / `path1..17` de la planilla original **se colapsan en dos**,
separadas por `|`. Verificado antes de escribir: ningún `path` contiene `|`, coma ni salto de línea,
así que el colapso es sin pérdida. Un CSV con 34 columnas de cadena es inmanejable a mano.

**Ninguna de estas columnas llega al sitio.** `build_investors_map.mjs` arma el JSON con lista blanca
(`company_id`, `company_canonical`, `ownership`, `is_consortium`, `members`), así que el peso servido
no cambia.

**`jv_parents` existió y se eliminó el 03-08.** Duplicaba `controllers` —en Andes Petroleum las dos
decían lo mismo— y quedaba vacía **por diseño** en los tres vehículos que marcó la revisión externa,
porque sus socios son personas naturales y la columna solo admitía empresas. Quiénes controlan una
empresa va en `controllers`, sea empresa o persona; `is_jv_vehicle` se queda porque dice algo que de
ahí no se deduce.

**`chinese_name`, `firm_type` y `control_paths` se dejan vacías en las filas propuestas por nosotros,
a propósito.** Su valor es que vienen de un registro chino; llenarlas con conjeturas destruiría lo
único que las hace confiables. El hueco es el entregable: es lo que la revisión externa completa.

**`_count` y `_musd` no las escribe ningún script.** Quedaron de una auditoría vieja y ya están
desactualizadas en todas las filas. Tratarlas como informativas, nunca como fuente.

## Ids retirados

| Id retirado | Fecha | Ahora vive en | Motivo |
|---|---|---|---|
| `sinochem` | 2026-07-07 | `sinochem-holdings` | fusión corporativa 2021, canónico nuevo (aprobado Francisco, correo 2026-07-02) |
| `chemchina` | 2026-07-07 | `sinochem-holdings` | ídem |
| `citic-agri-fund` | 2026-07-07 | `citic` | fondo JV fusionado a matriz (aprobado Francisco, correo 2026-07-02) |
| `hanaq` | 2026-07-07 | `hanaq-group` | duplicado del dato fuente (confirmado Francisco por WhatsApp) |
| `icbc` | 2026-07-07 | `industrial-and-commercial-bank-of-china` | sigla vs nombre completo, mismo banco (ídem) |

## Por qué slugs y no códigos numéricos

El `corp_code` numérico de Francisco se re-numeró por completo entre sus propias versiones
(02-07 vs 11-07: 0 coincidencias código+nombre) — un código opaco sin regla de estabilidad no
sirve de llave. Los slugs son legibles, URL-friendly y estables por regla 2/3. Todo cruce con
archivos externos va **por nombre** (+ alias), nunca por corp_code.
