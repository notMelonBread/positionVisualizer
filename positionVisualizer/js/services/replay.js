(function(){
  function createReplayController(vm) {
    if (!vm) throw new Error('ViewModel is required');
    
    let frames = [];
    let timer = null;
    let frameIndex = 0;
    let intervalMs = 200;
    let playbackStartTime = null;
    let isPlaying = false;
    let animationFrameId = null;
    
    // Recording functionality
    let isRecording = false;
    let recordedData = []; // Array of { id, value, ts }
    let recordingStartTime = null;

    function inferInterval(sorted) {
      // Always return 200ms interval
      return 200;
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
      
      // Create sorted list of device IDs (up to 6 devices)
      // Map device ID to index: id 1 -> index 0, id 2 -> index 1, etc.
      const idList = Array.from(ids).sort((a,b)=>a-b).slice(0,6);
      const idToIndexMap = new Map(); // Map<deviceId, index>
      idList.forEach((id, idx) => {
        idToIndexMap.set(id, idx);
      });
      
      // Normalize timestamps to start from 0 (relative time)
      const firstTs = sortedTs.length > 0 ? sortedTs[0] : 0;
      
      // Build frames with carry-forward values for smooth playback
      // Each frame contains values array: [device1_value, device2_value, ..., device6_value]
      // Values for devices not in log are set to null
      const lastVals = new Map(); // Track last known value for each device ID
      frames = sortedTs.map(ts=>{
        const m = byTs.get(ts);
        // Update last known values for devices that have new data at this timestamp
        idList.forEach(id=>{ 
          if (m.has(id)) lastVals.set(id, m.get(id)); 
        });
        
        // Build values array: index i corresponds to device idList[i]
        // Initialize with null for all 6 slots
        const values = [null, null, null, null, null, null];
        for (let i=0;i<idList.length;i++) {
          const deviceId = idList[i];
          if (lastVals.has(deviceId)) {
            values[i] = lastVals.get(deviceId);
          }
        }
        
        // Normalize timestamp to relative time (start from 0)
        return { ts: ts - firstTs, values, idList }; // Store idList for reference
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
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      isPlaying = false;
      playbackStartTime = null;
      // Reset all values to null (initial state)
      for (let i = 0; i < 6; i++) {
        vm.setValue(i, null, false);
      }
    }

    function play(){
      if (!frames.length) return;
      vm.stop(); // stop VM timers (this will also stop interpolation animations)
      stop(); // Clear any existing timers
      
      frameIndex = 0;
      playbackStartTime = Date.now();
      isPlaying = true;
      
      // Use requestAnimationFrame for smooth playback with ViewModel interpolation
      // Update at frame rate, but only when frame timestamps change
      let lastFrameIndex = -1;
      
      const updateFrame = () => {
        if (!isPlaying || frames.length === 0) {
          animationFrameId = null;
          return;
        }
        
        const currentTime = Date.now() - playbackStartTime;
        
        // Find the frame that should be playing now
        let prevFrameIndex = -1;
        let nextFrameIndex = -1;
        
        for (let i = 0; i < frames.length; i++) {
          if (frames[i].ts <= currentTime) {
            prevFrameIndex = i;
          } else {
            nextFrameIndex = i;
            break;
          }
        }
        
        // If we've passed all frames, stop
        if (prevFrameIndex < 0) {
          // Before first frame, use first frame value
          if (frames.length > 0) {
            const vals = frames[0].values;
            for (let i = 0; i < 6; i++) {
              vm.setValue(i, vals[i] !== undefined ? vals[i] : null, false, true); // smooth=false, value is normalized
            }
          }
          animationFrameId = requestAnimationFrame(updateFrame);
          return;
        }
        
        if (currentTime >= frames[frames.length - 1].ts) {
          // Past last frame - reset all values to null (initial state)
          for (let i = 0; i < 6; i++) {
            vm.setValue(i, null, false);
          }
          stop();
          return;
        }
        
        // Linear interpolation between frames
        const prevFrame = frames[prevFrameIndex];
        let interpolatedValues = prevFrame.values.slice();
        
        if (nextFrameIndex >= 0 && nextFrameIndex < frames.length) {
          const nextFrame = frames[nextFrameIndex];
          const prevTime = prevFrame.ts;
          const nextTime = nextFrame.ts;
          
          // Calculate interpolation factor (0 to 1)
          const t = nextTime > prevTime ? (currentTime - prevTime) / (nextTime - prevTime) : 0;
          const clampedT = Math.max(0, Math.min(1, t));
          
          // Interpolate each device value
          for (let i = 0; i < 6; i++) {
            const prevVal = prevFrame.values[i];
            const nextVal = nextFrame.values[i];
            
            if (prevVal !== null && prevVal !== undefined && nextVal !== null && nextVal !== undefined) {
              // Both values exist, interpolate
              interpolatedValues[i] = prevVal + (nextVal - prevVal) * clampedT;
            } else if (prevVal !== null && prevVal !== undefined) {
              // Only previous value exists, use it
              interpolatedValues[i] = prevVal;
            } else if (nextVal !== null && nextVal !== undefined) {
              // Only next value exists, use it
              interpolatedValues[i] = nextVal;
            } else {
              // Neither value exists
              interpolatedValues[i] = null;
            }
          }
        }
        
        // Update values with interpolated values (smooth=false to use replay-side interpolation)
        for (let i = 0; i < 6; i++) {
          vm.setValue(i, interpolatedValues[i] !== undefined ? interpolatedValues[i] : null, false, true); // smooth=false, value is normalized
        }
        
        // Continue animation loop
        animationFrameId = requestAnimationFrame(updateFrame);
      };
      
      // Start animation loop
      animationFrameId = requestAnimationFrame(updateFrame);
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

