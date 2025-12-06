/**
 * NetworkInterface.h - ネットワーク通信抽象インターフェース
 *
 * WiFi接続、HTTP/UDPサーバー機能の抽象化を提供するヘッダファイル。
 * テスト容易性を確保するため、実機とシミュレーション環境の両方で動作可能。
 */

#ifndef NETWORK_INTERFACE_H
#define NETWORK_INTERFACE_H

#include <Arduino.h>
#include <functional>

// ネットワーク接続状態
enum NetworkStatus {
  DISCONNECTED,    // 未接続
  CONNECTING,      // 接続中
  CONNECTED,       // 接続済み
  CONNECTION_ERROR // 接続エラー
};

// HTTP要求処理用のコールバック関数の型
using HttpRequestCallback = std::function<String(String)>;

/**
 * ネットワークインターフェース抽象クラス
 * WiFi接続、HTTP/UDPサーバー機能の基底インターフェース
 */
class INetworkManager {
public:
  virtual ~INetworkManager() {}

  // 初期化（起動時に呼び出す）
  virtual void begin() = 0;

  // 定期的に呼び出して接続状態を更新する
  virtual void update() = 0;

  // WiFi接続状態を取得
  virtual NetworkStatus getStatus() = 0;

  // ローカルIPアドレスを取得
  virtual String getLocalIP() = 0;

  // デバイスIDを設定
  virtual void setDeviceId(const String& deviceId) = 0;

  // デバイスIDを取得
  virtual String getDeviceId() = 0;

  // HTTPサーバー関連
  // API要求に対する応答を処理するコールバックを設定
  virtual void setApiHandler(HttpRequestCallback handler) = 0;

  // UDPディスカバリー関連
  // UDP検出要求への応答をON/OFFする
  virtual void enableDiscovery(bool enable) = 0;

  // レバー値の更新を通知（送信はしない、次回の要求時に返すためのキャッシュ）
  virtual void updateLeverValue(int rawValue, int calibratedValue, bool isCalibrated,
                              int minValue, int maxValue) = 0;

  // エラーコードを設定
  virtual void setErrorCode(uint8_t errorCode) = 0;

  // WiFi設定をリセット
  virtual void resetSettings() = 0;

  // 接続待ち
  virtual bool waitForConnection(unsigned long timeout = 10000) = 0;
};

#endif // NETWORK_INTERFACE_H