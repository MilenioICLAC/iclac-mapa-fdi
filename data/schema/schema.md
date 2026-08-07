# Esquema canónico de datos — mapa_FDI

**Versión:** 1.6 (2026-08-07)
**Estado:** contrato vigente para el flujo por país. Base del validador JS de GH Actions (2.3).
**Fuente de verdad:** Parte II (II.1–II.7) de `docs/sprint_3/entrega_2606_validacion_esquema_04072026.html` (entregable cliente). Este .md es la versión técnica de ese contrato.
**Versión para el equipo de datos:** `docs/sprint_6/esquema_datos_iclac.md`. Es el mismo contrato sin
changelogs, sin rutas del repo y sin la procedencia de nuestras decisiones. **Si se cambia una regla
acá, hay que cambiarla allá**: son dos redacciones de lo mismo, y si divergen gana ésta.

**Historia del contrato:** `data/schema/CHANGELOG.md` (qué cambió en cada versión y por qué).

Este documento define el **contrato de datos** que debe cumplir cada archivo de inversiones.
Una columna por campo. Sin columnas de trabajo (`*_ORIG`, `*_ARREGLADO`). Sin columnas redundantes.

Derivado de lo que consumen el ETL (`scripts/etl.mjs`) y los tipos (`src/types/data.ts`).
Lo que no aparezca aquí, el ETL y el validador lo **ignoran** (columnas extra permitidas, ver §3).

---

## 1. Alcance y formato del archivo

- **Un archivo por país** en `data/source/`, nombrado con el **país en inglés, sin tildes**
  (p. ej. `CHILE.xlsx`, `BRAZIL.xlsx`, `PERU.xlsx`, `COSTA_RICA.xlsx`). **Case-insensitive (v1.4):**
  `chile.xlsx` y `CHILE.xlsx` valen igual; la normalización unifica. La lista de nombres válidos =
  países del registro `data/schema/countries.csv` (columna `filename`).
- **Una sola hoja** con los datos.
- Primera fila = cabeceras exactas de la tabla §3 (sensibles a mayúsculas).
- Codificación UTF-8. Decimales con punto (`1234.5`), no coma.
- Sin filas en blanco intercaladas ni columnas fantasma (`__EMPTY*`).

### Granularidad de filas

Una **inversión** puede ocupar **1 o N filas**, según su geometría:
- `Vector = Punto` → 1 fila = 1 punto. Una adquisición multipunto se reporta **punto por punto**
  (p. ej. CNPC Perú: 5.153 puntos = 5.153 filas; confirmado por cliente). Aunque compartan
  `Id_Investment`, cada fila Punto sale como punto independiente; el ETL **no** las agrupa.
- `Vector = Vector` → N filas = vértices de una **polilínea** (oleoducto, transmisión, etc.).
  Los vértices de una misma línea comparten **`Id_Investment` + `Path`**. El orden de filas es el orden de la línea.

### `Path`: discriminador de línea (no es "vacío para Punto")

`Path` no se deja en blanco. Su rol depende de `Vector`:
- **`Punto`** → `Path = 0`, sea la inversión única o no. En filas Punto el sistema **ignora** su valor;
  el `0` solo mantiene la base ordenada. **Confirmado con cliente** (correo 24-06-2026).
- **`Vector`** → `Path` es un entero `≥ 1` que **numera cada trazado** dentro de un mismo `Id_Investment`.
  Una inversión puede tener **varias líneas separadas** (`Path` 1, 2, …) y cada una se dibuja por separado.
  El ETL agrupa por `(Id_Investment, Path)`; cada par = una línea.

> ⚠️ En una línea (`Vector`, mismo id+path), los campos no geográficos (monto, sector, detalle…) se repiten
> por vértice. El ETL toma el valor de la **primera fila** del grupo. Mantenerlos consistentes.

---

## 2. Convenciones de tipos

