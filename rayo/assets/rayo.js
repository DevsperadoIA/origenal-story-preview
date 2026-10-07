// Lo que en el Rayo original hacia el runtime de React + GSAP: entrada, menu, apariciones y contadores.
(() => {
  const root = document.documentElement;
  root.classList.add('js');
  requestAnimationFrame(() => document.body.classList.add('is-loaded'));

  // Menu hamburguesa
  const ham = document.querySelector('.mxd-nav__hamburger');
  const nav = document.querySelector('.mxd-nav__wrap');
  const menu = document.querySelector('.mxd-menu__wrapper');
  const setMenu = (open) => {
    nav.classList.toggle('active_menu', open);
    menu.classList.toggle('active_menu', open);
    ham.classList.toggle('nav-open', open);
    ham.parentElement.classList.toggle('nav-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  };
  ham.addEventListener('click', (ev) => { ev.preventDefault(); setMenu(!menu.classList.contains('active_menu')); });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') setMenu(false); });

  // Apariciones al hacer scroll
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
  document.querySelectorAll('.anim-uni-in-up').forEach((el) => io.observe(el));

  // Hero fijo que se apaga mientras suben las fotos
  const hero = document.querySelector('.os-pinned__static');
  if (hero) {
    const fade = () => {
      if (getComputedStyle(hero).position !== 'sticky') { hero.style.opacity = ''; return; }
      hero.style.opacity = Math.max(0.12, 1 - window.scrollY / (window.innerHeight * 1.4)).toFixed(3);
    };
    fade();
    window.addEventListener('scroll', fade, { passive: true });
  }

  // Contadores
  const co = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target, target = parseInt(el.dataset.n, 10), t0 = performance.now();
      const tick = (t) => {
        const k = Math.min(1, (t - t0) / 1500);
        el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      co.unobserve(el);
    });
  }, { threshold: 0.6 });
  document.querySelectorAll('[data-n]').forEach((el) => co.observe(el));

  // Imagen que sigue al raton en las listas (hover-reveal de Rayo)
  document.querySelectorAll('.hover-reveal__item').forEach((item) => {
    const box = item.querySelector('.hover-reveal__content');
    if (!box) return;
    item.addEventListener('mousemove', (ev) => {
      const r = item.getBoundingClientRect();
      box.style.transform = `translate(${ev.clientX - r.left - box.offsetWidth / 2}px, ${ev.clientY - r.top - box.offsetHeight / 2}px)`;
    });
    item.addEventListener('mouseenter', () => box.classList.add('os-show'));
    item.addEventListener('mouseleave', () => box.classList.remove('os-show'));
  });

  // Formulario sin backend en la propuesta: compone el correo
  const form = document.querySelector('.os-form');
  if (form) {
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const d = new FormData(form);
      const body = `Name: ${d.get('name')}\nCompany: ${d.get('company')}\nEmail: ${d.get('email')}\nTarget market: ${d.get('market')}\n\n${d.get('message')}`;
      location.href = `mailto:${form.dataset.to}?subject=${encodeURIComponent('New project - ' + d.get('company'))}&body=${encodeURIComponent(body)}`;
    });
  }
})();
