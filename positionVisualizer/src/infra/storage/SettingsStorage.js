import { ValueRange } from '../../domain/ValueRange.js';
import { DeviceConfig } from '../../domain/DeviceConfig.js';

const RANGE_KEY = 'pv:valueRange';
const DEVICES_KEY = 'pv:deviceConfigs';

export class SettingsStorage {
  loadValueRange() {
    try {
      const raw = localStorage.getItem(RANGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return ValueRange.from(parsed);
    } catch (_) {
      return null;
    }
  }

  saveValueRange(range) {
    if (!range) return;
    try {
      localStorage.setItem(RANGE_KEY, JSON.stringify(range));
    } catch (_) {
      // ignore
    }
  }

  loadDeviceConfigs() {
    try {
      const raw = localStorage.getItem(DEVICES_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item) => DeviceConfig.from(item))
        .filter(Boolean);
    } catch (_) {
      return [];
    }
  }

  saveDeviceConfigs(configs) {
    if (!Array.isArray(configs)) return;
    try {
      localStorage.setItem(
        DEVICES_KEY,
        JSON.stringify(configs.map((c) => (c instanceof DeviceConfig ? c.toJSON() : c)))
      );
    } catch (_) {
      // ignore
    }
  }
}

