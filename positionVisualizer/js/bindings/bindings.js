(function(){
  const MeterState = (window.MVVM && window.MVVM.MeterState);
  const MeterViewModel = (window.MVVM && window.MVVM.MeterViewModel);

  function MonitorBinding(vm){
    this.vm = vm;
    this.bc = null;
    try { this.bc = new BroadcastChannel('meter-overlay'); } catch(e) {}
    this._ws = null;
    this._wsTimer = null;
    this._pollTimers = [];
    this._deviceIdMap = new Map(); // device_id -> index mapping
    this._recordingController = null; // Reference to recording controller
  }
  
  // Map device_id to index (e.g., "lever1" -> 0, "lever2" -> 1)
  MonitorBinding.prototype._getDeviceIndex = function(deviceId) {
    if (!deviceId) return -1;
    // Check if already mapped
    if (this._deviceIdMap.has(deviceId)) {
      return this._deviceIdMap.get(deviceId);
    }
    // Try to extract number from device_id (lever1 -> 0, lever2 -> 1, etc.)
    const match = deviceId.match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 1 && num <= 6) {
        const index = num - 1;
        this._deviceIdMap.set(deviceId, index);
        return index;
      }
    }
    // Try to find by IP address or name
    for (let i = 0; i < 6; i++) {
      const ipEl = document.getElementById(`device${i+1}-ip`);
      const nameEl = document.getElementById(`device${i+1}-name`);
      const ip = ipEl ? ipEl.value.trim() : '';
      const name = nameEl ? nameEl.value.trim() : '';
      // Match by device_id in name or IP
      if (name && name.toLowerCase().includes(deviceId.toLowerCase())) {
        this._deviceIdMap.set(deviceId, i);
        return i;
      }
    }
    return -1;
  };
  
  // Process JSON data from device
  MonitorBinding.prototype._processDeviceData = function(jsonData) {
    try {
      if (!jsonData || typeof jsonData !== 'object') return;
      
      const deviceId = jsonData.device_id;
      if (!deviceId) return;
      
      const index = this._getDeviceIndex(deviceId);
      if (index < 0 || index > 5) return;
      
      // Get value from data.value or data.smoothed (prefer value)
      const data = jsonData.data;
      if (!data) return;
      
      let value = null;
      if (typeof data.value === 'number') {
        value = data.value;
      } else if (typeof data.smoothed === 'number') {
        value = data.smoothed;
      } else if (typeof data.raw === 'number') {
        value = data.raw;
      }
      
      if (value !== null && !isNaN(value)) {
        // Set the actual value (ViewModel will normalize it)
        this.vm.setValue(index, value);
        
        // Record data if recording is active
        if (this._recordingController && this._recordingController.recordDeviceData) {
          // Record normalized value (0-100) - state.values already contains normalized values
          const normalizedValue = this.vm.state.values[index];
          this._recordingController.recordDeviceData(deviceId, normalizedValue);
        }
      }
    } catch (error) {
      console.error('Error processing device data:', error);
    }
  };
  
  MonitorBinding.prototype._ensureWs = function(){
    if (this._ws && this._ws.readyState === WebSocket.OPEN) return this._ws;
    const self = this;
    try {
      if (this._ws) { try { this._ws.close(); } catch(_){} this._ws = null; }
      const ws = new WebSocket('ws://127.0.0.1:8123');
      this._ws = ws;
      ws.onopen = () => { /* ready */ };
      ws.onclose = () => { if (this._wsTimer) clearTimeout(this._wsTimer); this._wsTimer = setTimeout(()=>this._ensureWs(), 1500); };
      ws.onerror = () => { try { ws.close(); } catch(_){} };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Handle state messages from bridge-server.js (same format as OverlayBinding)
          if (data.type === 'state' && data.payload) {
            const payload = data.payload;
            if (payload.values && Array.isArray(payload.values)) {
              // Update values from state payload
              for (let i = 0; i < 6; i++) {
                const value = payload.values[i];
                if (value !== null && value !== undefined) {
                  // Value is already normalized (0-100) from bridge-server
                  self.vm.setValue(i, value, true, true); // Enable smooth interpolation, value is normalized
                } else {
                  self.vm.setValue(i, null, false);
                }
              }
            }
            return;
          }
          // Handle device data JSON (legacy format)
          if (data.device_id && data.data) {
            self._processDeviceData(data);
          }
          // Handle wrapped messages
          else if (data.type === 'device' && data.payload) {
            self._processDeviceData(data.payload);
          }
          // Handle array of device data
          else if (Array.isArray(data)) {
            data.forEach(item => self._processDeviceData(item));
          }
        } catch (e) {
          // Not JSON or invalid format, ignore
        }
      };
    } catch(_) {}
    if (!this._wsTimer) this._wsTimer = setTimeout(()=>this._ensureWs(), 1500);
    return this._ws;
  };
  MonitorBinding.prototype.broadcast = function(){
    const s = this.vm.toJSON();
    // Also serialize current SVG for mirroring
    const svgEl = document.querySelector('#meter-container svg[data-meter]');
    const svgMarkup = svgEl ? svgEl.outerHTML : '';
    if (this.bc) this.bc.postMessage({ ...s, svg: svgMarkup });
    try {
      localStorage.setItem('meter-state', JSON.stringify({ ...s, ts: Date.now() }));
      if (svgMarkup) localStorage.setItem('meter-svg', svgMarkup);
    } catch(e) {}
    // WebSocket send to local bridge (preferred)
    try {
      const ws = this._ensureWs();
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'state', payload: { ...s, svg: svgMarkup } }));
      }
    } catch(_) {}
  };
  MonitorBinding.prototype.getConnectedDeviceIndices = function(){
    // Show only devices that have received data
    // Use ViewModel's method to get connected device indices
    return this.vm.getConnectedDeviceIndices();
  };

  // Start WebSocket connection for device data (replaces HTTP polling)
  MonitorBinding.prototype._startPolling = function() {
    // Clear any existing polling timers (for compatibility)
    this._pollTimers.forEach(timer => clearInterval(timer));
    this._pollTimers = [];
    
    // Establish WebSocket connection - data will arrive via onmessage handler
    // The _ensureWs() method already sets up the message handler that calls _processDeviceData
    this._ensureWs();
  };
  
  MonitorBinding.prototype.attach = function(){
    const vm = this.vm;
    const self = this;
    MeterRenderer.initMeter(document.getElementById('meter-container'));
    this._ensureWs();
    
    // Start/stop polling based on VM state
    const originalStart = vm.start;
    const originalStop = vm.stop;
    vm.start = function() {
      originalStart.call(this);
      if (this.running) {
        self._startPolling();
      }
    };
    vm.stop = function() {
      originalStop.call(this);
      // Stop polling
      self._pollTimers.forEach(timer => clearInterval(timer));
      self._pollTimers = [];
    };
    
    // Restart polling when interval changes
    vm.onChange(() => {
      if (vm.running) {
        self._startPolling();
      } else {
        // Stop polling if not running
        self._pollTimers.forEach(timer => clearInterval(timer));
        self._pollTimers = [];
      }
    });
    
    // Start polling if already running
    if (vm.running) {
      this._startPolling();
    }
    
    vm.onChange((state) => {
      const connectedDeviceIndices = this.getConnectedDeviceIndices();
      const actualValues = vm.getActualValues();
      MeterRenderer.updateMeter(state.values, { 
        names: state.names, 
        icon: state.icon, 
        numbersOnly: true, 
        textYOffset: 15,
        connectedDeviceIndices: connectedDeviceIndices,
        actualValues: actualValues,
        unit: vm.unit,
        minValue: vm.minValue,
        maxValue: vm.maxValue,
        icons: vm.state.icons
      });
      this.broadcast();
    });
    // initial paint
    const initialConnectedDeviceIndices = this.getConnectedDeviceIndices();
    const initialActualValues = vm.getActualValues();
    MeterRenderer.updateMeter(vm.state.values, { 
      names: vm.state.names, 
      icon: vm.state.icon, 
      numbersOnly: true, 
      textYOffset: 15,
      connectedDeviceIndices: initialConnectedDeviceIndices,
      actualValues: initialActualValues,
      unit: vm.unit,
      minValue: vm.minValue,
      maxValue: vm.maxValue,
      icons: vm.state.icons
    });
    this.broadcast();
  };

  function OverlayBinding(vm){
    this.vm = vm;
    this.bc = null;
    try { this.bc = new BroadcastChannel('meter-overlay'); } catch(e) {}
    this._ws = null;
    this._wsTimer = null;
  }
  OverlayBinding.prototype._ensureWs = function(onState){
    if (this._ws && this._ws.readyState === WebSocket.OPEN) return this._ws;
    try {
      if (this._ws) { try { this._ws.close(); } catch(_){} this._ws = null; }
      const ws = new WebSocket('ws://127.0.0.1:8123');
      this._ws = ws;
      ws.onopen = () => { /* connected */ };
      ws.onclose = () => { if (this._wsTimer) clearTimeout(this._wsTimer); this._wsTimer = setTimeout(()=>this._ensureWs(onState), 1500); };
      ws.onerror = () => { try { ws.close(); } catch(_){} };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data || '{}');
          if (msg && msg.type === 'state' && msg.payload) {
            onState && onState(msg.payload);
          }
        } catch(_){}
      };
    } catch(_) {}
    if (!this._wsTimer) this._wsTimer = setTimeout(()=>this._ensureWs(onState), 1500);
    return this._ws;
  };
  OverlayBinding.prototype.attach = function(){
    const container = document.getElementById('meter-container');
    let initialized = false;
    const self = this;

    // Ensure there is at least a placeholder meter so overlay is never blank
    try {
      MeterRenderer.initMeter(container);
      // Start with empty state - no default values
      MeterRenderer.updateMeter([], { icon: null });
      initialized = !!container.querySelector('svg[data-meter]');
      
      // Initialize iconRenderer for overlay
      if (window.IconRenderer && window.IconRenderer.updateAllIconValues) {
        setTimeout(() => {
          window.IconRenderer.updateAllIconValues();
        }, 100);
      }
    } catch(e) {}

    const setHref = (img, href) => {
      if (!img) return;
      if (href) {
        if (img.getAttribute('href') !== href) {
          img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', href);
          img.setAttribute('href', href);
        }
      } else {
        if (img.getAttribute('href')) {
          img.removeAttribute('href');
          img.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
        }
      }
    };

    const renderSvgFull = (svgMarkup) => {
      if (!svgMarkup) return;
      container.innerHTML = svgMarkup;
      initialized = true;
      // Update icon values after rendering
      if (window.IconRenderer && window.IconRenderer.updateAllIconValues) {
        setTimeout(() => {
          window.IconRenderer.updateAllIconValues();
        }, 50);
      }
    };

    const patchSvg = (svgMarkup) => {
      if (!svgMarkup) return;
      const existingSvg = container.querySelector('svg[data-meter]');
      if (!existingSvg) { renderSvgFull(svgMarkup); return; }
      const temp = document.createElement('div'); temp.innerHTML = svgMarkup;
      const nextSvg = temp.querySelector('svg[data-meter]'); if (!nextSvg) return;
      
      // Update viewBox if it changed
      const nextViewBox = nextSvg.getAttribute('viewBox');
      if (nextViewBox && existingSvg.getAttribute('viewBox') !== nextViewBox) {
        existingSvg.setAttribute('viewBox', nextViewBox);
      }
      
      // Update perf groups
      const nextGroups = nextSvg.querySelectorAll('g[data-perf]');
      nextGroups.forEach((ng) => {
        const key = ng.getAttribute('data-perf');
        let g = existingSvg.querySelector(`g[data-perf="${key}"]`);
        if (!g) { g = ng.cloneNode(true); existingSvg.appendChild(g); return; }
        // Update transform for animation
        const tr = ng.getAttribute('transform'); if (tr) g.setAttribute('transform', tr);
        // Update data attributes
        const dataPercentage = ng.getAttribute('data-percentage');
        const dataActual = ng.getAttribute('data-actual');
        const dataUnit = ng.getAttribute('data-unit');
        if (dataPercentage !== null) g.setAttribute('data-percentage', dataPercentage);
        if (dataActual !== null) g.setAttribute('data-actual', dataActual);
        if (dataUnit !== null) g.setAttribute('data-unit', dataUnit);
        // Update text (including icon-value text)
        const nt = ng.querySelector('text'); 
        const ct = g.querySelector('text');
        if (nt && ct) {
          if (ct.textContent !== nt.textContent) ct.textContent = nt.textContent;
          ct.setAttribute('y', nt.getAttribute('y') || ct.getAttribute('y') || '15');
        }
        // Check for icon-value text element
        const nIconText = ng.querySelector('text.icon-value');
        const cIconText = g.querySelector('text.icon-value');
        if (nIconText) {
          if (!cIconText) {
            g.appendChild(nIconText.cloneNode(true));
          } else {
            cIconText.textContent = nIconText.textContent;
            cIconText.setAttribute('data-actual', nIconText.getAttribute('data-actual') || '');
            cIconText.setAttribute('data-unit', nIconText.getAttribute('data-unit') || '');
          }
        }
        // Update images: [0]=bg, [1]=fg
        const nimgs = ng.querySelectorAll('image');
        const cimgs = g.querySelectorAll('image');
        if (nimgs && nimgs.length) {
          // Ensure at least as many images
          for (let i=0;i<nimgs.length;i++) {
            if (!cimgs[i]) { g.insertBefore(nimgs[i].cloneNode(true), ct || null); }
          }
          const updatedCImgs = g.querySelectorAll('image');
          for (let i=0;i<nimgs.length;i++) {
            const href = nimgs[i].getAttribute('href') || nimgs[i].getAttributeNS('http://www.w3.org/1999/xlink','href');
            setHref(updatedCImgs[i], href);
          }
        }
      });
      // Update icon values after patching
      if (window.IconRenderer && window.IconRenderer.updateAllIconValues) {
        setTimeout(() => {
          window.IconRenderer.updateAllIconValues();
        }, 50);
      }
    };
    // receivers: prefer svg mirroring
    if (this.bc) this.bc.onmessage = (ev)=>{
      const d = ev.data || {};
      if (typeof d.svg === 'string' && d.svg) {
        if (!initialized) renderSvgFull(d.svg); else patchSvg(d.svg);
        return;
      }
      // Fallback (legacy): if only state arrived
      if (Array.isArray(d.values)) {
        const MeterStateClass = (window.MVVM && window.MVVM.MeterState);
        if (MeterStateClass) {
          this.vm.setState(new MeterStateClass(d.values, d.names, d.icon, d.icons));
        }
        // And try to read latest svg from LS
        try { const svg = localStorage.getItem('meter-svg'); if (svg) { if (!initialized) renderSvgFull(svg); else patchSvg(svg); } } catch(e){}
      }
    };
    // Listen to localStorage updates for svg
    window.addEventListener('storage', (e)=>{ if (e.key==='meter-svg' && typeof e.newValue==='string') { if (!initialized) renderSvgFull(e.newValue); else patchSvg(e.newValue); } });
    // initial
    try { const svg = localStorage.getItem('meter-svg'); if (svg) renderSvgFull(svg); } catch(e){}

    // WebSocket receiver (preferred across OBS)
    const onWsState = (payload) => {
      if (payload && typeof payload.svg === 'string' && payload.svg) {
        if (!initialized) renderSvgFull(payload.svg); else patchSvg(payload.svg);
        return;
      }
      if (payload && Array.isArray(payload.values)) {
        // Update ViewModel with smooth interpolation enabled
        const values = payload.values;
        for (let i = 0; i < 6; i++) {
          const value = values[i];
          if (value !== null && value !== undefined) {
            // Value is already normalized (0-100), so pass isNormalized=true
            this.vm.setValue(i, value, true, true); // Enable smooth interpolation, value is normalized
          } else {
            this.vm.setValue(i, null, false); // No interpolation for null values
          }
        }
        
        // Update other state properties
        if (payload.icon !== undefined) {
          this.vm.setIcon(payload.icon);
        }
        if (payload.unit !== undefined) {
          this.vm.setUnit(payload.unit);
        }
        if (payload.minValue !== undefined) {
          this.vm.setMinValue(payload.minValue);
        }
        if (payload.maxValue !== undefined) {
          this.vm.setMaxValue(payload.maxValue);
        }
        
        initialized = true;
      }
    };
    
    // Listen to ViewModel changes to update renderer
    this.vm.onChange((state) => {
      const connectedDeviceIndices = this.vm.getConnectedDeviceIndices();
      const actualValues = this.vm.getActualValues();
      MeterRenderer.updateMeter(state.values, { 
        names: state.names, 
        icon: state.icon, 
        numbersOnly: true, 
        textYOffset: 15,
        connectedDeviceIndices: connectedDeviceIndices,
        actualValues: actualValues,
        unit: this.vm.unit,
        minValue: this.vm.minValue,
        maxValue: this.vm.maxValue,
        icons: state.icons
      });
      // Update icon values
      if (window.IconRenderer && window.IconRenderer.updateAllIconValues) {
        setTimeout(() => {
          window.IconRenderer.updateAllIconValues();
        }, 50);
      }
    });
    this._ensureWs(onWsState);

    // Bridge polling (OBS/browser-source safe) as a fallback
    async function pollBridge(){
      try {
        const res = await fetch('http://127.0.0.1:8123/state', { cache: 'no-store' });
        if (!res || !res.ok) return;
        const d = await res.json();
        onWsState(d);
      } catch(_){ }
    }
    setInterval(pollBridge, 1500);
    pollBridge();
  };

  function UIBinding(vm) {
    this.vm = vm;
    this.replayController = null;
  }

  UIBinding.prototype.attach = function() {
    const vm = this.vm;

    // Initialize initial state from DOM
    const initialNames = [];
    for (let i = 1; i <= 6; i++) {
      const el = document.getElementById(`device${i}-name`);
      initialNames.push(el ? (el.value || '') : '');
    }
    initialNames.forEach((name, idx) => {
      if (name) vm.setName(idx, name);
    });

    // Bind buttons (start/stop buttons removed - auto-connect on startup)
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', () => {
        const el = document.getElementById('history-content');
        if (el) el.innerHTML = '';
      });
    }

    // Bind device name inputs
    for (let i = 1; i <= 6; i++) {
      const el = document.getElementById(`device${i}-name`);
      if (el) {
        const handler = () => vm.setName(i - 1, el.value);
        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
      }
    }

    // Bind IP address inputs (for visibility updates)
    for (let i = 1; i <= 6; i++) {
      const el = document.getElementById(`device${i}-ip`);
      if (el) {
        const handler = () => {
          vm._notify();
        };
        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
      }
    }

    // Poll interval is fixed at 100ms - no UI binding needed
    // const pollInput = document.getElementById('poll-interval');
    // if (pollInput) {
    //   pollInput.addEventListener('change', () => {
    //     vm.setPollInterval(pollInput.value);
    //   });
    // }

    // Bind range settings
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

    // Bind icon uploads
    for (let i = 1; i <= 6; i++) {
      const input = document.getElementById(`device${i}-icon`);
      if (input) {
        const button = input.closest('.icon-file-button');
        const buttonText = button ? button.querySelector('.icon-button-text') : null;
        
        // Update icon state class and button text based on current state
        const updateIconState = () => {
          const hasIcon = vm.state.icons && vm.state.icons[i - 1];
          if (button) {
            if (hasIcon) {
              button.classList.add('has-icon');
              if (buttonText) buttonText.textContent = '✓ 登録済み';
            } else {
              button.classList.remove('has-icon');
              if (buttonText) buttonText.textContent = '画像を選択';
            }
          }
        };
        
        // Initial state check
        updateIconState();
        
        input.addEventListener('change', () => {
          const file = input.files && input.files[0];
          if (!file) {
            if (button) button.classList.remove('has-icon');
            if (buttonText) buttonText.textContent = '画像を選択';
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = String(reader.result || '');
            if (dataUrl) {
              vm.setIconAt(i - 1, dataUrl);
              if (button) button.classList.add('has-icon');
              if (buttonText) buttonText.textContent = '✓ 登録済み';
            }
          };
          reader.readAsDataURL(file);
        });
        
        // Watch for icon changes from other sources
        vm.onChange(() => {
          updateIconState();
        });
      }
    }

    // Bind history updates
    vm.onChange((state) => {
      if (vm.running) {
        const el = document.getElementById('history-content');
        if (el) {
          const row = document.createElement('div');
          const actualValues = vm.getActualValues();
          const unit = vm.unit || '%';
          row.textContent = `${new Date().toLocaleTimeString()} - ${actualValues.map(v => Math.round(v) + unit).join(', ')}`;
          el.prepend(row);
          while (el.children.length > 100) el.removeChild(el.lastChild);
        }
      }
    });

    // Bind replay controls
    if (window.Replay) {
      this.replayController = window.Replay.create(vm);
      
      // Share recording controller with MonitorBinding
      const monitorBinding = this.monitorBinding;
      if (monitorBinding) {
        monitorBinding._recordingController = this.replayController;
      }
      
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
          this.replayController.loadFile(f, (err, meta) => {
            if (err) {
              alert('読み込み失敗: ' + err.message);
              return;
            }
            this.replayController.play();
          });
        });
      }
      if (stopBtn) {
        stopBtn.addEventListener('click', () => {
          if (this.replayController) this.replayController.stop();
        });
      }
      
      // Bind recording controls
      const startRecordBtn = document.getElementById('start-record');
      const stopRecordBtn = document.getElementById('stop-record');
      const recordStatusEl = document.getElementById('log-record-status');
      
      const updateRecordStatus = () => {
        if (!recordStatusEl) return;
        const status = this.replayController.getRecordingStatus();
        if (status.isRecording) {
          recordStatusEl.textContent = `記録中... (${status.recordCount}件)`;
          recordStatusEl.style.color = '#d32f2f';
        } else {
          recordStatusEl.textContent = '停止中';
          recordStatusEl.style.color = '#666';
        }
      };
      
      if (startRecordBtn) {
        startRecordBtn.addEventListener('click', () => {
          this.replayController.startRecording();
          updateRecordStatus();
        });
      }
      
      if (stopRecordBtn) {
        stopRecordBtn.addEventListener('click', () => {
          const data = this.replayController.stopRecording();
          updateRecordStatus();
          if (data && data.length > 0) {
            this.replayController.saveRecordedData(data);
          }
        });
      }
      
      // Update status periodically
      setInterval(updateRecordStatus, 500);
      updateRecordStatus();
    }
  };

  window.MVVM = window.MVVM || {}; window.MVVM.Bindings = { MonitorBinding, OverlayBinding, UIBinding };
})();

