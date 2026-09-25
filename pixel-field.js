(() => {
  const canvas = document.getElementById("pixel-field");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const CELL_W = 9;
  const CELL_H = 14;
  const MOUSE_RADIUS = 150;
  const PULL = 0.42;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

  // Wide landscape proportions (desktop).
  const landscape = {
    ground: 0.74,
    waterLine: 0.78,
    towerTop: 0.30,
    t0: 0.34,
    t1: 0.78,
    deckTop: 0.628,
    deckBottom: 0.648,
    hangerStep: 0.022,
    cableHi: 0.33,
    cableLow: 0.61,
    sideRise: 0.34,
    towerHalfW: 0.008,
    cableHalfThick: 0.005,
    densityFloor: 0,
  };

  // Taller / mobile proportions.
  const portrait = {
    ground: 0.76,
    waterLine: 0.80,
    towerTop: 0.22,
    t0: 0.26,
    t1: 0.74,
    deckTop: 0.66,
    deckBottom: 0.68,
    hangerStep: 0.026,
    cableHi: 0.24,
    cableLow: 0.60,
    sideRise: 0.32,
    towerHalfW: 0.012,
    cableHalfThick: 0.008,
    densityFloor: 0.55,
  };

  const birdsAll = [
    { y: 0.10, speed: 0.040, phase: 0.0, x0: -0.08 },
    { y: 0.18, speed: 0.028, phase: 0.7, x0: -0.35 },
    { y: 0.06, speed: 0.034, phase: 1.4, x0: -0.60 },
    { y: 0.22, speed: 0.046, phase: 2.1, x0: -0.85 },
  ];
  const birdFrames = [
    ["‿", "⌒", "‿"],
    ["╲", "_", "╱"],
  ];

  const heavy = ["█", "▓", "▒"];
  const mid = ["▒", "░", "·"];
  const light = ["·", "∙"];

  const state = {
    mx: -9999,
    my: -9999,
    t: 0,
    w: 0,
    h: 0,
    tipAlpha: 0,
  };

  let cols = 0;
  let rows = 0;
  let noise = new Float32Array(0);
  let profile = landscape;
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

  function densityAt(x, y, p) {
    if (y > p.waterLine) {
      const wave =
        Math.abs(Math.sin(x * 22) * 0.5 + Math.sin(x * 8.3 + y * 16) * 0.5);
      const depth = (y - p.waterLine) / (1 - p.waterLine);
      return 0.12 + wave * 0.2 * (1 - depth * 0.5);
    }
    if (y > p.ground) return 0.35;

    const {
      t0,
      t1,
      towerTop,
      deckTop,
      deckBottom,
      cableHi,
      cableLow,
      hangerStep,
      sideRise,
      towerHalfW,
      cableHalfThick,
      densityFloor,
    } = p;

    const span = p.ground - towerTop;
    const crossA = towerTop + span * 0.37;
    const crossB = towerTop + span * 0.62;
    const floor = (v) => (v > 0 && v < densityFloor ? densityFloor : v);

    // Towers.
    if (
      ((Math.abs(x - t0) < towerHalfW || Math.abs(x - t1) < towerHalfW) &&
        y > towerTop &&
        y < p.ground) ||
      ((Math.abs(x - t0) < 0.02 || Math.abs(x - t1) < 0.02) &&
        (Math.abs(y - crossA) < cableHalfThick || Math.abs(y - crossB) < cableHalfThick))
    ) {
      return 1;
    }

    // Deck.
    if (x > 0.04 && x < 0.98 && y > deckTop && y < deckBottom) {
      const along = (x - 0.04) / 0.94;
      return floor(0.32 + along * 0.58);
    }

    // Main cables + hangers between towers.
    if (x >= t0 && x <= t1) {
      const a = (x - t0) / (t1 - t0);
      const cableY = cableHi + (cableLow - cableHi) * (1 - 4 * (a - 0.5) ** 2);
      if (Math.abs(y - cableY) < cableHalfThick) return 1;
      const step = ((x - t0) % hangerStep + hangerStep) % hangerStep;
      if (a > 0.03 && a < 0.97 && step < 0.0024 && y > cableY && y < deckTop) {
        return floor(0.6);
      }
    }

    // Approach cables.
    if (x < t0 && x > 0.04) {
      const a = (t0 - x) / (t0 - 0.04);
      const cableY = cableHi + sideRise * a - 0.02 * (1 - a);
      if (Math.abs(y - cableY) < Math.max(0.004, cableHalfThick * 0.8) && y < deckTop) {
        return floor(0.65);
      }
    }
    if (x > t1 && x < t1 + 0.06) {
      const a = (x - t1) / 0.06;
      const cableY = cableHi + (cableLow - cableHi) * 0.9 * a;
      if (Math.abs(y - cableY) < cableHalfThick && y < deckTop) return floor(0.75);
    }

    // Soft city blocks on both shores.
    if (y > p.ground - 0.16 && y < p.ground) {
      const left = x < 0.22;
      const right = x > 0.86;
      if (left || right) {
        const local = left ? x / 0.22 : (x - 0.86) / 0.14;
        const h = 0.05 + Math.abs(Math.sin(local * 17 + (left ? 1 : 3))) * 0.1;
        if (y > p.ground - h) return floor(0.45 + Math.abs(Math.sin(local * 9)) * 0.25);
      }
    }

    return 0;
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

    const paper = cssVar("--pixel-paper", "#0d0f14");
    const ink = cssVar("--pixel-ink", "#e8ecf4");
    const accent = cssVar("--pixel-accent", "#ff6b6b");
    const mono = cssVar("--pixel-mono", "JetBrains Mono, ui-monospace, monospace");

    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, state.w, state.h);
    ctx.font = `12px ${mono}`;
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
        const dens = densityAt(nx, ny, profile);
        if (dens === 0 && !birdGlyph) continue;

        const n = noise[row * cols + col];
        const flicker = state.t * (0.4 + n * 0.5);
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
          alpha = 0.55;
        } else {
          const pick = Math.floor(n * 13 + flicker * 1.6);
          if (dens > 0.85) glyph = heavy[pick % heavy.length];
          else if (dens > 0.55) glyph = mid[pick % mid.length];
          else if (dens > 0.25) glyph = light[pick % light.length];
          else glyph = "·";
          alpha = Math.min(0.82, dens * 0.82);
        }

        if (influence > 0.04) {
          drawX = px + dx * influence * PULL;
          drawY = py + dy * influence * PULL;
          color = accent;
          alpha = (birdGlyph ? 0.7 : 0.55) + influence * 0.4;
        }

        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;
        ctx.fillText(glyph, drawX, drawY);
      }
    }

    // Tip near the right tower.
    const tipX = profile.t1 * state.w;
    const tipY = profile.towerTop * state.h;
    const nearTower =
      interactive &&
      Math.abs(state.mx - tipX) < 160 &&
      state.my > tipY - 30 &&
      state.my < state.h;
    state.tipAlpha += ((nearTower ? 1 : 0) - state.tipAlpha) * 0.18;

    if (state.tipAlpha > 0.02) {
      const right = Math.min(state.w - 8, tipX + 6);
      const titleY = Math.max(36, tipY - 22);
      const subY = titleY + 18;
      ctx.textAlign = "right";
      ctx.font = `600 15px ${mono}`;
      const title = "PADUA ↔ ANKARA";
      const titleW = ctx.measureText(title).width;
      ctx.font = `11px ${mono}`;
      const sub = "research · systems · agentic eval";
      const subW = ctx.measureText(sub).width;
      const pad = 10;
      const boxR = right + pad;
      const boxL = right - Math.max(titleW, subW) - pad;
      const boxT = titleY - 16;
      const boxB = subY + 6;

      ctx.fillStyle = paper;
      ctx.globalAlpha = state.tipAlpha * 0.88;
      ctx.fillRect(boxL, boxT, boxR - boxL, boxB - boxT);
      ctx.fillStyle = accent;
      ctx.globalAlpha = state.tipAlpha;
      ctx.fillRect(boxL, boxT, 2, boxB - boxT);

      ctx.textBaseline = "alphabetic";
      ctx.font = `600 15px ${mono}`;
      ctx.fillStyle = ink;
      ctx.globalAlpha = state.tipAlpha;
      ctx.fillText(title, right, titleY);
      ctx.font = `11px ${mono}`;
      ctx.fillStyle = accent;
      ctx.globalAlpha = state.tipAlpha * 0.92;
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
    const ratio = width / height;

    profile = ratio < 1.8 ? portrait : landscape;
    birds = ratio < 1.8 ? birdsAll.slice(0, 2) : birdsAll;

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
      // ignore first-paint race
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
