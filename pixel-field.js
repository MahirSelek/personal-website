(() => {
  const canvas = document.getElementById("pixel-field");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const CELL_W = 8;
  const CELL_H = 13;
  const MOUSE_RADIUS = 160;
  const PULL = 0.38;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

  // Padua silhouette anchors (normalized x,y).
  // Left→right: Specola tower, Palazzo della Ragione, Basilica di Sant'Antonio domes,
  // Prato della Valle ellipse + statues, low canal banks.
  const groundY = 0.78;
  const canalY = 0.86;

  const heavy = ["█", "▓", "▒"];
  const mid = ["▓", "▒", "░"];
  const light = ["░", "·", "∙"];

  const birdsAll = [
    { y: 0.12, speed: 0.032, phase: 0.2, x0: -0.1 },
    { y: 0.2, speed: 0.024, phase: 1.1, x0: -0.42 },
    { y: 0.08, speed: 0.038, phase: 2.0, x0: -0.7 },
  ];
  const birdFrames = [
    ["‿", "⌒", "‿"],
    ["╲", "_", "╱"],
  ];

  const state = { mx: -9999, my: -9999, t: 0, w: 0, h: 0, tipAlpha: 0 };
  let cols = 0;
  let rows = 0;
  let noise = new Float32Array(0);
  let birds = birdsAll;
  let raf = 0;
  let visible = true;

  function cssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function smoothstep(t, edge) {
    const x = clamp01(1 - t / edge);
    return x * x * (3 - 2 * x);
  }

  function rect(x, y, cx, cy, w, h) {
    return Math.abs(x - cx) < w / 2 && y > cy - h && y < cy;
  }

  function dome(x, y, cx, baseY, radius) {
    const dx = (x - cx) / radius;
    const dy = (baseY - y) / radius;
    if (dy < 0 || dy > 1.15) return 0;
    const rim = Math.sqrt(Math.max(0, 1 - dx * dx));
    if (dy <= rim) return 0.75 + (1 - dy) * 0.25;
    return 0;
  }

  function spire(x, y, cx, baseY, height, halfW) {
    if (y > baseY || y < baseY - height) return 0;
    const t = (baseY - y) / height;
    const w = halfW * (1 - t * 0.85);
    return Math.abs(x - cx) < w ? 0.9 - t * 0.2 : 0;
  }

  // Unique Padua density field (not a bridge copy).
  function densityAt(x, y) {
    // Night sky with faint stars.
    if (y < 0.42) {
      const star = Math.abs(Math.sin(x * 97 + y * 53));
      return star > 0.985 ? 0.35 : 0;
    }

    // Canal water under the city.
    if (y > canalY) {
      const wave = Math.abs(Math.sin(x * 28 + state.t * 1.4) * 0.5 + Math.sin(x * 11 + y * 20) * 0.5);
      const depth = (y - canalY) / (1 - canalY);
      return 0.22 + wave * 0.35 * (1 - depth * 0.45);
    }

    // Ground / embankment.
    if (y > groundY) return 0.55;

    let d = 0;

    // Specola (observatory) tower — left landmark.
    if (rect(x, y, 0.14, groundY, 0.055, 0.34)) d = Math.max(d, 0.95);
    if (rect(x, y, 0.14, groundY - 0.34, 0.075, 0.05)) d = Math.max(d, 1);
    d = Math.max(d, spire(x, y, 0.14, groundY - 0.39, 0.1, 0.018));

    // Low academic/residential blocks.
    for (const b of [
      [0.24, 0.12, 0.16],
      [0.33, 0.1, 0.2],
      [0.92, 0.09, 0.14],
    ]) {
      if (rect(x, y, b[0], groundY, b[1], b[2])) {
        const windows = Math.abs(Math.sin((x + y) * 70)) > 0.55 ? 0.15 : 0;
        d = Math.max(d, 0.55 + windows);
      }
    }

    // Palazzo della Ragione — long roof mass in the center-left.
    if (rect(x, y, 0.42, groundY, 0.2, 0.2)) d = Math.max(d, 0.8);
    // Triangular roof crest.
    if (x > 0.32 && x < 0.52 && y < groundY - 0.2) {
      const local = (x - 0.32) / 0.2;
      const roofH = 0.1 * (1 - Math.abs(local - 0.5) * 2);
      if (y > groundY - 0.2 - roofH) d = Math.max(d, 0.92);
    }

    // Basilica di Sant'Antonio — multi-dome composition (Padua signature).
    const basilicaBase = groundY - 0.08;
    d = Math.max(d, dome(x, y, 0.63, basilicaBase, 0.085));
    d = Math.max(d, dome(x, y, 0.7, basilicaBase - 0.02, 0.07));
    d = Math.max(d, dome(x, y, 0.76, basilicaBase, 0.08));
    d = Math.max(d, dome(x, y, 0.69, basilicaBase - 0.12, 0.05)); // central higher dome
    if (rect(x, y, 0.7, groundY, 0.22, 0.16)) d = Math.max(d, 0.7);
    // Twin facade towers.
    if (rect(x, y, 0.6, groundY, 0.028, 0.28)) d = Math.max(d, 0.95);
    if (rect(x, y, 0.8, groundY, 0.028, 0.28)) d = Math.max(d, 0.95);
    d = Math.max(d, spire(x, y, 0.6, groundY - 0.28, 0.08, 0.014));
    d = Math.max(d, spire(x, y, 0.8, groundY - 0.28, 0.08, 0.014));

    // Prato della Valle — elliptical ring of statues (right-center).
    const ex = (x - 0.88) / 0.1;
    const ey = (y - (groundY - 0.07)) / 0.05;
    const ellipse = ex * ex + ey * ey;
    if (ellipse > 0.55 && ellipse < 0.95 && y < groundY) d = Math.max(d, 0.55);
    // Statue dots around the ellipse.
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2;
      const sx = 0.88 + Math.cos(a) * 0.09;
      const sy = groundY - 0.07 + Math.sin(a) * 0.045;
      if (Math.hypot(x - sx, y - sy) < 0.008) d = Math.max(d, 1);
      if (Math.abs(x - sx) < 0.005 && y > sy && y < groundY - 0.01) d = Math.max(d, 0.7);
    }

    // Soft canal reflections of tallest volumes.
    if (y > canalY && y < canalY + 0.08) {
      const mirrorY = canalY - (y - canalY);
      const reflected = densityAt(x, Math.min(groundY - 0.01, mirrorY));
      if (reflected > 0.4) d = Math.max(d, reflected * 0.35);
    }

    return d;
  }

  function birdMap(time, c, r, flock) {
    const map = new Map();
    for (const bird of flock) {
      let x = (bird.x0 + bird.speed * time) % 1.25;
      if (x < 0) x += 1.25;
      if (x > 1.05 || x < -0.05) continue;
      const frame = Math.floor(time * 4 + bird.phase) % 2;
      const glyphs = birdFrames[frame];
      const col = Math.floor(x * (c - 1));
      const row = Math.floor(bird.y * (r - 1));
      for (let i = -1; i <= 1; i += 1) {
        const cc = col + i;
        if (cc < 0 || cc >= c) continue;
        map.set(`${cc},${row}`, glyphs[i + 1]);
      }
    }
    return map;
  }

  function drawFrame() {
    state.t += 0.016;

    const paper = cssVar("--pixel-paper", "#0b0d12");
    const ink = cssVar("--pixel-ink", "#f2f5fb");
    const accent = cssVar("--pixel-accent", "#ffd93d");
    const mono = cssVar("--pixel-mono", "JetBrains Mono, ui-monospace, monospace");

    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, state.w, state.h);
    ctx.font = `13px ${mono}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    const interactive = !coarsePointer && state.mx > -1000;
    const birdsNow = birdMap(state.t, cols, rows, birds);

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const nx = col / Math.max(1, cols - 1);
        const ny = row / Math.max(1, rows - 1);
        const key = `${col},${row}`;
        const birdGlyph = birdsNow.get(key);
        const dens = densityAt(nx, ny);
        if (dens === 0 && !birdGlyph) continue;

        const n = noise[row * cols + col];
        const flicker = state.t * (0.35 + n * 0.45);
        const px = col * CELL_W + CELL_W / 2;
        const py = row * CELL_H + CELL_H / 2;
        const dx = state.mx - px;
        const dy = state.my - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const influence = interactive ? smoothstep(dist, MOUSE_RADIUS) : 0;

        let drawX = px;
        let drawY = py;
        let glyph;
        let color = ink;
        let alpha;

        if (birdGlyph) {
          glyph = birdGlyph;
          color = ink;
          alpha = 0.8;
        } else {
          const pick = Math.floor(n * 13 + flicker * 1.6);
          if (dens > 0.85) glyph = heavy[pick % heavy.length];
          else if (dens > 0.55) glyph = mid[pick % mid.length];
          else if (dens > 0.25) glyph = light[pick % light.length];
          else glyph = "·";
          // Stronger presence than before.
          alpha = Math.min(0.98, 0.35 + dens * 0.7);
        }

        if (influence > 0.04) {
          drawX = px + dx * influence * PULL;
          drawY = py + dy * influence * PULL;
          color = accent;
          alpha = Math.min(1, (birdGlyph ? 0.85 : 0.7) + influence * 0.35);
        }

        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;
        ctx.fillText(glyph, drawX, drawY);
      }
    }

    // Tip near Basilica cluster.
    const tipX = 0.7 * state.w;
    const tipY = (groundY - 0.34) * state.h;
    const near =
      interactive &&
      Math.abs(state.mx - tipX) < 170 &&
      state.my > tipY - 40 &&
      state.my < state.h * 0.92;
    state.tipAlpha += ((near ? 1 : 0) - state.tipAlpha) * 0.18;

    if (state.tipAlpha > 0.02) {
      const right = Math.min(state.w - 10, tipX + 8);
      const titleY = Math.max(34, tipY);
      const subY = titleY + 18;
      const title = "PADOVA";
      const sub = "basilica · specola · prato della valle";

      ctx.textAlign = "right";
      ctx.font = `700 16px ${mono}`;
      const titleW = ctx.measureText(title).width;
      ctx.font = `11px ${mono}`;
      const subW = ctx.measureText(sub).width;
      const pad = 10;
      const boxR = right + pad;
      const boxL = right - Math.max(titleW, subW) - pad;
      const boxT = titleY - 16;
      const boxB = subY + 8;

      ctx.fillStyle = paper;
      ctx.globalAlpha = state.tipAlpha * 0.9;
      ctx.fillRect(boxL, boxT, boxR - boxL, boxB - boxT);
      ctx.fillStyle = accent;
      ctx.globalAlpha = state.tipAlpha;
      ctx.fillRect(boxL, boxT, 3, boxB - boxT);

      ctx.textBaseline = "alphabetic";
      ctx.font = `700 16px ${mono}`;
      ctx.fillStyle = ink;
      ctx.globalAlpha = state.tipAlpha;
      ctx.fillText(title, right, titleY);
      ctx.font = `11px ${mono}`;
      ctx.fillStyle = accent;
      ctx.globalAlpha = state.tipAlpha * 0.95;
      ctx.fillText(sub, right, subY);
      ctx.globalAlpha = 1;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
    } else {
      ctx.globalAlpha = 1;
    }
  }

  function loop() {
    try {
      drawFrame();
    } catch (err) {
      console.error("pixel-field frame error:", err);
    }
    raf = visible && !reducedMotion ? requestAnimationFrame(loop) : 0;
  }

  function resize() {
    const dprCap = window.innerWidth < 768 ? 1.5 : 2;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    const width = Math.max(40, Math.floor(canvas.parentElement.offsetWidth || window.innerWidth));
    const height = Math.max(40, Math.floor(canvas.parentElement.offsetHeight || window.innerHeight));

    birds = width / height < 1.5 ? birdsAll.slice(0, 2) : birdsAll;
    state.w = width;
    state.h = height;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    cols = Math.floor(width / CELL_W) + 1;
    rows = Math.floor(height / CELL_H) + 1;
    noise = new Float32Array(cols * rows);
    for (let i = 0; i < noise.length; i += 1) noise[i] = Math.random();

    try {
      drawFrame();
    } catch {
      // ignore
    }
  }

  function onMove(event) {
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width ? canvas.offsetWidth / rect.width : 1;
    const sy = rect.height ? canvas.offsetHeight / rect.height : 1;
    state.mx = (event.clientX - rect.left) * sx;
    state.my = (event.clientY - rect.top) * sy;
  }

  function onLeave() {
    state.mx = -9999;
    state.my = -9999;
  }

  resize();
  window.addEventListener("resize", resize);

  if (!reducedMotion) {
    raf = requestAnimationFrame(loop);
    if (typeof IntersectionObserver !== "undefined") {
      const io = new IntersectionObserver(
        ([entry]) => {
          const was = visible;
          visible = entry.isIntersecting;
          if (visible && !was && !raf) raf = requestAnimationFrame(loop);
        },
        { threshold: 0 }
      );
      io.observe(canvas);
    }
  }

  canvas.addEventListener("mousemove", onMove);
  canvas.addEventListener("mouseleave", onLeave);
})();
