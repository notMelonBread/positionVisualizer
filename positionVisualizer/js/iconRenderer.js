// Simple placeholder for potential separate icon rendering logic
// Currently handled inside meterRenderer. Expose a tiny API for compatibility.
(function () {
  function getMockMode() {
    const el = document.getElementById('mock-mode');
    return !!(el && el.checked);
  }

  function getIpForIndex(index) {
    const input = document.getElementById(`device${index + 1}-ip`);
    return (input && input.value && input.value.trim()) || '';
  }

  function applyVisibility() {
    const svg = document.querySelector('#meter-container svg[data-meter]');
    if (!svg) return;
    const isMock = getMockMode();
    for (let i = 0; i < 4; i++) {
      const g = svg.querySelector(`g[data-perf="${i}"]`);
      if (!g) continue;
      if (isMock) {
        g.style.display = '';
      } else {
        const hasIp = !!getIpForIndex(i);
        g.style.display = hasIp ? '' : 'none';
      }
    }
  }

  function setupListeners() {
    const mock = document.getElementById('mock-mode');
    if (mock) mock.addEventListener('change', applyVisibility);
    ['device1-ip','device2-ip','device3-ip','device4-ip'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', applyVisibility);
      el.addEventListener('change', applyVisibility);
    });

    // Re-apply when meter SVG updates (animations preserved)
    const container = document.getElementById('meter-container');
    if (container && window.MutationObserver) {
      const mo = new MutationObserver(() => applyVisibility());
      mo.observe(container, { childList: true, subtree: true, attributes: false });
    }
  }

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setupListeners();
        // slight delay to allow first SVG render
        setTimeout(applyVisibility, 0);
      });
    } else {
      setupListeners();
      setTimeout(applyVisibility, 0);
    }
  }

  function placeIcons() {}

  init();
  window.IconRenderer = { placeIcons, applyVisibility };
})();


