// Bento Grid Generator — lógica principal (sandbox de Figma)
// Genera una grilla de `cols` × `rows` celdas y fusiona celdas vecinas al azar
// hasta quedar con exactamente `blocks` rectángulos. Cada rectángulo se crea
// como un frame con auto layout dentro de un frame padre con Grid auto layout.

// ---------------------------------------------------------------------------
// 1. RNG con semilla (mulberry32) para poder reproducir un resultado.
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// 2. Algoritmo de fusión: parte de cols*rows bloques de 1×1 y fusiona pares de
//    bloques adyacentes que formen un rectángulo, hasta llegar a `target`.
// ---------------------------------------------------------------------------
function canMerge(a, b, maxColSpan, maxRowSpan) {
  // Lado a lado, misma fila y misma altura
  if (a.r === b.r && a.h === b.h && (a.c + a.w === b.c || b.c + b.w === a.c)) {
    return !maxColSpan || a.w + b.w <= maxColSpan;
  }
  // Apilados, misma columna y mismo ancho
  if (a.c === b.c && a.w === b.w && (a.r + a.h === b.r || b.r + b.h === a.r)) {
    return !maxRowSpan || a.h + b.h <= maxRowSpan;
  }
  return false;
}

function mergeBlocks(a, b) {
  return {
    c: Math.min(a.c, b.c),
    r: Math.min(a.r, b.r),
    w: a.r === b.r ? a.w + b.w : a.w,
    h: a.c === b.c ? a.h + b.h : a.h,
  };
}

function attemptLayout(cols, rows, target, rng, opts) {
  let blocks = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) blocks.push({ c, r, w: 1, h: 1 });
  }

  while (blocks.length > target) {
    const candidates = [];
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        if (canMerge(blocks[i], blocks[j], opts.maxColSpan, opts.maxRowSpan)) {
          // Peso: favorece fusionar bloques pequeños para que el tamaño quede variado
          const area = blocks[i].w * blocks[i].h + blocks[j].w * blocks[j].h;
          candidates.push({ i, j, weight: 1 / Math.pow(area, opts.variety) });
        }
      }
    }
    if (candidates.length === 0) break;

    const total = candidates.reduce((s, x) => s + x.weight, 0);
    let pick = rng() * total;
    let chosen = candidates[candidates.length - 1];
    for (const cand of candidates) {
      pick -= cand.weight;
      if (pick <= 0) { chosen = cand; break; }
    }
    const merged = mergeBlocks(blocks[chosen.i], blocks[chosen.j]);
    blocks = blocks.filter((_, idx) => idx !== chosen.i && idx !== chosen.j);
    blocks.push(merged);
  }
  return blocks;
}

function generateLayout(params) {
  const cols = Math.max(1, Math.floor(params.cols));
  const rows = Math.max(1, Math.floor(params.rows));
  const target = Math.min(cols * rows, Math.max(1, Math.floor(params.blocks)));
  const rng = mulberry32(params.seed);
  const opts = {
    maxColSpan: params.maxColSpan || 0,
    maxRowSpan: params.maxRowSpan || 0,
    variety: typeof params.variety === 'number' ? params.variety : 1,
  };

  let best = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const blocks = attemptLayout(cols, rows, target, rng, opts);
    if (!best || Math.abs(blocks.length - target) < Math.abs(best.length - target)) best = blocks;
    if (blocks.length === target) break;
  }
  // Orden de lectura: arriba→abajo, izquierda→derecha
  best.sort((a, b) => (a.r - b.r) || (a.c - b.c));
  return { cols, rows, target, blocks: best, exact: best.length === target };
}

// ---------------------------------------------------------------------------
// 3. Utilidades de color
// ---------------------------------------------------------------------------
function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return { r: 0.73, g: 0.76, b: 0.43 };
  const v = parseInt(m[1], 16);
  return { r: ((v >> 16) & 255) / 255, g: ((v >> 8) & 255) / 255, b: (v & 255) / 255 };
}

