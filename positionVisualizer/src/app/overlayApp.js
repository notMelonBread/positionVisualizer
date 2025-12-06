import { OverlayViewModel } from '../presentation/viewmodels/OverlayViewModel.js';
import { OverlayBindings } from '../presentation/bindings/OverlayBindings.js';
import { OverlayChannel } from '../infra/sync/OverlayChannel.js';
import { LiveMonitorService } from '../usecases/LiveMonitorService.js';
import { WebSocketBridgeClient } from '../infra/bridge/WebSocketBridgeClient.js';
import { HttpPollingClient } from '../infra/bridge/HttpPollingClient.js';

function bootstrap() {
  const viewModel = new OverlayViewModel();
  const overlayChannel = new OverlayChannel();
  const liveMonitorService = new LiveMonitorService({
    bridgeClient: new WebSocketBridgeClient(),
    pollingClient: new HttpPollingClient()
  });

  const bindings = new OverlayBindings({
    viewModel,
    overlayChannel,
    liveMonitorService
  });

  bindings.attach();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

