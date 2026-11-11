(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Mobile menu
  const toggle = document.querySelector('.nav-toggle');
  const panel = document.getElementById('menu-panel');
  if (toggle && panel) {
    const setOpen = open => {
      panel.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    };
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    panel.addEventListener('click', event => { if (event.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setOpen(false); toggle.focus(); }
    });
  }

  // Hero demo: the plan of a landing page, built for the chosen trade
  const frame = document.querySelector('.demo-frame');
  if (frame) {
    const examples = {
      dental: {
        accent: '#0e8f7e', url: 'tuclinica.cl', brand: 'Tu clínica dental',
        title: 'Ortodoncia y limpieza dental en Providencia',
        sub: 'Pide tu evaluación y te confirmamos la hora el mismo día.',
        cta: 'Agendar evaluación',
        trust: ['Atención de lunes a sábado', 'Presupuesto por escrito antes de empezar']
      },
      cafe: {
        accent: '#b4471f', url: 'tucafeteria.cl', brand: 'Tu cafetería',
        title: 'Café de especialidad y pastelería en Valparaíso',
        sub: 'Reserva una mesa o encarga tu torta para retirar.',
        cta: 'Reservar mesa',
        trust: ['Abierto todos los días desde las 8:30', 'Opciones sin gluten y veganas']
      },
      contable: {
        accent: '#5b3fc4', url: 'tuestudio.cl', brand: 'Tu estudio contable',
        title: 'Contabilidad mensual para pymes y emprendedores',
        sub: 'Impuestos, remuneraciones y patente al día, sin perseguir papeles.',
        cta: 'Pedir cotización',
        trust: ['Un contador asignado a tu empresa', 'Reporte mensual fácil de leer']
      },
      gasfiter: {
        accent: '#c2410c', url: 'tugasfiter.cl', brand: 'Tu servicio de gasfitería',
        title: 'Gasfíter a domicilio en Santiago',
        sub: 'Fugas, calefont y destapes. Cuéntanos el problema y coordinamos la visita.',
        cta: 'Pedir visita',
        trust: ['Presupuesto antes de comenzar', 'Garantía por escrito del trabajo']
      }
    };
    const tabs = [...document.querySelectorAll('.demo-tab')];
    const slot = name => frame.querySelector(`[data-demo="${name}"]`);
    let timer = 0;

    const fill = example => {
      frame.style.setProperty('--accent', example.accent);
      slot('url').textContent = example.url;
      slot('brand').textContent = example.brand;
      slot('title').textContent = example.title;
      slot('sub').textContent = example.sub;
      slot('cta').textContent = example.cta;
      slot('trust').querySelectorAll('span').forEach((item, index) => { item.textContent = example.trust[index]; });
    };

    const show = key => {
      const example = examples[key];
      if (!example) return;
      tabs.forEach(tab => tab.setAttribute('aria-pressed', String(tab.dataset.example === key)));
      clearTimeout(timer);
      if (reduceMotion) { fill(example); return; }
      frame.classList.add('is-plano');
      timer = setTimeout(() => {
        fill(example);
        timer = setTimeout(() => frame.classList.remove('is-plano'), 320);
      }, 260);
    };

    tabs.forEach(tab => tab.addEventListener('click', () => show(tab.dataset.example)));
    // Page load: the drawing becomes the page, once.
    if (reduceMotion) frame.classList.remove('is-plano');
    else timer = setTimeout(() => frame.classList.remove('is-plano'), 700);
  }

  // Contact form: send in place, fall back to a normal POST if fetch is unavailable
  const form = document.querySelector('form[data-async]');
  if (form && window.fetch && window.FormData) {
    const status = form.querySelector('.form-status');
    const button = form.querySelector('button[type="submit"]');
    const label = button.textContent;
    const SEND_TIMEOUT_MS = 15000;
    const say = (kind, text) => { status.className = `form-status ${kind}`; status.textContent = text; };

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (form.botcheck && form.botcheck.checked) return;
      button.disabled = true;
      button.textContent = 'Enviando…';
      say('', '');
      const kept = 'Lo que escribiste sigue en el formulario.';
      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), SEND_TIMEOUT_MS);
      let response = null;
      try {
        response = await fetch(form.action, { method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(form), signal: abort.signal });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) throw new Error(result.message || `HTTP ${response.status}`);
        form.reset();
        say('is-ok', 'Propuesta pedida. Recibimos tu consulta y te responderemos al correo que indicaste.');
      } catch (error) {
        console.error('Contact form send failed:', error);
        // A response means the provider answered and refused; no response means the network failed or timed out.
        say('is-error', response
          ? `El servicio de formularios rechazó el envío, así que tu consulta no llegó. Inténtalo de nuevo más tarde. ${kept}`
          : `No se pudo enviar la consulta. Revisa tu conexión y vuelve a intentarlo. ${kept}`);
      } finally {
        clearTimeout(timeout);
        button.disabled = false;
        button.textContent = label;
        status.focus();
      }
    });
  }

  // Mobile action bar: appears after the hero, hides while the form is on screen
  const bar = document.querySelector('.action-bar');
  const hero = document.querySelector('.hero');
  const contact = document.getElementById('formulario');
  if (bar && hero && 'IntersectionObserver' in window) {
    document.body.classList.add('has-action-bar');
    const seen = new Map();
    const update = () => bar.classList.toggle('is-visible', !seen.get(hero) && !seen.get(contact));
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => seen.set(entry.target, entry.isIntersecting));
      update();
    });
    observer.observe(hero);
    if (contact) observer.observe(contact);
  }
})();