| Tipo | Regla |
|---|---|
| `texto` | string; se hace `trim`; vacío → `null` |
| `entero` | número sin decimales |
| `decimal` | número con punto decimal |
| `enum` | uno de un conjunto cerrado (case-sensitive salvo nota) |
| `coords` | `"lat, lng"` en una celda; ver §4 |
| `bool-YN` | literal `Yes` / `No` |

Obligatoriedad:
- **req** = obligatorio. La columna debe existir (si no, `archivo/columna-requerida`, bloqueante) y la
  celda no puede ir vacía (`fila/requerido-vacio`, error de fila).
- **opt** = puede ir vacío → `null`.

**Ojo: `req` en el contrato ≠ «la fila se cae».** Son dos capas distintas y conviene no confundirlas:

| | Qué pasa |
|---|---|
| Validador | un `req` vacío es error de fila; si el archivo baja del umbral de filas válidas, **el archivo entero** queda fuera del build |
| ETL (`cleanRow`) | descarta la fila solo por **tres** campos: `Id_Investment`, `Coordinates` y `Project_Type` (y este último tiene que mapear al enum). Los otros diez `req` no botan la fila |

O sea que una fila sin `Year` no se pierde en el ETL: la protege el validador antes, botando el
archivo. Si algún día se corre el ETL con `--no-filter`, esa fila entra con `year = null`.

---

## 3. Columnas canónicas

