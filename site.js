// Contents rail: highlight the section in view, collapse on small screens.
(() => {
  const links = [...document.querySelectorAll('.toc a')];
  const byId = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      links.forEach(a => a.removeAttribute('aria-current'));
      byId.get(e.target.id)?.setAttribute('aria-current', 'true');
    }
  }, { rootMargin: '-20% 0px -70% 0px' });
  byId.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });

  const d = document.querySelector('.toc details');
  const wide = matchMedia('(min-width: 1100px)');
  const sync = () => { d.open = wide.matches; };
  wide.addEventListener('change', sync);
  sync();
  links.forEach(a => a.addEventListener('click', () => { if (!wide.matches) d.open = false; }));
})();

// Cycle-time model, ported from APLP-cycle-time.xlsx.
(() => {
  const $ = id => document.getElementById(id);
  const inputs = { OD: $('iOD'), D: $('iD'), L: $('iL'), RPM: $('iRPM'), P: $('iP') };
  if (!inputs.OD) return;
  const defaults = { OD: 50.8, D: 12.7, L: 152.4, RPM: 200, P: 60 };
  const K = { ratio: 72 / 14, stroke: 380, rev: 0.2, step: 3, finish: 0.3, rough: 3, finishSpeed: 0.75, u: 0.1, setup: 30, release: 20, core: 5 };
  const fmt = (v, d = 1) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const inch = mm => (mm / 25.4).toFixed(2).replace(/0$/, '');
  const mmss = s => { const m = Math.floor(s / 60), r = Math.round(s % 60); return `${m} min ${String(r).padStart(2, '0')} s`; };

  function model(OD, D, L, RPM, P) {
    const R = OD / 2;
    const ring = RPM / K.ratio;
    const strokeT = K.stroke / 360 / (ring / 60) + K.rev;
    const strokes = Math.ceil(L / K.step);
    const ringPass = strokes * strokeT;
    const n = Math.max(1, Math.ceil((D - K.finish) / K.rough));
    const dp = (D - K.finish) / n;
    const passes = [];
    for (let i = 0; i < n; i++) {
      const a = R - i * dp, b = a - dp;
      passes.push({ a, b, ringT: ringPass });
    }
    const fa = R - D + K.finish, fb = R - D;
    passes.push({ a: fa, b: fb, ringT: strokes * (K.stroke / 360 / (ring * K.finishSpeed / 60) + K.rev), finish: true });
    let total = 0, vol = 0;
    for (const p of passes) {
      p.vol = Math.PI * (p.a * p.a - p.b * p.b) * L;
      p.powT = p.vol * K.u / P;
      p.t = Math.max(p.ringT, p.powT);
      p.lim = p.powT > p.ringT ? 'spindle power' : 'ring motor';
      total += p.t; vol += p.vol;
    }
    return { R, passes, vol, total: total + K.setup + K.release };
  }

  const g = $('endG');
  const ns = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs) => { const e = document.createElementNS(ns, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

  function draw(m, D) {
    g.replaceChildren();
    const s = 50 / 25.5;               // 51 mm cable fills the frame
    const R = m.R * s, Rin = (m.R - D) * s;
    g.append(el('circle', { r: R, fill: 'url(#hatch)', stroke: 'currentColor', 'stroke-width': .6 }));
    g.append(el('circle', { r: Rin, fill: 'var(--paper)', stroke: 'currentColor', 'stroke-width': .8 }));
    g.append(el('circle', { r: Rin, fill: 'var(--fill-2)', stroke: 'none' }));
    m.passes.slice(0, -1).forEach(p => g.append(el('circle', { r: p.b * s, fill: 'none', stroke: 'currentColor', 'stroke-width': .35, 'stroke-dasharray': '1.4 1.1' })));
    g.append(el('circle', { r: Math.max(m.R - D - 6, 2) * s, fill: 'currentColor', opacity: .85 }));
    // cutter at 12 o'clock on the final surface
    const cy = -Rin - 3.2;
    g.append(el('circle', { cx: 0, cy, r: 3, fill: 'var(--paper)', stroke: 'currentColor', 'stroke-width': .8 }));
    g.append(el('line', { x1: 0, y1: cy - 3, x2: 0, y2: -58, stroke: 'currentColor', 'stroke-width': .8 }));
    // dimension line for the cable diameter
    const y = 57;
    g.append(el('line', { x1: -R, y1: y, x2: R, y2: y, stroke: 'currentColor', 'stroke-width': .35, 'marker-start': '', 'marker-end': '' }));
    [-R, R].forEach(x => g.append(el('line', { x1: x, y1: y - 2.5, x2: x, y2: y + 2.5, stroke: 'currentColor', 'stroke-width': .35 })));
  }

  function update() {
    const v = Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, +i.value]));
    const maxD = Math.min(12.7, v.OD / 2 - K.core);
    inputs.D.max = maxD.toFixed(1);
    if (v.D > maxD) { v.D = maxD; inputs.D.value = maxD; }
    const m = model(v.OD, v.D, v.L, v.RPM, v.P);
    $('oOD').textContent = `${fmt(v.OD)} mm (${inch(v.OD)} in)`;
    $('oD').textContent = `${fmt(v.D)} mm`;
    $('oL').textContent = `${fmt(v.L, 0)} mm (${(v.L / 25.4).toFixed(1)} in)`;
    $('oRPM').textContent = `${v.RPM} rpm`;
    $('oP').textContent = `${v.P} W`;
    $('rT').textContent = mmss(m.total);
    $('rV').textContent = `${fmt(m.vol / 1000)} cm³`;
    $('rN').textContent = `${m.passes.length - 1} rough + 1 finish`;
    const spindle = m.passes.filter(p => p.lim === 'spindle power').length;
    $('rB').textContent = spindle > m.passes.length / 2 ? 'spindle power' : 'ring motor';
    const tb = document.querySelector('#passTable tbody');
    tb.replaceChildren(...m.passes.map((p, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${p.finish ? 'Finish' : i + 1}</td><td class="num">${fmt(p.a - p.b, 2)} mm</td><td class="num">${fmt(p.vol / 1000)} cm³</td><td class="num">${fmt(p.t, 0)} s</td><td>${p.lim}</td>`;
      return tr;
    }));
    draw(m, v.D);
  }
  Object.values(inputs).forEach(i => i.addEventListener('input', update));
  $('calcReset').addEventListener('click', () => {
    inputs.OD.value = defaults.OD; update();
    for (const k in defaults) inputs[k].value = defaults[k];
    update();
  });
  update();
})();

// Lightbox for dense figures.
(() => {
  const dlg = document.getElementById('lightbox');
  if (!dlg || !dlg.showModal) return;
  const img = document.createElement('img'), cap = dlg.querySelector('.lbcap');
  cap.before(img);
  const open = el => {
    img.src = el.currentSrc || el.src; img.alt = el.alt;
    cap.innerHTML = el.closest('figure')?.querySelector('figcaption')?.innerHTML || '';
    dlg.showModal();
  };
  document.querySelectorAll('img.zoom').forEach(el => {
    el.addEventListener('click', () => open(el));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(el); } });
  });
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
})();
