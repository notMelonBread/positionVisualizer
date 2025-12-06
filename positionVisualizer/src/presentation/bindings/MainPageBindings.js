import { ValueRange } from '../../domain/ValueRange.js';
import { renderMeter, initMeter } from '../views/meterRenderer.js';
import { renderIconValues } from '../views/iconRenderer.js';

export class MainPageBindings {
  constructor({
    viewModel,
    liveMonitorService,
    recordingService,
    replayService,
    settingsService,
    iconService,
    overlayChannel
  } = {}) {
    this.viewModel = viewModel;
    this.liveMonitorService = liveMonitorService;
    this.recordingService = recordingService;
    this.replayService = replayService;
    this.settingsService = settingsService;
    this.iconService = iconService;
    this.overlayChannel = overlayChannel;
    this.container = null;
  }

  attach() {
    this.container = document.getElementById('meter-container');
    initMeter(this.container);

    this._hydrateFromSettings();
    this._bindRangeInputs();
    this._bindIconInputs();
    this._bindLogControls();

    this.viewModel.onChange((snapshot) => {
      renderMeter(this.container, snapshot.values, {
        names: snapshot.names,
        icons: snapshot.icons,
        icon: 'assets/icon.svg',
        valueRange: snapshot.valueRange,
        actualValues: snapshot.actualValues
      });
      renderIconValues(this.container, snapshot.actualValues, snapshot.valueRange.unit);
      this.overlayChannel?.broadcast(snapshot);
      this.settingsService?.saveValueRange(ValueRange.from(snapshot.valueRange));
      this.settingsService?.saveDeviceConfigs(this.viewModel.deviceConfigs);
      if (this.recordingService?.isRecording) {
        this.recordingService.record(snapshot.values);
        this._updateRecordingStatus();
      }
    });

    this.liveMonitorService?.start((payload) => {
      this.viewModel.applyStatePayload(payload || {});
    });

    this.viewModel._emit?.();
  }

  _hydrateFromSettings() {
    const range = this.settingsService?.loadValueRange();
    if (range) {
      this.viewModel.setValueRange(range);
      const minEl = document.getElementById('min-value');
      const maxEl = document.getElementById('max-value');
      const unitEl = document.getElementById('value-unit');
      if (minEl) minEl.value = range.min;
      if (maxEl) maxEl.value = range.max;
      if (unitEl) unitEl.value = range.unit;
    }
    const configs = this.settingsService?.loadDeviceConfigs() || [];
    configs.forEach((cfg, idx) => {
      this.viewModel.deviceConfigs[idx] = cfg;
    });
  }

  _bindRangeInputs() {
    const minEl = document.getElementById('min-value');
    const maxEl = document.getElementById('max-value');
    const unitEl = document.getElementById('value-unit');

    const syncRange = () => {
      const min = Number(minEl?.value);
      const max = Number(maxEl?.value);
      const unit = unitEl ? unitEl.value : '%';
      const next = this.viewModel.valueRange.withChanges({ min, max, unit });
      this.viewModel.setValueRange(next);
    };

    [minEl, maxEl, unitEl].forEach((el) => {
      if (!el) return;
      el.addEventListener('input', syncRange);
      el.addEventListener('change', syncRange);
    });
  }

  _bindIconInputs() {
    for (let i = 1; i <= 6; i++) {
      const input = document.getElementById(`device${i}-icon`);
      if (!input) continue;
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const url = String(reader.result || '');
          const configs = this.iconService?.updateIcon(this.viewModel.deviceConfigs, i - 1, url);
          if (configs) {
            this.viewModel.deviceConfigs = configs;
            this.viewModel.updateIcon(i - 1, url);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  }

  _bindLogControls() {
    const logFile = document.getElementById('log-file');
    const playBtn = document.getElementById('play-log');
    const stopBtn = document.getElementById('stop-log');
    const startRecordBtn = document.getElementById('start-record');
    const stopRecordBtn = document.getElementById('stop-record');

    if (playBtn && logFile) {
      playBtn.addEventListener('click', async () => {
        const file = logFile.files?.[0];
        if (!file) {
          alert('ログファイル（JSON）を選択してください');
          return;
        }
        const meta = await this.replayService.loadFile(file);
        if (meta.frameCount === 0) {
          alert('ログに再生可能なフレームがありません');
          return;
        }
        this.replayService.play((values) => this.viewModel.updateValues(values));
      });
    }

    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        this.replayService.stop();
      });
    }

    if (startRecordBtn) {
      startRecordBtn.addEventListener('click', () => {
        this.recordingService.start('session');
        this._updateRecordingStatus();
      });
    }

    if (stopRecordBtn) {
      stopRecordBtn.addEventListener('click', () => {
        const session = this.recordingService.stop({ save: true });
        this._updateRecordingStatus();
        if (session) {
          alert(`記録を保存しました (${session.entries.length} 件)`);
        }
      });
    }
  }

  _updateRecordingStatus() {
    const statusEl = document.getElementById('log-record-status');
    if (!statusEl) return;
    const status = this.recordingService?.getStatus() || { isRecording: false, recordCount: 0 };
    statusEl.textContent = status.isRecording
      ? `記録中... (${status.recordCount}件)`
      : '停止中';
    statusEl.style.color = status.isRecording ? '#d32f2f' : '#666';
  }
}

