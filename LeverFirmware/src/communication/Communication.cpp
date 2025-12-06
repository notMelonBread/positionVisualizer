/**
 * Communication.cpp - レバーセンサーの通信機能の実装
 *
 * マイコン非依存のシリアル通信機能を実装したソースファイル。
 * マイコン依存部分はプリプロセッサマクロで切り替える設計とする。
 */

#include "Communication.h"

// コンストラクタ
Communication::Communication()
{
  _deviceId = "lever1"; // デフォルトID
  _lastCommand = "";
  _resetCalibCallback = nullptr;
  _setIdCallback = nullptr;
}

// 初期化
void Communication::begin(long baudRate)
{
  // すでにSerial.begin()が呼び出されているという前提
  // Serial.begin(baudRate); // 必要に応じて呼び出し

  Serial.println("通信機能初期化");
  Serial.println("利用可能なコマンド:");
  Serial.println("  GET_DATA - センサーデータ取得");
  Serial.println("  RESET_CALIB - キャリブレーションリセット");
  Serial.println("  SET_ID:xxxx - デバイスID設定");
}

// デバイスID設定
void Communication::setDeviceId(const char *id)
{
  _deviceId = String(id);
}

// データ送信（JSON形式）
void Communication::sendData(int rawValue, int smoothedValue, int calibratedValue,
                             bool isCalibrated, int calibMin, int calibMax, int errorCode)
{
  StaticJsonDocument<256> jsonDoc;

  // デバイスID
  jsonDoc["device_id"] = _deviceId;

  // タイムスタンプ
  jsonDoc["timestamp"] = getTimestamp();

  // センサー値
  JsonObject data = jsonDoc.createNestedObject("data");
  data["raw"] = rawValue;
  data["smoothed"] = smoothedValue;
  data["value"] = calibratedValue;
  data["calibrated"] = isCalibrated;
  data["calib_min"] = calibMin;
  data["calib_max"] = calibMax;

  // ステータス
  JsonObject status = jsonDoc.createNestedObject("status");
  status["error_code"] = errorCode;

  // JSONシリアライズ＆送信
  serializeJson(jsonDoc, Serial);
  Serial.println();
}

// コマンド受信処理
bool Communication::processCommands()
{
  if (Serial.available())
  {
    String command = Serial.readStringUntil('\n');
    command.trim();
    _lastCommand = command;

    // コマンド解析
    if (command == "GET_DATA")
    {
      handleGetData();
      return true;
    }
    else if (command == "RESET_CALIB")
    {
      handleResetCalib();
      return true;
    }
    else if (command.startsWith("SET_ID:"))
    {
      String newId = command.substring(7);
      handleSetId(newId);
      return true;
    }
    else
    {
      // 不明なコマンド
      Serial.print("{\"status\":\"ERROR\",\"message\":\"Unknown command: ");
      Serial.print(command);
      Serial.println("\"}");
      return false;
    }
  }

  return false;
}

// 最後に受信したコマンド
String Communication::getLastCommand()
{
  return _lastCommand;
}

// リセットキャリブレーションコールバック設定
void Communication::setResetCalibCallback(ResetCalibCallback callback)
{
  _resetCalibCallback = callback;
}

// IDセットコールバック設定
void Communication::setSetIdCallback(SetIdCallback callback)
{
  _setIdCallback = callback;
}

// GET_DATAコマンド処理
void Communication::handleGetData()
{
  // このコマンドは外部からの呼び出しが前提なので何もしない
  // データの送信はsendData()関数によって行われる
}

// RESET_CALIBコマンド処理
void Communication::handleResetCalib()
{
  if (_resetCalibCallback != nullptr)
  {
    _resetCalibCallback();
  }
  Serial.println("{\"status\":\"OK\",\"message\":\"Calibration reset\"}");
}

// SET_ID:xxxxコマンド処理
void Communication::handleSetId(const String &newId)
{
  if (_setIdCallback != nullptr)
  {
    _setIdCallback(newId);
  }
  _deviceId = newId;
  Serial.print("{\"status\":\"OK\",\"message\":\"ID set to ");
  Serial.print(newId);
  Serial.println("\"}");
}

// Unix時間を取得（マイコン依存部分）
unsigned long Communication::getTimestamp()
{
  // マイコンが未確定のため、現時点では簡易的な実装
  // 実際のUnix時間ではなく、起動からの経過時間（ミリ秒）を秒に変換
  return millis() / 1000;

  // 実際の実装は以下のようになる（ESP8266/ESP32の例）
  /*
  #if defined(ESP8266) || defined(ESP32)
    // NTPまたはRTCを使用して実際の時間を取得
    time_t now;
    time(&now);
    return now;
  #else
    // その他のマイコンの場合は起動時間を返す
    return millis() / 1000;
  #endif
  */
}