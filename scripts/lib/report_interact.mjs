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

/** Rearma la lista agrupando los nodos que YA existen. Nunca clona ni recrea. */
const agrupar = (items, modo, meta) => {
  if (modo === 'nada') return null

  const grupos = new Map()
  for (const li of items) {
    const key =
      modo === 'regla' ? li.dataset.regla : modo === 'id' ? li.dataset.id || '—' : li.dataset.pais
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key).push(li)
  }

  // Los que bloquean primero, después los más numerosos: el orden en que se
  // trabaja. Un grupo de 70 celdas vacías es un solo gesto en Excel.
  const orden = [...grupos.entries()].sort((a, b) => {
    const bloq = (xs) => (xs.some((li) => li.dataset.bloquea === '1') ? 0 : 1)
    return bloq(a[1]) - bloq(b[1]) || b[1].length - a[1].length
  })

  const frag = document.createDocumentFragment()
  for (const [key, lis] of orden) {
    const det = document.createElement('details')
    det.className = 'grupo'
    const m = modo === 'regla' ? meta[key] : null

    const sum = document.createElement('summary')
    const tit = document.createElement('span')
    tit.className = 'g-tit'
    tit.textContent = m ? m.titulo : key
    sum.appendChild(tit)
    if (m) {
      const b = document.createElement('span')
      b.className = 'badge ' + m.cls
      b.textContent = m.badge
      sum.appendChild(b)
    }
    const cuenta = document.createElement('span')
    cuenta.className = 'g-n'
    cuenta.textContent = lis.length + ' caso(s)'
    sum.appendChild(cuenta)
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
        p.innerHTML = '<strong>Cómo se corrige:</strong> '
        p.appendChild(document.createTextNode(m.fix))
        ayuda.appendChild(p)
      }
      det.appendChild(ayuda)
    }

    const ul = document.createElement('ul')
    ul.className = 'hallazgos'
    for (const li of lis) ul.appendChild(li)
    det.appendChild(ul)
    frag.appendChild(det)
  }
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

  const ul0 = lista.querySelector('ul.hallazgos')
  const autogroup = ul0?.dataset.autogroup === '1'
  let modo = autogroup ? 'regla' : 'nada'

  const aplicar = () => {
    const soloBloq = !!$solo?.checked
    const q = ($buscar?.value ?? '').trim().toLowerCase()

    const visibles = []
    for (const li of items) {
      const ok = (!soloBloq || li.dataset.bloquea === '1') && (!q || li.dataset.buscar.includes(q))
      li.hidden = !ok
      if (ok) visibles.push(li)
    }

    lista.textContent = ''
    const frag = agrupar(visibles, modo, meta)
    if (frag) {
      lista.appendChild(frag)
      // Con la lista plegada por volumen, abrir el primer grupo da algo que mirar
      // sin obligar a un clic para ver que la página funciona.
      if (autogroup) lista.querySelector('details.grupo')?.setAttribute('open', '')
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
