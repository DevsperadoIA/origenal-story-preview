// Panel de administracion local de origenalstory.com (http://localhost:8144/admin/panel/).
// Formularios de todo el contenido (generados desde campos.yml), secciones con arrastrar y soltar,
// blog rapido y programado, idiomas, quiz, diseno, ajustes y publicar.
(() => {
  'use strict';
  const S = { data: null, dirty: false, view: 'home', arg: null };
  const view = document.getElementById('view');
  const menu = document.getElementById('menu');
  const toastEl = document.getElementById('toast');

  // ---------------------------------------------------------------- utilidades
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const plain = (s) => String(s ?? '').replace(/\*(.+?)\*/g, '$1');
  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v === false || v == null) return;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'class') el.className = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    kids.flat().forEach((k) => { if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(k)); });
    return el;
  }
  function toast(msg, err) {
    toastEl.textContent = msg;
    toastEl.className = 'on' + (err ? ' err' : '');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { toastEl.className = ''; }, err ? 7000 : 2800);
  }
  async function api(name, body = {}) {
    const r = await fetch(`/_ed/api/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({ ok: false, error: `Error ${r.status}` }));
    if (!j.ok && !j.login) throw new Error(j.error || 'Error');
    return j;
  }
  async function load() { S.data = await api('state'); }
  function dirty(on = true) {
    S.dirty = on;
    document.body.classList.toggle('is-dirty', on);
  }
  addEventListener('beforeunload', (ev) => { if (S.dirty) { ev.preventDefault(); ev.returnValue = ''; } });
  const readFile = (file) => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = ko; r.readAsDataURL(file); });
  async function upload(file) {
    toast('Subiendo foto…');
    const j = await api('upload', { name: file.name, data: await readFile(file) });
    toast('Foto subida.');
    return j.path;
  }
  function pickFile(accept = 'image/*') {
    return new Promise((ok) => {
      const i = h('input', { type: 'file', accept });
      i.addEventListener('change', () => ok(i.files[0] || null));
      i.click();
    });
  }
  const fmtWhen = (w) => { const [d, t] = String(w).split(' '); const [y, m, dd] = (d || '').split('-'); return y ? `${dd}/${m}/${y} ${t || ''}` : w; };

  // ---------------------------------------------------------------- esquema (campos.yml)
  function fieldsFor(rel) {
    for (const c of S.data.schema) {
      for (const fi of c.files || []) if (fi.file === `content/${rel}`) return fi.fields;
      if (c.folder && rel.startsWith(c.folder.slice(8) + '/')) return c.fields;
    }
    return [];
  }
  const typeDef = (f, name) => (f.types || []).find((t) => t.name === name);
  function newItem(f, type) {
    const fields = type ? (typeDef(f, type) || {}).fields || [] : f.fields || [];
    const item = type ? { type } : {};
    fields.forEach((x) => {
      if ('default' in x) item[x.name] = clone(x.default);
      else if (['string', 'text', undefined].includes(x.widget) && x.required !== false) item[x.name] = 'Write here';
    });
    return item;
  }
  function options(collection) {
    const F = S.data.files;
    const pre = { works: 'works/', posts: 'posts/', legal: 'legal/' }[collection] || 'services/';
    const keys = Object.keys(F).filter((k) => k.startsWith(pre)).sort();
    if (collection === 'legal') return keys.map((k) => ({ v: k.slice(6, -5), l: F[k].title }));
    if (collection === 'works') return keys.map((k) => ({ v: k.slice(6, -5), l: `${F[k].client} — ${F[k].title}` }));
    if (collection === 'posts') return keys.map((k) => ({ v: k.slice(6, -5), l: F[k].title }));
    return keys.map((k) => ({ v: k.slice(9, -5), l: `${F[k].num || ''} · ${F[k].name}` })).sort((a, b) => a.l.localeCompare(b.l));
  }
  function pageKey(rel) {
    if (rel.includes('/')) return { services: 'service', works: 'case', posts: 'post', pages: 'page' }[rel.split('/')[0]];
    return { 'home.json': 'home', 'services.json': 'services', 'work.json': 'work', 'blog.json': 'blog', 'about.json': 'about',
      'founder.json': 'founder', 'contact.json': 'contact' }[rel];
  }
  function sectionsOf(data, key) {
    const defaults = (S.data.sectionDefs[key] || []).map(([id]) => ({ type: 'builtin', id }));
    const secs = clone(data.sections || []);
    if (!secs.length) return defaults;
    const have = new Set(secs.filter((s) => s.type === 'builtin').map((s) => s.id));
    defaults.forEach((d, k) => { if (!have.has(d.id)) secs.splice(Math.min(k, secs.length), 0, d); });
    return secs;
  }
  const builtinLabel = (key, id) => ((S.data.sectionDefs[key] || []).find(([i]) => i === id) || [id, id])[1];

  // Nombre de cada fichero para el usuario
  function fileName(rel) {
    const F = S.data.files[rel] || {};
    const fixed = { 'home.json': 'Inicio', 'services.json': 'Servicios (página general)', 'work.json': 'Proyectos (página general)',
      'blog.json': 'Blog (página general)', 'about.json': 'About', 'founder.json': 'Fundadora', 'contact.json': 'Contacto',
      'site.json': 'Datos generales', 'quiz.json': 'Quiz' };
    if (fixed[rel]) return fixed[rel];
    if (rel.startsWith('services/')) return `Servicio ${F.num || ''} · ${F.name || ''}`;
    if (rel.startsWith('works/')) return `Proyecto · ${F.client || ''} — ${F.title || ''}`;
    if (rel.startsWith('posts/')) return `Artículo · ${F.title || ''}`;
    if (rel.startsWith('pages/')) return `Página · ${plain(F.title || '')}`;
    if (rel.startsWith('legal/')) return `Legal · ${F.title || ''}`;
    return rel;
  }
  function visualUrl(rel) {
    const slug = rel.includes('/') ? rel.split('/')[1].slice(0, -5) : '';
    if (rel.startsWith('services/')) return `/admin/services/${slug}/`;
    if (rel.startsWith('works/')) return `/admin/work/${slug}/`;
    if (rel.startsWith('posts/')) return `/admin/blog/${slug}/`;
    if (rel.startsWith('pages/')) return `/admin/${slug}/`;
    if (rel.startsWith('legal/')) return `/admin/legal/${slug}/`;
    return { 'home.json': '/admin/', 'services.json': '/admin/services/', 'work.json': '/admin/work/', 'blog.json': '/admin/blog/',
      'about.json': '/admin/about/', 'founder.json': '/admin/about/founder/', 'contact.json': '/admin/contact/', 'quiz.json': '/admin/quiz/' }[rel] || '/admin/';
  }

  // ---------------------------------------------------------------- formularios generados desde el esquema
  function form(fields, obj, opts = {}) {
    const wrap = h('div');
    fields.forEach((f) => {
      if (f.widget === 'hidden' || (opts.skip || []).includes(f.name)) return;
      wrap.append(field(f, obj));
    });
    return wrap;
  }
  function field(f, obj) {
    const w = f.widget || 'string';
    const hint = f.hint ? h('small', {}, f.hint) : null;
    const set = (v) => { obj[f.name] = v; dirty(); };
    const val = obj[f.name];
    const box = h('div', { class: 'f' });
    const lab = () => h('label', {}, f.label || f.name);
    if (w === 'object') {
      if (!obj[f.name] || typeof obj[f.name] !== 'object') obj[f.name] = {};
      const fs = h('fieldset', { class: 'obj' }, h('legend', {}, f.label || f.name));
      fs.append(form(f.fields || [], obj[f.name]));
      return fs;
    }
    if (w === 'list') { box.append(lab(), hint || '', listEditor(f, obj)); return box; }
    if (w === 'boolean') {
      const cb = h('input', { type: 'checkbox', onchange: (e) => set(e.target.checked) });
      cb.checked = !!val;
      box.append(h('label', { class: 'check' }, cb, f.label || f.name), hint || '');
      return box;
    }
    let input;
    if (w === 'text') {
      input = h('textarea', { oninput: (e) => set(e.target.value) });
      input.value = val ?? '';
    } else if (w === 'number') {
      input = h('input', { type: 'number', value: val ?? '', oninput: (e) => set(e.target.value === '' ? 0 : parseInt(e.target.value, 10)) });
    } else if (w === 'select') {
      input = h('select', { onchange: (e) => set(e.target.value) }, (f.options || []).map((o) => h('option', { value: o.value, selected: o.value === val }, o.label)));
    } else if (w === 'color') {
      const swatch = h('code', {}, val || 'sin color');
      const c = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(val || '') ? val : '#ffffff', oninput: (e) => { set(e.target.value); swatch.textContent = e.target.value; } });
      input = h('div', { class: 'colorrow' }, c, swatch, h('button', { type: 'button', class: 'btn sm', onclick: () => { set(''); swatch.textContent = 'sin color'; } }, 'Quitar'));
    } else if (w === 'image') {
      input = imageInput(val, set);
    } else if (w === 'file') {
      input = fileInput(val, set, f.accept);
    } else if (w === 'relation') {
      const opts = options(f.collection);
      if (f.multiple) {
        const cur = new Set(Array.isArray(val) ? val : []);
        input = h('div', { class: 'checks' }, opts.map((o) => {
          const cb = h('input', { type: 'checkbox', value: o.v, onchange: (e) => { e.target.checked ? cur.add(o.v) : cur.delete(o.v); set(opts.map((x) => x.v).filter((v) => cur.has(v))); } });
          cb.checked = cur.has(o.v);
          return h('label', {}, cb, o.l);
        }));
      } else {
        input = h('select', { onchange: (e) => set(e.target.value) }, h('option', { value: '' }, '(ninguno)'),
          opts.map((o) => h('option', { value: o.v, selected: o.v === val }, o.l)));
      }
    } else {
      input = h('input', { type: 'text', value: val ?? '', oninput: (e) => set(e.target.value) });
    }
    box.append(lab(), hint || '', input);
    return box;
  }
  function imageInput(val, set) {
    const img = val ? h('img', { src: val, alt: '' }) : h('span', { class: 'noimg' });
    const row = h('div', { class: 'imgrow drop' }, img, h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn sm', onclick: async () => { const f = await pickFile(); if (f) apply(await upload(f)); } }, 'Cambiar foto…'),
      h('span', { class: 'hint' }, 'o arrastra una foto aquí')));
    function apply(path) {
      set(path);
      const n = h('img', { src: path, alt: '' });
      row.firstChild.replaceWith(n);
    }
    dropFiles(row, async (file) => apply(await upload(file)));
    return row;
  }
  function fileInput(val, set, accept) {
    const html = accept === '.html';
    const link = h('span', {});
    const paint = (v) => { link.innerHTML = ''; link.append(v ? h('a', { href: v, target: '_blank' }, v.split('/').pop()) : h('span', { class: 'hint' }, 'Ningún archivo')); };
    paint(val);
    const row = h('div', { class: 'row drop' }, link,
      h('button', { type: 'button', class: 'btn sm', onclick: async () => { const f = await pickFile(html ? '.html,text/html' : 'application/pdf'); if (f) { const p = await upload(f); set(p); paint(p); } } }, html ? 'Subir HTML…' : 'Subir PDF…'),
      h('button', { type: 'button', class: 'btn sm', onclick: () => { set(''); paint(''); } }, 'Quitar'));
    dropFiles(row, async (f) => { const p = await upload(f); set(p); paint(p); });
    return row;
  }
  function dropFiles(el, onFile) {
    el.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); el.classList.add('over'); } });
    el.addEventListener('dragleave', () => el.classList.remove('over'));
    el.addEventListener('drop', (e) => {
      if (!e.dataTransfer.files.length) return;
      e.preventDefault();
      el.classList.remove('over');
      onFile(e.dataTransfer.files[0]);
    });
  }
  function summaryOf(f, item, i) {
    if (typeof item !== 'object' || item === null) return String(item);
    const t = f.types ? typeDef(f, item.type) : null;
    const text = plain(item.title || item.label || item.name || item.text || item.client || (item.items || [])[0] || '');
    return { kind: t ? t.label : '', text: text || `${i + 1}` };
  }
  // Lista editable con arrastrar y soltar (tambien botones ↑ ↓ por si no hay raton)
  function listEditor(f, obj) {
    if (!Array.isArray(obj[f.name])) obj[f.name] = [];
    const arr = obj[f.name];
    const box = h('div');
    const lst = h('div', { class: 'lst' });
    const simple = !f.fields && !f.types;
    function move(from, to) {
      if (to < 0 || to >= arr.length) return;
      arr.splice(to, 0, arr.splice(from, 1)[0]);
      dirty();
      draw();
    }
    function draw() {
      lst.innerHTML = '';
      arr.forEach((item, i) => {
        const tools = [
          h('button', { type: 'button', class: 'iconbtn', title: 'Subir', onclick: () => move(i, i - 1) }, '↑'),
          h('button', { type: 'button', class: 'iconbtn', title: 'Bajar', onclick: () => move(i, i + 1) }, '↓'),
          h('button', { type: 'button', class: 'iconbtn', title: 'Duplicar', onclick: () => { arr.splice(i + 1, 0, clone(item)); dirty(); draw(); } }, '⧉'),
          h('button', { type: 'button', class: 'iconbtn', title: 'Quitar', onclick: () => { arr.splice(i, 1); dirty(); draw(); } }, '✕'),
        ];
        if (simple) {
          const inp = h('input', { class: 'txt', type: 'text', value: item ?? '', oninput: (e) => { arr[i] = e.target.value; dirty(); } });
          lst.append(h('div', { class: 'item' }, h('div', { class: 'item-head' }, h('span', { class: 'handle', title: 'Arrastra para ordenar' }, '⠿'), inp, ...tools)));
          return;
        }
        const sm = summaryOf(f, item, i);
        const fields = f.types ? ((typeDef(f, item.type) || {}).fields || []) : f.fields;
        const card = h('div', { class: 'item closed' });
        const title = h('span', { class: 't', onclick: () => card.classList.toggle('closed') }, sm.kind ? h('em', {}, sm.kind) : '', sm.text);
        card.append(h('div', { class: 'item-head' }, h('span', { class: 'handle', title: 'Arrastra para ordenar' }, '⠿'), title, ...tools),
          h('div', { class: 'item-body' }, form(fields, item)));
        lst.append(card);
      });
    }
    draw();
    if (window.Sortable) {
      Sortable.create(lst, { handle: '.handle', animation: 150, onEnd: (e) => { if (e.oldIndex !== e.newIndex) move(e.oldIndex, e.newIndex); } });
    }
    const add = h('div', { class: 'add' });
    if (f.types) {
      const sel = h('select', { class: 'txt', style: 'width:auto' }, f.types.filter((t) => t.name !== 'builtin').map((t) => h('option', { value: t.name }, t.label)));
      add.append(sel, h('button', { type: 'button', class: 'btn sm', onclick: () => { arr.push(newItem(f, sel.value)); dirty(); draw(); } }, '+ Añadir'));
    } else {
      add.append(h('button', { type: 'button', class: 'btn sm', onclick: () => { arr.push(simple ? '' : newItem(f)); dirty(); draw(); } }, '+ Añadir'));
    }
    box.append(lst, add);
    return box;
  }

  // ---------------------------------------------------------------- navegacion
  const MENU = [
    ['home', 'Inicio'], ['pages', 'Páginas'], ['sections', 'Secciones'], ['blog', 'Blog'], ['works', 'Proyectos'],
    ['services', 'Servicios'], ['i18n', 'Idiomas'], ['quizpage', 'Quiz'], 'sep', ['design', 'Diseño'],
    ['legal', 'Legal y cookies'], ['settings', 'Ajustes'], ['publish', 'Publicar'],
  ];
  function drawMenu() {
    menu.innerHTML = '';
    const P = S.data.posts;
    const badges = { blog: P.length, works: Object.keys(S.data.files).filter((k) => k.startsWith('works/')).length };
    MENU.forEach((m) => {
      if (m === 'sep') { menu.append(h('div', { class: 'sep' })); return; }
      const [id, label] = m;
      menu.append(h('button', { class: S.view === id ? 'on' : '', onclick: () => go(id) }, label, badges[id] ? h('span', { class: 'badge' }, badges[id]) : ''));
    });
  }
  async function go(v, arg = null, force = false) {
    if (S.dirty && !force && !confirm('Tienes cambios sin guardar. ¿Salir sin guardar?')) return;
    dirty(false);
    S.view = v;
    S.arg = arg;
    location.hash = arg ? `${v}:${arg}` : v;
    drawMenu();
    view.innerHTML = '';
    try { await (VIEWS[v] || VIEWS.home)(arg); } catch (err) { view.append(h('p', { class: 'card' }, 'Error: ' + err.message)); }
    scrollTo(0, 0);
  }
  async function saveFile(rel, data, msg = 'Guardado. La web ya está actualizada.') {
    await api('file', { f: rel, data });
    dirty(false);
    await load();
    drawMenu();
    toast(msg);
  }
  function header(title, lead, ...actions) {
    return h('div', { class: 'head' }, h('div', {}, h('h1', {}, title), lead ? h('p', { class: 'lead' }, lead) : ''), h('div', { class: 'row' }, ...actions));
  }
  function saveBar(onSave, extra = []) {
    return h('div', { class: 'savebar' }, h('button', { class: 'btn primary', onclick: onSave }, 'Guardar'), h('span', { class: 'dirty-dot', title: 'Cambios sin guardar' }), ...extra);
  }

  // ---------------------------------------------------------------- vistas
  const VIEWS = {};

  VIEWS.home = () => {
    const F = S.data.files;
    const P = S.data.posts;
    const count = (pre) => Object.keys(F).filter((k) => k.startsWith(pre)).length;
    const n = (st) => P.filter((p) => p.status === st).length;
    view.append(
      header('Panel de Origenal Story', 'Todo lo de la web en un sitio. Los textos de cada página también se cambian haciendo clic en ellos en el editor visual.',
        h('a', { class: 'btn', href: '/admin/', target: '_blank' }, 'Editor visual ↗'), h('a', { class: 'btn', href: '/', target: '_blank' }, 'Ver la web ↗')),
      h('div', { class: 'grid' },
        stat('Artículos publicados', n('published'), () => go('blog')), stat('Programados', n('scheduled'), () => go('blog')),
        stat('Borradores', n('draft'), () => go('blog')), stat('Proyectos', count('works/'), () => go('works')),
        stat('Servicios', count('services/'), () => go('services')), stat('Páginas nuevas', count('pages/'), () => go('pages'))),
      h('h2', {}, 'Acciones rápidas'),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', onclick: () => go('compose') }, '✎ Escribir un artículo'),
        h('button', { class: 'btn', onclick: () => go('sections', 'home.json') }, 'Ordenar secciones de la home'),
        h('button', { class: 'btn', onclick: () => go('edit', 'quiz.json') }, 'Cambiar el quiz'),
        h('button', { class: 'btn', onclick: () => go('publish') }, 'Publicar en internet')),
    );
    if (n('scheduled') && !S.data.autopublish) {
      view.append(h('p', { class: 'card' }, h('span', { class: 'chip warn' }, 'Aviso'), ' Tienes artículos programados pero la publicación automática está apagada. Actívala en ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); go('publish'); } }, 'Publicar'), '.'));
    }
  };
  function stat(label, value, onclick) {
    return h('div', { class: 'card stat', style: 'cursor:pointer', onclick }, h('b', {}, value), label);
  }

  // Paginas: todas, con acceso a formulario, secciones y editor visual
  VIEWS.pages = () => {
    const F = S.data.files;
    const fixed = ['home.json', 'services.json', 'work.json', 'blog.json', 'about.json', 'founder.json', 'contact.json', 'quiz.json'];
    const custom = Object.keys(F).filter((k) => k.startsWith('pages/')).sort();
    const row = (rel) => {
      const d = F[rel];
      const st = rel.startsWith('pages/') ? (d.published === false ? h('span', { class: 'chip off' }, 'Oculta') : h('span', { class: 'chip ok' }, 'Publicada')) : h('span', { class: 'chip' }, 'Fija');
      const menuChip = rel.startsWith('pages/') && d.menu !== false && d.published !== false ? h('span', { class: 'chip' }, 'En el menú') : '';
      return h('tr', {}, h('td', {}, h('b', {}, fileName(rel).replace('Página · ', ''))), h('td', {}, st, ' ', menuChip),
        h('td', { class: 'act' },
          pageKey(rel) ? h('button', { class: 'btn sm', onclick: () => go('sections', rel) }, 'Secciones') : '', ' ',
          h('button', { class: 'btn sm', onclick: () => go('edit', rel) }, 'Formulario'), ' ',
          h('a', { class: 'btn sm', href: visualUrl(rel), target: '_blank' }, 'Editor visual ↗'), ' ',
          rel.startsWith('pages/') ? h('button', { class: 'btn sm danger', onclick: () => remove(rel, 'pages') }, 'Borrar') : ''));
    };
    view.append(
      header('Páginas', 'Las fijas de la web y las que crees tú. «Secciones» ordena y añade bloques; «Formulario» edita todos sus campos.',
        h('button', { class: 'btn primary', onclick: newPage }, '+ Página nueva')),
      h('table', { class: 'list' }, h('thead', {}, h('tr', {}, h('th', {}, 'Página'), h('th', {}, 'Estado'), h('th', {}))),
        h('tbody', {}, [...fixed, ...custom].map(row))));
  };
  async function newPage() {
    const title = prompt('Nombre de la página nueva (por ejemplo: Trade fairs 2027)');
    if (!title || !title.trim()) return;
    const secF = fieldsFor('pages/x.json').find((f) => f.name === 'sections');
    const hero = newItem(secF, 'hero');
    hero.title = title.trim();
    const j = await api('create', { folder: 'pages', data: { title: title.trim(), menu: true, published: false, sections: [hero, newItem(secF, 'text'), newItem(secF, 'cta')] } });
    await load();
    toast('Página creada (oculta). Ordena sus secciones y publícala en «Formulario».');
    go('sections', j.f, true);
  }
  async function remove(rel, folder) {
    if (!confirm(`¿Borrar «${fileName(rel)}» para siempre?`)) return;
    await api('page', { op: 'del', f: rel });
    await load();
    toast('Borrado.');
    go(S.view, null, true);
    return folder;
  }

  // Formulario completo de un fichero
  VIEWS.edit = (rel) => {
    const data = clone(S.data.files[rel]);
    const fields = fieldsFor(rel);
    const hasSecs = fields.some((f) => f.name === 'sections');
    view.append(header(fileName(rel), 'Todos los campos de esta ficha. Arrastra (⠿) para ordenar las listas.',
      hasSecs ? h('button', { class: 'btn', onclick: () => go('sections', rel) }, 'Secciones') : '',
      h('a', { class: 'btn', href: visualUrl(rel), target: '_blank' }, 'Editor visual ↗')));
    view.append(h('div', { class: 'card' }, form(fields, data, { skip: ['sections'] })), saveBar(() => saveFile(rel, data)));
  };

  // Secciones con arrastrar y soltar
  VIEWS.sections = (rel) => {
    const F = S.data.files;
    const files = ['home.json', 'services.json', 'work.json', 'blog.json', 'about.json', 'founder.json', 'contact.json',
      ...Object.keys(F).filter((k) => /^(pages|services|works|posts)\//.test(k)).sort()];
    rel = rel && F[rel] ? rel : 'home.json';
    const key = pageKey(rel);
    const data = clone(F[rel]);
    data.sections = sectionsOf(data, key);
    const secF = fieldsFor(rel).find((f) => f.name === 'sections');
    const pick = h('select', { class: 'txt', style: 'max-width:380px', onchange: (e) => go('sections', e.target.value) },
      files.map((f) => h('option', { value: f, selected: f === rel }, fileName(f))));
    view.append(header('Secciones', 'Arrastra para ordenar. Arrastra un bloque de la derecha a la lista (o haz clic) para añadirlo.', pick,
      h('a', { class: 'btn', href: visualUrl(rel), target: '_blank' }, 'Ver en el editor visual ↗')));
    const lst = h('div', { class: 'lst sec-list' });
    const blockTypes = (secF.types || []).filter((t) => t.name !== 'builtin');
    function draw() {
      lst.innerHTML = '';
      data.sections.forEach((s, i) => {
        const builtin = s.type === 'builtin';
        const t = typeDef(secF, s.type);
        const label = builtin ? builtinLabel(key, s.id) : (t ? t.label : s.type);
        const sub = builtin ? '' : plain(s.title || s.text || '');
        const color = h('label', { class: 'swatch', title: 'Color de fondo' },
          h('input', { type: 'color', value: s.background || '#ffffff', oninput: (e) => { s.background = e.target.value; e.target.nextSibling.style.background = s.background; dirty(); } }),
          h('span', { style: `background:${s.background || 'transparent'}` }));
        const card = h('div', { class: `item closed${s.hidden ? ' off' : ''}`, 'data-builtin': builtin || null },
          h('div', { class: 'item-head' },
            h('span', { class: 'handle', title: 'Arrastra para ordenar' }, '⠿'),
            h('span', { class: 't', onclick: () => !builtin && card.classList.toggle('closed') }, builtin ? '' : h('em', {}, 'bloque'), label, sub ? ` · ${sub.slice(0, 50)}` : '', s.hidden ? ' (oculta)' : ''),
            h('button', { class: 'iconbtn', title: 'Subir', onclick: () => mv(i, i - 1) }, '↑'),
            h('button', { class: 'iconbtn', title: 'Bajar', onclick: () => mv(i, i + 1) }, '↓'),
            h('button', { class: 'btn sm', onclick: () => { s.hidden = !s.hidden; if (!s.hidden) delete s.hidden; dirty(); draw(); } }, s.hidden ? 'Mostrar' : 'Ocultar'),
            color,
            s.background ? h('button', { class: 'btn sm', onclick: () => { delete s.background; dirty(); draw(); } }, 'Sin fondo') : '',
            builtin ? '' : h('button', { class: 'iconbtn', title: 'Duplicar', onclick: () => { data.sections.splice(i + 1, 0, clone(s)); dirty(); draw(); } }, '⧉'),
            builtin ? '' : h('button', { class: 'iconbtn', title: 'Borrar', onclick: () => { if (confirm('¿Borrar este bloque?')) { data.sections.splice(i, 1); dirty(); draw(); } } }, '✕')),
          builtin ? '' : h('div', { class: 'item-body' }, form((t ? t.fields : []).filter((x) => !['background', 'hidden'].includes(x.name)), s)));
        lst.append(card);
      });
    }
    function mv(a, b) {
      if (b < 0 || b >= data.sections.length) return;
      data.sections.splice(b, 0, data.sections.splice(a, 1)[0]);
      dirty();
      draw();
    }
    draw();
    const pal = h('div', { class: 'lst' }, blockTypes.map((t) => h('div', { class: 'pchip', 'data-type': t.name, title: 'Arrastra a la lista o haz clic',
      onclick: () => { data.sections.push(newItem(secF, t.name)); dirty(); draw(); toast(`«${t.label}» añadido al final. Arrástralo a su sitio.`); } }, '＋ ', t.label)));
    if (window.Sortable) {
      Sortable.create(lst, { handle: '.handle', animation: 150, group: { name: 'secs', pull: false, put: ['blocks'] },
        onEnd: (e) => { if (e.from === e.to && e.oldIndex !== e.newIndex) mv(e.oldIndex, e.newIndex); },
        onAdd: (e) => { const type = e.item.dataset.type; e.item.remove(); data.sections.splice(e.newIndex, 0, newItem(secF, type)); dirty(); draw(); } });
      Sortable.create(pal, { group: { name: 'blocks', pull: 'clone', put: false }, sort: false, animation: 150 });
    }
    view.append(h('div', { class: 'sec-layout' },
      h('div', {}, lst, saveBar(async () => { await saveFile(rel, data); go('sections', rel, true); })),
      h('div', { class: 'card palette' }, h('b', {}, 'Bloques'), h('p', { class: 'hint' }, 'Arrástralos a la lista.'), pal)));
  };

  // Blog: lista y escritura rapida
  VIEWS.blog = () => {
    const P = S.data.posts;
    const chip = (st) => ({ published: h('span', { class: 'chip ok' }, 'Publicado'), scheduled: h('span', { class: 'chip warn' }, 'Programado'), draft: h('span', { class: 'chip off' }, 'Borrador') }[st]);
    view.append(header('Blog', `Hora actual: ${fmtWhen(S.data.now)}. Los programados salen solos a su hora (si la publicación automática está activada en «Publicar»).`,
      h('button', { class: 'btn primary', onclick: () => go('compose') }, '✎ Escribir un artículo'),
      h('button', { class: 'btn', onclick: () => go('edit', 'blog.json') }, 'Textos del blog')));
    if (!P.length) { view.append(h('p', { class: 'card muted' }, 'Todavía no hay artículos.')); return; }
    view.append(h('table', { class: 'list' }, h('thead', {}, h('tr', {}, h('th', {}, 'Artículo'), h('th', {}, 'Estado'), h('th', {}, 'Fecha'), h('th', {}))),
      h('tbody', {}, P.map((p) => h('tr', {}, h('td', {}, h('b', {}, p.title)), h('td', {}, chip(p.status)), h('td', {}, fmtWhen(p.when)),
        h('td', { class: 'act' },
          h('button', { class: 'btn sm', onclick: () => go('compose', p.f) }, 'Escribir'), ' ',
          h('button', { class: 'btn sm', onclick: () => go('edit', p.f) }, 'Formulario'), ' ',
          h('a', { class: 'btn sm', href: visualUrl(p.f), target: '_blank' }, 'Editor visual ↗'), ' ',
          h('button', { class: 'btn sm danger', onclick: () => remove(p.f, 'posts') }, 'Borrar')))))));
  };

  // Texto rapido <-> bloques del articulo
  function toBlocks(text) {
    const out = [];
    String(text).replace(/\r/g, '').split(/\n\s*\n/).forEach((chunk) => {
      const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
      if (!lines.length) return;
      const img = lines.length === 1 && lines[0].match(/^!\[(.*?)\]\((.+?)\)$/);
      if (img) { out.push({ type: 'image', image: img[2], alt: img[1], caption: img[1] }); return; }
      if (lines.every((l) => /^[-*•] /.test(l))) { out.push({ type: 'list', items: lines.map((l) => l.slice(2).trim()) }); return; }
      if (/^#{1,3} /.test(lines[0])) {
        out.push({ type: 'heading', text: lines[0].replace(/^#{1,3} /, '') });
        if (lines.length > 1) out.push({ type: 'paragraph', text: lines.slice(1).join(' ') });
        return;
      }
      if (lines[0].startsWith('>')) {
        const author = lines.find((l) => /^(—|--)\s/.test(l));
        out.push({ type: 'quote', text: lines.filter((l) => l !== author).map((l) => l.replace(/^>\s?/, '')).join(' '), author: author ? author.replace(/^(—|--)\s/, '') : '' });
        return;
      }
      out.push({ type: 'paragraph', text: lines.join(' ') });
    });
    return out;
  }
  function toText(blocks) {
    return (blocks || []).map((b) => {
      if (typeof b === 'string') return b;
      if (b.type === 'heading') return `## ${b.text || ''}`;
      if (b.type === 'quote') return `> ${b.text || ''}${b.author ? `\n— ${b.author}` : ''}`;
      if (b.type === 'list') return (b.items || []).map((x) => `- ${x}`).join('\n');
      if (b.type === 'image') return `![${b.caption || b.alt || ''}](${b.image || ''})`;
      return b.text || '';
    }).join('\n\n');
  }

  VIEWS.compose = (rel) => {
    const existing = rel && S.data.files[rel];
    const d = existing ? clone(existing) : { title: '', date: '', time: '', published: false, cover: '/assets/img/passiflora.webp', cover_alt: '', excerpt: '', body: [], services: [] };
    const now = S.data.now;
    const when = h('input', { type: 'datetime-local', value: d.date ? `${d.date}T${d.time || '09:00'}` : now.replace(' ', 'T'), oninput: () => { dirty(); label(); } });
    const title = h('input', { type: 'text', value: d.title, placeholder: 'Título del artículo', oninput: () => dirty() });
    const excerpt = h('textarea', { placeholder: 'Una o dos frases: sale bajo el título, en la tarjeta y en Google.', oninput: () => dirty() });
    excerpt.value = d.excerpt || '';
    const body = h('textarea', { class: 'body', placeholder: 'Escribe aquí. Deja una línea en blanco entre párrafos.', oninput: () => dirty() });
    body.value = toText(d.body);
    const coverBox = h('div');
    const coverSet = (p) => { d.cover = p; dirty(); };
    coverBox.append(imageInput(d.cover, coverSet));
    const cur = new Set(d.services || []);
    const svc = h('div', { class: 'checks' }, options('services').map((o) => {
      const cb = h('input', { type: 'checkbox', value: o.v, onchange: (e) => { e.target.checked ? cur.add(o.v) : cur.delete(o.v); dirty(); } });
      cb.checked = cur.has(o.v);
      return h('label', {}, cb, o.l);
    }));
    const pubBtn = h('button', { class: 'btn primary' }, 'Publicar');
    function label() {
      const future = when.value.replace('T', ' ') > now;
      pubBtn.textContent = future ? `Programar para el ${fmtWhen(when.value.replace('T', ' '))}` : 'Publicar ahora';
    }
    label();
    function insert(snippet) {
      const a = body.selectionStart;
      const before = body.value.slice(0, a);
      const sep = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
      body.value = before + sep + snippet + '\n\n' + body.value.slice(body.selectionEnd);
      body.focus();
      dirty();
    }
    const tools = h('div', { class: 'tools' },
      h('button', { class: 'btn sm', type: 'button', onclick: () => insert('## Subtítulo') }, 'Subtítulo'),
      h('button', { class: 'btn sm', type: 'button', onclick: () => insert('> Una frase para destacar\n— Autor') }, 'Cita'),
      h('button', { class: 'btn sm', type: 'button', onclick: () => insert('- Primer punto\n- Segundo punto') }, 'Lista'),
      h('button', { class: 'btn sm', type: 'button', onclick: async () => { const f = await pickFile(); if (f) insert(`![Pie de foto](${await upload(f)})`); } }, 'Foto…'));
    dropFiles(body, async (f) => insert(`![Pie de foto](${await upload(f)})`));
    async function save(publish) {
      if (!title.value.trim()) { toast('Ponle un título.', true); return; }
      const [date, time] = when.value.split('T');
      Object.assign(d, { title: title.value.trim(), date, time: (time || '09:00').slice(0, 5), published: publish, excerpt: excerpt.value.trim(),
        body: toBlocks(body.value), services: options('services').map((o) => o.v).filter((v) => cur.has(v)) });
      if (!d.body.length) d.body = [{ type: 'paragraph', text: 'Write here.' }];
      let f = rel;
      if (existing) await api('file', { f: rel, data: d });
      else f = (await api('create', { folder: 'posts', data: d })).f;
      dirty(false);
      await load();
      const st = (S.data.posts.find((p) => p.f === f) || {}).status;
      toast({ draft: 'Borrador guardado.', scheduled: 'Artículo programado: saldrá solo a su hora.', published: 'Artículo publicado en la web local. Publica en internet desde «Publicar».' }[st] || 'Guardado.');
      go('compose', f, true);
    }
    pubBtn.addEventListener('click', () => save(true));
    const status = existing ? ({ published: 'Publicado', scheduled: `Programado para el ${fmtWhen(S.data.posts.find((p) => p.f === rel)?.when || '')}`, draft: 'Borrador' })[(S.data.posts.find((p) => p.f === rel) || {}).status] : 'Nuevo';
    view.append(header(existing ? 'Escribir artículo' : 'Artículo nuevo', `Estado: ${status}.`,
      existing ? h('a', { class: 'btn', href: visualUrl(rel), target: '_blank' }, 'Ver en el editor visual ↗') : '',
      h('button', { class: 'btn', onclick: () => go('blog') }, '← Todos los artículos')),
      h('div', { class: 'composer' },
        h('div', { class: 'card' },
          h('div', { class: 'f' }, h('label', {}, 'Título'), title),
          h('div', { class: 'f' }, h('label', {}, 'Resumen'), excerpt),
          h('div', { class: 'f' }, h('label', {}, 'Texto'), tools, body),
          h('div', { class: 'help', html: 'Línea en blanco = párrafo nuevo · <code>## </code> subtítulo · <code>&gt; </code> cita (y <code>— Autor</code> debajo) · <code>- </code> lista · arrastra una foto al texto para meterla. <code>*palabra*</code> = cursiva.' })),
        h('div', {},
          h('div', { class: 'card' },
            h('div', { class: 'f' }, h('label', {}, 'Fecha y hora de publicación'), when, h('small', {}, 'Si es futura, el artículo queda programado y sale solo.')),
            h('div', { class: 'f' }, h('label', {}, 'Foto de portada'), coverBox),
            h('div', { class: 'f' }, h('label', {}, 'Sale al final de estos servicios'), svc)),
          h('div', { class: 'card row' }, pubBtn, h('button', { class: 'btn', onclick: () => save(false) }, 'Guardar borrador'), h('span', { class: 'dirty-dot' })))));
  };

  // Proyectos y servicios
  function collectionView(folder, title, lead, newData, cols) {
    const F = S.data.files;
    const rels = Object.keys(F).filter((k) => k.startsWith(folder + '/'));
    rels.sort((a, b) => (cols.sort ? cols.sort(F[a], F[b]) : a.localeCompare(b)));
    view.append(header(title, lead, h('button', { class: 'btn primary', onclick: async () => {
      const j = await api('create', { folder, data: newData() });
      await load();
      toast('Creado. Rellena sus campos.');
      go('edit', j.f, true);
    } }, '+ Nuevo')));
    view.append(h('table', { class: 'list' }, h('thead', {}, h('tr', {}, cols.head.map((c) => h('th', {}, c)), h('th', {}))),
      h('tbody', {}, rels.map((rel) => h('tr', {}, cols.cells(F[rel]).map((c) => h('td', {}, c)),
        h('td', { class: 'act' },
          h('button', { class: 'btn sm', onclick: () => go('edit', rel) }, 'Formulario'), ' ',
          h('button', { class: 'btn sm', onclick: () => go('sections', rel) }, 'Secciones'), ' ',
          h('a', { class: 'btn sm', href: visualUrl(rel), target: '_blank' }, 'Editor visual ↗'), ' ',
          h('button', { class: 'btn sm', onclick: async () => { const j = await api('page', { op: 'dup', f: rel }); await load(); toast('Copia creada (oculta).'); go(S.view, null, true); return j; } }, 'Duplicar'), ' ',
          h('button', { class: 'btn sm danger', onclick: () => remove(rel, folder) }, 'Borrar')))))));
  }
  VIEWS.works = () => collectionView('works', 'Proyectos', 'Los casos de «Work». El orden se cambia con el campo «Orden»; los ocultos no salen en la web.',
    () => ({ order: 99, published: false, client: 'New client', title: 'New project', service: 'Market Intelligence', pillar: options('services')[0]?.v || '', country: '', year: new Date().getFullYear(), sectors: [], summary: 'Summary.', challenge: 'Challenge.', solution: 'Solution.', delivered: ['Deliverable'], show_quote: false }),
    { head: ['Orden', 'Cliente y proyecto', 'Estado'], sort: (a, b) => (a.order || 999) - (b.order || 999),
      cells: (d) => [String(d.order ?? ''), h('span', {}, h('b', {}, d.client), ' — ', d.title), d.published === false ? h('span', { class: 'chip off' }, 'Oculto') : h('span', { class: 'chip ok' }, 'Publicado')] });
  VIEWS.services = () => collectionView('services', 'Servicios', 'Los servicios ordenados por su número. Cada uno tiene su página.',
    () => ({ num: '05', name: 'New service', short: 'Short description', color: 'amber', image: '/assets/img/amber.webp', question: 'Question?', hook: 'Hook.', body: ['Text.'], support: [], boxes: [], steps: [{ title: 'Step', question: 'Question', text: ['Text.'], list_label: 'We look at', list: ['Item'], expect: '', best: '' }], works: [] }),
    { head: ['Nº', 'Servicio'], sort: (a, b) => String(a.num).localeCompare(String(b.num)), cells: (d) => [String(d.num || ''), h('b', {}, d.name)] });

  // Quiz: es el contacto de la web. Se cambia subiendo su HTML en el formulario de la pagina.
  VIEWS.quizpage = () => go('edit', 'quiz.json', true);

  // Cuestionario de la pagina de contacto (retirada: el contacto es el quiz)
  VIEWS.i18n = async () => {
    view.append(header('Idiomas', 'El inglés es el original. Cada idioma sale en su dirección (/es/, /pt/, /fr/) con el selector del menú. Un texto sin traducir sale en inglés.'));
    const wait = h('p', { class: 'card' }, 'Cargando los textos…');
    view.append(wait);
    const j = await api('i18n', { op: 'list' });
    wait.remove();
    let lang = S.i18nLang || j.langs[0].v; let q = ''; let only = false; let limit = 60;
    const tabs = h('div', { class: 'row', style: 'margin-bottom:12px' });
    const list = h('div', {});
    const search = h('input', { type: 'text', placeholder: 'Buscar un texto (en inglés o traducido)…', oninput: (e) => { q = e.target.value.toLowerCase(); limit = 60; draw(); } });
    const onlyBox = h('input', { type: 'checkbox', onchange: (e) => { only = e.target.checked; limit = 60; draw(); } });
    const missing = (l) => j.items.filter((x) => !x.tr[l]).length;
    const draw = () => {
      S.i18nLang = lang;
      tabs.innerHTML = '';
      j.langs.forEach((l) => tabs.append(h('button', { class: 'btn' + (l.v === lang ? ' primary' : ''), onclick: () => { lang = l.v; limit = 60; draw(); } },
        `${l.l} · ${missing(l.v) ? 'faltan ' + missing(l.v) : 'completo'}`)));
      tabs.append(h('a', { class: 'btn', href: `/admin/${lang}/`, target: '_blank' }, 'Corregir sobre la propia web ↗'));
      const rows = j.items.filter((x) => (!only || !x.tr[lang]) && (!q || (x.en + ' ' + (x.tr[lang] || '')).toLowerCase().includes(q)));
      list.innerHTML = '';
      rows.slice(0, limit).forEach((x) => {
        const ta = h('textarea', { rows: Math.min(6, Math.max(1, Math.ceil(x.en.length / 70))), placeholder: 'Sin traducir: sale en inglés' });
        ta.value = x.tr[lang] || '';
        ta.addEventListener('change', async () => {
          try { await api('i18n', { op: 'save', lang, en: x.en, v: ta.value }); x.tr[lang] = ta.value.trim(); toast('Traducción guardada.'); }
          catch (err) { toast(err.message, true); }
        });
        list.append(h('div', { class: 'card', style: 'padding:14px 16px;margin-bottom:10px' },
          h('p', { class: 'hint', style: 'margin:0 0 4px' }, x.ctx),
          h('div', { class: 'grid' }, h('div', { class: 'f' }, h('label', {}, 'Inglés (original)'), h('p', { style: 'margin:0;white-space:pre-wrap' }, x.en)),
            h('div', { class: 'f' }, h('label', {}, j.langs.find((l) => l.v === lang).l), ta))));
      });
      if (rows.length > limit) list.append(h('button', { class: 'btn', onclick: () => { limit += 120; draw(); } }, `Ver más (${rows.length - limit} más)`));
      if (!rows.length) list.append(h('p', { class: 'card' }, only ? 'No falta ningún texto por traducir en este idioma.' : 'Ningún texto coincide.'));
    };
    view.append(tabs, h('div', { class: 'card', style: 'margin-bottom:12px' }, h('div', { class: 'f' }, search), h('label', { class: 'check' }, onlyBox, 'Solo los que faltan por traducir'),
      h('p', { class: 'hint' }, 'Cada cambio se guarda al salir de la casilla. Deja vacía una traducción para que salga el inglés. Mantén los *asteriscos* y las {variables} igual que en el original.')), list);
    draw();
  };
  VIEWS.quiz = () => {
    const data = clone(S.data.files['contact.json']);
    const f = fieldsFor('contact.json').find((x) => x.name === 'form');
    const fb = S.data.firebase;
    view.append(header('Cuestionario de contacto', 'Arrastra las preguntas para ordenarlas. Una pregunta de tipo «Nuevo paso» parte el cuestionario en pantallas.',
      h('a', { class: 'btn', href: '/contact/', target: '_blank' }, 'Probar el cuestionario ↗'),
      h('button', { class: 'btn', onclick: () => go('answers') }, 'Respuestas')));
    if (!fb.configured) view.append(h('p', { class: 'card' }, h('span', { class: 'chip warn' }, 'Firebase sin configurar'), ' Mientras tanto, al enviar se abre el correo de quien escribe con sus respuestas. Configúralo en ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); go('settings'); } }, 'Ajustes'), '.'));
    view.append(h('div', { class: 'card' }, form(f.fields, data.form)), saveBar(() => saveFile('contact.json', data)));
  };

  // Respuestas del cuestionario (Firebase)
  VIEWS.answers = async () => {
    view.append(header('Respuestas del cuestionario', 'Lo que la gente envía desde la página de contacto.'));
    if (!S.data.firebase.configured) { view.append(h('p', { class: 'card' }, 'Las respuestas del cuestionario llegan por correo a la dirección de contacto de la web, y queda una copia en el hosting (carpeta _respuestas). Esta pantalla solo se usa si se guardan en Firebase: se configura en ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); go('settings'); } }, 'Ajustes'), '.')); return; }
    const j = await api('submissions', { op: 'list' });
    if (j.login) {
      const email = h('input', { type: 'text', placeholder: 'email', autocomplete: 'username' });
      const pass = h('input', { type: 'password', placeholder: 'contraseña', autocomplete: 'current-password', class: 'txt' });
      const doLogin = async () => { try { await api('fb-login', { email: email.value, password: pass.value }); go('answers', null, true); } catch (err) { toast(err.message, true); } };
      pass.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
      view.append(h('div', { class: 'card', style: 'max-width:420px' }, h('p', {}, 'Entra con tu usuario de Firebase (el que tiene permiso para ver las respuestas).'),
        h('div', { class: 'f' }, h('label', {}, 'Email'), email), h('div', { class: 'f' }, h('label', {}, 'Contraseña'), pass),
        h('button', { class: 'btn primary', onclick: doLogin }, 'Entrar')));
      return;
    }
    const items = j.items;
    const keys = [...new Set(items.flatMap((x) => Object.keys(x.answers || {})))];
    const qs = ((S.data.files['contact.json'] || {}).form || {}).questions || [];
    const qlabel = (k) => (qs.find((q) => (q.id || '').toLowerCase() === k) || {}).label || k;
    const csv = () => {
      const q = (v) => `"${String(Array.isArray(v) ? v.join('; ') : v ?? '').replace(/"/g, '""')}"`;
      const rows = [['Fecha', ...keys.map(qlabel)].map(q).join(','), ...items.map((x) => [x.createdAt, ...keys.map((k) => (x.answers || {})[k])].map(q).join(','))];
      const a = h('a', { href: URL.createObjectURL(new Blob(['﻿' + rows.join('\n')], { type: 'text/csv' })), download: 'respuestas-cuestionario.csv' });
      a.click();
    };
    view.querySelector('.head .row').append(h('span', { class: 'hint' }, j.email), h('button', { class: 'btn', onclick: csv }, 'Descargar CSV'),
      h('button', { class: 'btn', onclick: async () => { await api('fb-logout'); go('answers', null, true); } }, 'Salir'));
    if (!items.length) { view.append(h('p', { class: 'card muted' }, 'Todavía no hay respuestas.')); return; }
    const show = (x) => h('div', { class: 'card' }, keys.filter((k) => (x.answers || {})[k] !== undefined && String(x.answers[k]) !== '').map((k) =>
      h('p', {}, h('b', {}, qlabel(k) + ': '), Array.isArray(x.answers[k]) ? x.answers[k].join(', ') : x.answers[k])));
    const tb = h('tbody');
    items.forEach((x) => {
      const a = x.answers || {};
      const det = h('tr', { hidden: true }, h('td', { colspan: 5 }, show(x)));
      tb.append(h('tr', { class: x.read ? '' : 'unread' },
        h('td', {}, new Date(x.createdAt).toLocaleString('es-ES')),
        h('td', {}, h('b', {}, a.name || '—'), h('br'), a.company || ''),
        h('td', {}, a.email ? h('a', { href: `mailto:${a.email}` }, a.email) : '—'), h('td', {}, x.read ? h('span', { class: 'chip' }, 'Leída') : h('span', { class: 'chip warn' }, 'Nueva')),
        h('td', { class: 'act' },
          h('button', { class: 'btn sm', onclick: async () => { det.hidden = !det.hidden; if (!x.read) { await api('submissions', { op: 'read', id: x.id }); x.read = true; } } }, 'Ver'), ' ',
          h('button', { class: 'btn sm', onclick: async () => { await api('submissions', { op: x.read ? 'unread' : 'read', id: x.id }); go('answers', null, true); } }, x.read ? 'Marcar nueva' : 'Marcar leída'), ' ',
          h('button', { class: 'btn sm danger', onclick: async () => { if (confirm('¿Borrar esta respuesta?')) { await api('submissions', { op: 'delete', id: x.id }); go('answers', null, true); } } }, 'Borrar'))), det);
    });
    view.append(h('table', { class: 'list' }, h('thead', {}, h('tr', {}, h('th', {}, 'Fecha'), h('th', {}, 'Nombre'), h('th', {}, 'Email'), h('th', {}, 'Estado'), h('th', {}))), tb));
  };

  // Legal y cookies: datos de la empresa, aviso de cookies, analitica y textos legales
  VIEWS.legal = () => {
    const data = clone(S.data.files['site.json']);
    const lg = data.legal || {};
    const missing = ['owner', 'tax_id', 'address'].filter((k) => !String(lg[k] || '').trim());
    const F = S.data.files;
    const rels = Object.keys(F).filter((k) => k.startsWith('legal/')).sort((a, b) => (F[a].order || 99) - (F[b].order || 99));
    const siteFields = fieldsFor('site.json').filter((f) => ['legal', 'cookies', 'analytics'].includes(f.name));
    view.append(header('Legal y cookies', 'Textos legales del pie, aviso de cookies y estadísticas. Los textos son plantillas: que los revise vuestro asesor.',
      h('button', { class: 'btn primary', onclick: async () => {
        const title = prompt('Título del texto legal nuevo (por ejemplo: Terms of service)');
        if (!title || !title.trim()) return;
        const j = await api('create', { folder: 'legal', data: { title: title.trim(), order: 9, footer: true, updated: S.data.now.slice(0, 10), intro: '', body: [{ type: 'paragraph', text: 'Write here.' }], pdf: '' } });
        await load();
        go('legaledit', j.f, true);
      } }, '+ Texto legal')));
    if (missing.length) view.append(h('p', { class: 'card' }, h('span', { class: 'chip warn' }, 'Faltan datos'), ' Falta algún dato legal (titular, NIF o dirección). El NIF es obligatorio en el aviso legal: mientras esté vacío, esa línea no sale.'));
    view.append(h('h2', {}, 'Textos legales'),
      h('table', { class: 'list' }, h('thead', {}, h('tr', {}, h('th', {}, 'Texto'), h('th', {}, 'Pie'), h('th', {}, 'PDF'), h('th', {}, 'Actualizado'), h('th', {}))),
        h('tbody', {}, rels.map((rel) => h('tr', {}, h('td', {}, h('b', {}, F[rel].title)),
          h('td', {}, F[rel].footer === false ? h('span', { class: 'chip off' }, 'No') : h('span', { class: 'chip ok' }, 'Sí')),
          h('td', {}, F[rel].pdf ? h('a', { href: F[rel].pdf, target: '_blank' }, 'PDF') : '—'), h('td', {}, F[rel].updated || ''),
          h('td', { class: 'act' }, h('button', { class: 'btn sm', onclick: () => go('legaledit', rel) }, 'Escribir'), ' ',
            h('a', { class: 'btn sm', href: visualUrl(rel), target: '_blank' }, 'Editor visual ↗'), ' ',
            h('a', { class: 'btn sm', href: `/legal/${rel.slice(6, -5)}/`, target: '_blank' }, 'Ver ↗'), ' ',
            h('button', { class: 'btn sm danger', onclick: () => remove(rel, 'legal') }, 'Borrar')))))),
      h('h2', {}, 'Datos de la empresa, aviso de cookies y estadísticas'),
      h('div', { class: 'card' }, form(siteFields, data)), saveBar(() => saveFile('site.json', data)));
  };
  VIEWS.legaledit = (rel) => {
    const d = clone(S.data.files[rel]);
    const title = h('input', { type: 'text', value: d.title || '', oninput: () => dirty() });
    const updated = h('input', { type: 'text', value: d.updated || '', placeholder: 'AAAA-MM-DD', oninput: () => dirty() });
    const intro = h('textarea', { oninput: () => dirty() });
    intro.value = d.intro || '';
    const body = h('textarea', { class: 'body', oninput: () => dirty() });
    body.value = toText(d.body);
    const foot = h('input', { type: 'checkbox', onchange: () => dirty() });
    foot.checked = d.footer !== false;
    const pdfBox = fileInput(d.pdf, (p) => { d.pdf = p; dirty(); });
    async function save() {
      Object.assign(d, { title: title.value.trim(), updated: updated.value.trim(), intro: intro.value.trim(), body: toBlocks(body.value), footer: foot.checked });
      await saveFile(rel, d);
    }
    view.append(header(d.title || 'Texto legal', 'Variables que se rellenan solas: {owner}, {tax_id}, {address}, {email}, {site_url}, {brand}, {registry}.',
      h('a', { class: 'btn', href: `/legal/${rel.slice(6, -5)}/`, target: '_blank' }, 'Ver ↗'), h('button', { class: 'btn', onclick: () => go('legal') }, '← Legal y cookies')),
      h('div', { class: 'composer' },
        h('div', { class: 'card' }, h('div', { class: 'f' }, h('label', {}, 'Título'), title), h('div', { class: 'f' }, h('label', {}, 'Entradilla'), intro),
          h('div', { class: 'f' }, h('label', {}, 'Texto'), body),
          h('div', { class: 'help', html: 'Línea en blanco = párrafo nuevo · <code>## </code> apartado · <code>- </code> lista.' })),
        h('div', {}, h('div', { class: 'card' },
          h('div', { class: 'f' }, h('label', {}, 'Última actualización'), updated),
          h('div', { class: 'f' }, h('label', { class: 'check' }, foot, 'Sale en el pie de página')),
          h('div', { class: 'f' }, h('label', {}, 'Documento PDF (opcional)'), pdfBox, h('small', {}, 'Si lo subes, la página muestra un botón para descargarlo.'))),
        h('div', { class: 'card row' }, h('button', { class: 'btn primary', onclick: save }, 'Guardar'), h('span', { class: 'dirty-dot' })))));
  };

  // Diseno con vista previa
  VIEWS.design = () => {
    const data = clone(S.data.files['site.json']);
    const f = fieldsFor('site.json').find((x) => x.name === 'theme');
    const prev = h('div', { class: 'preview' });
    function paint() {
      const t = data.theme;
      prev.style.background = t.paper; prev.style.color = t.ink;
      prev.innerHTML = `<div style="font:500 12px system-ui;letter-spacing:.14em;color:${esc(t.orange)}">KICKER</div>
        <h3 style="font-family:'${esc(t.font_serif)}',Georgia,serif;color:${esc(t.ink)}">A title with <span style="background:linear-gradient(115deg,${esc(t.amber)},${esc(t.coral)} 45%,${esc(t.magenta)});-webkit-background-clip:text;color:transparent">colour</span>.</h3>
        <p style="font-family:'${esc(t.font_sans)}',system-ui;color:${esc(t.ink_soft)};margin:0">Body text in ${esc(t.font_sans)}. Secondary text colour.</p>
        <span class="pbtn" style="background:${esc(t.ink)};font-family:'${esc(t.font_sans)}'">Button</span>
        <span class="pbtn" style="background:${esc(t.orange)};font-family:'${esc(t.font_sans)}'">Accent</span>
        <div class="pgrad" style="background:linear-gradient(115deg,${esc(t.amber)},${esc(t.coral)} 45%,${esc(t.magenta)})"></div>
        <div class="pgrad" style="background:${esc(t.paper_2)};border:1px solid #0001"></div>
        <div class="pgrad" style="background:${esc(t.forest)}"></div>`;
      const fams = [t.font_serif, t.font_sans].filter(Boolean).map((x) => `family=${encodeURIComponent(x).replace(/%20/g, '+')}`).join('&');
      let link = document.getElementById('pv-fonts');
      if (!link) { link = h('link', { id: 'pv-fonts', rel: 'stylesheet' }); document.head.append(link); }
      link.href = `https://fonts.googleapis.com/css2?${fams}&display=swap`;
    }
    const fm = form(f.fields, data.theme);
    fm.addEventListener('input', paint);
    fm.addEventListener('click', () => setTimeout(paint));
    paint();
    view.append(header('Diseño', 'Colores y tipografías de toda la web. La vista previa cambia mientras eliges; guarda para aplicarlo.'),
      h('div', { class: 'composer' }, h('div', { class: 'card' }, fm), h('div', {}, h('div', { class: 'card' }, h('b', {}, 'Vista previa'), h('div', { style: 'margin-top:10px' }, prev)))),
      saveBar(() => saveFile('site.json', data, 'Diseño guardado.')));
  };

  // Ajustes generales
  VIEWS.settings = () => {
    const data = clone(S.data.files['site.json']);
    view.append(header('Ajustes', 'Datos de contacto, menú, cifras y SEO. El diseño está en «Diseño».'),
      h('div', { class: 'card' }, form(fieldsFor('site.json'), data, { skip: ['theme'] })), saveBar(() => saveFile('site.json', data)));
  };

  // Publicar
  VIEWS.publish = () => {
    const fb = S.data.firebase;
    const log = h('pre', { class: 'log', hidden: !S.data.lastPublish }, S.data.lastPublish || '');
    const busy = async (btn, fn) => { btn.disabled = true; const t = btn.textContent; btn.textContent = 'Trabajando…'; try { await fn(); } finally { btn.disabled = false; btn.textContent = t; } };
    const checkBtn = h('button', { class: 'btn' }, 'Comprobar la web');
    checkBtn.addEventListener('click', () => busy(checkBtn, async () => { const j = await api('check'); log.hidden = false; log.textContent = j.log; toast(j.passed ? 'Todo correcto.' : 'Hay errores: míralos abajo.', !j.passed); }));
    const ftp = S.data.ftp || {};
    const canPublish = !!(fb.project || (ftp.host && ftp.has_password));
    const pubBtn = h('button', { class: 'btn primary', disabled: !canPublish }, 'Publicar en internet');
    const fHost = h('input', { type: 'text', value: ftp.host || '', placeholder: 'ftp.tudominio.com' });
    const fUser = h('input', { type: 'text', value: ftp.user || '', autocomplete: 'off' });
    const fPass = h('input', { type: 'password', class: 'txt', placeholder: ftp.has_password ? '•••••••• (guardada)' : '', autocomplete: 'new-password' });
    const fDir = h('input', { type: 'text', value: ftp.dir || '/public_html' });
    const fTls = h('input', { type: 'checkbox' });
    fTls.checked = ftp.tls !== false;
    const ftpMsg = h('p', { class: 'hint' });
    const saveFtp = async () => { await api('ftp', { op: 'save', host: fHost.value, user: fUser.value, password: fPass.value, dir: fDir.value, tls: fTls.checked }); await load(); };
    const ftpCard = h('div', { class: 'card' }, h('h2', { style: 'margin-top:0' }, 'Hosting (Raiola, por FTP)'),
      h('p', { class: 'hint' }, 'Los datos están en cPanel → Cuentas FTP. Se guardan solo en este ordenador. Para probar sin tocar la web actual, usa una carpeta nueva, por ejemplo /public_html/nueva.'),
      h('div', { class: 'grid' }, h('div', { class: 'f' }, h('label', {}, 'Servidor'), fHost), h('div', { class: 'f' }, h('label', {}, 'Usuario'), fUser),
        h('div', { class: 'f' }, h('label', {}, 'Contraseña'), fPass), h('div', { class: 'f' }, h('label', {}, 'Carpeta'), fDir)),
      h('label', { class: 'check' }, fTls, 'Conexión segura (FTPS)'),
      h('div', { class: 'row', style: 'margin-top:10px' },
        h('button', { class: 'btn', onclick: async () => { await saveFtp(); toast('Datos del hosting guardados.'); go('publish', null, true); } }, 'Guardar'),
        h('button', { class: 'btn', onclick: async () => { await saveFtp(); ftpMsg.textContent = 'Probando…'; try { const j = await api('ftp', { op: 'test' }); ftpMsg.textContent = j.msg + (j.files && j.files.length ? ' Contiene: ' + j.files.slice(0, 14).join(', ') + (j.files.length > 14 ? '…' : '') : ''); } catch (err) { ftpMsg.textContent = err.message; } } }, 'Probar conexión')),
      ftpMsg);
    pubBtn.addEventListener('click', () => {
      if (!confirm(`¿Publicar ahora la web en internet?${ftp.host ? ` Se sube a ${ftp.host}${ftp.dir} y sustituye lo que haya ahí con el mismo nombre.` : ''}`)) return;
      busy(pubBtn, async () => { const j = await api('publish'); log.hidden = false; log.textContent = j.log; toast(j.passed ? 'Publicada.' : 'No se ha podido publicar: mira el registro.', !j.passed); });
    });
    const autoBtn = h('button', { class: 'btn' }, S.data.autopublish ? 'Desactivar publicación automática' : 'Activar publicación automática');
    autoBtn.addEventListener('click', () => busy(autoBtn, async () => {
      const j = await api('autopublish', { enable: !S.data.autopublish }).catch((err) => toast(err.message, true));
      await load();
      if (j) toast(S.data.autopublish ? 'Activada: cada hora se publican los artículos programados que ya toca sacar.' : 'Desactivada.');
      go('publish', null, true);
    }));
    view.append(header('Publicar', 'La web se sube al hosting (Raiola) desde este ordenador. Las respuestas del quiz le llegan a Claudia por correo desde el propio hosting; no hay nada más que configurar.'),
      ftpCard,
      h('div', { class: 'card' }, h('h2', { style: 'margin-top:0' }, '1. Comprobar'), h('p', { class: 'hint' }, 'Revisa que no falte nada y que el SEO esté bien (títulos, descripciones, enlaces, datos para Google).'), checkBtn),
      h('div', { class: 'card' }, h('h2', { style: 'margin-top:0' }, '2. Publicar'),
        h('p', { class: 'hint' }, ftp.host ? `Web: se sube a ${ftp.host}${ftp.dir}.` : 'Web: falta configurar el hosting (arriba).'),
        fb.project ? h('p', { class: 'hint' }, `Respuestas (Firebase): proyecto ${fb.project}. La primera vez hay que haber hecho «firebase login» en este ordenador.`)
          : h('p', { class: 'hint' }, 'Respuestas del quiz: llegan por correo desde el hosting. Después de publicar, abre /contact.php en la web (debe decir "mail":true) y haz el quiz una vez para comprobar que llega.'),
        pubBtn),
      h('div', { class: 'card' }, h('h2', { style: 'margin-top:0' }, '3. Artículos programados'),
        h('p', {}, 'Publicación automática: ', S.data.autopublish ? h('span', { class: 'chip ok' }, 'Activada') : h('span', { class: 'chip off' }, 'Apagada')),
        h('p', { class: 'hint' }, 'Una tarea de Windows revisa cada hora si algún artículo programado ya debe salir y, si es así, publica la web. El ordenador tiene que estar encendido.'),
        autoBtn),
      h('h2', {}, 'Registro'), log);
  };

  // ---------------------------------------------------------------- arranque
  (async () => {
    try { await load(); } catch (err) { view.innerHTML = `<p class="card">No se puede conectar con el editor: ${esc(err.message)}. ¿Está abierta la ventana de editar.bat?</p>`; return; }
    const [v, arg] = (location.hash.slice(1) || 'home').split(':');
    go(VIEWS[v] ? v : 'home', arg || null, true);
  })();
  // Botones atras/adelante del navegador
  addEventListener('hashchange', () => {
    const [v, arg] = (location.hash.slice(1) || 'home').split(':');
    if (v !== S.view || (arg || null) !== S.arg) go(VIEWS[v] ? v : 'home', arg || null);
  });
  addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      const b = view.querySelector('.savebar .btn.primary');
      if (b) { e.preventDefault(); b.click(); }
    }
  });
})();
