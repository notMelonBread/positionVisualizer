export class LiveMonitorService {
  constructor({ bridgeClient, pollingClient } = {}) {
    this.bridgeClient = bridgeClient;
    this.pollingClient = pollingClient;
    this.unsubscribeWs = null;
  }

  start(onState) {
    this.stop();
    if (this.bridgeClient) {
      this.unsubscribeWs = this.bridgeClient.subscribe(onState);
    }
    if (this.pollingClient) {
      this.pollingClient.start(onState);
    }
  }

  stop() {
    if (this.unsubscribeWs) {
      try { this.unsubscribeWs(); } catch (_) {}
      this.unsubscribeWs = null;
    }
    if (this.pollingClient) {
      this.pollingClient.stop();
    }
  }
}

