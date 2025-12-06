import { LogEntry } from './LogEntry.js';

function safeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export class SessionLog {
  constructor({ id = safeId(), name = 'session', startedAt = new Date(), endedAt = null, entries = [] } = {}) {
    this.id = id;
    this.name = name;
    this.startedAt = startedAt instanceof Date ? startedAt : new Date(startedAt || Date.now());
    this.endedAt = endedAt ? new Date(endedAt) : null;
    this.entries = Array.isArray(entries) ? entries : [];
  }

  addEntry(entry) {
    if (entry instanceof LogEntry) {
      this.entries.push(entry);
    }
  }

  finish(endedAt = new Date()) {
    this.endedAt = endedAt instanceof Date ? endedAt : new Date(endedAt || Date.now());
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      entries: this.entries.map((e) => e.toJSON())
    };
  }
}