| Columna | Tipo | Oblig. | Formato / enum | Notas |
|---|---|---|---|---|
| `Id_Investment` | texto | **req** | propuesto `ALPHA3-NNNN` (`ARG-0080`), por confirmar | Ver §5. Guardar como **texto**. Mismo id en todas las filas de una inversión. |
| `Id_Seq` | entero | **req** | `≥ 1`, secuencia por país (1, 2, 3…) | Base del `Id_Investment`, ver §5. **Adoptada:** los 17 archivos por país la traen desde la carga del 09-07. |
| `Coordinates` | coords | **req** | `"lat, lng"` | Ver §4. Fila sin coords válidas se descarta. |
| `Year` | entero | **req** | `1900–<año actual>` | |
| `Country` | texto | **req** | nombre país | Debe ser consistente con `COUNTRY_ISO_ALPHA3`. |
| `COUNTRY_ISO_NUM` | texto | **req** | ISO 3166-1 numérico, 3 díg. con ceros (`152`=Chile) | Guardar como texto (preservar ceros). |
| `COUNTRY_ISO_ALPHA3` | enum | **req** | ISO 3166-1 alfa-3 (`CHL`, `ARG`…) | Consistente con el país del nombre del archivo (§1). |
| `Province_ISO` | texto | opt | ISO 3166-2 (`CL-RM`) | Subdivisión. |
| `Investor` | texto | **req** | | Empresa inversora (clave del filtro Sankey S5). |
| `Vector` | enum | **req** | `Punto` \| `Vector` | Define geometría. Ver §1. |
| `Path` | entero | **req** | `0` para `Punto`; `≥1` para `Vector` | Numera la línea dentro de un `Id_Investment`. Agrupa vértices `(id, Path)`. Ver §1. |
| `Area_EN` | enum | **req** | 8 sectores canónicos (`sectores.md`) | **Match exacto** con una de las 8 claves EN; el frontend traduce a es/en/cn vía i18n keyed por `Area_EN`. Mismatch = punto **gris** + categoría duplicada en filtro, en los 3 idiomas. |
| `Area_ES` | texto | **req-presencia** | — | **Informativa en cuanto al valor** (v1.4: el mapa traduce desde `Area_EN`), pero **la columna sigue en `REQUIRED_COLUMNS` y una celda vacía es error de fila**. Del contenido sólo se chequea el **conflicto conceptual** con `Area_EN` (warning): si apunta a otro sector, una de las dos está mal. Ver la nota de §3.1. |
| `Detail_ES` | texto | opt | | Descripción en español. |
| `Detail_EN` | texto | opt | | Descripción en inglés. |
| `Investment` | decimal | opt | **millones de USD** (✅ confirmado por cliente, 2026-07-05) | Queda **opcional**: hay inversiones reales sin monto público. Mismo valor en todas las filas de una inversión. |
| `Location` | texto | opt | dirección / lugar | Texto plano, **sin URLs** embebidas. |
| `Project_Type` | enum | **req** | `Adquisición` \| `Greenfield` \| `Construcción` | **Valores mutuamente excluyentes.** Canónico en español, tildes correctas. Ver §9. |
| `Joint_Venture` | bool-YN | opt | `Yes` \| `No` | **Columna legada: mal codificada y sin criterio definido, así que la app no la usa.** Está en `Yes` en 3 inversiones publicadas mientras otras 39 describen una operación conjunta en el texto de `Detail`, y los dos conjuntos no se tocan. Se conserva igual, como dummy, para no perder el dato mientras no haya un criterio. No se filtra ni se muestra con ella. |
| `Origin_Of_Seller` | texto | opt | | Origen del vendedor (en adquisiciones). Renombrada desde `Origin of seller` (v1.2). |
| `Stake` | decimal | opt | porcentaje `0–100` | % adquirido. |
| `Research` | enum | **req** | `Yes` \| `No` | `Yes` si tiene respaldo en un **estudio**. Ver §6. |
| `News` | enum | **req** | `Yes` \| `No` | `Yes` si el enlace es **noticia** y no estudio — columna aparte de `Research`. Nueva en v1.2 (ya implementada en la entrega 26/06). Ver §6. |
| `Caso1`…`Caso14` | texto | opt | título del estudio/fuente | Ver §6. |
| `Link1`…`Link14` | texto | opt | URL (`http…`) | Pareado con `CasoN`. La **URL va aquí**, no en `CasoN`. |
| `reliability_score` | entero | opt | `0`–`5` | Puntaje de confiabilidad de la rúbrica ICLAC: número de fuentes independientes que confirman la operación, más uno. **Es de la inversión, no del punto**: mismo valor en todas las filas de un `Id_Investment`. **Con `≤ 2` la inversión no entra al sitio**, se publica en el anexo de evidencia limitada. Vacío = todavía sin revisar: entra igual, y el validador lo avisa. |
| `reliability_notes` | texto | opt | | Por qué ese puntaje y no otro, en español. Qué confirma cada fuente y qué queda sin confirmar. **Su ausencia se avisa**, ver §3.2. |
| `source1`…`source5` | texto | opt | URL (`http…`) | Las fuentes que sostienen el puntaje. Igual que el puntaje, se repiten en todas las filas de la inversión. **Son cinco y hoy sólo existen tres**, ver §3.2. |

### 3.1 `Area_ES`: el doc y el código no dicen lo mismo (pendiente de decidir)

v1.4 la sacó de la validación **de formato** y §3/§7 la venían marcando `opt`. Pero
`REQUIRED_COLUMNS` del validador **la sigue incluyendo**, así que hoy: si la columna no está, es
`archivo/columna-requerida` (bloqueante), y si una celda está vacía, es `fila/requerido-vacio` (error
de fila). No hay test que cubra la celda vacía, y no ha molestado porque los 17 archivos la traen
llena en todas las filas.

Las dos lecturas son defendibles (v1.4 habló de formato, no de presencia). **La tabla de arriba
describe lo que hace el código**, que es lo que se ve en el informe. Si se decide que sea realmente
opcional, el cambio es sacarla de `REQUIRED_COLUMNS` en `scripts/lib/validate.mjs` y volver a `opt`
acá y en §7.

### 3.2 Las tres columnas de confiabilidad que los archivos por país no tienen

`reliability_notes`, `source4` y `source5` entraron al contrato el 03-08 y **ningún archivo por país
las trae**: los 17 quedaron con `source1..source3` y sin la nota. Dos consecuencias, y una decisión
distinta para cada caso.

