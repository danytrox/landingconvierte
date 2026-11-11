(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const FIRST_BUILD_MS = 900;   // how long the plan shows on page load
  const PLAN_SWAP_MS = 260;     // plan state before the new trade's text appears
  const PLAN_HOLD_MS = 320;     // new text shown as a plan before it is built

  // Hero entrance: one sequence on load.
  requestAnimationFrame(() => document.body.classList.add('is-loaded'));

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
      slot('trust').querySelectorAll('li span').forEach((item, index) => { item.textContent = example.trust[index]; });
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
        timer = setTimeout(build, PLAN_HOLD_MS);
      }, PLAN_SWAP_MS);
    };

    // The drawing turns into the page, with one scan line sweeping over it.
    const build = () => {
      frame.classList.remove('is-plano');
      frame.classList.remove('is-scanning');
      void frame.offsetWidth; // restart the scan animation
      frame.classList.add('is-scanning');
    };
    frame.addEventListener('animationend', () => frame.classList.remove('is-scanning'));

    tabs.forEach(tab => tab.addEventListener('click', () => show(tab.dataset.example)));
    if (reduceMotion) frame.classList.remove('is-plano');
    else timer = setTimeout(build, FIRST_BUILD_MS);

    // Fine pointers tilt the demo window slightly toward the cursor.
    const stage = document.querySelector('.demo-stage');
    const win = frame.querySelector('.demo-window');
    if (stage && win && !reduceMotion && finePointer) {
      let raf = 0;
      stage.addEventListener('pointermove', event => {
        const box = stage.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width - .5;
        const y = (event.clientY - box.top) / box.height - .5;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          win.style.setProperty('--ry', `${(x * 8).toFixed(2)}deg`);
          win.style.setProperty('--rx', `${(-y * 6).toFixed(2)}deg`);
        });
      });
      stage.addEventListener('pointerleave', () => {
        cancelAnimationFrame(raf);
        win.style.setProperty('--ry', '0deg');
        win.style.setProperty('--rx', '0deg');
      });
    }
  }

  // Blueprint surfaces: the grid lights up in neon around the pointer.
  if (!reduceMotion && finePointer) {
    document.querySelectorAll('.on-blue').forEach(surface => {
      let raf = 0;
      surface.addEventListener('pointermove', event => {
        const box = surface.getBoundingClientRect();
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          surface.style.setProperty('--mx', `${event.clientX - box.left}px`);
          surface.style.setProperty('--my', `${event.clientY - box.top}px`);
          surface.style.setProperty('--spot', '1');
        });
      });
      surface.addEventListener('pointerleave', () => surface.style.setProperty('--spot', '0'));
    });
  }

  // Scroll reveal, staggered inside lists. Only applied when it can be undone by the observer.
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const groups = ['.section-head', '.service-list', '.included', '.compare', '.compare-note', '.steps', '.pair', '.faq', '.contact-copy', '.form', '.band'];
    const targets = [];
    document.querySelectorAll(groups.join(',')).forEach(element => {
      if (element.closest('.hero')) return;
      const items = element.matches('.service-list, .steps, .pair') ? [...element.children] : [element];
      items.forEach((item, index) => {
        item.style.setProperty('--rd', `${index * 90}ms`);
        targets.push(item);
      });
    });
    const revealer = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: .12 });
    targets.forEach(item => {
      // Anything already on screen at load stays put instead of flashing.
      if (item.getBoundingClientRect().top < window.innerHeight * .9) return;
      item.classList.add('reveal');
      revealer.observe(item);
    });
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
