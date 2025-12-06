// Generate log data with simultaneous independent device movements
// Each device moves independently to different target values at different times
// Devices can increase or decrease simultaneously

const fs = require('fs');
const path = require('path');

function generateLog() {
  const records = [];
  const totalDuration = 30000; // 30 seconds total
  const interval = 200; // 200ms sampling interval
  const tau = 0.5; // Time constant (0.5 seconds) for exponential movement
  
  // Interpolate value from start to target using exponential function
  // f(x) = target - (target - start) * e^(-x/tau)
  function interpolateValue(startValue, targetValue, elapsedTime) {
    const diff = targetValue - startValue;
    const value = targetValue - diff * Math.exp(-elapsedTime / tau);
    return Math.round(Math.max(0, Math.min(100, value)));
  }
  
  // Device state tracking
  class DeviceState {
    constructor(id) {
      this.id = id;
      this.currentValue = Math.floor(Math.random() * 101); // Random initial value 0-100
      this.targetValue = this.currentValue;
      this.startValue = this.currentValue; // Value at start of current movement
      this.movementStartTime = 0;
      this.isMoving = false;
      this.movementDuration = 0;
    }
    
    // Start a new movement to a random target
    startMovement(currentTime) {
      // Update current value to actual value at this moment (if moving, interpolate)
      if (this.isMoving) {
        this.currentValue = this.getValueAtTime(currentTime, false);
      }
      
      // Generate random target (different from current)
      let newTarget;
      do {
        newTarget = Math.floor(Math.random() * 101);
      } while (Math.abs(newTarget - this.currentValue) < 10); // At least 10 points difference
      
      this.startValue = this.currentValue;
      this.targetValue = newTarget;
      this.movementStartTime = currentTime;
      this.isMoving = true;
      // Random movement duration between 2-6 seconds
      this.movementDuration = 2000 + Math.random() * 4000;
    }
    
    // Get value at a given time
    getValueAtTime(currentTime, updateState = true) {
      if (!this.isMoving) {
        return this.currentValue;
      }
      
      const elapsed = (currentTime - this.movementStartTime) / 1000; // Convert to seconds
      
      if (elapsed >= this.movementDuration / 1000) {
        // Movement complete
        const finalValue = this.targetValue;
        if (updateState) {
          this.currentValue = finalValue;
          this.isMoving = false;
        }
        return finalValue;
      }
      
      // Interpolate during movement
      return interpolateValue(this.startValue, this.targetValue, elapsed);
    }
    
    // Check if should start new movement (random chance)
    shouldStartNewMovement(currentTime, minTimeBetweenMovements = 1000) {
      if (this.isMoving) return false;
      const timeSinceLastMovement = currentTime - (this.movementStartTime + this.movementDuration);
      if (timeSinceLastMovement < minTimeBetweenMovements) return false;
      
      // Random chance to start movement (higher chance as time passes)
      const chance = Math.min(0.3, (timeSinceLastMovement - minTimeBetweenMovements) / 5000);
      return Math.random() < chance;
    }
  }
  
  // Initialize 4 devices with random initial states
  const devices = [];
  for (let i = 1; i <= 4; i++) {
    const device = new DeviceState(i);
    // Random initial delay before first movement (0-3 seconds)
    device.movementStartTime = -Math.random() * 3000;
    devices.push(device);
  }
  
  // Generate records for all time points
  for (let t = 0; t <= totalDuration; t += interval) {
    for (const device of devices) {
      // Check if device should start a new movement
      if (device.shouldStartNewMovement(t)) {
        device.startMovement(t);
      }
      
      // Get current value
      const value = device.getValueAtTime(t);
      
      // Record value
      records.push({
        id: device.id,
        value: value,
        ts: t
      });
    }
  }
  
  // Sort by timestamp, then by device ID
  records.sort((a, b) => {
    if (a.ts !== b.ts) return a.ts - b.ts;
    return a.id - b.id;
  });
  
  // Ensure logs directory exists
  const logsDir = path.join(__dirname, 'positionVisualizer', 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  // Write to file
  const filename = path.join(logsDir, 'meter-log-simulated-30s-simultaneous.json');
  fs.writeFileSync(filename, JSON.stringify(records, null, 2), 'utf8');
  
  console.log(`Generated ${records.length} records`);
  console.log(`Total duration: ${totalDuration / 1000} seconds`);
  console.log(`Devices: 4 (independent simultaneous movements)`);
  console.log(`Saved to: ${filename}`);
  
  // Print sample values showing simultaneous movements
  console.log('\nSample values showing simultaneous movements (first 30 records):');
  records.slice(0, 30).forEach(r => {
    console.log(`  t=${r.ts}ms: device ${r.id} = ${r.value}`);
  });
  
  // Show example of simultaneous movement
  console.log('\nExample simultaneous movement (around 5000ms):');
  records.filter(r => r.ts >= 4800 && r.ts <= 5200).forEach(r => {
    console.log(`  t=${r.ts}ms: device ${r.id} = ${r.value}`);
  });
}

generateLog();

