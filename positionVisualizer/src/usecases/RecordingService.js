import { SessionLog } from '../domain/SessionLog.js';
import { LogEntry } from '../domain/LogEntry.js';

export class RecordingService {
  constructor({ logFileStorage } = {}) {
    this.logFileStorage = logFileStorage;
    this.session = null;
    this.isRecording = false;
    this.startedAt = null;
  }

  start(name = 'session') {
    this.session = new SessionLog({ name, startedAt: new Date() });
    this.isRecording = true;
    this.startedAt = performance.now();
  }

  record(values = []) {
    if (!this.isRecording || !this.session) return;
    const ts = Math.round(performance.now() - this.startedAt);
    this.session.addEntry(new LogEntry(ts, values));
  }

  stop({ save = true, filename } = {}) {
    if (!this.session) return null;
    this.isRecording = false;
    this.session.finish(new Date());
    if (save && this.logFileStorage) {
      this.logFileStorage.save(this.session, filename);
    }
    const finished = this.session;
    this.session = null;
    return finished;
  }

  getStatus() {
    return {
      isRecording: this.isRecording,
      recordCount: this.session ? this.session.entries.length : 0,
      startedAt: this.session ? this.session.startedAt : null
    };
  }
}

