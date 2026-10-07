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

  // Formulario: sin backend en la propuesta, compone un correo.
  const form = document.querySelector('.form');
  if (form) {
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const d = new FormData(form);
      const goals = d.getAll('goal').join(', ');
      const body = `Name: ${d.get('name')}\nCompany: ${d.get('company')}\nEmail: ${d.get('email')}\nTarget market: ${d.get('market')}\nLooking for: ${goals}\n\n${d.get('message')}`;
      window.location.href = `mailto:${form.dataset.to}?subject=${encodeURIComponent('New project - ' + d.get('company'))}&body=${encodeURIComponent(body)}`;
    });
  }
})();