**`reliability_notes` se avisa.** Si la columna no está, el validador emite
`archivo/columna-sugerida-ausente`, warning **de archivo**, uno por archivo, nunca bloqueante. Vive en
`SUGGESTED_COLUMNS` de `scripts/lib/validate.mjs` y **no** en `REQUIRED_SOFT_COLUMNS` a propósito: esa
lista además valida celda por celda, y como la nota es de la inversión y no del punto, Perú dejaría
5.000 avisos del mismo hueco. Sin la nota, el puntaje no tiene respaldo escrito y no se puede auditar
después.

**`source4` y `source5` NO se avisan**, decisión del 07-08: nadie las va a llenar en la pasada actual
y el aviso sería ruido. Queda anotado igual porque tiene consecuencia medible: la rúbrica llega a 5
(cuatro o más fuentes independientes), así que con tres columnas **un puntaje 4 o 5 no se puede
documentar entero**. En la entrega del 06-08 eso dejó 27 inversiones con puntaje 5 sostenidas por 3
fuentes cargadas, y 35 enlaces sueltos dentro de la prosa de las notas.

### Columnas que NO deben ir (eliminar antes de entregar)

- Booleanos redundantes con `Project_Type`: **`Greenfield`, `Acquisition`, `Construction`** —
  son la misma información que `Project_Type` (ver §9; resuelto en v1.2, `Construction` también sale).
- Columnas de trabajo: cualquier `*_ORIG`, `*_ARREGLADO`, `Project_Type_ES`/`Project_Type_EN` (colapsar en `Project_Type`).
- Columnas fantasma `__EMPTY*` (artefacto de Excel).

### Columnas extra permitidas

El cliente **puede añadir columnas propias** si lo considera necesario (p. ej. `Location_ES`).
El validador y el ETL solo leen las columnas canónicas e **ignoran el resto**.

---

## 4. Formato de coordenadas

- Una celda: `"-33.45, -70.66"` → `lat, lng`.
- **Orden: latitud primero, longitud después.** (Error frecuente en origen: invertidas.)
- Rangos: `lat ∈ [-90, 90]`, `lng ∈ [-180, 180]`.
- Decimal con punto. Sin grados/minutos, sin `N/S/E/W`.
- Para LATAM continental se espera `lat < 15` y `lng < -30`; fuera de eso, revisar (probable inversión lat/lng).

---

## 5. Identificador (`Id_Investment` + `Id_Seq`)

- **Texto** siempre, no número (preservar el cero inicial; el cero perdido causó la colisión `0019100`).
- **Base ISO — ahora.** Acordado con cliente (hilo 24-06-2026): usar las columnas `COUNTRY_ISO_*`
  (ya pobladas) como base del identificador, manteniendo compatibilidad con los registros existentes.
- **No es único global.** El mismo `Id_Investment` se repite por diseño: en cada vértice de una línea
  (mismo id+`Path`), y puede aparecer en varias líneas (`Path` distinto) o en varios puntos.
  La clave de geometría es `(Id_Investment, Path)`, no el id solo.
- **Scope de unicidad: LATAM.** La validación de unicidad/consistencia de IDs se hace dentro del conjunto LATAM.
- Estable entre entregas (no re-numerar; el ID es la clave de seguimiento).

### Formato `ALPHA3-NNNN` (adoptado)

Mismo flujo de armado que el cliente ya usa (secuencia por país + código de país), con dos ajustes:

- **Código como prefijo, no sufijo:** `ARG-0080` en vez de `80160`. El sufijo actual es ambiguo de
  parsear y el código a mano ya produjo la colisión `0019100` (un id de Venezuela con código de Colombia).
- **Alfa-3, no numérico:** con una letra adentro, Excel no puede convertir el id a número —
  el problema del cero perdido desaparece **por construcción**, no por disciplina.

