export class LogEntry {
  constructor(timestamp, normalizedValues = []) {
    this.timestamp = Number(timestamp) || 0;
    // Normalize array length to 6
    const values = Array.isArray(normalizedValues) ? normalizedValues.slice(0, 6) : [];
    while (values.length < 6) values.push(null);
    this.normalizedValues = values.map((v) => {
      if (v === null || v === undefined) return null;
      return Math.max(0, Math.min(100, Number(v)));
    });
  }

  toJSON() {
    return { timestamp: this.timestamp, normalizedValues: this.normalizedValues };
  }

  static from(raw) {
    if (!raw) return null;
    if (Array.isArray(raw.normalizedValues)) {
      return new LogEntry(raw.timestamp, raw.normalizedValues);
    }
    return null;
  }
}

