export class ReplayService {
  constructor({ logFileStorage } = {}) {
    this.logFileStorage = logFileStorage;
    this.entries = [];
    this._animId = null;
    this._onFrame = null;
  }

  async loadFile(file) {
    if (!this.logFileStorage || !file) return { frameCount: 0 };
    this.entries = await this.logFileStorage.loadFromFile(file);
    return { frameCount: this.entries.length };
  }

  stop() {
    if (this._animId !== null) {
      cancelAnimationFrame(this._animId);
      this._animId = null;
    }
  }

  play(onFrame) {
    if (!this.entries.length) return;
    this.stop();
    this._onFrame = onFrame;
    const firstTs = this.entries[0].timestamp;
    const lastTs = this.entries[this.entries.length - 1].timestamp;
    const startedAt = performance.now();

    const tick = () => {
      const elapsed = performance.now() - startedAt + firstTs;
      if (elapsed > lastTs) {
        this._emitFrame(this.entries[this.entries.length - 1].normalizedValues);
        this.stop();
        return;
      }

      // find prev/next entries
      let prev = this.entries[0];
      let next = this.entries[this.entries.length - 1];
      for (let i = 0; i < this.entries.length; i++) {
        const entry = this.entries[i];
        if (entry.timestamp <= elapsed) {
          prev = entry;
        } else {
          next = entry;
          break;
        }
      }

      if (prev === next || next.timestamp === prev.timestamp) {
        this._emitFrame(prev.normalizedValues);
      } else {
        const t = Math.max(0, Math.min(1, (elapsed - prev.timestamp) / (next.timestamp - prev.timestamp)));
        const values = prev.normalizedValues.map((v, idx) => {
          const nv = next.normalizedValues[idx];
          if (v === null && nv === null) return null;
          if (v === null) return nv;
          if (nv === null) return v;
          return v + (nv - v) * t;
        });
        this._emitFrame(values);
      }

      this._animId = requestAnimationFrame(tick);
    };

    this._animId = requestAnimationFrame(tick);
  }

  _emitFrame(values) {
    if (typeof this._onFrame === 'function') {
      this._onFrame(values);
    }
  }
}

