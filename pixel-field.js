(() => {
  const canvas = document.getElementById("pixel-field");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const CELL_W = 10;
  const CELL_H = 15;
  const MOUSE_RADIUS = 140;
  const PULL = 0.36;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

  // Simple readable skyline — low blocks + one tower, clear birds above.
  const birdsAll = [
    { y: 0.08, speed: 0.038, phase: 0.0, x0: -0.05 },
    { y: 0.14, speed: 0.030, phase: 0.6, x0: -0.28 },
    { y: 0.05, speed: 0.044, phase: 1.2, x0: -0.52 },
    { y: 0.2, speed: 0.026, phase: 1.9, x0: -0.72 },
    { y: 0.11, speed: 0.048, phase: 2.5, x0: -0.95 },
    { y: 0.17, speed: 0.033, phase: 3.1, x0: -1.15 },
  ];
  const birdFrames = [
    ["‿", "⌒", "‿"],
    ["╲", "_", "╱"],
  ];

  const heavy = ["█", "▓", "▒"];
  const mid = ["▓", "▒", "░"];
  const light = ["░", "·", "∙"];

  const state = { mx: -9999, my: -9999, t: 0, w: 0, h: 0 };
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

  function smoothstep(dist, edge) {
    const x = clamp01(1 - dist / edge);
    return x * x * (3 - 2 * x);
  }

  // Clear, sparse density field — horizon + a few buildings.
  function densityAt(x, y) {
    const ground = 0.78;
    const water = 0.84;

    if (y > water) {
      const wave = Math.abs(Math.sin(x * 18 + state.t * 0.6)) * 0.15;
      return 0.08 + wave * (1 - (y - water) / 0.16);
    }
    if (y > ground) return 0.28;

    // Soft sky grit (very light).
    if (y < 0.55) {
      const grit = Math.abs(Math.sin(x * 70 + y * 40));
      return grit > 0.985 ? 0.12 : 0;
    }

    // Building silhouettes — short, readable blocks.
    const blocks = [
      { x0: 0.06, x1: 0.14, h: 0.18 },
      { x0: 0.15, x1: 0.22, h: 0.26 },
      { x0: 0.23, x1: 0.3, h: 0.16 },
      { x0: 0.68, x1: 0.76, h: 0.2 },
      { x0: 0.77, x1: 0.84, h: 0.3 },
      { x0: 0.85, x1: 0.93, h: 0.22 },
    ];

    for (const b of blocks) {
      if (x >= b.x0 && x <= b.x1 && y > ground - b.h && y < ground) {
        const win =
          Math.abs(Math.sin(x * 90)) > 0.55 && Math.abs(Math.sin(y * 55)) > 0.45 ? 0.15 : 0;
        return 0.7 + win;
      }
    }

    // Thin tower / Specola hint in the middle-right.
    if (Math.abs(x - 0.58) < 0.012 && y > ground - 0.42 && y < ground) return 0.95;
    if (Math.abs(x - 0.58) < 0.028 && y > ground - 0.44 && y < ground - 0.4) return 0.85;

    // Low dome hint (right).
    {
      const cx = 0.88;
      const base = ground - 0.22;
      const r = 0.05;
      const dx = (x - cx) / r;
      const dy = (base - y) / r;
      if (dy >= 0 && dy <= 1.1) {
        const rim = Math.sqrt(Math.max(0, 1 - dx * dx));
        if (dy <= rim) return 0.75;
      }
    }

    // Soft ground texture under skyline.
    if (y > ground - 0.05 && y < ground) {
      return 0.18 + Math.abs(Math.sin(x * 25)) * 0.1;
    }

    return 0;
  }

  function birdMap(time, c, r, flock) {
    const map = new Map();
    for (const bird of flock) {
      let x = (bird.x0 + bird.speed * time) % 1.35;
      if (x < 0) x += 1.35;
      if (x > 1.08 || x < -0.04) continue;
      const bob = Math.sin(time * 1.4 + bird.phase) * 0.012;
      const frame = Math.floor(time * 5 + bird.phase) % 2;
      const glyphs = birdFrames[frame];
      const col = Math.floor(x * (c - 1));
      const row = Math.floor((bird.y + bob) * (r - 1));
      for (let i = -1; i <= 1; i += 1) {
        const cc = col + i;
        if (cc < 0 || cc >= c || row < 0 || row >= r) continue;
        map.set(`${cc},${row}`, glyphs[i + 1]);
      }
    }
    return map;
  }

  function drawFrame() {
    state.t += reducedMotion ? 0.004 : 0.016;

    const paper = cssVar("--pixel-paper", "#0b0d12");
    const ink = cssVar("--pixel-ink", "#d7dde8");
    const accent = cssVar("--pixel-accent", "#ff6b6b");
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
        const dens = densityAt(nx, ny);
        const key = `${col},${row}`;
        const birdGlyph = birdsNow.get(key);
        if (dens <= 0.05 && !birdGlyph) continue;

        const n = noise[row * cols + col] || 0.5;
        const flicker = state.t * (0.2 + n * 0.3);
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
        let alpha = 0.55;

        if (birdGlyph) {
          glyph = birdGlyph;
          color = accent;
          alpha = 0.92;
        } else {
          const pick = Math.floor(n * 11 + flicker);
          if (dens > 0.8) glyph = heavy[pick % heavy.length];
          else if (dens > 0.4) glyph = mid[pick % mid.length];
          else glyph = light[pick % light.length];
          alpha = Math.min(0.9, 0.25 + dens * 0.7);
        }

        if (influence > 0.04) {
          drawX = px + dx * influence * PULL;
          drawY = py + dy * influence * PULL;
          if (!birdGlyph) color = accent;
          alpha = Math.min(1, alpha + influence * 0.35);
        }

        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;
        ctx.fillText(glyph, drawX, drawY);
      }
    }

    ctx.globalAlpha = 1;
  }

  function resize() {
    const parent = canvas.parentElement;
    const rect = parent.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.w = Math.max(1, Math.floor(rect.width));
    state.h = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(state.w * dpr);
    canvas.height = Math.floor(state.h * dpr);
    canvas.style.width = `${state.w}px`;
    canvas.style.height = `${state.h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    cols = Math.max(8, Math.floor(state.w / CELL_W));
    rows = Math.max(6, Math.floor(state.h / CELL_H));
    noise = new Float32Array(cols * rows);
    for (let i = 0; i < noise.length; i += 1) noise[i] = Math.random();

    birds = state.w < 520 ? birdsAll.slice(0, 3) : birdsAll;
  }

  function loop() {
    if (!visible) {
      raf = 0;
      return;
    }
    drawFrame();
    raf = requestAnimationFrame(loop);
  }

  function onMove(e) {
    const rect = canvas.getBoundingClientRect();
    state.mx = e.clientX - rect.left;
    state.my = e.clientY - rect.top;
  }

  function onLeave() {
    state.mx = -9999;
    state.my = -9999;
  }

  const hero = canvas.closest(".hero") || canvas.parentElement;
  hero.addEventListener("pointermove", onMove);
  hero.addEventListener("pointerleave", onLeave);

  window.addEventListener("resize", () => {
    resize();
  });

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting);
        if (visible && !raf && !reducedMotion) raf = requestAnimationFrame(loop);
        if (visible && reducedMotion) drawFrame();
      },
      { threshold: 0.05 }
    );
    io.observe(hero);
  }

  resize();
  if (reducedMotion) {
    drawFrame();
  } else {
    raf = requestAnimationFrame(loop);
  }
})();
