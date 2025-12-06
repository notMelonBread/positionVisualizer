export class IconService {
  constructor({ settingsService } = {}) {
    this.settingsService = settingsService;
  }

  updateIcon(configs, index, iconUrl) {
    const next = configs.slice();
    if (!next[index]) return configs;
    next[index] = next[index].withChanges({ iconUrl });
    this.settingsService?.saveDeviceConfigs(next);
    return next;
  }
}

