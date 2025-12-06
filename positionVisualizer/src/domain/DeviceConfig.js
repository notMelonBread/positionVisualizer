export class DeviceConfig {
  constructor(id, { name = '', ip = '', iconUrl = null } = {}) {
    this.id = id;
    this.name = name;
    this.ip = ip;
    this.iconUrl = iconUrl;
  }

  withChanges(next = {}) {
    return new DeviceConfig(this.id, {
      name: next.name ?? this.name,
      ip: next.ip ?? this.ip,
      iconUrl: next.iconUrl ?? this.iconUrl
    });
  }

  toJSON() {
    return { id: this.id, name: this.name, ip: this.ip, iconUrl: this.iconUrl };
  }

  static from(raw) {
    if (!raw || raw.id === undefined || raw.id === null) return null;
    return new DeviceConfig(raw.id, {
      name: raw.name,
      ip: raw.ip,
      iconUrl: raw.iconUrl
    });
  }
}