function shade(color, amount) {
  const clamp = (x) => Math.max(0, Math.min(1, x));
  return { r: clamp(color.r + amount), g: clamp(color.g + amount), b: clamp(color.b + amount) };
}

// ---------------------------------------------------------------------------
// 4. Construcción en Figma
// ---------------------------------------------------------------------------
async function buildInFigma(layout, p) {
  const { cols, rows, blocks } = layout;
  const gap = p.gap;
  const pad = p.padding;
  const totalW = p.frameWidth;
  const totalH = p.frameHeight;
  const cellW = (totalW - pad * 2 - gap * (cols - 1)) / cols;
  const cellH = (totalH - pad * 2 - gap * (rows - 1)) / rows;

  const fill = hexToRgb(p.fillColor);
  const bg = hexToRgb(p.bgColor);
  const rng = mulberry32(p.seed ^ 0x9e3779b9);

  if (p.labels) await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });

  const frame = figma.createFrame();
  frame.name = `Bento ${cols}×${rows} · ${blocks.length} bloques · seed ${p.seedLabel}`;
  frame.fills = [{ type: 'SOLID', color: bg }];
  frame.cornerRadius = p.radius * 2;
  frame.clipsContent = true;

  let usedNativeGrid = false;
  if (p.nativeGrid) {
    try {
      frame.layoutMode = 'GRID';
      frame.gridColumnCount = cols;
      frame.gridRowCount = rows;
      frame.gridColumnGap = gap;
      frame.gridRowGap = gap;
      frame.paddingTop = frame.paddingBottom = frame.paddingLeft = frame.paddingRight = pad;
      frame.resize(totalW, totalH);
      frame.layoutSizingHorizontal = 'FIXED';
      frame.layoutSizingVertical = 'FIXED';
      for (const t of frame.gridColumnSizes) t.type = 'FLEX';
      for (const t of frame.gridRowSizes) t.type = 'FLEX';
      usedNativeGrid = true;
    } catch (e) {
      // Versión de Figma sin Grid auto layout: caemos a posicionamiento absoluto.
      frame.layoutMode = 'NONE';
      frame.resize(totalW, totalH);
    }
  } else {
    frame.resize(totalW, totalH);
  }

  // Guías visuales (layout grid) para ver las columnas/filas como en el ejemplo
  if (p.guides) {
    frame.layoutGrids = [
      { pattern: 'COLUMNS', alignment: 'STRETCH', gutterSize: gap, offset: pad, count: cols, visible: true, color: { r: 0.85, g: 0.9, b: 0.45, a: 0.25 } },
      { pattern: 'ROWS', alignment: 'STRETCH', gutterSize: gap, offset: pad, count: rows, visible: true, color: { r: 0.85, g: 0.9, b: 0.45, a: 0.25 } },
    ];
  }

  const created = [];
  blocks.forEach((b, i) => {
    const card = figma.createFrame();
    card.name = `Bloque ${i + 1} · ${b.w}×${b.h}`;
    card.layoutMode = 'VERTICAL';
    card.primaryAxisSizingMode = 'FIXED';
    card.counterAxisSizingMode = 'FIXED';
    card.primaryAxisAlignItems = 'MIN';
    card.counterAxisAlignItems = 'MIN';
    card.itemSpacing = 8;
    card.paddingTop = card.paddingBottom = card.paddingLeft = card.paddingRight = p.cardPadding;
    card.cornerRadius = p.radius;
    card.clipsContent = true;
    const tint = p.varyTones ? shade(fill, (rng() - 0.5) * 0.16) : fill;
    card.fills = [{ type: 'SOLID', color: tint }];

    const w = b.w * cellW + (b.w - 1) * gap;
    const h = b.h * cellH + (b.h - 1) * gap;
    card.resize(Math.max(1, w), Math.max(1, h));

    if (usedNativeGrid) {
      frame.appendChildAt(card, b.r, b.c);
      card.gridRowSpan = b.h;
      card.gridColumnSpan = b.w;
      try {
        card.layoutSizingHorizontal = 'FILL';
        card.layoutSizingVertical = 'FILL';
      } catch (e) { /* queda con tamaño fijo calculado */ }
    } else {
      frame.appendChild(card);
      card.x = pad + b.c * (cellW + gap);
      card.y = pad + b.r * (cellH + gap);
    }

    if (p.labels) {
      const t = figma.createText();
      t.fontName = { family: 'Inter', style: 'Medium' };
      t.characters = `${i + 1}  ·  ${b.w}×${b.h}`;
      t.fontSize = 12;
      t.fills = [{ type: 'SOLID', color: shade(tint, -0.45) }];
      card.appendChild(t);
    }
    created.push(card.id);
  });

  // Colocamos el frame en el centro del viewport, sin pisar (0,0)
  const center = figma.viewport.center;
  frame.x = Math.round(center.x - totalW / 2);
  frame.y = Math.round(center.y - totalH / 2);

  frame.setPluginData('bento', JSON.stringify({ cols, rows, blocks, seed: p.seedLabel }));
  figma.currentPage.selection = [frame];
  figma.viewport.scrollAndZoomIntoView([frame]);

  return { frameId: frame.id, created, usedNativeGrid };
}

