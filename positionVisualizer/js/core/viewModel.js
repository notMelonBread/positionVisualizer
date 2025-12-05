(function(){
  const Emitter = (window.MVVM && window.MVVM.Emitter);
  const MeterState = (window.MVVM && window.MVVM.MeterState);

  function MeterViewModel(initial){
    this.emitter = new Emitter();
    this.state = initial instanceof MeterState ? initial : new MeterState();
    this.running = false;
    this.pollIntervalMs = 100; // Fixed at 100ms
    this._timer = null;
    this.minValue = 0;
    this.maxValue = 100;
    this.unit = '%';
    
    // Interpolation state for smooth animation
    this._interpolationDuration = 200; // ms
    this._interpolations = []; // Array of { index, startValue, targetValue, startTime, endTime }
    this._animationFrameId = null;
  }

  MeterViewModel.prototype.onChange = function(fn){ return this.emitter.on('change', fn); };
  MeterViewModel.prototype._notify = function(){ this.emitter.emit('change', this.state.clone()); };
  MeterViewModel.prototype.setPollInterval = function(ms){ this.pollIntervalMs = 100; }; // Fixed at 100ms, cannot be changed
  MeterViewModel.prototype.setMinValue = function(v){ 
    let min = Number(v);
    if (!isNaN(min)) {
      // Allow any numeric value, but ensure min < max
      if (min >= this.maxValue) {
        this.maxValue = min + 1;
      }
      this.minValue = min;
      this._notify();
    }
  };
  MeterViewModel.prototype.setMaxValue = function(v){ 
    let max = Number(v);
    if (!isNaN(max)) {
      // Allow any numeric value, but ensure max > min
      if (max <= this.minValue) {
        this.minValue = max - 1;
      }
      this.maxValue = max;
      this._notify();
    }
  };
  MeterViewModel.prototype.setUnit = function(v){ 
    this.unit = String(v || '%').trim() || '%';
    this._notify();
  };
  
  // Convert actual value to percentage (0-100) for meter position calculation
  MeterViewModel.prototype.normalizeValue = function(actualValue){
    const range = this.maxValue - this.minValue;
    if (range === 0) return 50; // Default to middle if range is invalid
    const normalized = ((actualValue - this.minValue) / range) * 100;
    return Math.max(0, Math.min(100, normalized));
  };
  
  // Convert percentage (0-100) back to actual value
  MeterViewModel.prototype.denormalizeValue = function(percentage){
    const range = this.maxValue - this.minValue;
    return this.minValue + (percentage / 100) * range;
  };
  MeterViewModel.prototype.setName = function(index, name){
    if (index < 0 || index > 5) return; this.state.names[index] = String(name || '').trim() || this.state.names[index]; this._notify();
  };
  MeterViewModel.prototype.setValue = function(index, value, smooth, isNormalized){
    if (index < 0 || index > 5) return; 
    // Allow null to be set (indicates device not connected)
    if (value === null || value === undefined) {
      // Cancel any interpolation for this index
      this._interpolations = this._interpolations.filter(interp => interp.index !== index);
      this.state.values[index] = null;
      this._notify();
      return;
    }
    
    let normalized;
    if (isNormalized === true) {
      // Value is already normalized (0-100), use it directly
      normalized = Math.max(0, Math.min(100, Number(value) || 0));
    } else {
      // Store actual value, but normalize to 0-100 for internal state
      const actualValue = Number(value) || 0;
      const clamped = Math.max(this.minValue, Math.min(this.maxValue, actualValue));
      normalized = this.normalizeValue(clamped);
    }
    
    // Check if smooth interpolation is enabled (default: true)
    const useSmooth = smooth !== false;
    
    // Get current normalized value (may be null/undefined)
    const currentNormalized = this.state.values[index];
    
    if (useSmooth && currentNormalized !== null && currentNormalized !== undefined && !isNaN(currentNormalized)) {
      // Start interpolation from current value to target value
      const targetNormalized = normalized;
      
      // Only interpolate if there's a meaningful difference (reduced threshold for smoother animation)
      const diff = Math.abs(currentNormalized - targetNormalized);
      if (diff > 0.01) {
        // Remove any existing interpolation for this index
        this._interpolations = this._interpolations.filter(interp => interp.index !== index);
        
        // Add new interpolation
        const now = performance.now();
        this._interpolations.push({
          index: index,
          startValue: currentNormalized,
          targetValue: targetNormalized,
          startTime: now,
          endTime: now + this._interpolationDuration
        });
        
        // Start animation loop if not already running
        this._startInterpolation();
        return;
      }
    }
    
    // Set value immediately (no interpolation or difference too small)
    this.state.values[index] = normalized;
    this._notify();
  };
  
  // Start interpolation animation loop
  MeterViewModel.prototype._startInterpolation = function(){
    if (this._animationFrameId !== null) return; // Already running
    
    const self = this;
    const animate = function(){
      const now = performance.now();
      let needsUpdate = false;
      
      // Update all active interpolations
      self._interpolations.forEach(interp => {
        if (now >= interp.endTime) {
          // Interpolation complete - set to target value
          if (self.state.values[interp.index] !== interp.targetValue) {
            self.state.values[interp.index] = interp.targetValue;
            needsUpdate = true;
          }
        } else {
          // Interpolate between start and target
          const progress = (now - interp.startTime) / (interp.endTime - interp.startTime);
          const clampedProgress = Math.max(0, Math.min(1, progress)); // Ensure 0-1 range
          const currentValue = interp.startValue + (interp.targetValue - interp.startValue) * clampedProgress;
          self.state.values[interp.index] = currentValue;
          needsUpdate = true;
        }
      });
      
      // Remove completed interpolations
      const beforeCount = self._interpolations.length;
      self._interpolations = self._interpolations.filter(interp => now < interp.endTime);
      
      // Notify listeners if there was an update
      if (needsUpdate) {
        self._notify();
      }
      
      // Continue animation if there are active interpolations
      if (self._interpolations.length > 0) {
        self._animationFrameId = requestAnimationFrame(animate);
      } else {
        self._animationFrameId = null;
      }
    };
    
    this._animationFrameId = requestAnimationFrame(animate);
  };
  
  // Set interpolation duration
  MeterViewModel.prototype.setInterpolationDuration = function(ms){
    this._interpolationDuration = Math.max(0, Math.min(1000, Number(ms) || 200));
  };
  
  // Get actual value (not normalized) for display
  MeterViewModel.prototype.getActualValue = function(index){
    if (index < 0 || index > 5) return null;
    const value = this.state.values[index];
    if (value === null || value === undefined) return null;
    return this.denormalizeValue(value);
  };
  
  // Get all actual values
  MeterViewModel.prototype.getActualValues = function(){
    return this.state.values.map((v, i) => {
      if (v === null || v === undefined) return null;
      return this.denormalizeValue(v);
    });
  };
  
  // Get connected device indices (indices where value is not null)
  MeterViewModel.prototype.getConnectedDeviceIndices = function(){
    const indices = [];
    for (let i = 0; i < 6; i++) {
      const value = this.state.values[i];
      if (value !== null && value !== undefined && !isNaN(value)) {
        indices.push(i);
      }
    }
    return indices.length > 0 ? indices : null;
  };
  MeterViewModel.prototype.setIcon = function(path){ if (path) { this.state.icon = path; this._notify(); } };
  MeterViewModel.prototype.setIconAt = function(index, path){
    if (index < 0 || index > 3) return;
    this.state.icons[index] = String(path || '');
    this._notify();
  };

  MeterViewModel.prototype.setState = function(next){
    if (!next) return;
    if (!(next instanceof MeterState)) next = new MeterState(next.values, next.names, next.icon, next.icons);
    this.state = next;
    this._notify();
  };

  MeterViewModel.prototype.toJSON = function(){
    return { values: this.state.values.slice(0,6), names: this.state.names.slice(0,6), icon: this.state.icon, icons: this.state.icons.slice(0,6) };
  };

  MeterViewModel.prototype.start = function(){
    if (this.running) return; this.running = true;
    // Start polling for device data (handled by MonitorBinding)
    this._notify();
  };

  MeterViewModel.prototype.stop = function(){
    if (!this.running) return; this.running = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    // Stop interpolation animation
    if (this._animationFrameId !== null) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }
    // Complete all interpolations immediately
    this._interpolations.forEach(interp => {
      this.state.values[interp.index] = interp.targetValue;
    });
    this._interpolations = [];
    this._notify();
  };

  window.MVVM = window.MVVM || {}; window.MVVM.MeterViewModel = MeterViewModel;
})();