La secuencia vive en su propia columna, **`Id_Seq`** (entero: 1, 2, 3…): para agregar una inversión
basta tomar el máximo de `Id_Seq` del archivo y sumar 1. El `Id_Investment` se arma desde ella:
prefijo alfa-3 + `Id_Seq` con relleno a 4 dígitos (`Id_Seq = 80` en Argentina → `ARG-0080`).
Cada equipo de país solo necesita conocer la secuencia de su propio archivo; la unicidad global
la garantiza el prefijo.

**El validador chequea:** prefijo == país del archivo, y `Id_Investment` consistente con `Id_Seq`.

**Tabla de equivalencia lista:** `docs/sprint_3/equivalencia_ids.xlsx` (generada por
`scripts/build_id_map.mjs`) — los 450 ids actuales mapeados al formato nuevo (id actual → id nuevo,
con país e `Id_Seq`), verificados sin colisiones. Basta aplicar el reemplazo.

### 5.1 `Ownership` no es columna de la base (v1.5)

**Fuente única = `data/schema/investors_map.csv`**, curado de nuestro lado desde la revisión externa
(Dialogue/Yifang Wang, 17-07). Enum `Central SOE / Local SOE / POE / MIXED / UNKNOWN`. El Sankey y el
filtro leen ownership de ahí (`investors_map.json`).

**Por qué es atributo de la empresa y no del deal:** la propiedad última de una firma china no cambia
según en qué país invierta. Ponerla por fila obliga a repetir el mismo hecho miles de veces y a
mantenerlo sincronizado, que es justo lo que no pasó.

**Qué mostró el intento de tenerla en los dos lados** (v1.4 → v1.5): el cruce
(`scripts/audit_ownership_cross.mjs`, 23-07) verificó que la entrega del cliente **no aplicó ninguna
de las 30 correcciones** de la revisión experta — sólo el rename mecánico `SASAC`→`Central SOE`. A
28-07 su base sigue con **0 `Local SOE`** y la tabla nuestra con 21. No es negligencia: clasificar
propiedad de firmas chinas (central vs local vs mixta) es trabajo experto, no de data-entry, y
pedírselo a quien carga los datos era el error de diseño.

**Estado v1.5:** la columna se sacó de los archivos por país (28-07,
`scripts/drop_base_columns.mjs`, con respaldo en `docs/sprint_5/respaldo_columnas_ownership.xlsx`).
Si reaparece, el validador la trata como columna extra y la ignora; la regla `fila/ownership`
se mantiene como red por si vuelve con valores fuera del enum.

### 5.2 Convención de dos lugares (24-07)

El manejo del inversor se reparte en **dos artefactos, con responsabilidades distintas**:

1. **La base por país (`Investor`)** lleva el nombre **RAW, tal como viene de la fuente**. No se
   normaliza. Conserva procedencia (ej: "Pacific Hydro", no "State Power Investment"). Lo mantiene
   el cliente al cargar inversiones. Recuperación del histórico: `scripts/restore_investor_raw.mjs`
   (join por `Id_Investment_Original` contra la base vieja, ~96%).
2. **La tabla de inversores (`data/schema/investors_map.csv`)** mapea `investor_raw` → identidad
   canónica (`company_id`, `company_canonical`, consorcio/`members`) + `ownership`. **También pasa
   por el validador** (`scripts/validate_investors.mjs` / núcleo `scripts/lib/validate_investors.mjs`):
   enum de ownership, `investor_raw` único, `company_id ↔ company_canonical` 1:1, ownership
   consistente por `company_id`. El ETL une base ↔ tabla por el nombre (raw y canónico) en el build.

   **Steward (a definir por ICLAC):** la poblamos nosotros para la v1, pero mantenerla es trabajo
   experto (estructura corporativa china) y **NO es tarea permanente nuestra ni del data-entry**.
   Antes del cierre, ICLAC debe designar quién la mantiene (equipo con ese conocimiento, o Diálogo).

