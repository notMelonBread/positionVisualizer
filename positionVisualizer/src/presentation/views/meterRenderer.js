// Gradient meter + ticks + icons rendering (stateless)
// Public API:
//   initMeter(containerEl)
//   renderMeter(containerEl, values: number[], options?: { names, icons, valueRange, actualValues })

const baseCx = 251.74;
const baseCy = 168.17;
const baseRadius = Math.sqrt((503.48 / 2) ** 2 + (168.17 * 0.52) ** 2);
const strokeWidth = 100;
const startAngle = -140;
const endAngle = -40;
const MAX_LANE_OFFSET = 30;
const MIN_LANE_OFFSET = -30;
const ICON_Y_OFFSET = -12; // adjust upward to compensate for title spacing

const toRadians = (angle) => (angle * Math.PI) / 180;

function calculateLaneOffsets(deviceCount) {
  if (deviceCount <= 0) return [];
  if (deviceCount === 1) return [0];
  const offsets = [];
  for (let i = 0; i < deviceCount; i++) {
    const t = deviceCount === 1 ? 0.5 : i / (deviceCount - 1);
    const offset = MIN_LANE_OFFSET + (MAX_LANE_OFFSET - MIN_LANE_OFFSET) * t;
    offsets.push(offset);
  }
  return offsets;
}

function calculateViewBox() {
  const outerRadius = baseRadius + strokeWidth / 2;
  const innerRadius = baseRadius - strokeWidth / 2;
  const angles = [startAngle, endAngle];
  for (let angle = Math.ceil(startAngle); angle <= Math.floor(endAngle); angle++) {
    if (angle % 90 === 0) angles.push(angle);
  }
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  angles.forEach((angle) => {
    const rad = toRadians(angle);
    const xOuter = baseCx + outerRadius * Math.cos(rad);
    const yOuter = baseCy + outerRadius * Math.sin(rad);
    const xInner = baseCx + innerRadius * Math.cos(rad);
    const yInner = baseCy + innerRadius * Math.sin(rad);
    minX = Math.min(minX, xOuter, xInner);
    maxX = Math.max(maxX, xOuter, xInner);
    minY = Math.min(minY, yOuter, yInner);
    maxY = Math.max(maxY, yOuter, yInner);
  });

  const maxIconOffset = Math.max(Math.abs(MAX_LANE_OFFSET), Math.abs(MIN_LANE_OFFSET));
  const iconRadius = 25;
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const angle = startAngle + (endAngle - startAngle) * t;
    const angleRad = toRadians(angle);
    const radius = baseRadius + maxIconOffset;
    const x = baseCx + radius * Math.cos(angleRad);
    const y = baseCy + radius * Math.sin(angleRad);
    minX = Math.min(minX, x - iconRadius);
    maxX = Math.max(maxX, x + iconRadius);
    minY = Math.min(minY, y - iconRadius);
    maxY = Math.max(maxY, y + iconRadius);
  }

  const padding = 30;
  return {
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
    offsetX: -minX + padding,
    offsetY: -minY + padding
  };
}

const viewBox = calculateViewBox();
const cx = baseCx + viewBox.offsetX;
const cy = baseCy + viewBox.offsetY;

