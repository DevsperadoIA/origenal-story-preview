// Modo demostracion del panel y del editor: no hay programa detras. Lo que se pide al servidor se contesta con una
// foto del contenido, y nada se guarda.
(() => {
  const B = location.pathname.split('/admin/')[0];   // carpeta donde esta publicada la demostracion
  window.OS_DEMO = true;
  window.OS_BASE = B;
  const MSG = 'Esto es una demostración: puedes probarlo todo, pero aquí los cambios no se guardan.';
  const real = window.fetch.bind(window);
  const reply = (obj) => Promise.resolve(new Response(JSON.stringify(obj), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  window.fetch = (url, opts) => {
    const m = String(url).match(/\/_ed\/api\/([a-z0-9-]+)/);
    if (!m) return real(url, opts);
    let body = {};
    try { body = JSON.parse((opts && opts.body) || '{}'); } catch (e) { /* sin cuerpo */ }
    if (m[1] === 'state') return real(`${B}/_ed/demo/state.json`);
    if (m[1] === 'i18n' && body.op !== 'save') return real(`${B}/_ed/demo/i18n.json`);
    if (m[1] === 'check') return real(`${B}/_ed/demo/check.json`);
    notice();
    return reply({ ok: false, error: MSG });
  };
  // aviso visible cada vez que se intenta guardar, subir o publicar
  let box = null; let timer = 0;
  const notice = () => {
    if (!box) {
      box = document.createElement('div');
      box.style.cssText = 'position:fixed;left:50%;top:44px;transform:translateX(-50%);z-index:2147483647;max-width:min(560px,92vw);background:#2b2a28;color:#fff;font:500 15px/1.4 system-ui,sans-serif;padding:14px 18px;border-radius:12px;box-shadow:0 14px 40px -12px rgba(0,0,0,.5);text-align:center';
      box.id = 'demo-notice';
      box.textContent = MSG;
    }
    document.body.appendChild(box);
    clearTimeout(timer);
    timer = setTimeout(() => box.remove(), 4500);
  };
  addEventListener('unhandledrejection', (ev) => { if (ev.reason && ev.reason.message === MSG) ev.preventDefault(); });
  if (window.ED && window.ED.admin) window.ED.admin = B + window.ED.admin;
  // las direcciones del programa (/admin/, /assets/, /) apuntan a la carpeta de la demostracion
  const fix = (el) => ['src', 'href'].forEach((a) => {
    const v = el.getAttribute && el.getAttribute(a);
    if (v && v[0] === '/' && v[1] !== '/' && !v.startsWith(`${B}/`)) el.setAttribute(a, B + v);
  });
  const sweep = (n) => { if (n.nodeType === 1) { fix(n); n.querySelectorAll('[src], [href]').forEach(fix); } };
  new MutationObserver((ms) => ms.forEach((m) => { if (m.type === 'attributes') fix(m.target); else m.addedNodes.forEach(sweep); }))
    .observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'href'] });
  addEventListener('DOMContentLoaded', () => {
    sweep(document.documentElement);
    const r = document.createElement('div');
    r.textContent = 'DEMOSTRACIÓN · se puede probar todo, no se guarda nada';
    r.style.cssText = 'position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:2147483647;background:#e8692a;color:#fff;font:600 12px/1 system-ui,sans-serif;letter-spacing:.04em;padding:7px 14px;border-radius:0 0 10px 10px;pointer-events:none';
    document.body.appendChild(r);
  });
})();
