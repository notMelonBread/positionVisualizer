export class OverlayChannel {
  constructor(name = 'meter-overlay') {
    this.name = name;
    this.channel = this._createChannel();
  }

  broadcast(state) {
    if (this.channel) {
      try {
        this.channel.postMessage(state);
      } catch (_) {
        // ignore
      }
    }
    try {
      localStorage.setItem('pv:overlay-state', JSON.stringify(state));
    } catch (_) {
      // ignore
    }
  }

  subscribe(handler) {
    const callback = (event) => {
      if (typeof handler === 'function') {
        handler(event.data);
      }
    };
    if (this.channel) {
      this.channel.addEventListener('message', callback);
    }
    window.addEventListener('storage', (e) => {
      if (e.key === 'pv:overlay-state' && typeof e.newValue === 'string') {
        try {
          const parsed = JSON.parse(e.newValue);
          handler && handler(parsed);
        } catch (_) {}
      }
    });

    // Fire once with cached value if available
    try {
      const cached = localStorage.getItem('pv:overlay-state');
      if (cached) {
        handler && handler(JSON.parse(cached));
      }
    } catch (_) {}

    return () => {
      if (this.channel) {
        this.channel.removeEventListener('message', callback);
      }
    };
  }

  _createChannel() {
    try {
      return new BroadcastChannel(this.name);
    } catch (_) {
      return null;
    }
  }
}