function describeArc() {
  const startRad = toRadians(startAngle);
  const endRad = toRadians(endAngle);
  const innerRadius = baseRadius - strokeWidth / 2;
  const outerRadius = baseRadius + strokeWidth / 2;
  const x1 = cx + innerRadius * Math.cos(startRad);
  const y1 = cy + innerRadius * Math.sin(startRad);
  const x2 = cx + outerRadius * Math.cos(startRad);
  const y2 = cy + outerRadius * Math.sin(startRad);
  const x3 = cx + outerRadius * Math.cos(endRad);
  const y3 = cy + outerRadius * Math.sin(endRad);
  const x4 = cx + innerRadius * Math.cos(endRad);
  const y4 = cy + innerRadius * Math.sin(endRad);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${x1} ${y1} L ${x2} ${y2} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x3} ${y3} L ${x4} ${y4} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x1} ${y1}`;
}

function calculateIconPosition(percentage, laneIndex, deviceCount) {
  const clamped = Math.max(0, Math.min(100, percentage));
  const t = clamped / 100;
  const angle = startAngle + (endAngle - startAngle) * t;
  const angleRad = toRadians(angle);
  const laneOffsets = calculateLaneOffsets(deviceCount > 0 ? deviceCount : 1);
  const safeLaneIndex = Math.max(0, Math.min(laneOffsets.length - 1, laneIndex));
  const offset = laneOffsets[safeLaneIndex] || 0;
  const radius = baseRadius + offset;
  const x = cx + radius * Math.cos(angleRad);
  const y = cy + radius * Math.sin(angleRad) + ICON_Y_OFFSET;
  return { x, y };
}

// keep meter clean: remove tick labels if present
function clearTickLabels(svg) {
  if (!svg) return;
  const existing = svg.querySelector('g.tick-labels-group');
  if (existing) existing.remove();
}

function ensureSvg(containerEl) {
  if (!containerEl) return null;
  let svg = containerEl.querySelector('svg[data-meter]');
  if (svg) return svg;

  svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('data-meter', '');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('viewBox', `0 0 ${viewBox.width} ${viewBox.height}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.style.display = 'block';
  svg.style.verticalAlign = 'middle';

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
  gradient.setAttribute('id', 'meterGradient');
  gradient.setAttribute('x1', '0');
  gradient.setAttribute('y1', String(viewBox.height / 2));
  gradient.setAttribute('x2', String(viewBox.width));
  gradient.setAttribute('y2', String(viewBox.height / 2));
  gradient.setAttribute('gradientUnits', 'userSpaceOnUse');
  const s1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop'); s1.setAttribute('offset', '0'); s1.setAttribute('stop-color', '#71cce2');
  const s2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop'); s2.setAttribute('offset', '1'); s2.setAttribute('stop-color', '#6e40a9');
  gradient.append(s1, s2);

  const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
  filter.setAttribute('id', 'iconShadow');
  const fe = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow');
  fe.setAttribute('dx', '0'); fe.setAttribute('dy', '2'); fe.setAttribute('stdDeviation', '3'); fe.setAttribute('flood-opacity', '0.3');
  filter.appendChild(fe);
  const mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
  mask.setAttribute('id', 'maskIconCircle');
  mask.setAttribute('maskContentUnits', 'objectBoundingBox');
  mask.setAttribute('maskUnits', 'objectBoundingBox');
  const maskCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  maskCircle.setAttribute('cx', '0.5');
  maskCircle.setAttribute('cy', '0.5');
  maskCircle.setAttribute('r', '0.5');
  maskCircle.setAttribute('fill', '#fff');
  mask.appendChild(maskCircle);
  defs.append(gradient, filter, mask);

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('data-arc', '');
  path.setAttribute('d', describeArc());
  path.setAttribute('fill', 'url(#meterGradient)');

  svg.append(defs, path);

  const tickCount = 11;
  const totalAngle = endAngle - startAngle;
  for (let i = 1; i < tickCount; i++) {
    const angle = startAngle + (totalAngle / tickCount) * i;
    const angleRad = toRadians(angle);
    const innerR = baseRadius - strokeWidth / 2;
    const outerR = baseRadius - strokeWidth / 2 + 10;
    const x1 = cx + innerR * Math.cos(angleRad);
    const y1 = cy + innerR * Math.sin(angleRad);
    const x2 = cx + outerR * Math.cos(angleRad);
    const y2 = cy + outerR * Math.sin(angleRad);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(x1)); line.setAttribute('y1', String(y1));
    line.setAttribute('x2', String(x2)); line.setAttribute('y2', String(y2));
    line.setAttribute('stroke', '#fff'); line.setAttribute('stroke-width', '3');
    svg.appendChild(line);
  }

  containerEl.innerHTML = '';
  containerEl.appendChild(svg);
  return svg;
}

export function initMeter(containerEl) {
  ensureSvg(containerEl);
}

