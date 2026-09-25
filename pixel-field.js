(() => {
  const canvas = document.getElementById("pixel-field");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Monet Impression, soleil levant — bold, readable glyph scene + mouse pull.
  const CELL_W = 9;
  const CELL_H = 13;
  const MOUSE_RADIUS = 170;
  const PULL = 0.42;
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

  /**
   * dens:
   *  0     empty
   *  0–1   ink (mist / water / boat)
   *  >1    sun (warm color)
   */
  function sample(x, y) {
    // BIG sun — left-center, impossible to miss.
    const sunX = 0.30;
    const sunY = 0.30;
    const sunR = 0.14;
    const sd = Math.hypot((x - sunX) / sunR, (y - sunY) / (sunR * 0.95));
    if (sd < 1) return 1.2 - sd * 0.2;
    if (sd < 1.35) return 0.55 * (1.35 - sd);

    const horizon = 0.48;
    const water = 0.52;

    // Quiet upper mist (almost empty — no noise soup).
    if (y < 0.16) return 0;

    // Distant fog bank (right), soft but sparse.
    if (y > 0.22 && y < horizon && x > 0.58) {
      const band = (y - 0.22) / (horizon - 0.22);
      const silhouette = Math.abs(Math.sin(x * 14 + 1.2));
      if (silhouette > 0.78 && band > 0.35) return 0.28 + band * 0.25;
      return band > 0.7 ? 0.1 : 0;
    }

    // Horizon stroke.
    if (Math.abs(y - horizon) < 0.01 && x > 0.08 && x < 0.95) return 0.45;

    // Water + bold sun reflection pillar.
    if (y >= water) {
      const depth = (y - water) / (1 - water);
      const ripple =
        0.5 * Math.abs(Math.sin(x * 22 + state.t * 1.2 + y * 8)) +
        0.5 * Math.abs(Math.sin(x * 7 - state.t * 0.7));
      let d = 0.16 + ripple * 0.22 * (1 - depth * 0.4);

      const rx = Math.abs(x - sunX);
      if (rx < 0.045 + depth * 0.02) d = Math.max(d, 1.15 - depth * 0.2);
      else if (rx < 0.1 + depth * 0.03) d = Math.max(d, 0.6 - depth * 0.12);

      // BIG boat + rower (center-ish).
      const boatX = 0.52;
      const boatY = 0.70;
      const bx = x - boatX;
      const by = y - boatY;

      // Hull
      if (bx > -0.11 && bx < 0.12 && by > -0.015 && by < 0.035) {
        const hull = 1 - Math.abs(bx) / 0.12;
        if (hull > 0.12) d = Math.max(d, 1);
      }
      // Cabin / rower torso
      if (Math.abs(bx + 0.01) < 0.02 && by > -0.08 && by < 0) d = Math.max(d, 1);
      // Head
      if (Math.hypot(bx + 0.01, by + 0.09) < 0.016) d = Math.max(d, 1);
      // Oar
      if (bx > -0.14 && bx < 0.08 && Math.abs(by + 0.025 - bx * 0.28) < 0.01) {
        d = Math.max(d, 0.9);
      }
      // Wake
      if (bx > 0.1 && bx < 0.2 && Math.abs(by - 0.012) < 0.015 + (bx - 0.1) * 0.08) {
        d = Math.max(d, 0.35);
      }

      return d;
    }

    // Fog strip between horizon and water.
    if (y > horizon && y < water) {
      return 0.08 + Math.abs(Math.sin(x * 5)) * 0.06;
    }

    return 0;
  }

  function drawFrame() {
    state.t += 0.016;

    const paper = cssVar("--pixel-paper", "#0a0c11");
    const ink = cssVar("--pixel-ink", "#eef2fa");
    const accent = cssVar("--pixel-accent", "#ff6b6b");
    const sun = cssVar("--pixel-sun", "#ff6b4a");
    const mono = cssVar("--pixel-mono", "JetBrains Mono, ui-monospace, monospace");

    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, state.w, state.h);
    ctx.font = `13px ${mono}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    const interactive = !coarsePointer && state.mx > -1000;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const nx = col / Math.max(1, cols - 1);
        const ny = row / Math.max(1, rows - 1);
        const dens = sample(nx, ny);
        if (dens <= 0.05) continue;

        const n = noise[row * cols + col];
        const flicker = state.t * (0.28 + n * 0.35);
        const px = col * CELL_W + CELL_W / 2;
        const py = row * CELL_H + CELL_H / 2;
        const dx = state.mx - px;
        const dy = state.my - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const influence = interactive ? smoothstep(dist, MOUSE_RADIUS) : 0;

        let drawX = px;
        let drawY = py;
        const pick = Math.floor(n * 11 + flicker * 1.4);
        let glyph;
        if (dens > 0.85) glyph = heavy[pick % heavy.length];
        else if (dens > 0.5) glyph = mid[pick % mid.length];
        else if (dens > 0.22) glyph = light[pick % light.length];
        else glyph = "·";

        const isSun = dens > 1;
        let color = isSun ? sun : ink;
        let alpha = isSun ? 1 : Math.min(0.96, 0.32 + dens * 0.72);

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

    // Tip near boat.
    const tipX = 0.52 * state.w;
    const tipY = 0.62 * state.h;
    const near =
      interactive &&
      Math.abs(state.mx - tipX) < 160 &&
      state.my > tipY - 40 &&
      state.my < state.h * 0.92;
    state.tipAlpha += ((near ? 1 : 0) - state.tipAlpha) * 0.18;

    if (state.tipAlpha > 0.02) {
      const right = Math.min(state.w - 12, tipX + 100);
      const titleY = Math.max(36, tipY);
      const subY = titleY + 18;
      const title = "MONET";
      const sub = "impression, soleil levant";

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
      ctx.globalAlpha = state.tipAlpha * 0.92;
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
