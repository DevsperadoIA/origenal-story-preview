// Editor visual local de origenalstory.com (solo en http://localhost:8144/admin/).
// Clic en un texto o una foto para cambiarlo; Secciones, Diseño y Más campos en el panel lateral;
// «Guardar» escribe en content/*.json y la web se regenera.
(() => {
  const ED = window.ED;
  const pending = new Map();            // clave [fichero, ruta] -> {f, p, v}
  const key = (f, p) => JSON.stringify([f, p]);
  const info = (el) => JSON.parse(el.dataset.ed || el.dataset.edImg);
  const url = (rel) => ED.admin + rel.replace(/index\.html$/, '');
  const TYPED = ['sections', 'body'];
  let current = null;

  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // ---------------------------------------------------------------- barra inferior
  const bar = document.createElement('div');
  bar.id = 'ed-bar';
  const opts = ED.pages.map((p) => `<option value="${esc(p.rel)}"${p.rel === ED.page ? ' selected' : ''}>${esc(p.t)}</option>`).join('');
  const nMore = ED.groups.filter((g) => g.file !== 'design').reduce((n, g) => n + g.fields.length, 0);
  bar.innerHTML = `
    <div class="ed-row">
      <a class="ed-brand" href="/admin/panel/" title="Panel: secciones, blog, cuestionario, diseño, ajustes y publicar">← Panel</a>
      <select id="ed-pages" title="Ir a otra página">${opts}</select>
      ${(ED.langs || []).length > 1 ? `<select id="ed-lang" title="Idioma que estás viendo y corrigiendo">${ED.langs.map((l) => `<option value="${l.v}"${l.v === (ED.lang || 'en') ? ' selected' : ''}>${esc(l.l)}</option>`).join('')}</select>` : ''}
      ${ED.lang ? '<span class="ed-hidden">Traducción: aquí solo se corrigen textos. Fotos, secciones y diseño se cambian en inglés.</span>' : ''}
      <button id="ed-newpage" title="Crea una página nueva con bloques">+ Página</button>
      ${ED.blog ? '<button id="ed-pnew">+ Artículo</button>' : ''}
      ${ED.hidden ? '<span class="ed-hidden">Oculta: no sale en la web (Más campos → Publicado)</span>' : ''}
      <span class="ed-sp"></span>
      ${ED.sections ? '<button id="ed-secs">Secciones</button>' : ''}
      <button id="ed-design">Diseño</button>
      <button id="ed-more">Más campos (${nMore})</button>
      ${ED.pageFile ? '<button id="ed-pdup" title="Crea una copia de esta página">Duplicar</button><button id="ed-pdel" class="ed-danger">Borrar</button>' : ''}
      <a id="ed-view" href="/${ED.lang ? ED.lang + '/' : ''}${esc(ED.page.replace(/index\.html$/, ''))}" target="_blank" title="La web tal y como queda">Ver web ↗</a>
      <button id="ed-save" class="ed-primary" disabled>Guardar</button>
    </div>
    <div class="ed-row ed-row2">
      <span class="ed-field" id="ed-field">Haz clic en cualquier texto o foto para cambiarlo. Para usar un enlace o un botón: Alt + clic.</span>
      <span class="ed-ctx" id="ed-item"><button id="ed-dup" title="Añade otro igual justo después">+ Duplicar</button><button id="ed-del" class="ed-danger">− Quitar</button></span>
      <span class="ed-ctx" id="ed-block"><span class="ed-lbl">Bloque:</span><button id="ed-bup" title="Subir">↑</button><button id="ed-bdown" title="Bajar">↓</button><select id="ed-btype"></select><button id="ed-badd">+ Añadir debajo</button><button id="ed-bdel" class="ed-danger">Quitar bloque</button></span>
    </div>`;
  document.body.appendChild(bar);
  if (ED.lang) bar.classList.add('ed-tr');
  if (document.getElementById('ed-lang')) {
    document.getElementById('ed-lang').addEventListener('change', (ev) => {
      const go = () => { location.href = `${window.OS_BASE || ''}/admin/${ev.target.value === 'en' ? '' : ev.target.value + '/'}${ED.page.replace(/index\.html$/, '')}`; };
      if (pending.size && !confirm('Tienes cambios sin guardar. ¿Cambiar de idioma sin guardar?')) { ev.target.value = ED.lang || 'en'; return; }
      go();
    });
  }
  const toast = document.createElement('div');
  toast.id = 'ed-toast';
  document.body.appendChild(toast);
  const $ = (id) => document.getElementById(id);

  function say(msg, err) {
    toast.textContent = msg;
    toast.className = 'on' + (err ? ' err' : '');
    clearTimeout(say.t);
    say.t = setTimeout(() => { toast.className = ''; }, err ? 6000 : 2600);
  }
  function refresh() {
    const n = pending.size;
    $('ed-save').disabled = !n;
    $('ed-save').textContent = n ? `Guardar (${n})` : 'Guardar';
  }
  function mark(f, p, v, g) { pending.set(key(f, p), g ? { f, p, v, g } : { f, p, v }); refresh(); }

  async function api(name, body) {
    const r = await fetch(`/_ed/api/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({ ok: false, error: `Error ${r.status}` }));
    if (!j.ok) throw new Error(j.error || 'Error');
    return j;
  }
  function reload(to) {
    sessionStorage.setItem('ed-scroll', JSON.stringify({ page: ED.page, y: scrollY, side: side.dataset.mode && side.classList.contains('on') ? side.dataset.mode : '' }));
    pending.clear();
    if (to) location.href = to; else location.reload();
  }
  // Guarda lo pendiente y despues hace la accion (que recarga la pagina)
  async function save(then) {
    if (pending.size) {
      $('ed-save').disabled = true;
      $('ed-save').textContent = 'Guardando…';
      try { await api('save', { changes: [...pending.values()] }); }
      catch (err) { say('No se ha guardado: ' + err.message, true); if (window.OS_DEMO) { pending.clear(); refresh(); if (then) then(); return; } refresh(); return; }
      pending.clear();
      if (!then) { sessionStorage.setItem('ed-msg', 'Guardado. La web ya está actualizada.'); reload(); return; }
    }
    if (then) then();
  }
  async function act(name, body, msg, to) {
    await save(async () => {
      try {
        const j = await api(name, body);
        if (msg) sessionStorage.setItem('ed-msg', msg);
        reload(to || j.url);
      } catch (err) { say(err.message, true); }
    });
  }

  // ---------------------------------------------------------------- textos
  function levels(p) {
    let block = -1;
    p.forEach((k, i) => { if (typeof k === 'number' && TYPED.includes(p[i - 1])) block = i; });
    let item = -1;
    p.forEach((k, i) => { if (typeof k === 'number' && i > block) item = i; });
    return { block, item };
  }
  document.querySelectorAll('.ed').forEach((el) => {
    el.dataset.orig = el.textContent;
    el.addEventListener('focus', () => {
      current = el;
      const d = info(el);
      $('ed-field').innerHTML = `Editando: <b>${esc(d.l)}</b>`;
      const lv = levels(d.p);
      $('ed-item').classList.toggle('on', lv.item >= 0);
      $('ed-block').classList.toggle('on', lv.block >= 0);
      if (lv.block >= 0) {
        const list = d.p[lv.block - 1] === 'body' ? ED.bodyTypes : (ED.sections ? ED.sections.types : []);
        $('ed-btype').innerHTML = list.map((t) => `<option value="${esc(t.v)}">${esc(t.l)}</option>`).join('');
      }
    });
    el.addEventListener('input', () => {
      const d = info(el);
      const v = el.textContent;
      el.classList.toggle('ed-dirty', v !== el.dataset.orig);
      document.querySelectorAll('.ed').forEach((o) => { if (o !== el && o.dataset.ed === el.dataset.ed) { o.textContent = v; o.classList.add('ed-dirty'); } });
      if (v === el.dataset.orig) { pending.delete(key(d.f, d.p)); refresh(); } else mark(d.f, d.p, v, d.g);
    });
    el.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === 'Escape') { ev.preventDefault(); el.blur(); }
    });
  });

  // En el editor un clic es para ESCRIBIR. Un clic en un texto, o en cualquier parte de un boton, enlace, pestaña o
  // desplegable que tenga texto editable, pone el cursor en ese texto: ni navega ni acciona nada.
  // Para usar de verdad el enlace o el boton: Alt + clic (o Ctrl + clic).
  const nearest = (host, ev) => [...host.querySelectorAll('.ed')].map((el) => {
    const r = el.getBoundingClientRect();
    const dx = Math.max(r.left - ev.clientX, 0, ev.clientX - r.right);
    const dy = Math.max(r.top - ev.clientY, 0, ev.clientY - r.bottom);
    return [dx * dx + dy * dy, el];
  }).sort((x, y) => x[0] - y[0])[0][1];
  const leave = (a) => {
    const h = a.getAttribute('href');
    if (/^(https?:|mailto:|tel:)/.test(h)) { window.open(a.href, '_blank', 'noopener'); return; }
    if (h.startsWith('#')) { location.hash = h; return; }
    if (pending.size && !confirm('Tienes cambios sin guardar. ¿Salir sin guardar?')) return;
    pending.clear();
    location.href = a.href;
  };
  document.addEventListener('click', (ev) => {
    if (ev.target.closest('#ed-bar, #ed-side, #ed-toast') || ev.target.matches('input, textarea, select')) return;
    const text = ev.target.closest('.ed');
    const img = ev.target.closest('img[data-ed-img]');
    const host = ev.target.closest('a, button, label, summary, [role=button]');
    const a = ev.target.closest('a[href]');
    if (ev.altKey || ev.ctrlKey || ev.metaKey) {   // usar el enlace o el boton
      if (a) { ev.preventDefault(); ev.stopPropagation(); leave(a); }
      return;
    }
    if (img) { if (host) ev.preventDefault(); return; }   // la foto se cambia con su propio clic
    if (text || (host && host.querySelector('.ed'))) {
      ev.preventDefault();
      ev.stopPropagation();
      if (!text) {
        const el = nearest(host, ev);
        el.focus();
        const sel = getSelection();
        sel.selectAllChildren(el);
        sel.collapseToEnd();
      }
      return;
    }
    if (a) { ev.preventDefault(); leave(a); }   // enlaces sin texto (el logo, una flecha): se sigue dentro del editor
  }, true);
  document.querySelectorAll('form').forEach((f) => f.addEventListener('submit', (ev) => { ev.preventDefault(); ev.stopImmediatePropagation(); }, true));
  // dentro de un texto, las teclas son para escribir (que el espacio o Intro no activen el boton que lo contiene)
  ['keydown', 'keyup', 'keypress'].forEach((type) => document.addEventListener(type, (ev) => {
    // solo se corta el paso hacia el boton; no se impide escribir
    if (type !== 'keydown' && ev.target.closest && ev.target.closest('.ed') && (ev.key === ' ' || ev.key === 'Enter')) ev.stopPropagation();
  }, true));
  // arrastrar para seleccionar texto dentro de un enlace no debe arrastrar el enlace
  document.querySelectorAll('a, img').forEach((el) => { if (el.querySelector('.ed') || el.closest('a')) el.draggable = false; });

  // Duplicar / quitar un elemento de una lista, y mover / anadir / quitar bloques
  [['ed-dup', 'dup'], ['ed-del', 'del']].forEach(([id, op]) => {
    $(id).addEventListener('mousedown', (ev) => ev.preventDefault());
    $(id).addEventListener('click', () => {
      if (!current) return;
      const d = info(current);
      if (op === 'del' && !confirm(`¿Quitar «${current.textContent.slice(0, 60)}»?`)) return;
      act('list', { f: d.f, p: d.p, op, level: levels(d.p).item }, op === 'dup' ? 'Duplicado. Cambia el texto de la copia.' : 'Quitado.');
    });
  });
  [['ed-bup', 'up'], ['ed-bdown', 'down'], ['ed-badd', 'add'], ['ed-bdel', 'del']].forEach(([id, op]) => {
    $(id).addEventListener('mousedown', (ev) => ev.preventDefault());
    $(id).addEventListener('click', () => {
      if (!current) return;
      const d = info(current);
      if (op === 'del' && !confirm('¿Quitar este bloque entero?')) return;
      act('list', { f: d.f, p: d.p, op, level: levels(d.p).block, type: $('ed-btype').value },
        { add: 'Bloque añadido debajo.', del: 'Bloque quitado.' }[op]);
    });
  });
  $('ed-btype').addEventListener('mousedown', (ev) => ev.stopPropagation());

  // ---------------------------------------------------------------- fotos
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = 'image/*';
  let pickFor = null;
  picker.addEventListener('change', () => {
    const file = picker.files[0];
    if (!file || !pickFor) return;
    const target = pickFor;
    const rd = new FileReader();
    rd.onload = () => { say('Subiendo foto…'); act('image', { f: target.f, p: target.p, name: file.name, data: rd.result }, 'Foto cambiada.'); };
    rd.readAsDataURL(file);
    picker.value = '';
  });
  function pickImage(target) { pickFor = target; picker.click(); }
  document.querySelectorAll('img[data-ed-img]').forEach((img) => {
    img.title = 'Clic para cambiar esta foto · ' + info(img).l;
    img.addEventListener('click', (ev) => { if (ev.altKey) return; ev.preventDefault(); pickImage(info(img)); });
  });

  // ---------------------------------------------------------------- paginas
  $('ed-pages').addEventListener('change', (ev) => {
    const go = url(ev.target.value);
    if (pending.size && confirm('Tienes cambios sin guardar. ¿Guardarlos antes de cambiar de página?')) save(() => { location.href = go; });
    else { pending.clear(); location.href = go; }
  });
  $('ed-newpage').addEventListener('click', () => {
    const title = prompt('Nombre de la página nueva (por ejemplo: Trade fairs 2027)');
    if (title && title.trim()) act('page', { op: 'newpage', title: title.trim() }, 'Página creada (oculta). Cambia sus textos, añade secciones y en «Más campos» la publicas.');
  });
  if (ED.blog) $('ed-pnew').addEventListener('click', () => act('page', { op: 'new' }, 'Artículo creado (oculto). Cambia título, foto y texto; en «Más campos» lo publicas y eliges en qué servicios sale.'));
  if (ED.pageFile) {
    $('ed-pdup').addEventListener('click', () => act('page', { op: 'dup', f: ED.pageFile }, 'Copia creada. Las copias de proyectos, artículos y páginas empiezan ocultas.'));
    $('ed-pdel').addEventListener('click', () => {
      if (confirm('¿Borrar esta página para siempre? (También puedes ocultarla en «Más campos» → Publicado.)')) act('page', { op: 'del', f: ED.pageFile }, 'Página borrada.');
    });
  }
  $('ed-save').addEventListener('click', () => save());
  document.addEventListener('keydown', (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') { ev.preventDefault(); save(); }
  });
  addEventListener('beforeunload', (ev) => { if (pending.size) { ev.preventDefault(); ev.returnValue = ''; } });

  // ---------------------------------------------------------------- panel lateral
  const side = document.createElement('aside');
  side.id = 'ed-side';
  document.body.appendChild(side);
  const names = { 'site.json': 'Datos generales (todas las páginas)', 'home.json': 'Inicio', 'services.json': 'Servicios: textos comunes',
    'blog.json': 'Blog: textos comunes', 'work.json': 'Proyectos: textos comunes', 'about.json': 'About', 'founder.json': 'Fundadora',
    'contact.json': 'Contacto' };
  const groupName = (f) => names[f] || (f.startsWith('works/') ? 'Este proyecto' : f.startsWith('posts/') ? 'Este artículo'
    : f.startsWith('pages/') ? 'Esta página' : 'Este servicio');
  let uid = 0;

  function fieldHtml(x) {
    const id = `ed-x${uid++}`;
    const hint = x.h ? `<small>${esc(x.h)}</small>` : '';
    const lab = `<label for="${id}">${esc(x.l)}${hint}</label>`;
    const data = `data-k="${esc(JSON.stringify({ f: x.f, p: x.p, w: x.w }))}" id="${id}"`;
    switch (x.w) {
      case 'boolean':
        return `<label class="ed-check"><input type="checkbox" ${data}${x.v ? ' checked' : ''}> ${esc(x.l)}</label>${hint}`;
      case 'number':
        return `${lab}<input type="number" ${data} value="${esc(x.v)}">`;
      case 'text':
        return `${lab}<textarea ${data}>${esc(x.v)}</textarea>`;
      case 'lines':
        return `${lab}<textarea ${data} placeholder="Uno por línea">${esc((x.v || []).join('\n'))}</textarea>`;
      case 'color':
        return `${lab}<div class="ed-colorrow"><input type="color" ${data} value="${esc(/^#[0-9a-f]{6}$/i.test(x.v) ? x.v : '#ffffff')}"${x.v ? '' : ' data-empty="1"'}>
          <code>${esc(x.v || 'sin color')}</code><button type="button" class="ed-clear" data-for="${id}">Quitar</button></div>`;
      case 'select':
        return `${lab}<select ${data}>${x.o.map((o) => `<option value="${esc(o.v)}"${o.v === x.v ? ' selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`;
      case 'relation':
        if (x.multiple) {
          return `${lab}<div class="ed-checks" ${data}>${x.o.map((o) => `<label><input type="checkbox" value="${esc(o.v)}"${(x.v || []).includes(o.v) ? ' checked' : ''}>${esc(o.l)}</label>`).join('')}</div>`;
        }
        return `${lab}<select ${data}><option value="">(ninguno)</option>${x.o.map((o) => `<option value="${esc(o.v)}"${o.v === x.v ? ' selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`;
      case 'image':
        return `${lab}<div class="ed-imgrow"><img src="${esc(x.v || '')}" alt=""><button type="button" ${data}>Cambiar foto…</button></div>`;
      default:
        return `${lab}<input type="text" ${data} value="${esc(x.v)}">`;
    }
  }

  function sectionsHtml() {
    const S = ED.sections;
    const rows = S.list.map((s) => `
      <div class="ed-sec${s.hidden ? ' off' : ''}" data-i="${s.i}">
        <div class="ed-sec-top">
          <span class="ed-sec-name">${s.type === 'builtin' ? '' : '<em>bloque</em> '}${esc(s.label)}${s.hidden ? ' <i>(oculta)</i>' : ''}</span>
          <span class="ed-sec-btns">
            <button data-sop="up" title="Subir">↑</button><button data-sop="down" title="Bajar">↓</button>
            <button data-sop="toggle">${s.hidden ? 'Mostrar' : 'Ocultar'}</button>
            <label class="ed-swatch" title="Color de fondo"><input type="color" data-sbg value="${esc(s.bg || '#ffffff')}"><span style="background:${esc(s.bg || 'transparent')}"></span></label>
            ${s.bg ? '<button data-sop="nobg" title="Quitar el color de fondo">Sin fondo</button>' : ''}
            ${s.type === 'builtin' ? '' : '<button data-sop="del" class="ed-danger">Borrar</button>'}
          </span>
        </div>
        ${s.fields.length ? `<details class="ed-sec-fields"><summary>Más opciones (${s.fields.length})</summary>${s.fields.map(fieldHtml).join('')}</details>` : ''}
      </div>`).join('');
    const where = S.list.map((s) => `<option value="${s.i}"${s.i === S.list.length - 1 ? ' selected' : ''}>después de: ${esc(s.label.slice(0, 38))}</option>`).join('');
    return `<p class="ed-help">Ordena, oculta o pinta las secciones de esta página, o añade bloques nuevos. Los textos de cada bloque se cambian haciendo clic en la página.</p>
      ${rows}
      <div class="ed-add"><b>Añadir sección</b>
        <select id="ed-addtype">${S.types.map((t) => `<option value="${esc(t.v)}">${esc(t.l)}</option>`).join('')}</select>
        <select id="ed-addpos"><option value="-1">al principio</option>${where}</select>
        <button id="ed-addgo" class="ed-primary-btn">Añadir</button></div>`;
  }

  function openSide(mode) {
    side.dataset.mode = mode;
    let body = '';
    let title = '';
    if (mode === 'sections') { title = 'Secciones de esta página'; body = sectionsHtml(); }
    if (mode === 'design') {
      title = 'Diseño';
      const g = ED.groups.find((x) => x.file === 'design');
      body = `<p class="ed-help">Colores y tipografías de toda la web. Guarda para verlos aplicados. Las tipografías son nombres de Google Fonts.</p>${(g ? g.fields : []).map(fieldHtml).join('')}`;
    }
    if (mode === 'more') {
      title = 'Más campos';
      body = ED.groups.filter((g) => g.file !== 'design' && g.fields.length).map((g, gi) =>
        `<details${gi === 0 ? ' open' : ''}><summary>${esc(groupName(g.file))} (${g.fields.length})</summary>${g.fields.map(fieldHtml).join('')}</details>`).join('');
    }
    side.innerHTML = `<header><b>${title}</b><button id="ed-close" title="Cerrar">×</button></header><div class="ed-body">${body}</div>`;
    side.classList.add('on');
    $('ed-close').addEventListener('click', () => side.classList.remove('on'));
  }
  if (ED.sections) $('ed-secs').addEventListener('click', () => openSide('sections'));
  $('ed-design').addEventListener('click', () => openSide('design'));
  $('ed-more').addEventListener('click', () => openSide('more'));

  side.addEventListener('input', (ev) => {
    if (ev.target.matches('[data-sbg]')) return;
    const box = ev.target.closest('[data-k]');
    if (!box) return;
    const k = JSON.parse(box.dataset.k);
    let v;
    if (k.w === 'boolean') v = box.checked;
    else if (k.w === 'relation' && box.classList.contains('ed-checks')) v = [...box.querySelectorAll('input:checked')].map((i) => i.value);
    else if (k.w === 'lines') v = box.value.split('\n');
    else v = box.value;
    if (k.w === 'color') { box.removeAttribute('data-empty'); box.nextElementSibling.textContent = v; }
    box.classList.add('ed-dirty');
    mark(k.f, k.p, v);
  });
  side.addEventListener('change', (ev) => {
    const sw = ev.target.closest('[data-sbg]');
    if (sw) act('section', { f: ED.sections.file, op: 'bg', i: +sw.closest('.ed-sec').dataset.i, color: sw.value }, 'Color de fondo cambiado.');
  });
  side.addEventListener('click', (ev) => {
    const img = ev.target.closest('button[data-k]');
    if (img) { const k = JSON.parse(img.dataset.k); pickImage({ f: k.f, p: k.p }); return; }
    const clr = ev.target.closest('.ed-clear');
    if (clr) {
      const inp = $(clr.dataset.for);
      const k = JSON.parse(inp.dataset.k);
      inp.dataset.empty = '1';
      inp.nextElementSibling.textContent = 'sin color';
      mark(k.f, k.p, '');
      return;
    }
    const sb = ev.target.closest('[data-sop]');
    if (sb) {
      const i = +sb.closest('.ed-sec').dataset.i;
      const op = sb.dataset.sop;
      if (op === 'del' && !confirm('¿Borrar este bloque?')) return;
      if (op === 'nobg') act('section', { f: ED.sections.file, op: 'bg', i, color: '' }, 'Color de fondo quitado.');
      else act('section', { f: ED.sections.file, op, i }, { up: 'Sección subida.', down: 'Sección bajada.', toggle: 'Hecho.', del: 'Bloque borrado.' }[op]);
      return;
    }
    if (ev.target.id === 'ed-addgo') {
      act('section', { f: ED.sections.file, op: 'add', type: $('ed-addtype').value, i: +$('ed-addpos').value },
        'Sección añadida. Haz clic en sus textos para cambiarlos.');
    }
  });

  // Volver al mismo sitio (y al mismo panel) tras guardar
  try {
    const s = JSON.parse(sessionStorage.getItem('ed-scroll') || 'null');
    if (s && s.page === ED.page) {
      addEventListener('load', () => scrollTo(0, s.y));
      if (s.side) openSide(s.side);
    }
    sessionStorage.removeItem('ed-scroll');
    const m = sessionStorage.getItem('ed-msg');
    if (m) { sessionStorage.removeItem('ed-msg'); say(m); }
  } catch (_) { /* sin sessionStorage: no pasa nada */ }
})();