export function renderMeter(containerEl, values, options = {}) {
  if (!containerEl) return;
  const icon = options.icon ?? null;
  const icons = options.icons || null;
  const connectedDeviceIndices = options.connectedDeviceIndices || null;
  const actualValues = options.actualValues || null;
  const valueRange = options.valueRange || { min: 0, max: 100, unit: '%' };

  let deviceCount = 0;
  if (connectedDeviceIndices !== null && Array.isArray(connectedDeviceIndices)) {
    deviceCount = connectedDeviceIndices.length;
  } else {
    deviceCount = values.filter((v) => v !== null && v !== undefined && !Number.isNaN(v)).length;
  }
  if (deviceCount === 0) {
    const svg = containerEl.querySelector('svg[data-meter]');
    if (svg) {
      svg.querySelectorAll('g[data-perf]').forEach((g) => g.remove());
    }
    return;
  }

  const denormalizeValue = (percentage) => {
    const range = valueRange.max - valueRange.min;
    if (range === 0) return valueRange.min;
    return valueRange.min + (percentage / 100) * range;
  };

  const svg = ensureSvg(containerEl);
  if (!svg) return;
  const existing = new Map();
  svg.querySelectorAll('g[data-perf]').forEach((g) => {
    existing.set(g.getAttribute('data-perf'), g);
  });

  values.slice(0, 6).forEach((val, index) => {
    if (val === null || val === undefined) {
      const existingG = svg.querySelector(`g[data-perf="${index}"]`);
      if (existingG) existingG.remove();
      existing.delete(String(index));
      return;
    }
    if (connectedDeviceIndices !== null && !connectedDeviceIndices.includes(index)) {
      const existingG = svg.querySelector(`g[data-perf="${index}"]`);
      if (existingG) existingG.remove();
      existing.delete(String(index));
      return;
    }

    let laneIndex = 0;
    if (connectedDeviceIndices !== null && Array.isArray(connectedDeviceIndices)) {
      const positionInConnected = connectedDeviceIndices.indexOf(index);
      laneIndex = positionInConnected >= 0 ? positionInConnected : 0;
    } else {
      laneIndex = index % deviceCount;
    }

    const numericVal = Number(val);
    const safeVal = Number.isFinite(numericVal) ? numericVal : 0;
    const pos = calculateIconPosition(safeVal, laneIndex, deviceCount);

    let g = svg.querySelector(`g[data-perf="${index}"]`);
    if (!g) {
      g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('data-perf', String(index));
      g.style.transition = 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
      g.style.willChange = 'transform';

      const bgImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
      const bgHref = icons && icons[index] ? icons[index] : '';
      if (bgHref) {
        bgImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', bgHref);
        bgImage.setAttribute('href', bgHref);
      }
      bgImage.setAttribute('x', String(-25));
      bgImage.setAttribute('y', String(-25));
      bgImage.setAttribute('width', '50');
      bgImage.setAttribute('height', '50');
      bgImage.setAttribute('mask', 'url(#maskIconCircle)');

      let fgImage = null;
      if (icon) {
        fgImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        fgImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', icon);
        fgImage.setAttribute('href', icon);
        fgImage.setAttribute('x', String(-25));
        fgImage.setAttribute('y', String(-25));
        fgImage.setAttribute('width', '50');
        fgImage.setAttribute('height', '50');
        fgImage.setAttribute('filter', 'url(#iconShadow)');
      }

      const displayValue = actualValues && actualValues[index] !== undefined
        ? actualValues[index]
        : denormalizeValue(safeVal);
      const roundedDisplay = Math.round(displayValue);
      g.setAttribute('data-percentage', String(Math.max(0, Math.min(100, safeVal))));
      g.setAttribute('data-actual', String(roundedDisplay));
      g.setAttribute('data-unit', valueRange.unit || '%');

      if (fgImage) {
        g.append(bgImage, fgImage);
      } else {
        g.append(bgImage);
      }
      g.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
      svg.appendChild(g);
    } else {
      const displayValue = actualValues && actualValues[index] !== undefined
        ? actualValues[index]
        : denormalizeValue(safeVal);
      const roundedDisplay = Math.round(displayValue);
      const clampedPercent = Math.max(0, Math.min(100, safeVal));
      g.setAttribute('data-percentage', String(clampedPercent));
      g.setAttribute('data-actual', String(roundedDisplay));
      g.setAttribute('data-unit', valueRange.unit || '%');
      // Remove any legacy text labels (names are no longer shown on icons)
      g.querySelectorAll('text').forEach((node) => node.remove());
      const imgs = g.querySelectorAll('image');
      const bg = imgs[0];
      const fg = imgs.length >= 2 ? imgs[1] : null;
      if (bg) {
        const desiredBg = icons && icons[index] ? icons[index] : '';
        if (desiredBg) {
          if (bg.getAttribute('href') !== desiredBg) {
            bg.setAttributeNS('http://www.w3.org/1999/xlink', 'href', desiredBg);
            bg.setAttribute('href', desiredBg);
          }
        } else {
          bg.removeAttribute('href');
          bg.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
        }
      }
      if (icon) {
        if (fg) {
          if (fg.getAttribute('href') !== icon) {
            fg.setAttributeNS('http://www.w3.org/1999/xlink', 'href', icon);
            fg.setAttribute('href', icon);
          }
        } else {
          const newFg = document.createElementNS('http://www.w3.org/2000/svg', 'image');
          newFg.setAttributeNS('http://www.w3.org/1999/xlink', 'href', icon);
          newFg.setAttribute('href', icon);
          newFg.setAttribute('x', String(-25));
          newFg.setAttribute('y', String(-25));
          newFg.setAttribute('width', '50');
          newFg.setAttribute('height', '50');
          newFg.setAttribute('filter', 'url(#iconShadow)');
          g.appendChild(newFg);
        }
      } else if (fg) {
        fg.remove();
      }
      g.style.transition = 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
      g.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
    }
    existing.delete(String(index));
  });

  existing.forEach((g) => g.remove());
  clearTickLabels(svg);
}

