(function(){
  function createReplayController(vm) {
    if (!vm) throw new Error('ViewModel is required');
    
    let frames = [];
    let timer = null;
    let frameIndex = 0;
    let intervalMs = 200;
    let interpolationTimer = null;
    let playbackStartTime = null;
    let isPlaying = false;
    
    // Recording functionality
    let isRecording = false;
    let recordedData = []; // Array of { id, value, ts }
    let recordingStartTime = null;

    function inferInterval(sorted) {
      if (sorted.length < 2) return 200;
      const deltas = [];
      for (let i=1;i<sorted.length;i++) deltas.push(sorted[i].ts - sorted[i-1].ts);
      deltas.sort((a,b)=>a-b);
      return Math.max(20, deltas[Math.floor(deltas.length/2)] || 200);
    }

    function parseLogArray(arr) {
      // Parse log array: [{ id, value, ts }]
      // Supports multiple devices (ids) with simultaneous updates
      const byTs = new Map(); // Map<timestamp, Map<deviceId, value>>
      const ids = new Set();
      
      // First pass: collect all device IDs and group by timestamp
      arr.forEach(r=>{
        if (!r) return; 
        const id = Number(r.id); 
        const v = Number(r.value); 
        const ts = Number(r.ts);
        if (!Number.isFinite(id) || !Number.isFinite(v) || !Number.isFinite(ts)) return;
        ids.add(id);
        if (!byTs.has(ts)) byTs.set(ts, new Map());
        byTs.get(ts).set(id, Math.max(0, Math.min(100, v)));
      });
      
      const sortedTs = Array.from(byTs.keys()).sort((a,b)=>a-b);
      intervalMs = inferInterval(sortedTs.map(ts=>({ts})));
      
      // Create sorted list of device IDs (up to 4 devices)
      // idList[0] = device 1, idList[1] = device 2, etc.
      const idList = Array.from(ids).sort((a,b)=>a-b).slice(0,4);
      
      // Normalize timestamps to start from 0 (relative time)
      const firstTs = sortedTs.length > 0 ? sortedTs[0] : 0;
      
      // Build frames with carry-forward values for smooth playback
      // Each frame contains values array: [device1_value, device2_value, device3_value, device4_value]
      const lastVals = new Map(); // Track last known value for each device
      frames = sortedTs.map(ts=>{
        const m = byTs.get(ts);
        // Update last known values for devices that have new data at this timestamp
        idList.forEach(id=>{ 
          if (m.has(id)) lastVals.set(id, m.get(id)); 
        });
        
        // Build values array: index i corresponds to device idList[i]
        const values = [0,0,0,0];
        for (let i=0;i<idList.length;i++) {
          values[i] = lastVals.has(idList[i]) ? lastVals.get(idList[i]) : 0;
        }
        
        // Normalize timestamp to relative time (start from 0)
        return { ts: ts - firstTs, values };
      });
    }

    function loadFile(file, cb){
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (Array.isArray(data)) parseLogArray(data);
          else if (Array.isArray(data.records)) parseLogArray(data.records);
          else throw new Error('Invalid log format');
          cb && cb(null, { framesCount: frames.length, intervalMs });
        } catch (e) { cb && cb(e); }
      };
      reader.onerror = () => cb && cb(reader.error || new Error('Failed to read file'));
      reader.readAsText(file);
    }

    function stop(){ 
      if (timer) { clearInterval(timer); timer = null; }
      if (interpolationTimer) { clearInterval(interpolationTimer); interpolationTimer = null; }
      isPlaying = false;
      playbackStartTime = null;
    }

    function play(){
      if (!frames.length) return;
      vm.stop(); // stop VM timers
      stop(); // Clear any existing timers
      
      frameIndex = 0;
      playbackStartTime = Date.now();
      isPlaying = true;
      
      // Use interpolation for smooth playback
      const interpolationInterval = 50; // Update every 50ms for smooth animation
      
      const interpolate = () => {
        if (!isPlaying || frames.length === 0) return;
        
        const currentTime = Date.now() - playbackStartTime;
        
        // Find current and next frame
        let currentFrame = null;
        let nextFrame = null;
        
        // Find the frame that should be playing now
        for (let i = 0; i < frames.length; i++) {
          if (frames[i].ts <= currentTime) {
            currentFrame = frames[i];
            if (i < frames.length - 1) {
              nextFrame = frames[i + 1];
            }
          } else {
            break;
          }
        }
        
        // If we've passed all frames, stop
        if (!currentFrame) {
          // Before first frame, use first frame value
          if (frames.length > 0) {
            const vals = frames[0].values;
            for (let i = 0; i < Math.min(vals.length, 4); i++) {
              vm.setValue(i, vals[i]);
            }
          }
          return;
        }
        
        if (currentTime >= frames[frames.length - 1].ts) {
          // Past last frame, use last frame value
          const vals = frames[frames.length - 1].values;
          for (let i = 0; i < Math.min(vals.length, 4); i++) {
            vm.setValue(i, vals[i]);
          }
          stop();
          return;
        }
        
        // Interpolate between current and next frame
        if (nextFrame && currentFrame.ts !== nextFrame.ts) {
          const t = (currentTime - currentFrame.ts) / (nextFrame.ts - currentFrame.ts);
          const clampedT = Math.max(0, Math.min(1, t)); // Clamp between 0 and 1
          
          const interpolatedValues = [];
          for (let i = 0; i < 4; i++) {
            const currentVal = currentFrame.values[i] || 0;
            const nextVal = nextFrame.values[i] || currentVal;
            // Linear interpolation
            const interpolated = currentVal + (nextVal - currentVal) * clampedT;
            interpolatedValues[i] = interpolated;
          }
          
          for (let i = 0; i < interpolatedValues.length; i++) {
            vm.setValue(i, interpolatedValues[i]);
          }
        } else {
          // No next frame or same timestamp, use current frame value
          const vals = currentFrame.values;
          for (let i = 0; i < Math.min(vals.length, 4); i++) {
            vm.setValue(i, vals[i]);
          }
        }
      };
      
      // Start interpolation loop
      interpolate(); // Initial update
      interpolationTimer = setInterval(interpolate, interpolationInterval);
    }

    // Recording functions
    function startRecording() {
      if (isRecording) return;
      isRecording = true;
      recordedData = [];
      recordingStartTime = Date.now();
    }
    
    function stopRecording() {
      if (!isRecording) return;
      isRecording = false;
      const data = recordedData.slice(); // Copy array
      recordedData = []; // Clear
      return data;
    }
    
    function recordDeviceData(deviceId, value) {
      if (!isRecording) return;
      if (!deviceId || value === null || value === undefined) return;
      
      // Convert deviceId to numeric id if possible
      let id = deviceId;
      if (typeof deviceId === 'string') {
        // Try to extract number from device_id (lever1 -> 1, etc.)
        const match = deviceId.match(/(\d+)$/);
        if (match) {
          id = parseInt(match[1], 10);
        } else {
          // Use hash of string as id
          let hash = 0;
          for (let i = 0; i < deviceId.length; i++) {
            hash = ((hash << 5) - hash) + deviceId.charCodeAt(i);
            hash = hash & hash; // Convert to 32bit integer
          }
          id = Math.abs(hash);
        }
      }
      
      const numValue = Number(value);
      if (!Number.isFinite(numValue)) return;
      
      const ts = Date.now();
      recordedData.push({
        id: id,
        value: Math.max(0, Math.min(100, numValue)), // Clamp to 0-100
        ts: ts
      });
    }
    
    function saveRecordedData(data) {
      if (!data || data.length === 0) {
        alert('記録されたデータがありません');
        return;
      }
      
      // Create JSON content
      const jsonContent = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create download link
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `meter-log-${timestamp}.json`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Also save to server (backup)
      saveToServer(data, filename).catch(err => {
        console.warn('Failed to save to server:', err);
        // Don't show error to user, download already succeeded
      });
    }
    
    async function saveToServer(data, filename) {
      try {
        const response = await fetch('http://127.0.0.1:8123/save-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ records: data, filename: filename }),
          cache: 'no-store'
        });
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }
      } catch (error) {
        // Silently fail - download already succeeded
        throw error;
      }
    }
    
    function getRecordingStatus() {
      return {
        isRecording: isRecording,
        recordCount: recordedData.length,
        startTime: recordingStartTime
      };
    }

    return { 
      loadFile, 
      play, 
      stop,
      startRecording,
      stopRecording,
      recordDeviceData,
      saveRecordedData,
      getRecordingStatus
    };
  }

  window.Replay = { create: createReplayController };
})();

