// Settings window - handles log replay/recording and range settings
(function () {
  // Load dependencies dynamically
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
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

  async function initSettings() {
    if (!window.USE_MVVM) {
      console.warn('MVVM mode is disabled');
      return;
    }

    // Load dependencies
    const dependencies = [
      'js/core/event.js',
      'js/core/model.js',
      'js/core/viewModel.js',
      'js/bindings/bindings.js',
      'js/services/replay.js'
    ];

    try {
      for (const src of dependencies) {
        try {
          await loadScript(src);
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          console.error('Failed to load script:', src, error);
          throw error;
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
        throw new Error('MVVM modules are incomplete.');
      }

      // Create a shared ViewModel instance (or get from main window)
      const { MeterState, MeterViewModel, Bindings } = window.MVVM;
      
      // Try to get ViewModel from main window, or create a new one
      let vm = null;
      try {
        // Try to get from opener (main window)
        if (window.opener && window.opener.MVVM && window.opener.MVVM.MeterViewModel) {
          // Access the ViewModel instance from main window
          // We'll use BroadcastChannel to communicate instead
        }
      } catch (e) {
        // Cross-origin or not available
      }

      // Create a local ViewModel for settings (will sync with main window)
      const initial = new MeterState(
        [],
        ['', '', '', '', '', ''],
        'assets/icon.svg'
      );
      vm = new MeterViewModel(initial);

      // Use BroadcastChannel to sync with main window
      let bc = null;
      try {
        bc = new BroadcastChannel('meter-settings');
      } catch (e) {
        console.warn('BroadcastChannel not available');
      }

      // Get UI elements
      const recordStatusEl = document.getElementById('log-record-status');
      
      // Sync settings changes to main window
      function syncToMain(data) {
        if (bc) {
          bc.postMessage({ type: 'settings-update', data: data });
        }
        // Also use localStorage as fallback
        try {
          localStorage.setItem('meter-settings', JSON.stringify(data));
        } catch (e) {}
      }

      // Listen for messages from main window
      if (bc) {
        bc.onmessage = (ev) => {
          const msg = ev.data;
          if (msg && msg.type === 'settings-sync') {
            // Settings sync from main window
            const data = msg.data;
            if (data.minValue !== undefined) {
              vm.setMinValue(data.minValue);
              const el = document.getElementById('min-value');
              if (el) el.value = data.minValue;
            }
            if (data.maxValue !== undefined) {
              vm.setMaxValue(data.maxValue);
              const el = document.getElementById('max-value');
              if (el) el.value = data.maxValue;
            }
            if (data.unit !== undefined) {
              vm.setUnit(data.unit);
              const el = document.getElementById('value-unit');
              if (el) el.value = data.unit;
            }
          } else if (msg && msg.type === 'record-status') {
            // Recording status update from main window
            const status = msg.status;
            if (recordStatusEl) {
              if (status.isRecording) {
                recordStatusEl.textContent = `記録中... (${status.recordCount}件)`;
                recordStatusEl.style.color = '#d32f2f';
              } else {
                recordStatusEl.textContent = '停止中';
                recordStatusEl.style.color = '#666';
              }
            }
          }
        };
      }

      // Load initial settings from localStorage
      try {
        const saved = localStorage.getItem('meter-settings');
        if (saved) {
          const data = JSON.parse(saved);
          if (data.minValue !== undefined) {
            vm.setMinValue(data.minValue);
            document.getElementById('min-value').value = data.minValue;
          }
          if (data.maxValue !== undefined) {
            vm.setMaxValue(data.maxValue);
            document.getElementById('max-value').value = data.maxValue;
          }
          if (data.unit !== undefined) {
            vm.setUnit(data.unit);
            document.getElementById('value-unit').value = data.unit;
          }
        }
      } catch (e) {}

      // Override to sync to main window
      const originalSetMinValue = vm.setMinValue;
      const originalSetMaxValue = vm.setMaxValue;
      const originalSetUnit = vm.setUnit;
      
      vm.setMinValue = function(v) {
        originalSetMinValue.call(this, v);
        syncToMain({ minValue: this.minValue });
      };
      
      vm.setMaxValue = function(v) {
        originalSetMaxValue.call(this, v);
        syncToMain({ maxValue: this.maxValue });
      };
      
      vm.setUnit = function(v) {
        originalSetUnit.call(this, v);
        syncToMain({ unit: this.unit });
      };

      // Bind range settings UI
      const minValueInput = document.getElementById('min-value');
      const maxValueInput = document.getElementById('max-value');
      const unitInput = document.getElementById('value-unit');
      
      if (minValueInput) {
        minValueInput.addEventListener('change', () => {
          vm.setMinValue(minValueInput.value);
        });
        minValueInput.addEventListener('input', () => {
          vm.setMinValue(minValueInput.value);
        });
      }

      if (maxValueInput) {
        maxValueInput.addEventListener('change', () => {
          vm.setMaxValue(maxValueInput.value);
        });
        maxValueInput.addEventListener('input', () => {
          vm.setMaxValue(maxValueInput.value);
        });
      }

      if (unitInput) {
        unitInput.addEventListener('change', () => vm.setUnit(unitInput.value));
        unitInput.addEventListener('input', () => vm.setUnit(unitInput.value));
      }

      // Bind replay controls - send commands to main window
      const logFile = document.getElementById('log-file');
      const playBtn = document.getElementById('play-log');
      const stopBtn = document.getElementById('stop-log');
      
      if (playBtn && logFile) {
        playBtn.addEventListener('click', () => {
          const f = logFile.files && logFile.files[0];
          if (!f) {
            alert('ログファイル（JSON）を選択してください');
            return;
          }
          // Read file and send to main window
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const data = JSON.parse(reader.result);
              // Send file data and play command to main window
              if (bc) {
                bc.postMessage({ 
                  type: 'replay-load-and-play', 
                  data: data,
                  filename: f.name
                });
              }
            } catch (err) {
              alert('読み込み失敗: ' + err.message);
            }
          };
          reader.onerror = () => {
            alert('ファイル読み込みエラー');
          };
          reader.readAsText(f);
        });
      }
      
      if (stopBtn) {
        stopBtn.addEventListener('click', () => {
          // Send stop command to main window
          if (bc) {
            bc.postMessage({ type: 'replay-stop' });
          }
        });
      }
      
      // Bind recording controls - send commands to main window
      const startRecordBtn = document.getElementById('start-record');
      const stopRecordBtn = document.getElementById('stop-record');
      
      if (startRecordBtn) {
        startRecordBtn.addEventListener('click', () => {
          // Send record start command to main window
          if (bc) {
            bc.postMessage({ type: 'record-start' });
          }
        });
      }
      
      if (stopRecordBtn) {
        stopRecordBtn.addEventListener('click', () => {
          // Send record stop command to main window
          if (bc) {
            bc.postMessage({ type: 'record-stop' });
          }
        });
      }
      
      // Update status periodically by requesting from main window
      setInterval(() => {
        if (bc) {
          bc.postMessage({ type: 'record-status-request' });
        }
      }, 500);
      
      // Initial status update
      if (recordStatusEl) {
        recordStatusEl.textContent = '停止中';
        recordStatusEl.style.color = '#666';
      }

      // Request initial sync from main window
      if (bc) {
        bc.postMessage({ type: 'settings-request-sync' });
      }

    } catch (error) {
      console.error('Failed to initialize settings:', error);
    }
  }

  // Start initialization
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initSettings);
  } else {
    initSettings();
  }
})();

