export function renderIconValues(containerEl, actualValues = [], unit = '%') {
  if (!containerEl) return;
  const svg = containerEl.querySelector('svg[data-meter]');
  if (!svg) return;

  const u = unit || '%';
  // simple per-index smoothing to avoid jerky jumps on overlay
  const prev = renderIconValues._lastValues || Array(6).fill(null);
  const next = [];
  const lerp = (a, b, t) => a + (b - a) * t;
  const t = 0.2; // smoothing factor (closer to 0 = smoother/slower)
  for (let i = 0; i < 6; i++) {
    const g = svg.querySelector(`g[data-perf="${i}"]`);
    if (!g) continue;
    const value = actualValues[i];
    if (value === null || value === undefined || Number.isNaN(value)) {
      const existing = g.querySelector('text.icon-value');
      if (existing) existing.remove();
      next[i] = null;
      continue;
    }
    const last = prev[i] ?? value;
    const smoothed = lerp(last, value, t);
    next[i] = smoothed;
    let textEl = g.querySelector('text.icon-value');
    if (!textEl) {
      textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      textEl.setAttribute('class', 'icon-value');
      textEl.setAttribute('x', '0');
      textEl.setAttribute('y', '20'); // adjust closer to icon
      textEl.setAttribute('text-anchor', 'middle');
      textEl.setAttribute('font-size', '16');
      textEl.setAttribute('font-weight', '700');
      textEl.setAttribute('font-family', 'fot-udkakugoc80-pro, sans-serif');
      textEl.setAttribute('fill', '#ffffff');
      textEl.setAttribute('paint-order', 'stroke');
      textEl.setAttribute('stroke', 'rgba(0,0,0,0.6)');
      textEl.setAttribute('stroke-width', '3');
      g.appendChild(textEl);
    }
    textEl.textContent = `${Math.round(smoothed)}${u}`;
  }
  renderIconValues._lastValues = next;
}

