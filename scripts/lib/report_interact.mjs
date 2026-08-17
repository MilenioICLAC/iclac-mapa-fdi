// Interacción del informe: índice, filtros y agrupación. Sin dependencias y sin
// tocar red ni disco, a propósito.
//
// DOS CONSUMIDORES, UN SOLO ARCHIVO:
//   · La página del validador lo importa y llama a wireReport() después de
//     inyectar el informe.
//   · El informe estático de Pages lo lleva INLINEADO: build_validation_report.mjs
//     lee este archivo con readFileSync y lo mete como <script type="module">.
//
// Por qué inlineado y no como <script src>: el informe publicado es un solo
// archivo autocontenido, y además un <script> insertado con innerHTML NO se
// ejecuta, así que en el validador la única forma es llamar a la función. Tener
// las dos entregas del MISMO archivo es lo que evita que diverjan.
//
// El HTML ya viene con la vista por defecto armada: lista plana con bloqueantes
// arriba, secciones numeradas e índice abierto. Esto sólo mejora. Sin JavaScript
// el informe sigue siendo un documento completo, navegable por sus anclas e
// imprimible, que es la mitad de su razón de ser.
//
// OJO, dos cosas que rompen el informe estático y no el bundle del validador,
// porque sólo afectan al inlineado:
//   · Escribir la etiqueta de cierre de script en cualquier lado, aunque sea
//     dentro de un comentario: corta el <script> del informe ahí mismo.
//   · Que la cáscara arme el HTML con String.replace y una CADENA de reemplazo:
//     ahí `$$` significa `$` literal y este archivo se corrompe. Va con función.

// Dos niveles, no uno. Medido sobre una entrega de 21 países: 251 hallazgos, 13
// reglas, 52 inversiones, y una concentración enorme —los 109 "columna obligatoria
// vacía" son 4 inversiones y los 25 de inversor son UNA— así que la lista plana
// gasta 251 renglones en describir muchísimo menos.
//
// El primer nivel es la REGLA porque la acción tiene forma de regla: con Excel
// abierto, "rellenar la columna Project_Type" es un gesto, mientras que "arreglar
// CRI-0012" son tres gestos repartidos. Y hay reglas que son 1:1 con la inversión
// (los 35 inversores sin mapear son 35 inversiones): agrupando por inversión
// primero, ésas serían 35 entradas de una línea cada una, que es puro ruido.
//
// El segundo nivel es la INVERSIÓN, con los números de fila colapsados en rangos.
// Y hay un tercero, pero SÓLO cuando aporta: si los mensajes de las filas de esa
// inversión difieren entre sí. Las 27 filas que dicen todas "falta Project_Type"
// no tienen nada que desplegar; las de una colisión de id sí, porque cada una
// nombra al otro inversor y su fila.
const NIVELES = {
  regla: ['regla', 'id'],
  id: ['id', 'regla'],
  pais: ['pais', 'regla']
}

const clave = (li, eje) =>
  eje === 'regla' ? li.dataset.regla : eje === 'id' ? li.dataset.id || `(${li.dataset.pais})` : li.dataset.pais

const porClave = (items, eje) => {
  const m = new Map()
  for (const li of items) {
    const k = clave(li, eje)
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(li)
  }
  // Los que bloquean primero, después los más numerosos: el orden en que se
  // trabaja. Un grupo de 109 celdas vacías es un solo gesto en Excel.
  return [...m.entries()].sort((a, b) => {
    const bloq = (xs) => (xs.some((li) => li.dataset.bloquea === '1') ? 0 : 1)
    return bloq(a[1]) - bloq(b[1]) || b[1].length - a[1].length
  })
}

/** "filas 114-140" / "filas 12-28, 31" / "fila 269" / "archivo". */
const rangos = (lis) => {
  const xs = [...new Set(lis.map((li) => Number(li.dataset.fila)).filter((x) => x > 0))].sort(
    (a, b) => a - b
  )
  if (!xs.length) return 'archivo'
  const partes = []
  let ini = xs[0]
  let prev = xs[0]
  for (const x of xs.slice(1)) {
    if (x === prev + 1) {
      prev = x
      continue
    }
    partes.push(ini === prev ? `${ini}` : `${ini}-${prev}`)
    ini = x
    prev = x
  }
  partes.push(ini === prev ? `${ini}` : `${ini}-${prev}`)
  return (xs.length === 1 ? 'fila ' : 'filas ') + partes.join(', ')
}