Inversor nuevo que aparece en la base y no está en la tabla → cae a `UNKNOWN`. El mapa no se rompe;
el steward lo ve por dos vías:

- **En cada validación** (28-07): el validador emite `fila/inversor-sin-mapear`, **warning, nunca
  bloqueante** — un inversor sin clasificar no es un defecto del archivo de datos, es trabajo
  pendiente en otra tabla. Un aviso por **nombre distinto**, no por fila (el consorcio de Honduras
  son 71 filas del mismo nombre). El chequeo se salta solo si `investors_map.csv` no está presente,
  porque el repo del cliente todavía no lo lleva.
- **A pedido:** `scripts/check_investor_coverage.mjs`, con monto y nº de inversiones, para priorizar.

### Fuera del esquema: `Company_Id` / `previous_fdi`

**No son columnas del archivo del cliente.** La identidad canónica de empresa se resuelve **de
nuestro lado** con `data/schema/investors_map.csv` (mapeo `investor_raw` → canónico; script
`scripts/build_investors_map.mjs`). El **atributo ownership** ahora viene de la base (§5.1), no del
CSV.

---

## 6. Research, News y citas (`Research` + `News` + `CasoN`/`LinkN`)

- `Research` = `Yes` si la inversión tiene respaldo en un **estudio**; `No` en otro caso.
- `News` = `Yes` si el enlace es una **noticia** y no un estudio de investigación — columna aparte
  de `Research`, ya implementada en la entrega 26/06.
- **Regla:** toda fila con `CasoN`/`LinkN` poblado debe tener `Research = Yes` **o** `News = Yes` —
  si no, la fuente queda invisible en la interfaz (no aparece en ningún filtro).
- Por cada fuente `n` (1–14): el **título va en `Cason`**, la **URL en `Linkn`** (no en `CasoN`).
- El ETL deduplica casos por **título** dentro de una inversión Vector (vértices repiten la misma cita).

---

## 7. Resumen legible por máquina (para el validador)

Tabla fuente del validador JS (2.3). `req` = obligatorio, `enum` = conjunto cerrado.

```
Id_Investment        text   req   propuesto /^[A-Z]{3}-\d{4}$/ (por confirmar) ; prefijo == COUNTRY_ISO_ALPHA3 ; consistente con Id_Seq ; no único global (ver reglas inter-fila)
Id_Seq               int    req   >=1 ; secuencia por país ; Id_Investment == ALPHA3 + "-" + pad4(Id_Seq)   [PROPUESTA pendiente confirmación cliente]
Coordinates          coords req   lat[-90,90] lng[-180,180]
Year                 int    req   [1900,CURRENT_YEAR]
Country              text   req
COUNTRY_ISO_NUM      text   req   /^\d{3}$/
COUNTRY_ISO_ALPHA3   enum   req   ISO3166-1-alpha3 ; consistente con país del archivo
Province_ISO         text   opt
Investor             text   req
Vector               enum   req   {Punto,Vector}
Path                 int    req   Vector==Punto => 0 ; Vector==Vector => >=1
Area_EN              enum   req   sectores.md::EN (match exacto, case-sensitive)
Area_ES              text   req   presencia y celda no vacía SI se validan ; el VALOR es informativo (v1.4, no se valida formato) ; sólo warning si concepto != Area_EN (fila/sector-conflicto)
Detail_ES            text   opt
Detail_EN            text   opt
Investment           number opt   >=0 ; unit=MUSD (confirmado)
Location             text   opt   no-url
Project_Type         enum   req   {Adquisición,Greenfield,Construcción} (mutuamente excluyentes)
Joint_Venture        enum   opt   {Yes,No} ; legada, mal codificada y sin criterio ; se conserva como dummy, la app no la usa
Origin_Of_Seller     text   opt
Stake                number opt   [0,100]
Research             enum   req   {Yes,No}
News                 enum   req   {Yes,No}
Caso1..Caso14        text   opt
Link1..Link14        text   opt   url-if-present ; pairs-with CasoN
reliability_score    int    opt   [0,5] ; constante por Id_Investment ; <=2 => anexo
reliability_notes    text   opt
source1..source5     text   opt   url-if-present
```

