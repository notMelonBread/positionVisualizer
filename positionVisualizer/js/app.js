(function () {
  // Load dependencies dynamically
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      // Check if already loaded by checking window objects
      if (src.includes('meterRenderer.js') && window.MeterRenderer) {
        resolve();
        return;
      }
      if (src.includes('iconRenderer.js') && window.IconRenderer) {
        resolve();
        return;
      }
      if (src.includes('mock.js') && window.MockData) {
        resolve();
        return;
      }
      if (src.includes('replay.js') && window.Replay) {
        resolve();
        return;
      }
      if (src.includes('event.js') && window.MVVM && window.MVVM.Emitter) {
        resolve();
        return;
      }
      if (src.includes('model.js') && window.MVVM && window.MVVM.MeterState) {
        resolve();
        return;
      }
      if (src.includes('viewModel.js') && window.MVVM && window.MVVM.MeterViewModel) {
        resolve();
        return;
      }
      if (src.includes('bindings.js') && window.MVVM && window.MVVM.Bindings) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      // Add cache busting
      const cacheBuster = '?v=' + Date.now();
      script.src = src + cacheBuster;
      script.onload = resolve;
      script.onerror = () => {
        console.error('Failed to load script:', src);
        reject(new Error('Failed to load: ' + src));
      };
      document.head.appendChild(script);
    });
  }

  async function initApp() {
    if (!window.USE_MVVM) {
      console.warn('MVVM mode is disabled');
      return;
    }

    // Load dependencies in order
    const dependencies = [
      'js/core/event.js',
      'js/core/model.js',
      'js/core/viewModel.js',
      'js/bindings/bindings.js',
      'js/views/meterRenderer.js',
      'js/views/iconRenderer.js',
      'js/services/mock.js',
      'js/services/replay.js'
    ];

    try {
      // Check if already loaded
      const needsLoading = dependencies.filter(src => {
        const script = Array.from(document.scripts).find(s => s.src.includes(src));
        return !script;
      });

      if (needsLoading.length > 0) {
        for (const src of needsLoading) {
          try {
            console.log('Loading script:', src);
            await loadScript(src);
            // Small delay to ensure script execution
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Verify critical modules after loading
            if (src.includes('event.js') && !window.MVVM?.Emitter) {
              throw new Error('event.js failed to initialize window.MVVM.Emitter');
            }
            if (src.includes('model.js') && !window.MVVM?.MeterState) {
              throw new Error('model.js failed to initialize window.MVVM.MeterState');
            }
            if (src.includes('viewModel.js') && !window.MVVM?.MeterViewModel) {
              throw new Error('viewModel.js failed to initialize window.MVVM.MeterViewModel');
            }
            if (src.includes('bindings.js') && !window.MVVM?.Bindings) {
              throw new Error('bindings.js failed to initialize window.MVVM.Bindings');
            }
          } catch (error) {
            console.error('Failed to load script:', src, error);
            throw error;
          }
        }
      }

      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        await new Promise(resolve => window.addEventListener('DOMContentLoaded', resolve));
      }

      // Verify that MVVM is loaded
      if (!window.MVVM) {
        throw new Error('MVVM modules failed to load. window.MVVM is undefined.');
      }
      if (!window.MVVM.MeterState || !window.MVVM.MeterViewModel || !window.MVVM.Bindings) {
        throw new Error('MVVM modules are incomplete. Missing: ' + 
          (!window.MVVM.MeterState ? 'MeterState ' : '') +
          (!window.MVVM.MeterViewModel ? 'MeterViewModel ' : '') +
          (!window.MVVM.Bindings ? 'Bindings' : ''));
      }

      // Now initialize
      const { MeterState, MeterViewModel, Bindings } = window.MVVM;
      const initial = new MeterState(
        [],
        [
          document.getElementById('device1-name')?.value || '',
          document.getElementById('device2-name')?.value || '',
          document.getElementById('device3-name')?.value || '',
          document.getElementById('device4-name')?.value || '',
          document.getElementById('device5-name')?.value || '',
          document.getElementById('device6-name')?.value || ''
        ],
        'assets/icon.svg'
      );
      const vm = new MeterViewModel(initial);

      // Attach bindings
      const monitorBinding = new Bindings.MonitorBinding(vm);
      monitorBinding.attach();

      const uiBinding = new Bindings.UIBinding(vm);
      uiBinding.monitorBinding = monitorBinding; // Share reference for recording
      uiBinding.attach();
    } catch (error) {
      console.error('Failed to initialize application:', error);
    }
  }

  // Start initialization
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