const mensajeDe = (li) => li.querySelector('.h-det .msg')?.textContent.trim() ?? ''

/** Columnas distintas que toca un conjunto de hallazgos, en el orden en que salen. */
const columnasDe = (lis) => [...new Set(lis.map((li) => li.dataset.columna).filter(Boolean))]

/** Cuántas columnas todavía sirven como etiqueta y no como párrafo. */
const MAX_COLUMNAS_EN_CABECERA = 3

/** Agrega `<code>` por columna, que es la respuesta corta a "qué arreglo". */
const chipsColumnas = (destino, cols) => {
  for (const c of cols) {
    const code = document.createElement('code')
    code.className = 'g-col'
    code.textContent = c
    destino.appendChild(code)
  }
}

// En esta vista la mayoría de las líneas tienen un solo caso, así que "1 caso(s)"
// se ve por todos lados y queda mal escrito.
const casos = (n) => (n === 1 ? '1 caso' : n.toLocaleString('es') + ' casos')

const span = (cls, texto) => {
  const s = document.createElement('span')
  s.className = cls
  s.textContent = texto
  return s
}

/** La línea del segundo nivel. Se abre sólo si sus filas dicen cosas distintas. */
const subLinea = (key, lis, eje, meta, { conFix, multiFile }) => {
  const mensajes = new Set(lis.map(mensajeDe))
  const desplegable = mensajes.size > 1
  const caja = document.createElement(desplegable ? 'details' : 'div')
  caja.className = 'sub-f'

  const linea = document.createElement(desplegable ? 'summary' : 'div')
  linea.className = 'sub-l'

  const m = eje === 'regla' ? meta[key] : null
  if (m) {
    linea.appendChild(span('sub-id', m.titulo))
  } else {
    // Eje inversión: el país sólo si la entrega trae más de uno. Con un archivo
    // solo, repetirlo en cada línea es ruido: es constante.
    if (multiFile) linea.appendChild(span('sub-pais', lis[0].dataset.pais))
    linea.appendChild(span('sub-id', key))
    const inv = lis[0].dataset.inversor
    if (inv) linea.appendChild(span('sub-inv', inv))
  }
  // Con varios mensajes distintos, lo que distingue a esta línea son las columnas
  // que toca: van en la línea y el detalle queda adentro del desplegable.
  if (desplegable) chipsColumnas(linea, columnasDe(lis).slice(0, MAX_COLUMNAS_EN_CABECERA))
  linea.appendChild(span('sub-filas', rangos(lis)))

  const meta2 = document.createElement('span')
  meta2.className = 'sub-meta'
  if (m) {
    const b = span('badge ' + m.cls, m.badge)
    meta2.appendChild(b)
  }
  meta2.appendChild(span('g-n', casos(lis.length)))
  if (lis.some((li) => li.dataset.publica === '0')) {
    meta2.appendChild(span('estado no', 'no publica'))
  }
  linea.appendChild(meta2)
  caja.appendChild(linea)

  // El MENSAJE en la línea. Es lo que de verdad distingue un caso de otro y estaba
  // escondido: dice qué columna está vacía, o qué otra inversión se quedó con el
  // id y en qué fila. Medido sobre una entrega de 21 países, 88 de las 90 líneas
  // tienen un solo mensaje distinto, así que casi siempre cabe entero acá y no hay
  // nada que desplegar. No se recorta: recortarlo esconde justo lo que se vino a
  // mostrar.
  if (!desplegable) {
    const p = document.createElement('p')
    p.className = 'sub-msg'
    p.textContent = [...mensajes][0]
    caja.appendChild(p)
  }

  // Con el corte por inversión el arreglo no cabe en la cabecera del grupo (la
  // cabecera es la inversión, no la regla), así que va acá, una vez por regla.
  if (conFix && m?.fix) {
    const p = document.createElement('p')
    p.className = 'sub-fix'
    p.textContent = m.fix
    caja.appendChild(p)
  }

  if (desplegable) {
    const ul = document.createElement('ul')
    ul.className = 'hallazgos'
    for (const li of lis) ul.appendChild(li)
    caja.appendChild(ul)
  }
  return caja
}

