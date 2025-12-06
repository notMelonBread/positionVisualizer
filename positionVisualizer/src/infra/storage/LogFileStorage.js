import { LogEntry } from '../../domain/LogEntry.js';
import { SessionLog } from '../../domain/SessionLog.js';

export class LogFileStorage {
  async loadFromFile(file) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    return this._parseEntries(parsed);
  }

  _parseEntries(raw) {
    if (Array.isArray(raw)) {
      return this._fromRecords(raw);
    }
    if (raw && Array.isArray(raw.records)) {
      return this._fromRecords(raw.records);
    }
    if (raw && Array.isArray(raw.entries)) {
      return raw.entries
        .map((e) => LogEntry.from(e))
        .filter(Boolean);
    }
    return [];
  }

  _fromRecords(records) {
    const byTs = new Map();
    records.forEach((rec) => {
      const ts = Number(rec.ts);
      const id = Number(rec.id);
      const val = Number(rec.value);
      if (!Number.isFinite(ts) || !Number.isFinite(id) || !Number.isFinite(val)) return;
      const index = Math.max(0, Math.min(5, id - 1));
      if (!byTs.has(ts)) {
        byTs.set(ts, [null, null, null, null, null, null]);
      }
      const arr = byTs.get(ts);
      arr[index] = Math.max(0, Math.min(100, val));
    });

    const sortedTs = Array.from(byTs.keys()).sort((a, b) => a - b);
    return sortedTs.map((ts) => new LogEntry(ts, byTs.get(ts)));
  }

  save(sessionLog, filename) {
    if (!(sessionLog instanceof SessionLog)) return;
    const records = [];
    sessionLog.entries.forEach((entry) => {
      entry.normalizedValues.forEach((value, idx) => {
        if (value === null || value === undefined) return;
        records.push({
          id: idx + 1,
          value: Math.round(value),
          ts: entry.timestamp
        });
      });
    });
    const json = JSON.stringify({ name: sessionLog.name, records }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const ts = new Date(sessionLog.startedAt || Date.now()).toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const finalName = filename || `meter-log-${ts}.json`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = finalName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  }
}

