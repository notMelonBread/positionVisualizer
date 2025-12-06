export class ValueRange {
  constructor(min = 0, max = 100, unit = '%') {
    const safeMin = Number.isFinite(min) ? min : 0;
    const safeMax = Number.isFinite(max) ? max : 100;
    this.min = safeMin;
    this.max = safeMax > safeMin ? safeMax : safeMin + 1;
    this.unit = unit || '%';
  }

  normalize(value) {
    if (value === null || value === undefined || Number.isNaN(value)) return null;
    const clamped = this.clamp(value);
    const range = this.max - this.min;
    if (range === 0) return 0;
    return Math.max(0, Math.min(100, ((clamped - this.min) / range) * 100));
  }

  denormalize(percentage) {
    if (percentage === null || percentage === undefined || Number.isNaN(percentage)) return null;
    const clamped = Math.max(0, Math.min(100, percentage));
    const range = this.max - this.min;
    return this.min + (clamped / 100) * range;
  }

  clamp(value) {
    if (!Number.isFinite(value)) return this.min;
    return Math.max(this.min, Math.min(this.max, value));
  }

  withChanges(next = {}) {
    return new ValueRange(
      next.min ?? this.min,
      next.max ?? this.max,
      next.unit ?? this.unit
    );
  }

  toJSON() {
    return { min: this.min, max: this.max, unit: this.unit };
  }

  static from(raw) {
    if (!raw) return new ValueRange();
    return new ValueRange(raw.min, raw.max, raw.unit);
  }
}