/**
 * Rearma la lista. Los nodos originales se MUEVEN, nunca se clonan: cuando el
 * segundo nivel no se despliega quedan fuera del documento, pero el arreglo
 * `items` los sigue teniendo y vuelven enteros al pasar a plano.
 */
const agrupar = (items, modo, meta, { abrirTodo, multiFile }) => {
  if (modo === 'nada') return null
  const [eje1, eje2] = NIVELES[modo] ?? NIVELES.regla

  const frag = document.createDocumentFragment()
  const grupos = porClave(items, eje1)
  for (const [key, lis] of grupos) {
    const det = document.createElement('details')
    det.className = 'grupo'
    const m = eje1 === 'regla' ? meta[key] : null

    const sum = document.createElement('summary')
    sum.appendChild(span('g-tit', m ? m.titulo : key))
    // La columna, en la cabecera del grupo. "Columna obligatoria vacía" no dice
    // cuál; "Columna obligatoria vacía · Project_Type" contesta el arreglo de un
    // vistazo, sin abrir nada. Si son muchas, la lista deja de ser una etiqueta y
    // el dato queda en cada línea.
    if (m) {
      const cols = columnasDe(lis)
      if (cols.length && cols.length <= MAX_COLUMNAS_EN_CABECERA) chipsColumnas(sum, cols)
    }
    if (m) sum.appendChild(span('badge ' + m.cls, m.badge))
    if (eje1 === 'id') {
      const inv = lis[0].dataset.inversor
      if (inv) sum.appendChild(span('sub-inv', inv))
      if (lis.some((li) => li.dataset.publica === '0')) sum.appendChild(span('estado no', 'no publica'))
    }
    sum.appendChild(span('g-n', casos(lis.length)))
    det.appendChild(sum)

    // La causa y el arreglo van UNA vez por grupo, no repetidos en cada caso.
    if (m && (m.causa || m.fix)) {
      const ayuda = document.createElement('div')
      ayuda.className = 'g-ayuda'
      if (m.causa) {
        const p = document.createElement('p')
        p.textContent = m.causa
        ayuda.appendChild(p)
      }
      if (m.fix) {
        const p = document.createElement('p')
        p.className = 'fix'
        p.appendChild(document.createElement('strong')).textContent = 'Cómo se corrige:'
        p.appendChild(document.createTextNode(' ' + m.fix))
        ayuda.appendChild(p)
      }
      det.appendChild(ayuda)
    }

    const cuerpo = document.createElement('div')
    cuerpo.className = 'sub'
    for (const [k2, lis2] of porClave(lis, eje2)) {
      cuerpo.appendChild(subLinea(k2, lis2, eje2, meta, { conFix: eje1 !== 'regla', multiFile }))
    }
    det.appendChild(cuerpo)

    // Con un filtro puesto se abre todo: buscar y tener que abrir trece grupos
    // para ver dónde cayó la coincidencia no es buscar.
    if (abrirTodo) det.open = true
    frag.appendChild(det)
  }
  // Sin filtro se abre el primero, para que se vea la forma de la lista sin
  // obligar a un clic que confirme que la página funciona.
  if (!abrirTodo) frag.firstChild?.setAttribute('open', '')
  return frag
}

/**
 * @param {ParentNode} root documento o contenedor donde se inyectó el informe
 */
