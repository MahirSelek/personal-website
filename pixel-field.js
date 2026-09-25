(() => {
  const canvas = document.getElementById("pixel-field");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Prato della Valle, Padova — statues + canal + Santa Giustina domes
  const CELL_W = 8;
  const CELL_H = 12;
  const MOUSE_RADIUS = 150;
  const PULL = 0.38;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

  const heavy = ["█", "▓", "▒"];
  const mid = ["▓", "▒", "░"];
  const light = ["░", "·"];

  const state = { mx: -9999, my: -9999, t: 0, w: 0, h: 0, tipAlpha: 0 };
  let cols = 0;
  let rows = 0;
  let noise = new Float32Array(0);
  let raf = 0;
  let visible = true;

  // Pedestal+statue positions along both canal banks (normalized).
  const INNER = [0.18, 0.28, 0.38, 0.48, 0.58, 0.68, 0.78];
  const OUTER = [0.12, 0.22, 0.32, 0.42, 0.52, 0.62, 0.72, 0.84];

  function cssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function smoothstep(dist, edge) {
    const x = clamp01(1 - dist / edge);
    return x * x * (3 - 2 * x);
  }

  function canalY(x) {
    // Elliptical canal — compressed for short wide panel.
    return 0.62 + Math.sin((x - 0.12) * Math.PI * 0.9) * 0.055;
  }

  function statue(x, y, cx, baseY, scale) {
    const pedW = 0.016 * scale;
    const pedH = 0.11 * scale;
    const figH = 0.085 * scale;
    const figW = 0.011 * scale;
    let d = 0;
    // Pedestal block
    if (Math.abs(x - cx) < pedW && y < baseY && y > baseY - pedH) d = 0.95;
    // Cap of pedestal
    if (Math.abs(x - cx) < pedW * 1.25 && y < baseY - pedH && y > baseY - pedH - 0.014 * scale) {
      d = 1;
    }
    // Figure
    if (Math.abs(x - cx) < figW && y < baseY - pedH - 0.01 * scale && y > baseY - pedH - figH) {
      d = 1;
    }
    // Head
    if (Math.hypot(x - cx, y - (baseY - pedH - figH - 0.01 * scale)) < 0.011 * scale) d = 1;
    return d;
  }

  function dome(x, y, cx, baseY, r) {
    const dx = (x - cx) / r;
    const dy = (baseY - y) / r;
    if (dy < 0 || dy > 1.2) return 0;
    const rim = Math.sqrt(Math.max(0, 1 - dx * dx));
    return dy <= rim ? 0.85 + (1 - dy) * 0.15 : 0;
  }

  function sample(x, y) {
    let d = 0;

    // Thin sky for short panel.
    if (y < 0.08) return Math.abs(Math.sin(x * 40 + y * 20)) > 0.99 ? 0.15 : 0;

    // Building facade band (compressed).
    const roof = 0.22;
    const groundBuild = 0.42;
    if (y > roof && y < groundBuild) {
      const win = Math.abs(Math.sin(x * 55)) > 0.55 && Math.abs(Math.sin(y * 70)) > 0.4 ? 0.2 : 0;
      d = Math.max(d, 0.55 + win);
      if (y < roof + 0.025) d = Math.max(d, 0.85);
      // Portico arches near ground
      if (y > groundBuild - 0.06 && Math.abs(Math.sin(x * 40)) > 0.7) d = Math.max(d, 0.35);
    }

    // Santa Giustina domes + campanile (right).
    d = Math.max(d, dome(x, y, 0.76, 0.3, 0.075));
    d = Math.max(d, dome(x, y, 0.85, 0.32, 0.06));
    d = Math.max(d, dome(x, y, 0.8, 0.22, 0.05));
    if (Math.abs(x - 0.9) < 0.012 && y < 0.4 && y > 0.1) d = Math.max(d, 1);
    if (Math.abs(x - 0.9) < 0.022 && y < 0.12 && y > 0.07) d = Math.max(d, 0.9);

    const cy = canalY(x);
    const bankTop = cy - 0.06;
    const bankBot = cy + 0.055;

    // Grass / bank tops.
    if (y > groundBuild && y < bankTop) {
      d = Math.max(d, 0.2 + Math.abs(Math.sin(x * 30)) * 0.1);
    }

    // Canal water + shimmer.
    if (y >= bankTop && y <= bankBot + 0.1) {
      const depth = (y - bankTop) / 0.2;
      const ripple =
        0.5 * Math.abs(Math.sin(x * 28 + state.t * 1.4)) +
        0.5 * Math.abs(Math.sin(x * 9 - state.t * 0.8 + y * 12));
      d = Math.max(d, 0.18 + ripple * 0.32 * (1 - depth * 0.4));
    }

    // Statues along outer bank (closer / larger on left).
    for (let i = 0; i < OUTER.length; i += 1) {
      const sx = OUTER[i];
      const scale = 1.2 - i * 0.07;
      const base = bankTop - 0.005 - i * 0.003;
      d = Math.max(d, statue(x, y, sx, base, Math.max(0.65, scale)));
    }

    // Statues along inner island bank.
    for (let i = 0; i < INNER.length; i += 1) {
      const sx = INNER[i];
      const scale = 0.95 - i * 0.05;
      const base = bankBot + 0.015 + Math.sin(i) * 0.003;
      if (base < 0.94) d = Math.max(d, statue(x, y, sx, base, Math.max(0.6, scale)));
    }

    // Big foreground statue (left) — Prato signature.
    d = Math.max(d, statue(x, y, 0.07, 0.88, 1.75));

    // Soft reflection of nearby pedestals in water.
    if (y > cy && y < cy + 0.09) {
      const mirrorY = cy - (y - cy);
      for (const sx of OUTER.slice(0, 4)) {
        if (Math.abs(x - sx) < 0.012 && mirrorY < bankTop && mirrorY > bankTop - 0.08) {
          d = Math.max(d, 0.35);
        }
      }
    }

    return d;
  }

  function drawFrame() {
    state.t += 0.016;

    const paper = cssVar("--pixel-paper", "#0a0c11");
    const ink = cssVar("--pixel-ink", "#f0f3fa");
    const accent = cssVar("--pixel-accent", "#ff6b6b");
    const warm = cssVar("--pixel-sun", "#ff8a5c");
    const mono = cssVar("--pixel-mono", "JetBrains Mono, ui-monospace, monospace");

    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, state.w, state.h);
    ctx.font = `12px ${mono}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    const interactive = !coarsePointer && state.mx > -1000;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const nx = col / Math.max(1, cols - 1);
        const ny = row / Math.max(1, rows - 1);
        const dens = sample(nx, ny);
        if (dens <= 0.06) continue;

        const n = noise[row * cols + col];
        const flicker = state.t * (0.25 + n * 0.35);
        const px = col * CELL_W + CELL_W / 2;
        const py = row * CELL_H + CELL_H / 2;
        const dx = state.mx - px;
        const dy = state.my - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const influence = interactive ? smoothstep(dist, MOUSE_RADIUS) : 0;

        let drawX = px;
        let drawY = py;
        const pick = Math.floor(n * 11 + flicker * 1.3);
        let glyph;
        if (dens > 0.85) glyph = heavy[pick % heavy.length];
        else if (dens > 0.5) glyph = mid[pick % mid.length];
        else if (dens > 0.22) glyph = light[pick % light.length];
        else glyph = "·";

        // Warm tint on upper buildings / domes.
        const isWarm = dens > 0.7 && ny < 0.5;
        let color = isWarm ? warm : ink;
        let alpha = Math.min(0.98, 0.3 + dens * 0.75);

        if (influence > 0.04) {
          drawX = px + dx * influence * PULL;
          drawY = py + dy * influence * PULL;
          color = accent;
          alpha = Math.min(1, 0.7 + influence * 0.35);
        }

        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;
        ctx.fillText(glyph, drawX, drawY);
      }
    }

    const tipX = 0.78 * state.w;
    const tipY = 0.2 * state.h;
    const near =
      interactive &&
      Math.abs(state.mx - tipX) < 150 &&
      state.my > tipY - 30 &&
      state.my < tipY + 120;
    state.tipAlpha += ((near ? 1 : 0) - state.tipAlpha) * 0.18;

    if (state.tipAlpha > 0.02) {
      const right = Math.min(state.w - 10, tipX + 40);
      const titleY = Math.max(30, tipY);
      const subY = titleY + 17;
      const title = "PADOVA";
      const sub = "prato della valle";

      ctx.textAlign = "right";
      ctx.font = `700 15px ${mono}`;
      const titleW = ctx.measureText(title).width;
      ctx.font = `11px ${mono}`;
      const subW = ctx.measureText(sub).width;
      const pad = 9;
      const boxR = right + pad;
      const boxL = right - Math.max(titleW, subW) - pad;
      const boxT = titleY - 14;
      const boxB = subY + 7;

      ctx.fillStyle = paper;
      ctx.globalAlpha = state.tipAlpha * 0.92;
      ctx.fillRect(boxL, boxT, boxR - boxL, boxB - boxT);
      ctx.fillStyle = accent;
      ctx.globalAlpha = state.tipAlpha;
      ctx.fillRect(boxL, boxT, 3, boxB - boxT);

      ctx.textBaseline = "alphabetic";
      ctx.font = `700 15px ${mono}`;
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
