export class DeviceState {
  constructor(id, { normalized = null, actual = null, connected = false } = {}) {
    this.id = id;
    this.normalized = normalized;
    this.actual = actual;
    this.connected = connected;
  }

  updateFromNormalized(normalizedValue, valueRange) {
    const normalized = normalizedValue === null || normalizedValue === undefined
      ? null
      : Math.max(0, Math.min(100, Number(normalizedValue)));
    const actual = normalized === null || !valueRange
      ? null
      : valueRange.denormalize(normalized);
    return new DeviceState(this.id, {
      normalized,
      actual,
      connected: normalized !== null
    });
  }

  static empty(id) {
    return new DeviceState(id, { normalized: null, actual: null, connected: false });
  }

  toJSON() {
    return {
      id: this.id,
      normalized: this.normalized,
      actual: this.actual,
      connected: this.connected
    };
  }
}