export const wireReport = (root) => {
  const $ = (sel) => root.querySelector(sel)
  const $$ = (sel) => [...root.querySelectorAll(sel)]

  // ---- Índice ----
  //
  // Reemplazó a unas pestañas que escondían la mitad del informe: un índice
  // muestra todo lo que hay de un vistazo, que es exactamente lo que una barra de
  // pestañas impide. Los enlaces ya funcionan sin JS (son anclas); esto agrega
  // saber dónde estás y plegarlo cuando no hay ancho.
  const indice = $('#indice')
  if (indice) {
    const enlaces = new Map($$('#indice a[data-ix]').map((a) => [a.dataset.ix, a]))
    const secciones = $$('section.sec')

    // Resaltar la sección en curso. Se marca la primera visible empezando por
    // arriba, y no "la que más se ve": con secciones de alturas muy distintas
    // —una tira de tres renglones contra una lista de 251— la más visible es casi
    // siempre la larga, y el resaltado no se movería nunca.
    if ('IntersectionObserver' in window && secciones.length) {
      const visibles = new Set()
      const marcar = () => {
        // Si nada cae en la banda de observación —arriba de todo, donde el
        // encabezado y las tarjetas ocupan más que la banda— vale la última
        // sección que ya empezó, y si ninguna empezó, la primera. Sin esto el
        // índice arranca sin resaltar nada, que parece que no funciona.
        const actual =
          secciones.find((s) => visibles.has(s.id)) ??
          [...secciones].reverse().find((s) => s.getBoundingClientRect().top <= 0) ??
          secciones[0]
        for (const a of enlaces.values()) a.classList.remove('aqui')
        enlaces.get(actual.id.replace(/^sec-/, ''))?.classList.add('aqui')
      }
      const obs = new IntersectionObserver(
        (entradas) => {
          for (const e of entradas) {
            if (e.isIntersecting) visibles.add(e.target.id)
            else visibles.delete(e.target.id)
          }
          marcar()
        },
        // El margen inferior deja "en curso" la sección de arriba mientras siga
        // ocupando la parte alta de la pantalla, que es donde se está leyendo.
        { rootMargin: '0px 0px -70% 0px' }
      )
      for (const s of secciones) obs.observe(s)
    }

    // En angosto no hay lugar al costado: el índice se pliega arriba. Se emite
    // abierto para que sin JS quede utilizable, y acá se cierra si no hay ancho.
    // Sólo al cruzar el corte, para no pelearle al usuario que lo abrió a mano.
    const ANGOSTO = 900
    let eraAngosto = null
    const ajustar = () => {
      const angosto = window.innerWidth < ANGOSTO
      if (angosto === eraAngosto) return
      eraAngosto = angosto
      indice.open = !angosto
    }
    ajustar()
    window.addEventListener('resize', ajustar)

    // Al saltar a una sección en angosto, plegar el índice: si no, el destino
    // queda empujado abajo de una lista de ocho enlaces.
    for (const a of enlaces.values()) {
      a.addEventListener('click', () => {
        if (window.innerWidth < ANGOSTO) indice.open = false
      })
    }
  }

  // ---- Lista de hallazgos ----
  const lista = $('#lista')
  if (!lista) return

  const items = $$('#lista li.h')
  const $solo = $('#solo-bloqueantes')
  const $buscar = $('#buscar')
  const $conteo = $('#conteo')
  const $vacio = $('#sin-resultados')
  const botones = $$('.ctl-agrupar button[data-group]')

  let meta = {}
  const $meta = $('#reglas-meta')
  if ($meta) {
    try {
      meta = JSON.parse($meta.textContent)
    } catch {
      meta = {}
    }
  }

  // Por regla desde el arranque, siempre. El HTML se emite plano para que sin JS
  // el informe siga completo; el default de la herramienta es el agrupado.
  let modo = 'regla'
  const multiFile = new Set(items.map((li) => li.dataset.pais)).size > 1

  const aplicar = () => {
    const soloBloq = !!$solo?.checked
    const q = ($buscar?.value ?? '').trim().toLowerCase()
    const filtrando = soloBloq || !!q

    const visibles = []
    for (const li of items) {
      const ok = (!soloBloq || li.dataset.bloquea === '1') && (!q || li.dataset.buscar.includes(q))
      li.hidden = !ok
      if (ok) visibles.push(li)
    }

    lista.textContent = ''
    const frag = agrupar(visibles, modo, meta, { abrirTodo: filtrando, multiFile })
    if (frag) {
      lista.appendChild(frag)
    } else {
      const ul = document.createElement('ul')
      ul.className = 'hallazgos'
      for (const li of visibles) ul.appendChild(li)
      lista.appendChild(ul)
    }

    if ($conteo) {
      $conteo.textContent =
        visibles.length === items.length
          ? items.length.toLocaleString('es') + ' hallazgo(s)'
          : `${visibles.length.toLocaleString('es')} de ${items.length.toLocaleString('es')} hallazgo(s)`
    }
    if ($vacio) $vacio.hidden = visibles.length > 0
  }

  $solo?.addEventListener('change', aplicar)
  $buscar?.addEventListener('input', aplicar)
  for (const b of botones) {
    if (b.dataset.group === modo) b.classList.add('on')
    else b.classList.remove('on')
    b.addEventListener('click', () => {
      modo = b.dataset.group
      for (const o of botones) o.classList.toggle('on', o === b)
      aplicar()
    })
  }

  aplicar()
}
