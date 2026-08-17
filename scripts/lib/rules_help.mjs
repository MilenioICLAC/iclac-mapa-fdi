// Vocabulario de las reglas del validador: qué significa cada una en lenguaje
// llano, cómo se corrige, y DE QUIÉN es el arreglo. Sin I/O.
//
// Vive aparte porque tiene dos consumidores: el informe
// (scripts/lib/report_render.mjs) y la planilla de pendientes
// (scripts/lib/pendientes.mjs), que la usa para cortar por dueño. Tenerlo en dos
// lados garantiza que diverjan.
//
// `tipo` es el eje de DUEÑO, no de gravedad: dice quién tiene que arreglarlo, no
// si bloquea. Esas son dos preguntas distintas y confundirlas hace que el informe
// se lea como una lista de culpas.

// Diccionario de reglas → explicación en lenguaje llano + cómo se arregla.
export const RULE_HELP = {
  'fila/iso-num': {
    titulo: 'COUNTRY_ISO_NUM con formato inválido',
    causa: 'La celda trae un apóstrofe pegado al número (\'152 en vez de 152).',
    fix: 'Formatear la columna como Texto y quitar el apóstrofe. Es un solo arreglo, corrige todas las filas.',
    tipo: 'formato'
  },
  'fila/pais-desconocido': {
    titulo: 'Country en mayúsculas',
    causa: 'El país viene como CHILE en vez de Chile, y no matchea la lista.',
    fix: 'Usar la forma con mayúscula inicial (Chile, Argentina, Peru).',
    tipo: 'formato'
  },
  'fila/sector-es': {
    titulo: 'Area_ES no pareada con Area_EN',
    causa: 'La etiqueta en español no coincide 1:1 con nuestra tabla (ej: Agroindustria vs Agronegocios, Tic vs TIC).',
    fix: 'Esta columna la vamos a dejar de exigir (el mapa traduce desde Area_EN). No requiere acción de tu lado.',
    tipo: 'a-resolver-nuestro-lado'
  },
  'fila/sector-en': {
    titulo: 'Area_EN no es un sector canónico',
    causa: 'Valor fuera de los 8 sectores (ej: Construction, que no es una categoría de sector).',
    fix: 'Reclasificar a uno de los 8 sectores (Construction suele ser Infrastructure). Requiere criterio.',
    tipo: 'contenido'
  },
  'fila/ownership': {
    titulo: 'Ownership fuera del enum',
    causa: 'Valor de propiedad que no está en las categorías canónicas (típico: SOE en vez de Local SOE, o SASAC en vez de Central SOE).',
    fix: 'No requiere acción de tu lado: la propiedad se resuelve en la tabla de inversores, no en esta base. Aviso informativo.',
    tipo: 'a-resolver-nuestro-lado'
  },
  'fila/sin-puntaje-confiabilidad': {
    titulo: 'Inversión sin puntaje de confiabilidad',
    causa: 'La columna reliability_score está vacía en todas las filas de esa inversión: nadie registró cuántas fuentes independientes la respaldan.',
    fix: 'Asignar el puntaje 0-5 de la rúbrica (es el número de fuentes confiables independientes más uno) y dejar la nota en reliability_notes. Ojo: sin puntaje la inversión se publica igual, así que un vacío deja entrar al mapa algo que nadie evaluó.',
    tipo: 'contenido'
  },
  'fila/puntaje-confiabilidad-invalido': {
    titulo: 'reliability_score fuera de la rúbrica',
    causa: 'El valor no es un entero de 0 a 5 (texto, decimal o fuera de rango).',
    fix: 'Corregir a un entero entre 0 y 5 según la rúbrica.',
    tipo: 'formato'
  },
  'fila/puntaje-confiabilidad-inconsistente': {
    titulo: 'Puntajes distintos en la misma inversión',
    causa: 'Las filas de una misma inversión traen reliability_score distintos. El puntaje es de la inversión, no del punto.',
    fix: 'Dejar el mismo puntaje en todas las filas de ese Id_Investment.',
    tipo: 'contenido'
  },
  'archivo/sin-columna-confiabilidad': {
    titulo: 'Falta la columna reliability_score',
    causa: 'El archivo no trae la columna del puntaje de confiabilidad.',
    fix: 'Agregarla y completarla según la rúbrica 0-5. Sin ella, ninguna inversión del archivo pasa por el chequeo de evidencia.',
    tipo: 'formato'
  },
  'archivo/columna-sugerida-ausente': {
    titulo: 'Falta la columna reliability_notes',
    causa: 'El archivo no trae la columna donde va el porqué del puntaje de confiabilidad.',
    fix: 'Agregarla cuando toque editar el archivo. No bloquea nada: es el lugar donde queda escrito qué confirma cada fuente y qué no, que hoy se pierde.',
    tipo: 'formato'
  },
  'fila/inversor-sin-mapear': {
    titulo: 'Inversor nuevo, sin clasificar todavía',
    causa: 'El nombre no está en la tabla de inversores, donde vive la identidad de la empresa y su tipo de propiedad.',
    fix: 'No requiere acción de quien carga los datos y no bloquea nada: va a la cola del encargado de la tabla de inversores. Mientras tanto la inversión se muestra igual, con propiedad desconocida en Tendencias.',
    tipo: 'tabla-inversores'
  },
  'fila/project-type': {
    titulo: 'Project_Type inválido',
    causa: 'Valor en inglés o fuera del enum (Construction, Investment, Joint venture).',
    fix: 'Usar exactamente Adquisición, Greenfield o Construcción (español, con tilde).',
    tipo: 'contenido'
  },
  'fila/path': {
    titulo: 'Path no concuerda con Vector',
    causa: 'Path es el orden del punto dentro del trazado: 0 si la inversión es un Punto suelto, y 1, 2, 3… si es un Vector. Acá los dos campos dicen cosas distintas, o Path no es un número entero.',
    fix: 'Si la inversión es un punto solo, Vector="Punto" y Path=0. Si es un trazado, Vector="Vector" y cada fila numerada desde 1 en el orden del recorrido. Requiere saber cuál de las dos cosas es.',
    tipo: 'contenido'
  },
  'fila/requerido-vacio': {
    titulo: 'Columna obligatoria vacía',
    causa: 'Falta un valor requerido por el esquema.',
    fix: 'Completar el dato en origen.',
    tipo: 'contenido'
  },
  'fila/coordenadas-sospechosas': {
    titulo: 'El punto cae fuera de su país',
    causa: 'La coordenada queda fuera de la caja del país de la fila (con 1° de margen): lat/lng invertidas, un dígito de más, o la fila pertenece a otro país.',
    fix: 'Revisar el orden (latitud primero, longitud después) y que el punto corresponda al país del archivo.',
    tipo: 'contenido'
  },
  'fila/caso-url': {
    titulo: 'URL en CasoN',
    causa: 'El título del estudio trae la URL adentro.',
    fix: 'El título va en CasoN; la URL en LinkN.',
    tipo: 'contenido'
  },
  'fila/cita-invisible': {
    titulo: 'Fuente sin marca Research/News',
    causa: 'Hay CasoN/LinkN pero ni Research ni News en Yes → la fuente no se muestra.',
    fix: 'Marcar Research=Yes o News=Yes en esas filas.',
    tipo: 'contenido'
  },
  'fila/monto-inconsistente': {
    titulo: 'Monto distinto entre filas de la misma inversión',
    causa: 'El Investment cambia entre filas del mismo Id.',
    fix: 'Repetir el mismo monto en todas las filas de la inversión.',
    tipo: 'contenido'
  },
  'fila/metadata-inconsistente': {
    titulo: 'Metadata distinta entre filas de la misma inversión',
    causa: 'Year u otro campo cambia entre filas del mismo Id.',
    fix: 'Mantener idénticos los campos no geográficos dentro de una inversión.',
    tipo: 'contenido'
  },
  'fila/id-colision-intrapais': {
    titulo: 'Dos inversiones distintas con el mismo Id_Investment',
    causa: 'Una fila nueva reusó un Id_Investment que ya pertenecía a otra inversión del mismo país, con otro inversor. Pasa al agregar filas al final del archivo copiando una existente.',
    fix: 'Asignar un Id_Investment libre a la inversión nueva (el siguiente de la secuencia del país). Mientras compartan id, el mapa dibuja las dos pero el contador suma una sola y el monto de la segunda no entra al total.',
    tipo: 'contenido'
  },
  'fila/inversor-inconsistente': {
    titulo: 'Dos nombres de inversor en la misma inversión',
    causa: 'Una fila trae un nombre distinto (a menudo un placeholder tipo "Unidentified") y el resto el nombre real.',
    fix: 'Dejar el mismo nombre en todas las filas. El sitio muestra el de la primera fila del trazado, así que un placeholder ahí se ve en toda la inversión y la manda a propiedad desconocida.',
    tipo: 'contenido'
  },
  'fila/cancelled': {
    titulo: 'cancelled fuera del enum',
    causa: 'La celda trae algo distinto de 0 o 1.',
    fix: 'Usar 0 para vigente y 1 para cancelada. Es la columna que saca la inversión del mapa y la manda al anexo, así que un valor fuera del enum se lee como vigente y la deja publicada.',
    tipo: 'formato'
  },
  'fila/cancelled-inconsistente': {
    titulo: 'cancelled distinto entre filas de la misma inversión',
    causa: 'Unos puntos de la inversión están marcados como cancelados y otros no.',
    fix: 'Repetir el mismo valor en todas las filas: una inversión está cancelada o no lo está. Si son dos inversiones distintas, necesitan ids distintos.',
    tipo: 'contenido'
  },
  'fila/provincia-pais': {
    titulo: 'Province_ISO de otro país',
    causa: 'El prefijo del código de provincia no corresponde al país de la fila (ej: SR-NI en un archivo de Guyana).',
    fix: 'Corregir la división administrativa, o confirmar que el punto cae del otro lado de la frontera si la obra es binacional.',
    tipo: 'revisar'
  },
  'archivo/geometria-compartida': {
    titulo: 'Dos inversiones comparten geometría',
    causa: 'Coordenadas idénticas entre Ids distintos (posible duplicado anuncio/cierre).',
    fix: 'Revisar si son la misma operación o etapas legítimas.',
    tipo: 'revisar'
  },
  'archivo/nombre': {
    titulo: 'Archivo de un país fuera de la lista del proyecto',
    causa: 'El nombre del archivo no corresponde a ningún país del proyecto. No es un tema de mayúsculas/minúsculas (eso el validador ya lo tolera): es un país que todavía no está en el alcance.',
    fix: 'Si este país debe entrar al repositorio, hay que incorporarlo (avisarnos para sumarlo a la lista) y el archivo debe cumplir el contrato de columnas. Mientras tanto, sus filas no se procesan.',
    tipo: 'revisar'
  },
  'archivo/sin-borde': {
    titulo: 'País sin geometría de borde',
    causa: 'El país está reconocido pero todavía no tiene su polígono de borde: aunque los puntos existan, el país no se dibuja en el mapa.',
    fix: 'Nosotros cargamos el borde (semilla de la región). Aviso, no bloquea: el país entra al mapa cuando su borde está y sus datos pasan.',
    tipo: 'a-resolver-nuestro-lado'
  }
}

export const tipoBadge = {
  formato: { label: 'Formato', cls: 'b-formato' },
  contenido: { label: 'Contenido', cls: 'b-contenido' },
  revisar: { label: 'Revisar', cls: 'b-revisar' },
  'a-resolver-nuestro-lado': { label: 'Lo resolvemos nosotros', cls: 'b-nuestro' },
  // Categoría propia: no es "nosotros" genérico, es un rol nombrado con dueño.
  // Quien carga los datos no tiene que hacer nada; quien mantiene la tabla de
  // inversores sí, y esto es su cola de trabajo.
  'tabla-inversores': { label: 'Encargado de la tabla de inversores', cls: 'b-inversores' }
}
