// Simple placeholder for potential separate icon rendering logic
// Currently handled inside meterRenderer. Expose a tiny API for compatibility.
(function () {
  function getIpForIndex(index) {
    const input = document.getElementById(`device${index + 1}-ip`);
    return (input && input.value && input.value.trim()) || '';
  }

  // Get min/max/unit from DOM
  function getRangeSettings() {
    const minEl = document.getElementById('min-value');
    const maxEl = document.getElementById('max-value');
    const unitEl = document.getElementById('value-unit');
    const minValue = minEl ? Number(minEl.value) : 0;
    const maxValue = maxEl ? Number(maxEl.value) : 100;
    const unit = unitEl ? (unitEl.value || '%') : '%';
    return { minValue, maxValue, unit };
  }

  // Convert normalized percentage (0-100) to actual value based on min/max settings
  function denormalizeValue(percentage, minValue, maxValue) {
    const range = maxValue - minValue;
    if (range === 0) return minValue;
    return minValue + (percentage / 100) * range;
  }

  // Update value display for an icon
  function updateIconValue(g, index) {
    try {
      if (!g) return;
      
      // Get percentage from data attribute (0-100)
      const percentageAttr = g.getAttribute('data-percentage');
      if (!percentageAttr) return; // No percentage data yet
      
      const percentage = parseFloat(percentageAttr);
      if (isNaN(percentage)) return;
      
      // Get range settings
      const { minValue, maxValue, unit } = getRangeSettings();
      
      // Convert to actual value
      const actualValue = denormalizeValue(percentage, minValue, maxValue);
      const roundedValue = Math.round(actualValue);
      
      // Find or create text element
      let textEl = g.querySelector('text.icon-value');
      if (!textEl) {
        // Check if g is in an SVG context
        if (!g.ownerSVGElement && !g.closest('svg')) return;
        
        textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('class', 'icon-value');
        textEl.setAttribute('x', '0');
        textEl.setAttribute('y', '15');
        textEl.setAttribute('text-anchor', 'middle');
        textEl.setAttribute('font-size', '14');
        textEl.setAttribute('font-weight', '700');
        textEl.setAttribute('font-family', 'fot-udkakugoc80-pro, sans-serif');
        textEl.setAttribute('fill', '#ffffff');
        textEl.setAttribute('paint-order', 'stroke');
        textEl.setAttribute('stroke', 'rgba(0,0,0,0.6)');
        textEl.setAttribute('stroke-width', '3');
        g.appendChild(textEl);
      }
      
      // Update text content
      textEl.textContent = `${roundedValue}${unit}`;
      textEl.setAttribute('data-actual', String(roundedValue));
      textEl.setAttribute('data-unit', unit);
    } catch (error) {
      console.error('Error updating icon value:', error);
    }
  }

  // Cache range settings to avoid repeated DOM queries
  let cachedRangeSettings = null;
  let rangeSettingsCacheTime = 0;
  const RANGE_SETTINGS_CACHE_MS = 100; // Cache for 100ms

  function getCachedRangeSettings() {
    const now = Date.now();
    if (!cachedRangeSettings || (now - rangeSettingsCacheTime) > RANGE_SETTINGS_CACHE_MS) {
      cachedRangeSettings = getRangeSettings();
      rangeSettingsCacheTime = now;
    }
    return cachedRangeSettings;
  }

  // Update all icon values
  function updateAllIconValues() {
    try {
      const svg = document.querySelector('#meter-container svg[data-meter]');
      if (!svg) return;
      
      // Get range settings once for all icons
      const { minValue, maxValue, unit } = getCachedRangeSettings();
      
      for (let i = 0; i < 6; i++) {
        const g = svg.querySelector(`g[data-perf="${i}"]`);
        if (g && g.style.display !== 'none') {
          updateIconValueFast(g, i, minValue, maxValue, unit);
        }
      }
    } catch (error) {
      console.error('Error updating all icon values:', error);
    }
  }

  // Fast version that accepts pre-fetched range settings
  function updateIconValueFast(g, index, minValue, maxValue, unit) {
    try {
      if (!g) return;
      
      const percentageAttr = g.getAttribute('data-percentage');
      if (!percentageAttr) return;
      
      const percentage = parseFloat(percentageAttr);
      if (isNaN(percentage)) return;
      
      const actualValue = denormalizeValue(percentage, minValue, maxValue);
      const roundedValue = Math.round(actualValue);
      
      let textEl = g.querySelector('text.icon-value');
      if (!textEl) {
        if (!g.ownerSVGElement && !g.closest('svg')) return;
        
        textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('class', 'icon-value');
        textEl.setAttribute('x', '0');
        textEl.setAttribute('y', '15');
        textEl.setAttribute('text-anchor', 'middle');
        textEl.setAttribute('font-size', '14');
        textEl.setAttribute('font-weight', '700');
        textEl.setAttribute('font-family', 'fot-udkakugoc80-pro, sans-serif');
        textEl.setAttribute('fill', '#ffffff');
        textEl.setAttribute('paint-order', 'stroke');
        textEl.setAttribute('stroke', 'rgba(0,0,0,0.6)');
        textEl.setAttribute('stroke-width', '3');
        g.appendChild(textEl);
      }
      
      const newText = `${roundedValue}${unit}`;
      if (textEl.textContent !== newText) {
        textEl.textContent = newText;
        textEl.setAttribute('data-actual', String(roundedValue));
        textEl.setAttribute('data-unit', unit);
      }
    } catch (error) {
      console.error('Error updating icon value:', error);
    }
  }

  function applyVisibility() {
    try {
      const svg = document.querySelector('#meter-container svg[data-meter]');
      if (!svg) return;
      for (let i = 0; i < 4; i++) {
        const g = svg.querySelector(`g[data-perf="${i}"]`);
        if (!g) continue;
        const hasIp = !!getIpForIndex(i);
        g.style.display = hasIp ? '' : 'none';
      }
      // Update values immediately using requestAnimationFrame for smooth updates
      requestAnimationFrame(() => updateAllIconValues());
    } catch (error) {
      console.error('Error applying visibility:', error);
    }
  }

  function setupListeners() {
    ['device1-ip','device2-ip','device3-ip','device4-ip'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', applyVisibility);
      el.addEventListener('change', applyVisibility);
    });

    // Listen to range settings changes
    ['min-value', 'max-value', 'value-unit'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', updateAllIconValues);
        el.addEventListener('change', updateAllIconValues);
      }
    });

    // Re-apply when meter SVG updates (animations preserved)
    const container = document.getElementById('meter-container');
    if (container && window.MutationObserver) {
      // Track last known values to detect changes
      const lastValues = new Map();
      
      const mo = new MutationObserver((mutations) => {
        try {
          const { minValue, maxValue, unit } = getCachedRangeSettings();
          let hasChildListChange = false;
          
          mutations.forEach(mutation => {
            if (mutation.type === 'attributes' && 
                (mutation.attributeName === 'data-percentage' || 
                 mutation.attributeName === 'data-actual')) {
              // Update the specific icon that changed immediately (synchronously)
              const target = mutation.target;
              if (target && target.tagName === 'g' && target.hasAttribute('data-perf')) {
                const index = parseInt(target.getAttribute('data-perf') || '0', 10);
                if (!isNaN(index)) {
                  const percentageAttr = target.getAttribute('data-percentage');
                  if (percentageAttr) {
                    const percentage = parseFloat(percentageAttr);
                    const lastValue = lastValues.get(index);
                    // Only update if value actually changed
                    if (lastValue !== percentage) {
                      lastValues.set(index, percentage);
                      updateIconValueFast(target, index, minValue, maxValue, unit);
                    }
                  }
                }
              }
            } else if (mutation.type === 'childList') {
              hasChildListChange = true;
            }
          });
          
          // If new icons were added, update all
          if (hasChildListChange) {
            requestAnimationFrame(() => updateAllIconValues());
          }
        } catch (error) {
          console.error('Error in MutationObserver:', error);
        }
      });
      mo.observe(container, { 
        childList: true, 
        subtree: true, 
        attributes: true,
        attributeFilter: ['data-percentage', 'data-actual', 'style']
      });
      
      // Also poll for changes as a fallback to ensure real-time updates
      // This catches any changes that MutationObserver might miss
      let lastPollTime = Date.now();
      const pollInterval = 16; // ~60fps
      
      const pollForChanges = () => {
        const now = Date.now();
        if (now - lastPollTime < pollInterval) {
          requestAnimationFrame(pollForChanges);
          return;
        }
        lastPollTime = now;
        
        try {
          const svg = document.querySelector('#meter-container svg[data-meter]');
          if (!svg) {
            requestAnimationFrame(pollForChanges);
            return;
          }
          
          const { minValue, maxValue, unit } = getCachedRangeSettings();
          
          for (let i = 0; i < 6; i++) {
            const g = svg.querySelector(`g[data-perf="${i}"]`);
            if (!g || g.style.display === 'none') continue;
            
            const percentageAttr = g.getAttribute('data-percentage');
            if (!percentageAttr) continue;
            
            const percentage = parseFloat(percentageAttr);
            if (isNaN(percentage)) continue;
            
            const lastValue = lastValues.get(i);
            if (lastValue !== percentage) {
              lastValues.set(i, percentage);
              updateIconValueFast(g, i, minValue, maxValue, unit);
            }
          }
        } catch (error) {
          console.error('Error in polling:', error);
        }
        
        requestAnimationFrame(pollForChanges);
      };
      
      // Start polling
      requestAnimationFrame(pollForChanges);
    }
  }

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setupListeners();
        // Use requestAnimationFrame for faster initial render
        requestAnimationFrame(() => {
          applyVisibility();
          updateAllIconValues();
        });
      });
    } else {
      setupListeners();
      requestAnimationFrame(() => {
        applyVisibility();
        updateAllIconValues();
      });
    }
  }

  function placeIcons() {}

  init();
  window.IconRenderer = { placeIcons, applyVisibility, updateAllIconValues };
})();

