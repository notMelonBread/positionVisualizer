export class WebSocketBridgeClient {
  constructor(url = 'ws://127.0.0.1:8123') {
    this.url = url;
    this.ws = null;
    this.reconnectTimer = null;
  }

  subscribe(onState) {
    this._connect(onState);
    return () => this._cleanup();
  }

  _cleanup() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try { this.ws.close(); } catch (_) {}
      this.ws = null;
    }
  }

  _connect(onState) {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this._cleanup();
    try {
      this.ws = new WebSocket(this.url);
    } catch (err) {
      this._scheduleReconnect(onState);
      return;
    }

    this.ws.onopen = () => {
      // ready
    };

    this.ws.onmessage = (event) => {
      const payload = this._parsePayload(event.data);
      if (payload && typeof onState === 'function') {
        onState(payload);
      }
    };

    this.ws.onerror = () => {
      this._scheduleReconnect(onState);
    };

    this.ws.onclose = () => {
      this._scheduleReconnect(onState);
    };
  }

  _scheduleReconnect(onState) {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._connect(onState);
    }, 1200);
  }

  _parsePayload(raw) {
    try {
      const data = JSON.parse(raw);
      if (data && data.type === 'state' && data.payload) {
        return data.payload;
      }
      if (Array.isArray(data.values)) {
        return data;
      }
      if (Array.isArray(data)) {
        // Legacy device entries, normalize into state payload
        const values = [null, null, null, null, null, null];
        data.forEach((item) => {
          const idx = this._deviceIndex(item.device_id || item.id);
          if (idx >= 0 && idx < 6 && typeof item.value === 'number') {
            values[idx] = Math.max(0, Math.min(100, item.value));
          }
        });
        return { values };
      }
    } catch (_) {
      // ignore parse errors
    }
    return null;
  }

  _deviceIndex(id) {
    if (id === null || id === undefined) return -1;
    if (typeof id === 'number') {
      return Math.max(0, Math.min(5, id - 1));
    }
    const match = String(id).match(/(\d+)$/);
    if (!match) return -1;
    const num = parseInt(match[1], 10);
    return Number.isFinite(num) ? num - 1 : -1;
  }
}