Columnas prohibidas (error si aparecen): `Acquisition`, `Greenfield`, `Construction`,
`*_ORIG`, `*_ARREGLADO`, `Project_Type_ES`, `Project_Type_EN`, `__EMPTY*`.
Columnas no reconocidas distintas de las prohibidas: **se ignoran** (permitidas).

Curación automática (determinista, sin pérdida — se lista, no se enmascara):
- `COUNTRY_ISO_NUM` / `Id_Seq`: se quita el apóstrofe inicial de Excel (`'152` → `152`).
- `Country`: se lleva a forma canónica del registro (`CHILE`/`chile`/`Brasil` → `Chile`/`Brazil`).
- Nombre de archivo: match case-insensitive contra el registro.

Reglas de archivo e inter-fila:
- Nombre de archivo: país en inglés sin tildes, **case-insensitive** (`CHILE.xlsx` = `chile.xlsx`);
  lista válida = `data/schema/countries.csv`. Una sola hoja.
- País fuera del registro = `archivo/nombre` (fuera de la lista, con instrucción). País sin borde de
  geometría = `archivo/sin-borde` (warning, compuerta blanda; ver §10).
- Consistencia país: nombre de archivo ↔ `Country` ↔ `COUNTRY_ISO_ALPHA3` ↔ `COUNTRY_ISO_NUM` ↔ prefijo de `Id_Investment`.
- Una **línea** = grupo de filas con mismo `(Id_Investment, Path)` y `Vector=Vector`.
  En una línea, los campos no geográficos deben ser idénticos entre sus filas.
- Un `Id_Investment` puede repetirse: en varios puntos, o en varias líneas (`Path` distinto).
  No exigir `Id_Investment` único global. Unicidad se evalúa en scope **LATAM**.
- `CasoN`/`LinkN` poblado ⇒ `Research == Yes` o `News == Yes` (§6).
- **Multi-point = punto por punto** (confirmado): una inversión con N sitios = N registros.
  Al **sumar montos**, deduplicar por `Id_Investment` para no sobrecontar.

**Umbral del validador (2.3):** **propuesto 95%** de filas válidas (Parte III.2 del entregable,
"Proponemos"; por confirmar por cliente). El validador reporta el % válido y falla bajo el umbral
(no exige 100%); el reporte indica qué filas fallan y por qué.

---

## 8. Decisiones abiertas que afectan al esquema

| Tema | Estado |
|---|---|
| **Estado del proyecto** (cancelado / anunciado no desembolsado / por verificar) | La entrega del 06-08 trae una columna propia, `investment_classification`, con 29 valores distintos. Hoy el esquema **no tiene dimensión de estado**, así que una inversión cancelada entra al mapa como viva. Publicarlas exige enum cerrado + regla de si suman al total. **Decisión de ICLAC, ver `docs/sprint_6/`.** |
| **`Area_ES` req o opt** | §3.1. Divergencia entre este doc y `REQUIRED_COLUMNS`. Decisión nuestra, barata. |
| **Steward de la tabla de inversores** | §5.2. Sin definir. |

Resueltos (ya no abiertos): **formato de `Id_Investment` = `ALPHA3-NNNN` + `Id_Seq`** (adoptado en los
17 archivos desde el 09-07), **unidad de `Investment` = millones de USD** (confirmado 2026-07-05),
exclusividad de `Construcción` (§9), lista de sectores y 8ª categoría (`sectores.md`), `News` vs
`Research` (§6), `Company_Id`/`previous_fdi` fuera del esquema (§5).

