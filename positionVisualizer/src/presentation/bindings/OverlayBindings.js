import { initMeter, renderMeter } from '../views/meterRenderer.js';
import { renderIconValues } from '../views/iconRenderer.js';

export class OverlayBindings {
  constructor({ viewModel, overlayChannel, liveMonitorService } = {}) {
    this.viewModel = viewModel;
    this.overlayChannel = overlayChannel;
    this.liveMonitorService = liveMonitorService;
    this.container = null;
  }

  attach() {
    this.container = document.getElementById('meter-container');
    initMeter(this.container);

    this.viewModel.onChange((snapshot) => {
      renderMeter(this.container, snapshot.values, {
        names: snapshot.names,
        icons: snapshot.icons,
        icon: 'assets/icon.svg',
        valueRange: snapshot.valueRange,
        actualValues: snapshot.actualValues
      });
      renderIconValues(this.container, snapshot.actualValues, snapshot.valueRange.unit);
    });

    this.overlayChannel?.subscribe((state) => this.viewModel.applySnapshot(state));
    this.liveMonitorService?.start((state) => this.viewModel.applySnapshot(state));
    this.viewModel._emit?.();
  }
}

