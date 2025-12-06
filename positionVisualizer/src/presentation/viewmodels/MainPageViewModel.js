import { ValueRange } from '../../domain/ValueRange.js';
import { DeviceConfig } from '../../domain/DeviceConfig.js';
import { DeviceState } from '../../domain/DeviceState.js';

export class MainPageViewModel {
  constructor({ valueRange = new ValueRange(), deviceConfigs = [] } = {}) {
    this.valueRange = valueRange;
    this.deviceConfigs = deviceConfigs.length
      ? deviceConfigs
      : Array.from({ length: 6 }, (_, i) => new DeviceConfig(i + 1));
    this.deviceStates = Array.from({ length: 6 }, (_, i) => DeviceState.empty(i + 1));
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

  setValueRange(range) {
    if (range instanceof ValueRange) {
      this.valueRange = range;
      this._emit();
    }
  }

  updateName(index, name) {
    if (index < 0 || index > 5 || !this.deviceConfigs[index]) return;
    this.deviceConfigs[index] = this.deviceConfigs[index].withChanges({ name });
    this._emit();
  }

  updateIcon(index, iconUrl) {
    if (index < 0 || index > 5 || !this.deviceConfigs[index]) return;
    this.deviceConfigs[index] = this.deviceConfigs[index].withChanges({ iconUrl });
    this._emit();
  }

  updateValues(normalizedValues = []) {
    const next = [];
    for (let i = 0; i < 6; i++) {
      const val = normalizedValues[i] ?? null;
      const current = this.deviceStates[i] || DeviceState.empty(i + 1);
      next.push(current.updateFromNormalized(val, this.valueRange));
    }
    this.deviceStates = next;
    this._emit();
  }

  applyStatePayload(payload = {}) {
    if (Array.isArray(payload.values)) {
      this.updateValues(payload.values);
    }
    if (Array.isArray(payload.names)) {
      payload.names.slice(0, 6).forEach((name, idx) => this.updateName(idx, name));
    }
    if (Array.isArray(payload.icons)) {
      payload.icons.slice(0, 6).forEach((icon, idx) => this.updateIcon(idx, icon));
    }
    if (payload.valueRange) {
      this.setValueRange(ValueRange.from(payload.valueRange));
    } else if (payload.minValue !== undefined || payload.maxValue !== undefined || payload.unit !== undefined) {
      this.setValueRange(
        this.valueRange.withChanges({
          min: payload.minValue,
          max: payload.maxValue,
          unit: payload.unit
        })
      );
    }
  }

  getSnapshot() {
    return {
      values: this.deviceStates.map((s) => s.normalized),
      actualValues: this.deviceStates.map((s) => s.actual),
      names: this.deviceConfigs.map((c) => c.name),
      icons: this.deviceConfigs.map((c) => c.iconUrl),
      valueRange: this.valueRange.toJSON()
    };
  }
}

