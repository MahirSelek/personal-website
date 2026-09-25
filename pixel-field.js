(() => {
  const canvas = document.getElementById("pixel-field");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Compact but recognizable equirectangular world landmask.
  // '#' = land. Americas | Europe/Africa | Asia | Australia
  const MAP = [
    "........................................................................",
    "..............#####.....................................................",
    "............#########.......................######......................",
    "...........###########....................##########....................",
    "..........#############..................############...................",
    ".........###############................##############..................",
    "........########.########..............################.................",
    ".......#######....#######.............##################................",
    "......#######......######............#########..#########...............",
    ".....######........#####............########.....########...............",
    ".....#####.........####.............#######.......#######...............",
    ".....####..........####.............######.........######...............",
    ".....####..........#####............######..........#####...............",
    ".....####..........######...........#######..........####...............",
    "......###..........#######..........########............................",
    ".......##..........########.........#########...........................",
    "...................#########........##########..........................",
    "....................#########.......###########.........................",
    ".....................#########......############........................",
    "......................#########.....#############.......................",
    ".......................#########....##############......................",
    "........................#########...###############.....................",
    ".........................#########..################....................",
    "..........................#########..###############....................",
    "...........................########...##############....................",
    "............................#######....#############....................",
    ".............................######.....############....................",
    "..............................#####......###########....................",
    "...............................####.......##########....................",
    "................................###........#########....................",
    ".................................##.........########....................",
    "..................................#..........#######....................",
    "..............................................######....................",
    ".....................###.......................#####....................",
    "....................#####.......................####....................",
    "...................#######.......................###....................",
    "..................#########.......................##....................",
    ".................###########.......................#....................",
    ".................############...........................................",
    ".................#############..........................................",
    "..................############..........................................",
    "...................###########..........................................",
    "....................#########...........................................",
    ".....................#######............................................",
    "......................#####.............................................",
    ".......................###..............................................",
    "........................................................................",
    "........................................................................",
  ];

  const MAP_W = MAP[0].length;
  const MAP_H = MAP.length;

  // Approximate Padua / Ankara markers on map UV (for pulse dots).
  const MARKERS = [
    { x: 0.545, y: 0.34, label: "PD" }, // Padua-ish (N Italy)
    { x: 0.585, y: 0.36, label: "ANK" }, // Ankara-ish
  ];

  const CELL_W = 10;
  const CELL_H = 14;
  const MOUSE_RADIUS = 150;
  const PULL = 0.35;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

  const state = { mx: -9999, my: -9999, t: 0, w: 0, h: 0, tipAlpha: 0 };
  let cols = 0;
  let rows = 0;
  let noise = new Float32Array(0);
  let raf = 0;
  let visible = true;
  // Map placement in canvas UV (keep clear silhouette, avoid edges).
  let mapBox = { x0: 0.08, y0: 0.18, x1: 0.92, y1: 0.88 };

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

  function landAt(u, v) {
    if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
    const c = Math.min(MAP_W - 1, Math.floor(u * MAP_W));
    const r = Math.min(MAP_H - 1, Math.floor(v * MAP_H));
    return MAP[r][c] === "#" ? 1 : 0;
  }

  // Soft edge for slightly less blocky silhouette while staying readable.
  function landSample(u, v) {
    const solid = landAt(u, v);
    if (solid) return 1;
    // Neighbor bleed for coast thickness.
    const stepU = 1 / MAP_W;
    const stepV = 1 / MAP_H;
    let n = 0;
    n += landAt(u - stepU, v);
    n += landAt(u + stepU, v);
    n += landAt(u, v - stepV);
    n += landAt(u, v + stepV);
    if (n >= 2) return 0.55;
    if (n === 1) return 0.28;
    return 0;
  }

  function toMapUV(nx, ny) {
    const { x0, y0, x1, y1 } = mapBox;
    if (nx < x0 || nx > x1 || ny < y0 || ny > y1) return null;
    return {
      u: (nx - x0) / (x1 - x0),
      v: (ny - y0) / (y1 - y0),
    };
  }

  function drawFrame() {
    state.t += 0.016;

    const paper = cssVar("--pixel-paper", "#0a0c11");
    const ink = cssVar("--pixel-ink", "#f2f5fb");
    const accent = cssVar("--pixel-accent", "#ff6b6b");
    const mono = cssVar("--pixel-mono", "JetBrains Mono, ui-monospace, monospace");

    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, state.w, state.h);

    // Soft lat/long grid so it reads as a map, not noise.
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1;
    for (let g = 1; g < 6; g += 1) {
      const gx = mapBox.x0 + ((mapBox.x1 - mapBox.x0) * g) / 6;
      const gy = mapBox.y0 + ((mapBox.y1 - mapBox.y0) * g) / 6;
      ctx.beginPath();
      ctx.moveTo(gx * state.w, mapBox.y0 * state.h);
      ctx.lineTo(gx * state.w, mapBox.y1 * state.h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mapBox.x0 * state.w, gy * state.h);
      ctx.lineTo(mapBox.x1 * state.w, gy * state.h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.font = `13px ${mono}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    const interactive = !coarsePointer && state.mx > -1000;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const nx = col / Math.max(1, cols - 1);
        const ny = row / Math.max(1, rows - 1);
        const mapped = toMapUV(nx, ny);

        let dens = 0;
        if (mapped) dens = landSample(mapped.u, mapped.v);

        // Sparse ocean dots for depth (very light).
        if (!dens && mapped) {
          const n = noise[row * cols + col];
          if (n > 0.965) dens = 0.12;
        }

        if (dens <= 0.05) continue;

        const n = noise[row * cols + col];
        const px = col * CELL_W + CELL_W / 2;
        const py = row * CELL_H + CELL_H / 2;
        const dx = state.mx - px;
        const dy = state.my - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const influence = interactive ? smoothstep(dist, MOUSE_RADIUS) : 0;

        let drawX = px;
        let drawY = py;
        let glyph = dens > 0.7 ? "█" : dens > 0.4 ? "▓" : dens > 0.2 ? "▒" : "·";
        let color = ink;
        let alpha = dens > 0.7 ? 0.95 : dens > 0.4 ? 0.8 : dens > 0.2 ? 0.55 : 0.25;

        // Subtle shimmer on land edges.
        if (dens > 0.5) {
          alpha = Math.min(1, alpha + Math.sin(state.t * 2 + n * 8) * 0.04);
        }

        if (influence > 0.04) {
          drawX = px + dx * influence * PULL;
          drawY = py + dy * influence * PULL;
          color = accent;
          alpha = Math.min(1, 0.7 + influence * 0.35);
          if (dens > 0.5) glyph = "█";
        }

        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;
        ctx.fillText(glyph, drawX, drawY);
      }
    }

    // Pulse markers for Padua & Ankara.
    for (const m of MARKERS) {
      const mx = mapBox.x0 + m.x * (mapBox.x1 - mapBox.x0);
      const my = mapBox.y0 + m.y * (mapBox.y1 - mapBox.y0);
      const cx = mx * state.w;
      const cy = my * state.h;
      const pulse = 0.55 + Math.sin(state.t * 3 + m.x * 10) * 0.35;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = accent;
      ctx.font = `700 11px ${mono}`;
      ctx.fillText("●", cx, cy);
      ctx.globalAlpha = pulse * 0.9;
      ctx.font = `600 10px ${mono}`;
      ctx.textAlign = "left";
      ctx.fillText(m.label, cx + 8, cy);
      ctx.textAlign = "center";
    }

    // Tip when hovering Europe area.
    const tipX = (mapBox.x0 + 0.56 * (mapBox.x1 - mapBox.x0)) * state.w;
    const tipY = (mapBox.y0 + 0.32 * (mapBox.y1 - mapBox.y0)) * state.h;
    const near =
      interactive &&
      Math.abs(state.mx - tipX) < 180 &&
      Math.abs(state.my - tipY) < 120;
    state.tipAlpha += ((near ? 1 : 0) - state.tipAlpha) * 0.18;

    if (state.tipAlpha > 0.02) {
      const right = Math.min(state.w - 12, tipX + 70);
      const titleY = Math.max(34, tipY - 8);
      const subY = titleY + 18;
      const title = "WORLD";
      const sub = "ankara → padova · research path";

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

    // On narrow heroes, give map more vertical room.
    if (width / height < 1.7) {
      mapBox = { x0: 0.04, y0: 0.12, x1: 0.96, y1: 0.92 };
    } else {
      mapBox = { x0: 0.08, y0: 0.16, x1: 0.94, y1: 0.9 };
    }

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
