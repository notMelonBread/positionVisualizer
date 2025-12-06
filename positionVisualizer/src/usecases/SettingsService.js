import { ValueRange } from '../domain/ValueRange.js';
import { DeviceConfig } from '../domain/DeviceConfig.js';

export class SettingsService {
  constructor({ settingsStorage } = {}) {
    this.settingsStorage = settingsStorage;
  }

  loadValueRange() {
    const stored = this.settingsStorage?.loadValueRange();
    return stored || new ValueRange();
  }

  saveValueRange(range) {
    this.settingsStorage?.saveValueRange(range);
  }

  loadDeviceConfigs(count = 6) {
    const stored = this.settingsStorage?.loadDeviceConfigs() || [];
    const configs = [];
    for (let i = 0; i < count; i++) {
      const existing = stored.find((c) => Number(c.id) === i + 1);
      configs.push(existing || new DeviceConfig(i + 1));
    }
    return configs;
  }

  saveDeviceConfigs(configs) {
    this.settingsStorage?.saveDeviceConfigs(configs);
  }
}

