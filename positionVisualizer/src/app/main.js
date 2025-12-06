import { MainPageViewModel } from '../presentation/viewmodels/MainPageViewModel.js';
import { MainPageBindings } from '../presentation/bindings/MainPageBindings.js';
import { LiveMonitorService } from '../usecases/LiveMonitorService.js';
import { RecordingService } from '../usecases/RecordingService.js';
import { ReplayService } from '../usecases/ReplayService.js';
import { SettingsService } from '../usecases/SettingsService.js';
import { IconService } from '../usecases/IconService.js';
import { WebSocketBridgeClient } from '../infra/bridge/WebSocketBridgeClient.js';
import { HttpPollingClient } from '../infra/bridge/HttpPollingClient.js';
import { LogFileStorage } from '../infra/storage/LogFileStorage.js';
import { SettingsStorage } from '../infra/storage/SettingsStorage.js';
import { OverlayChannel } from '../infra/sync/OverlayChannel.js';

function bootstrap() {
  const settingsStorage = new SettingsStorage();
  const settingsService = new SettingsService({ settingsStorage });
  const viewModel = new MainPageViewModel({
    valueRange: settingsService.loadValueRange(),
    deviceConfigs: settingsService.loadDeviceConfigs()
  });

  const logFileStorage = new LogFileStorage();
  const recordingService = new RecordingService({ logFileStorage });
  const replayService = new ReplayService({ logFileStorage });
  const iconService = new IconService({ settingsService });

  const liveMonitorService = new LiveMonitorService({
    bridgeClient: new WebSocketBridgeClient(),
    pollingClient: new HttpPollingClient()
  });

  const bindings = new MainPageBindings({
    viewModel,
    liveMonitorService,
    recordingService,
    replayService,
    settingsService,
    iconService,
    overlayChannel: new OverlayChannel()
  });

  bindings.attach();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