// ---------------------------------------------------------------------------
// 5. Entrada / salida con la UI
// ---------------------------------------------------------------------------
function normalize(raw) {
  const seedLabel = (raw.seed && String(raw.seed).trim()) || String(Math.floor(Math.random() * 1e9));
  return {
    cols: Number(raw.cols) || 4,
    rows: Number(raw.rows) || 4,
    blocks: Number(raw.blocks) || 6,
    maxColSpan: Number(raw.maxColSpan) || 0,
    maxRowSpan: Number(raw.maxRowSpan) || 0,
    variety: Number(raw.variety),
    frameWidth: Number(raw.frameWidth) || 1200,
    frameHeight: Number(raw.frameHeight) || 1200,
    gap: Number(raw.gap) || 0,
    padding: Number(raw.padding) || 0,
    cardPadding: Number(raw.cardPadding) || 0,
    radius: Number(raw.radius) || 0,
    fillColor: raw.fillColor || '#B9C26E',
    bgColor: raw.bgColor || '#0A0A0A',
    nativeGrid: raw.nativeGrid !== false,
    guides: !!raw.guides,
    labels: !!raw.labels,
    varyTones: !!raw.varyTones,
    seedLabel,
    seed: hashSeed(seedLabel),
  };
}

if (typeof figma !== 'undefined') {
  figma.showUI(__html__, { width: 340, height: 720, themeColors: true });

  figma.clientStorage.getAsync('bento-params').then((saved) => {
    figma.ui.postMessage({ type: 'restore', params: saved || null });
  });

  figma.ui.onmessage = async (msg) => {
    if (msg.type === 'preview' || msg.type === 'generate') {
      const p = normalize(msg.params);
      const layout = generateLayout(p);
      figma.ui.postMessage({ type: 'layout', layout, seed: p.seedLabel });
      if (msg.type === 'generate') {
        try {
          const result = await buildInFigma(layout, p);
          await figma.clientStorage.setAsync('bento-params', Object.assign({}, msg.params, { seed: '' }));
          const note = layout.exact
            ? `Bento ${layout.cols}×${layout.rows} con ${layout.blocks.length} bloques`
            : `No se pudo llegar a ${layout.target} bloques exactos; se generaron ${layout.blocks.length}`;
          figma.notify(note + (result.usedNativeGrid ? ' (Grid auto layout)' : ' (posición absoluta)'));
        } catch (e) {
          figma.notify('Error al generar: ' + (e && e.message ? e.message : e), { error: true });
        }
      }
    } else if (msg.type === 'close') {
      figma.closePlugin();
    }
  };
}

if (typeof module !== 'undefined') {
  module.exports = { generateLayout, hashSeed, mulberry32 };
}
