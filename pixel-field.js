(() => {
  const canvas = document.getElementById("pixel-field");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Monet — Impression, soleil levant (simplified readable glyph field)
  const CELL_W = 9;
  const CELL_H = 14;
  const MOUSE_RADIUS = 170;
  const PULL = 0.4;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

  const heavy = ["█", "▓", "▒"];
  const mid = ["▓", "▒", "░"];
  const light = ["░", "·", "∙"];

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

  // Density map of Monet sunrise: sun + mist + boat + water ripples.
  function sample(x, y) {
    const horizon = 0.46;
    const waterTop = 0.5;

    // Soft mist / empty sky (sparse dots only).
    if (y < 0.18) {
      return Math.abs(Math.sin(x * 41 + y * 17)) > 0.992 ? 0.25 : 0;
    }

    // Rising sun disk (left-center, classic Impression Sunrise placement).
    const sunX = 0.34;
    const sunY = 0.34;
    const sunR = 0.085;
    const sunDist = Math.hypot((x - sunX) / sunR, (y - sunY) / (sunR * 0.92));
    if (sunDist < 1) {
      return 1.15 - sunDist * 0.35; // mark as "sun" with dens > 1 for color
    }
    // Soft corona.
    if (sunDist < 1.55) {
      return Math.max(0, 0.45 * (1.55 - sunDist));
    }

    // Distant misty harbor silhouettes (right horizon band).
    if (y > 0.28 && y < horizon) {
      const band = (y - 0.28) / (horizon - 0.28);
      const cranes =
        Math.abs(Math.sin(x * 18 + 0.4)) > 0.72 && x > 0.55 && x < 0.95
          ? 0.35 + band * 0.4
          : 0;
      const lowMist = x > 0.48 && band > 0.55 ? 0.18 + Math.abs(Math.sin(x * 9)) * 0.12 : 0;
      return Math.max(cranes, lowMist);
    }

    // Horizon line.
    if (Math.abs(y - horizon) < 0.008 && x > 0.05 && x < 0.98) return 0.55;

    // Water body + sun reflection column.
    if (y > waterTop) {
      const depth = (y - waterTop) / (1 - waterTop);
      const ripple =
        Math.abs(Math.sin(x * 26 + state.t * 1.3 + y * 10)) * 0.5 +
        Math.abs(Math.sin(x * 9 - state.t * 0.8)) * 0.5;
      let water = 0.18 + ripple * 0.28 * (1 - depth * 0.35);

      // Vertical shimmer of the sun on water (Monet signature).
      const reflectX = Math.abs(x - sunX);
      const reflectCore = reflectX < 0.035 + depth * 0.02;
      const reflectSoft = reflectX < 0.09 + depth * 0.03;
      if (reflectCore) water = Math.max(water, 1.05 - depth * 0.25);
      else if (reflectSoft) water = Math.max(water, 0.55 - depth * 0.15);

      // Small rowboat + rower silhouette (lower-left of center).
      const boatX = 0.46;
      const boatY = 0.68;
      const bx = x - boatX;
      const by = y - boatY;

      // Hull (crescent / flat boat shape).
      if (bx > -0.07 && bx < 0.08 && by > -0.01 && by < 0.025) {
        const hull = 1 - Math.abs(bx + 0.01) / 0.08;
        if (hull > 0.15) water = Math.max(water, 0.95);
      }
      // Rower body.
      if (Math.abs(bx + 0.01) < 0.012 && by > -0.055 && by < 0) water = Math.max(water, 1);
      // Oar.
      if (bx > -0.09 && bx < 0.05 && Math.abs(by + 0.02 - bx * 0.35) < 0.008) {
        water = Math.max(water, 0.85);
      }
      // Tiny wake.
      if (bx > 0.06 && bx < 0.14 && Math.abs(by - 0.01) < 0.012 + (bx - 0.06) * 0.1) {
        water = Math.max(water, 0.4);
      }

      return water;
    }

    // Between sun band and water: soft fog.
    if (y >= horizon && y <= waterTop) {
      return 0.12 + Math.abs(Math.sin(x * 7 + y * 20)) * 0.08;
    }

    return 0;
  }

  function drawFrame() {
    state.t += 0.016;

    const paper = cssVar("--pixel-paper", "#0a0c11");
    const ink = cssVar("--pixel-ink", "#eef2fa");
    const accent = cssVar("--pixel-accent", "#ff6b6b");
    const sunColor = cssVar("--pixel-sun", "#ff7a4d");
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
        if (dens <= 0.04) continue;

        const n = noise[row * cols + col];
        const flicker = state.t * (0.3 + n * 0.4);
        const px = col * CELL_W + CELL_W / 2;
        const py = row * CELL_H + CELL_H / 2;
        const dx = state.mx - px;
        const dy = state.my - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const influence = interactive ? smoothstep(dist, MOUSE_RADIUS) : 0;

        let drawX = px;
        let drawY = py;
        const pick = Math.floor(n * 13 + flicker * 1.5);
        let glyph;
        if (dens > 0.9) glyph = heavy[pick % heavy.length];
        else if (dens > 0.55) glyph = mid[pick % mid.length];
        else if (dens > 0.28) glyph = light[pick % light.length];
        else glyph = "·";

        const isSun = dens > 1;
        let color = isSun ? sunColor : ink;
        let alpha = isSun ? 0.98 : Math.min(0.95, 0.28 + dens * 0.75);

        if (influence > 0.04) {
          drawX = px + dx * influence * PULL;
          drawY = py + dy * influence * PULL;
          color = accent;
          alpha = Math.min(1, 0.65 + influence * 0.4);
        }

        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;
        ctx.fillText(glyph, drawX, drawY);
      }
    }

    // Tip near the boat.
    const tipX = 0.46 * state.w;
    const tipY = 0.62 * state.h;
    const near =
      interactive &&
      Math.abs(state.mx - tipX) < 150 &&
      state.my > tipY - 30 &&
      state.my < state.h * 0.9;
    state.tipAlpha += ((near ? 1 : 0) - state.tipAlpha) * 0.18;

    if (state.tipAlpha > 0.02) {
      const right = Math.min(state.w - 12, tipX + 90);
      const titleY = Math.max(36, tipY - 10);
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