Ver `docs/generales/next_steps.md` y `docs/sprint_3/entrega_2606_validacion_esquema_04072026.html`.

---

## 9. `Project_Type`: una sola columna, 3 valores excluyentes (RESUELTO v1.2)

La metodología define el "tipo" de inversión solo como **Greenfield o Adquisición (M&A)** — ambos con
participación china en la propiedad. **"Construcción" es aparte:** contratos de obra pública donde China
**no** retiene propiedad; la metodología es explícita en que esos proyectos se conservan igual en la base
y solo se **resta su monto del total de FDI**.

Por eso `Project_Type` = `Adquisición` | `Greenfield` | `Construcción`, **mutuamente excluyentes** —
sin columnas booleanas aparte: `Acquisition`, `Greenfield` y `Construction` **salen del esquema** (§3).

El ETL deriva `is_construction = (Project_Type === 'Construcción')` y el front filtra con `includeConstruction`.

**Conexión con el sector:** la categoría Construcción/Infraestructura es también la **8ª categoría de
sector** de la metodología ("infrastructure/construction projects"), cuyo monto se **excluye del total
FDI** (`Area_EN = Infrastructure`, `Area_ES = Infraestructura`; ver `sectores.md`).

---

## 10. País como dato + geometría (v1.4)

El alcance de países dejó de estar hardcodeado en el validador. Vive en el registro
`data/schema/countries.csv` (columnas `alpha3,numeric,name,aliases,filename,publish`), **pre-cargado
por nosotros** con toda LATAM + Centroamérica + Caribe. **México NO está en la semilla a propósito**
(exclusión metodológica 14-07): un `mexico.xlsx` cae como "país fuera de la lista".

Incorporar un país nuevo:
1. **Geometría de país** (compuerta blanda): la sembramos nosotros desde Natural Earth
   (`scripts/build_borders.mjs` → `data/sources/geo/borders.geojson`). Sin borde, el validador
   avisa `archivo/sin-borde` (no bota); el país no se dibuja hasta tenerlo.
2. **Datos sin bloqueantes:** el archivo del país pasa el contrato (§3/§7).
3. **Decisión de publicar:** su fila del registro dice `publish,yes`.

La geometría además define la caja contra la que se chequean las coordenadas de ese país
(`fila/coordenadas-sospechosas`, margen 1°). Un país sin borde cae a la caja de toda la región, así
que el chequeo es más laxo hasta que se le siembre la geometría.

### 10.1 Las dos compuertas: validar ≠ publicar

Son preguntas distintas y las contesta gente distinta, así que viven en lugares distintos:

| Compuerta | Pregunta | Quién contesta | Dónde |
|---|---|---|---|
| Validación | ¿el dato está bien? | el validador, mecánicamente | reglas de §3/§7 |
| Publicación | ¿lo mostramos ya? | ICLAC, por decisión editorial | columna `publish` de `countries.csv` |

Antes eran una sola: arreglar un archivo lo publicaba en el siguiente build, sin que nadie lo
decidiera. Con `publish,no` el país se sigue validando y sale en el informe con estado propio
(«PASA · RETENIDO»), pero el ETL no lo ingesta y `build_borders` no le arma el polígono — si no,
quedaría un país vacío clickeable en el mapa.

**Sin columna, o con la celda vacía, publica.** El default no puede ser retener: una versión vieja
del CSV apagaría el mapa entero. Se retiene sólo lo que está escrito `no`.

Para publicar un país retenido: cambiar su fila a `publish,yes` (se edita en el navegador, GitHub
abre el CSV como texto) y correr `npm run etl` + `node scripts/build_borders.mjs data/sources/countries`.
Para inspeccionar localmente sin cambiar el CSV: `npm run etl -- --include-unpublished`.

El validador y el ETL cargan el registro vía `scripts/lib/load_registry.mjs`; el núcleo
(`scripts/lib/validate.mjs`) lo recibe por `opts.registry` y sigue puro.
