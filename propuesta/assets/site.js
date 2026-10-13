// Medicion: solo cuenta si el visitante acepto la analitica (sin permiso, gtag no existe y esto no hace nada).
// Eventos: generate_lead (cuestionario enviado), quiz_result (servicio recomendado), book_call (clic en reservar),
// language_switch y contact_click (clic en el correo).
window.osTrack = (name, params) => { if (window.gtag) window.gtag('event', name, params || {}); };
document.addEventListener('click', (ev) => {
  const a = ev.target.closest ? ev.target.closest('a[href]') : null;
  if (!a) return;
  const href = a.getAttribute('href');
  if (/calendly\.com/.test(href)) window.osTrack('book_call', { service: decodeURIComponent((href.match(/utm_content=([^&]+)/) || [])[1] || '') });
  else if (a.closest('.lang-in, .lang-foot')) window.osTrack('language_switch', { language: a.getAttribute('hreflang') });
  else if (/^mailto:/.test(href)) window.osTrack('contact_click', { method: 'email' });
});

(() => {
  const header = document.querySelector('.site-header');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 10);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const burger = document.querySelector('.burger');
  const nav = document.querySelector('.nav');
  burger.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    burger.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

  // Contadores: animan el numero de "25+" -> 0..25 conservando el sufijo.
  const counters = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const target = parseInt(el.dataset.n, 10);
      const t0 = performance.now();
      const tick = (t) => {
        const k = Math.min(1, (t - t0) / 1400);
        el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      counters.unobserve(el);
    });
  }, { threshold: 0.6 });
  document.querySelectorAll('[data-n]').forEach((el) => counters.observe(el));

  const filters = document.querySelector('.filters');
  if (filters) {
    filters.addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      filters.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      const f = b.dataset.f;
      document.querySelectorAll('.cards .card').forEach((c) => {
        c.style.display = f === 'all' || c.dataset.p === f ? '' : 'none';
      });
    });
  }

  // Cuestionario de contacto: pasos, validacion y envio al programa del hosting (contact.php), que lo manda por correo.
  // Si falla, se abre el correo del visitante con las respuestas. Con Firebase configurado, se guarda alli.
  const quiz = document.querySelector('form.quiz');
  if (quiz) {
    const steps = [...quiz.querySelectorAll('.quiz-step')];
    const back = quiz.querySelector('.quiz-back');
    const next = quiz.querySelector('.quiz-next');
    const send = quiz.querySelector('.quiz-send');
    const bar = quiz.querySelector('.quiz-progress span');
    const msg = quiz.querySelector('.quiz-msg');
    let at = 0;
    const show = (i) => {
      at = i;
      steps.forEach((s, k) => { s.hidden = k !== i; });
      if (back) back.hidden = i === 0;
      if (next) next.hidden = i === steps.length - 1;
      if (send) send.hidden = i !== steps.length - 1;
      if (bar) bar.style.width = `${((i + 1) / steps.length) * 100}%`;
      msg.hidden = true;
    };
    const valid = (step) => {
      let ok = true;
      step.querySelectorAll('input, select, textarea').forEach((el) => {
        if (el.type === 'checkbox' || el.type === 'radio') return;
        const bad = !el.checkValidity() || (el.required && !el.value.trim());
        el.classList.toggle('bad', bad);
        if (bad) ok = false;
      });
      step.querySelectorAll('[data-required]').forEach((g) => {
        const bad = !g.querySelector('input:checked');
        g.classList.toggle('bad', bad);
        if (bad) ok = false;
      });
      if (!ok) { msg.textContent = quiz.dataset.requiredText || 'Please fill in the required fields.'; msg.hidden = false; }
      return ok;
    };
    const answers = () => {
      const out = {};
      const names = new Set([...quiz.querySelectorAll('[name]')].map((el) => el.name).filter((n) => n !== 'website'));
      names.forEach((n) => {
        const els = [...quiz.querySelectorAll(`[name="${n}"]`)];
        if (els[0].type === 'checkbox') out[n] = els.filter((x) => x.checked).map((x) => x.value);
        else if (els[0].type === 'radio') out[n] = (els.find((x) => x.checked) || {}).value || '';
        else out[n] = els[0].value.trim();
      });
      return out;
    };
    const toFields = (a) => {
      const f = {};
      Object.entries(a).forEach(([k, v]) => {
        f[k] = Array.isArray(v) ? { arrayValue: { values: v.map((x) => ({ stringValue: x })) } } : { stringValue: String(v).slice(0, 5000) };
      });
      return f;
    };
    if (next) next.addEventListener('click', () => { if (valid(steps[at])) show(at + 1); });
    if (back) back.addEventListener('click', () => show(at - 1));
    if (steps.length) show(0);
    quiz.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (!valid(steps[at] || quiz)) return;
      if (steps.length && at < steps.length - 1) { show(at + 1); return; }   // Intro a mitad: al paso siguiente, no enviar a medias
      if (quiz.elements.website && quiz.elements.website.value) return; // relleno por un robot
      const a = answers();
      const done = () => { quiz.hidden = true; const d = quiz.parentElement.querySelector('.quiz-done'); if (d) d.hidden = false; window.osTrack('generate_lead', { method: 'contact_form' }); };
      // cada respuesta con el texto de su pregunta, tal como la vio la persona
      const label = (n) => {
        const el = quiz.querySelector(`[name="${n}"]`);
        const l = el && el.closest('.q') && el.closest('.q').querySelector('.q-l');
        return l ? l.textContent.replace(/\s*\*\s*$/, '').trim() : n;
      };
      const labelled = Object.entries(a).filter(([, v]) => (Array.isArray(v) ? v.length : v)).map(([k, v]) => [label(k), v]);
      const byEmail = () => {
        const body = labelled.map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n');
        window.osTrack('generate_lead', { method: 'email' });
        window.location.href = `mailto:${quiz.dataset.to}?subject=${encodeURIComponent('New enquiry - ' + (a.company || a.name || ''))}&body=${encodeURIComponent(body)}`;
      };
      if (!quiz.dataset.endpoint) { byEmail(); return; }
      const php = /\.php$/.test(quiz.dataset.endpoint);
      if (send) send.disabled = true;
      try {
        const r = await fetch(quiz.dataset.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(php ? {
            fields: labelled, name: a.name || '', company: a.company || '', email: a.email || '',
            page: location.pathname, lang: document.documentElement.lang, website: '',
          } : { fields: {
            createdAt: { timestampValue: new Date().toISOString() },
            page: { stringValue: location.pathname },
            read: { booleanValue: false },
            answers: { mapValue: { fields: toFields(a) } },
          } }),
        });
        if (!r.ok) throw new Error(r.status);
        if (php && !(await r.json()).ok) throw new Error('php');
        done();
      } catch (err) {
        msg.textContent = quiz.dataset.errorText || 'Error';
        msg.hidden = false;
        if (send) send.disabled = false;
        if (php) byEmail();   // que no se pierda: se abre su correo con las respuestas ya escritas
      }
    });
  }
})();

