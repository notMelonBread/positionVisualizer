/**
 * Communication.h - レバーセンサーの通信機能
 *
 * マイコン非依存のシリアル通信機能を提供するヘッダファイル。
 * JSON形式でのデータ送信と、コマンド受信処理を含む。
 */

#ifndef COMMUNICATION_H
#define COMMUNICATION_H

#include <Arduino.h>
#include <ArduinoJson.h>

class Communication
{
public:
  Communication();

  // 初期化（起動時に呼び出す）
  void begin(long baudRate);

  // デバイスID設定
  void setDeviceId(const char *id);

  // データ送信（JSON形式）
  void sendData(int rawValue, int smoothedValue, int calibratedValue,
                bool isCalibrated, int calibMin, int calibMax, int errorCode = 0);

  // コマンド受信処理（定期的に呼び出す）
  bool processCommands();

  // 最後に受信したコマンド
  String getLastCommand();

  // コールバック関数の型定義
  typedef void (*ResetCalibCallback)();
  typedef void (*SetIdCallback)(const String &);

  // コールバック設定
  void setResetCalibCallback(ResetCalibCallback callback);
  void setSetIdCallback(SetIdCallback callback);

private:
  String _deviceId;
  String _lastCommand;

  // コマンドコールバック
  ResetCalibCallback _resetCalibCallback;
  SetIdCallback _setIdCallback;

  // コマンド処理関数
  void handleGetData();
  void handleResetCalib();
  void handleSetId(const String &newId);

  // Unix時間を取得（マイコン依存部分）
  unsigned long getTimestamp();
};

#endif // COMMUNICATION_H