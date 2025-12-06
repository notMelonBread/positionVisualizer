import { ValueRange } from '../../domain/ValueRange.js';
import { DeviceState } from '../../domain/DeviceState.js';

export class OverlayViewModel {
  constructor() {
    this.valueRange = new ValueRange();
    this.deviceStates = Array.from({ length: 6 }, (_, i) => DeviceState.empty(i + 1));
    this.names = Array(6).fill('');
    this.icons = Array(6).fill(null);
    this.listeners = new Set();
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((fn) => {
      try { fn(snapshot); } catch (_) {}
    });
  }

  applySnapshot(state = {}) {
    if (state.valueRange) {
      this.valueRange = ValueRange.from(state.valueRange);
    } else if (state.minValue !== undefined || state.maxValue !== undefined || state.unit !== undefined) {
      this.valueRange = this.valueRange.withChanges({
        min: state.minValue,
        max: state.maxValue,
        unit: state.unit
      });
    }
    if (Array.isArray(state.values)) {
      this.deviceStates = this.deviceStates.map((ds, idx) =>
        ds.updateFromNormalized(state.values[idx], this.valueRange)
      );
    }
    if (Array.isArray(state.names)) {
      this.names = state.names.slice(0, 6).concat(Array(6).fill('')).slice(0, 6);
    }
    if (Array.isArray(state.icons)) {
      this.icons = state.icons.slice(0, 6).concat(Array(6).fill(null)).slice(0, 6);
    }
    this._emit();
  }

  getSnapshot() {
    return {
      values: this.deviceStates.map((s) => s.normalized),
      actualValues: this.deviceStates.map((s) => s.actual),
      names: this.names.slice(0, 6),
      icons: this.icons.slice(0, 6),
      valueRange: this.valueRange.toJSON()
    };
  }
}