// Aviso de cookies: aceptar, rechazar o configurar. La eleccion se guarda 12 meses en el navegador
// y la analitica (Google Analytics, si hay ID) solo se carga con permiso.
(() => {
  const box = document.getElementById('cc');
  if (!box) return;
  const KEY = 'os_consent';
  const YEAR = 365 * 24 * 3600 * 1000;
  const ga = document.body.dataset.ga;
  const read = () => {
    try {
      const c = JSON.parse(localStorage.getItem(KEY) || 'null');
      return c && Date.now() - c.ts < YEAR ? c : null;
    } catch (_) { return null; }
  };
  const loadGA = () => {
    if (!ga || window.gtag) return;
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga)}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', ga, { anonymize_ip: true });
  };
  const opts = box.querySelector('.cc-opts');
  const analytics = box.querySelector('input[name=analytics]');
  const show = (settings) => {
    const c = read();
    analytics.checked = !!(c && c.analytics);
    opts.hidden = !settings;
    box.querySelector('.cc-set').hidden = settings;
    box.querySelector('.cc-save').hidden = !settings;
    box.hidden = false;
  };
  const save = (a) => {
    try { localStorage.setItem(KEY, JSON.stringify({ analytics: a, ts: Date.now(), v: 1 })); } catch (_) { /* navegador sin almacenamiento */ }
    box.hidden = true;
    if (a) loadGA();
    else if (window.gtag) location.reload(); // quitar una analitica ya cargada
  };
  box.querySelector('.cc-accept').addEventListener('click', () => save(true));
  box.querySelector('.cc-reject').addEventListener('click', () => save(false));
  box.querySelector('.cc-set').addEventListener('click', () => show(true));
  box.querySelector('.cc-save').addEventListener('click', () => save(analytics.checked));
  document.querySelectorAll('.cookie-link').forEach((b) => b.addEventListener('click', () => show(true)));
  const c = read();
  if (!c) show(false);
  else if (c.analytics) loadGA();
})();

