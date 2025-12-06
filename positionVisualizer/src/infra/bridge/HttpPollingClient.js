export class HttpPollingClient {
  constructor(endpoint = 'http://127.0.0.1:8123/state', intervalMs = 1500) {
    this.endpoint = endpoint;
    this.intervalMs = intervalMs;
    this.timer = null;
  }

  start(onState) {
    this.stop();
    const poll = async () => {
      try {
        const res = await fetch(this.endpoint, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (typeof onState === 'function') {
          onState(data);
        }
      } catch (_) {
        // ignore network failures
      }
    };
    poll();
    this.timer = setInterval(poll, this.intervalMs);
    return this.timer;
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