// Los pasos de cada servicio en la home y en /services/: clic = ir a ese paso de la pagina del servicio.
document.querySelectorAll('a.pillar').forEach((card) => {
  card.querySelectorAll('ol li').forEach((li, i) => {
    li.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); location.href = `${card.getAttribute('href')}#step-${i + 1}`; });
  });
});

// Quiz: las respuestas de cada persona viajan a Calendly en el enlace de la reserva (campo utm_term),
// asi aparecen en cada cita junto al servicio recomendado (utm_content).
(() => {
  const page = document.querySelector('.quiz-page');
  if (!page) return;
  // cada respuesta, con las primeras palabras de la opcion elegida: "1: decided to enter | 2: find the right + ..."
  const short = (k, v) => {
    const btn = page.querySelector(`.osq-options[data-question="${k}"] .osq-option[data-value="${v}"]`);
    const words = (btn ? btn.textContent : v).replace(/^\s*we(?:'re|'ve)?\s+/i, '').replace(/[^\p{L}\p{N}\s&-]/gu, '').trim().split(/\s+/);
    return words.slice(0, 4).join(' ').toLowerCase();
  };
  const num = { 0: 1, 1: 2, 2: 3, '2b': 3, c1: '4a', c2: '4b', t1: '5a', t2: '5b' };
  const code = (answers) => Object.keys(answers).sort().map((k) => `${num[k] || k}: ${[].concat(answers[k]).map((v) => short(k, v)).join(' + ')}`).join(' | ');
  // El quiz ES el contacto: al dar el resultado manda las respuestas a Claudia (contact.php) y el boton lleva a Calendly,
  // donde la persona pone sus datos. La referencia (Q-XXXX) va en el correo y en la reserva, para casarlos.
  const clean = (el) => el.textContent.replace(/\s+/g, ' ').trim();
  const quizFields = (plan) => {
    const answers = window.osQuizAnswers || {};
    const out = plan ? [[page.dataset.plan || 'Recommended starting point', plan]] : [];
    page.querySelectorAll('.osq-options[data-question]').forEach((g) => {
      if (!(g.dataset.question in answers)) return;
      const picked = [...g.querySelectorAll('.osq-option.is-selected')].map(clean);
      if (!picked.length) return;
      const q = g.closest('.osq-step').querySelector('.osq-q-text');
      const sub = g.previousElementSibling && g.previousElementSibling.classList.contains('osq-group-label') ? ` (${clean(g.previousElementSibling)})` : '';
      out.push([(q ? clean(q) : g.dataset.question) + sub, picked]);
    });
    return out;
  };
  let ref = ''; let last = ''; let planName = '';
  const send = (plan) => {
    planName = plan;
    const fields = quizFields(plan);
    const key = JSON.stringify(fields);
    if (key === last || fields.length < 2) return;   // las mismas respuestas no se mandan dos veces
    last = key;
    ref = `Q-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    if (!page.dataset.endpoint) return;
    fetch(page.dataset.endpoint, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: `Quiz ${ref}: ${plan}`, fields: [['Reference', ref], ...fields], page: location.pathname, lang: document.documentElement.lang, website: '' }),
    }).catch(() => {});
  };
  const tag = (a, answers) => {
    if (!a || !/calendly\.com/.test(a.href)) return;
    // 1) en la casilla de texto de la reserva (a1 = primera pregunta del formulario de Calendly): se ve en la cita y en su correo
    // 2) en los campos de seguimiento (utm), que Calendly solo guarda hasta 255 letras y en planes de pago
    const summary = code(answers);
    const note = `Quiz ${ref}${planName ? ` · ${planName}` : ''} — ${summary}`;
    a.href = `${a.href.replace(/&(utm_term|utm_campaign|a1)=[^&]*/g, '')}&utm_term=${encodeURIComponent(summary.slice(0, 240))}${ref ? `&utm_campaign=${ref}` : ''}&a1=${encodeURIComponent(note)}`;
  };
  window.osQuizDone = (root, answers, winner) => {
    const title = root.querySelector('#resTitle');
    send(title ? clean(title) : String(winner || ''));
    tag(root.querySelector('#resCta'), answers);
    window.osTrack('quiz_result', { service: String(winner || '') });
  };
  const yes = page.querySelector('#unclearYes');
  if (yes) {
    yes.addEventListener('click', () => {
      const label = yes.closest('.osq-step').querySelector('.osq-result-tag');
      send(label ? clean(label) : 'Unclear direction');
      tag(yes, window.osQuizAnswers || {});
    });
  }
})();

// Ferias: linea desplazable. Se arrastra con el raton o el dedo y, sola, va y vuelve despacio.
document.querySelectorAll('.fairs-row').forEach((row) => {
  let down = false; let startX = 0; let startLeft = 0; let moved = false;
  row.addEventListener('pointerdown', (ev) => { if (ev.pointerType === 'mouse') { down = true; moved = false; startX = ev.clientX; startLeft = row.scrollLeft; } });
  addEventListener('pointermove', (ev) => {
    if (!down) return;
    if (Math.abs(ev.clientX - startX) > 4) { moved = true; row.classList.add('drag'); }
    row.scrollLeft = startLeft - (ev.clientX - startX);
  });
  addEventListener('pointerup', () => { down = false; row.classList.remove('drag'); });
  const fit = () => row.parentElement.classList.toggle('scrolls', row.scrollWidth - row.clientWidth > 4);
  fit();
  addEventListener('resize', fit);
  row.scrollLeft = Math.max(0, (row.scrollWidth - row.clientWidth) / 2);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let dir = 1; let paused = false; let last = 0;
  let pos = Math.max(0, (row.scrollWidth - row.clientWidth) / 2);   // arranca centrada
  row.scrollLeft = pos;
  const stop = () => { paused = true; };
  const go = () => { paused = false; pos = row.scrollLeft; last = 0; };
  row.addEventListener('pointerenter', stop); row.addEventListener('pointerleave', go);
  row.addEventListener('touchstart', stop, { passive: true }); row.addEventListener('touchend', () => setTimeout(go, 2500));
  const tick = (t) => {
    const max = row.scrollWidth - row.clientWidth;
    if (!paused && max > 4 && last) {
      pos += dir * ((t - last) / 1000) * 28;
      if (pos >= max) { pos = max; dir = -1; } else if (pos <= 0) { pos = 0; dir = 1; }
      row.scrollLeft = pos;
    }
    last = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

// Mapa interactivo: el contorno de los paises (Natural Earth) se carga al acercarse; los puntos salen de la lista del panel.
document.querySelectorAll('.wmap').forEach((root) => {
  const stage = root.querySelector('.wmap-stage');
  const svg = root.querySelector('.wmap-svg');
  const land = root.querySelector('.wmap-land');
  const tip = root.querySelector('.wmap-tip');
  const W = +root.dataset.w; const H = +root.dataset.h;
  const pins = [...root.querySelectorAll('.wmap-pin')].map((el) => ({ el, k: el.dataset.k, g: el.dataset.g, id: el.dataset.id, x: +el.dataset.x, y: +el.dataset.y }));
  const items = [...root.querySelectorAll('.wmap-item')];
  const tabs = [...root.querySelectorAll('.wmap-tab')];
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // el punto verde de un pais que ademas es cliente se aparta un poco para que se vean los dos
  pins.forEach((p) => { p.twin = p.g === 's' && pins.some((q) => q.g !== 's' && q.x === p.x && q.y === p.y); });
  const radius = () => parseFloat(getComputedStyle(stage).getPropertyValue('--pin')) || 12;
  const clamp = (v, a, b) => Math.min(Math.max(v, a), Math.max(a, b));

  const world = () => {
    const ar = stage.clientWidth / stage.clientHeight;
    const w = Math.max(W, H * ar) * 1.05;
    return { x: (W - w) / 2, y: (H - w / ar) / 2, w, h: w / ar };
  };
  // encuadre que deja dentro todos los puntos de una region, con aire alrededor para el punto y su etiqueta
  const fit = (pts) => {
    const full = world();
    if (!pts.length) return full;
    const sw = stage.clientWidth; const sh = stage.clientHeight; const ar = sw / sh;
    const xs = pts.map((p) => p.x); const ys = pts.map((p) => p.y);
    const x0 = Math.min(...xs); const x1 = Math.max(...xs); const y0 = Math.min(...ys); const y1 = Math.max(...ys);
    const air = clamp(sh * 0.14, 24, 64);
    let w = Math.max((x1 - x0) / (1 - (2 * air) / sw), pts.length > 1 ? 230 : 330);
    let h = (y1 - y0) / (1 - (2 * air) / sh);
    if (w / h < ar) w = h * ar; else h = w / ar;
    if (w >= full.w * 0.97) return full;
    return { x: clamp((x0 + x1) / 2 - w / 2, full.x, full.x + full.w - w), y: clamp((y0 + y1) / 2 - h / 2, full.y, full.y + full.h - h), w, h };
  };

  let view = world(); let group = 'all'; let raf = 0; let hot = null; let sticky = null;
  const screen = (p, v, numbered) => {
    const s = stage.clientWidth / v.w;
    const off = p.twin ? radius() * (numbered ? 1.6 : 0.8) : 0;
    return [(p.x - v.x) * s + off, (p.y - v.y) * s - off];
  };
  // donde dos puntos se pisan, se quedan en punto pequeno sin numero
  const crowd = (v) => {
    const r = radius();
    const pos = pins.map((p) => screen(p, v, true));
    pins.forEach((p, i) => {
      p.el.classList.toggle('dot', pos.some((q, j) => j !== i && Math.hypot(q[0] - pos[i][0], q[1] - pos[i][1]) < r * 2 + 1));
    });
  };
  const showTip = () => {
    const p = pins.find((q) => q.k === hot);
    if (!p) { tip.classList.remove('show'); return; }
    const [x, y] = screen(p, view, !p.el.classList.contains('dot'));
    const sw = stage.clientWidth; const sh = stage.clientHeight; const r = radius();
    if (x < 0 || y < 0 || x > sw || y > sh) { tip.classList.remove('show'); return; }
    tip.textContent = p.el.dataset.name;
    if (p.el.dataset.sub) { const sub = document.createElement('small'); sub.textContent = p.el.dataset.sub; tip.append(sub); }
    const half = tip.offsetWidth / 2 + 6;
    const below = y - r * 1.3 - tip.offsetHeight < 6;
    tip.classList.toggle('below', below);
    tip.style.left = `${clamp(x, half, sw - half)}px`;
    tip.style.top = `${below ? y + r * 1.3 + 8 : y - r * 1.3 - 8}px`;
    tip.classList.add('show');
  };
  const place = () => {
    svg.setAttribute('viewBox', `${view.x.toFixed(1)} ${view.y.toFixed(1)} ${view.w.toFixed(1)} ${view.h.toFixed(1)}`);
    pins.forEach((p) => {
      const [x, y] = screen(p, view, !p.el.classList.contains('dot'));
      p.el.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;   // «translate» y no «transform»: asi no lo encoge el «scale» del punto pequeno
    });
    showTip();
  };
  const go = (v) => {
    cancelAnimationFrame(raf);
    const from = view; const zoomIn = v.w < from.w;
    if (!zoomIn) crowd(v);
    if (still || document.hidden) { view = v; crowd(v); place(); return; }
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 750);
      const q = k < 0.5 ? 4 * k * k * k : 1 - ((-2 * k + 2) ** 3) / 2;
      view = { x: from.x + (v.x - from.x) * q, y: from.y + (v.y - from.y) * q, w: from.w + (v.w - from.w) * q, h: from.h + (v.h - from.h) * q };
      if (k === 1) crowd(v);
      place();
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };
  // los puntos de una region: los suyos y los verdes que caen dentro de ella
  const members = (g) => {
    if (g === 'all') return pins;
    const own = pins.filter((p) => p.g === g);
    if (g === 's' || !own.length) return own;
    const xs = own.map((p) => p.x); const ys = own.map((p) => p.y); const m = 70;
    return own.concat(pins.filter((p) => p.g === 's' && p.x > Math.min(...xs) - m && p.x < Math.max(...xs) + m && p.y > Math.min(...ys) - m && p.y < Math.max(...ys) + m));
  };
  const frame = () => (group === 'all' ? world() : fit(members(group)));
  const mark = () => {
    const mine = new Set(members(group));
    const ids = new Set([...mine].map((p) => p.id));
    pins.forEach((p) => p.el.classList.toggle('in', mine.has(p)));
    land.querySelectorAll('path.on,path.sp').forEach((el) => el.classList.toggle('in', ids.has(el.dataset.id)));
  };
  const select = (g) => {
    group = g;
    tabs.forEach((t) => { const on = t.dataset.g === g; t.classList.toggle('on', on); t.setAttribute('aria-pressed', on); });
    root.classList.toggle('focus', g !== 'all');
    mark();
    go(frame());
  };
  const setHot = (k) => {
    hot = k;
    const p = pins.find((q) => q.k === k);
    pins.forEach((q) => q.el.classList.toggle('hot', q === p));
    items.forEach((el) => el.classList.toggle('hot', el.dataset.k === k));
    land.querySelectorAll('path.hot').forEach((el) => el.classList.remove('hot'));
    if (p && p.id) { const c = land.querySelector(`path[data-id="${p.id}"]`); if (c) c.classList.add('hot'); }
    showTip();
  };
  // clic: se queda resaltado, y si el punto no se distingue en este encuadre se acerca a su region
  const activate = (k) => {
    const p = pins.find((q) => q.k === k);
    if (!p) return;
    sticky = k;
    setHot(k);
    const [x, y] = screen(p, view, true);
    const out = x < 0 || y < 0 || x > stage.clientWidth || y > stage.clientHeight;
    if (group !== p.g && (out || p.el.classList.contains('dot'))) select(p.g);
  };
  const wire = (el, k) => {
    el.addEventListener('pointerenter', () => setHot(k()));
    el.addEventListener('pointerleave', () => setHot(sticky));
    el.addEventListener('click', (ev) => { ev.stopPropagation(); activate(k()); });
  };
  pins.forEach((p) => wire(p.el, () => p.k));
  items.forEach((el) => {
    wire(el, () => el.dataset.k);
    el.addEventListener('focus', () => setHot(el.dataset.k));
    el.addEventListener('blur', () => setHot(sticky));
    el.addEventListener('keydown', (ev) => {
      if (ev.target === el && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); activate(el.dataset.k); }
    });
  });
  tabs.forEach((t) => t.addEventListener('click', () => { sticky = null; setHot(null); select(t.dataset.g); }));
  stage.addEventListener('click', () => { sticky = null; setHot(null); });

  crowd(view); place();
  new ResizeObserver(() => { cancelAnimationFrame(raf); view = frame(); crowd(view); place(); }).observe(stage);

  const draw = (d) => {
    const cls = {};
    pins.forEach((p) => { if (p.id) cls[p.id] = p.g === 's' ? (cls[p.id] || 'sp') : 'on'; });
    const first = (id) => (pins.find((p) => p.id === id && p.g !== 's') || pins.find((p) => p.id === id)).k;
    const frag = document.createDocumentFragment();
    d.c.forEach((c) => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      el.setAttribute('d', c.d);
      el.dataset.id = c.id;
      if (cls[c.id]) { el.setAttribute('class', cls[c.id]); wire(el, () => first(c.id)); }
      frag.append(el);
    });
    land.append(frag);
    mark();
    root.classList.add('ready');
  };
  const load = () => fetch(root.dataset.src).then((r) => r.json()).then(draw).catch(() => root.classList.add('nomap'));
  if (!('IntersectionObserver' in window)) { load(); return; }
  new IntersectionObserver((entries, o) => {
    if (entries.some((e) => e.isIntersecting)) { o.disconnect(); load(); }
  }, { rootMargin: '800px 0px' }).observe(root);
});
