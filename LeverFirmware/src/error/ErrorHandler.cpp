/**
 * ErrorHandler.cpp - エラー検出と復帰処理の実装
 *
 * レバー制御システムにおけるエラー管理機能の実装。
 * センサー、キャリブレーション、通信などの各種エラーを検出し、適切な復帰処理を行う。
 */

#include "ErrorHandler.h"

// コンストラクタ
ErrorHandler::ErrorHandler()
{
  _currentError = NO_ERROR;
  _errorStartTime = 0;
  _inRecovery = false;

  // エラーカウントの初期化
  for (int i = 0; i < 100; i++)
  {
    _errorCounts[i] = 0;
  }
}

// 初期化
void ErrorHandler::begin()
{
  Serial.println("エラー処理システム初期化");
  clearError();
}

// センサーエラー検出
bool ErrorHandler::checkSensorError(int rawValue, int previousRaw[], int sampleCount)
{
  // センサー値が変化していないか確認（スタック検出）
  bool isStuck = true;
  for (int i = 0; i < sampleCount; i++)
  {
    if (previousRaw[i] != rawValue)
    {
      isStuck = false;
      break;
    }
  }

  // センサー値が範囲外でないか確認
  bool isOutOfRange = (rawValue < 0 || rawValue > 1023);

  // エラーがあればフラグ設定
  if (isStuck || isOutOfRange)
  {
    setError(SENSOR_ERROR);
    return true;
  }

  return false;
}

// キャリブレーションデータエラー検出
bool ErrorHandler::checkCalibrationData(int minValue, int maxValue, bool isCalibrated)
{
  // キャリブレーションが有効だがデータが異常（最小値＞最大値や範囲が狭すぎる）
  if (isCalibrated)
  {
    if (minValue >= maxValue || (maxValue - minValue) < 50)
    {
      setError(CALIBRATION_ERROR);
      return true;
    }
  }
  return false;
}

// ボタンエラー検出（スタック検出）
bool ErrorHandler::checkButtonStuck(bool buttonState, unsigned long stuckDuration)
{
  static bool lastButtonState = false;
  static unsigned long buttonPressStartTime = 0;

  // ボタン状態変化検出
  if (buttonState != lastButtonState)
  {
    lastButtonState = buttonState;
    buttonPressStartTime = millis();
  }
  else if (buttonState)
  { // ボタンが押されている
    if (millis() - buttonPressStartTime > stuckDuration)
    {
      // 長時間押されたままの状態はエラー
      setError(BUTTON_ERROR);
      return true;
    }
  }

  return false;
}

// 通信タイムアウト検出
bool ErrorHandler::checkCommunicationTimeout(unsigned long lastComTime, unsigned long timeoutLimit)
{
  // 最後の通信から一定時間経過しているかチェック
  if (millis() - lastComTime > timeoutLimit)
  {
    setError(COMMUNICATION_ERROR);
    return true;
  }
  return false;
}

// エラー状態設定
void ErrorHandler::setError(ErrorCode code, bool active)
{
  if (active)
  {
    _currentError = code;
    _errorStartTime = millis();
    _errorCounts[code]++;
    _inRecovery = false;

    // エラー発生ログ
    Serial.print("エラー発生: コード=");
    Serial.println(code);
  }
  else
  {
    clearError();
  }
}

// 現在のエラー状態を取得
ErrorHandler::ErrorCode ErrorHandler::getCurrentError()
{
  return _currentError;
}

// エラー状態クリア
void ErrorHandler::clearError()
{
  _currentError = NO_ERROR;
  _inRecovery = false;
}

// エラー処理
bool ErrorHandler::handleError()
{
  bool recovered = false;

  if (!_inRecovery)
  {
    _inRecovery = true;

    // エラーコード別の復帰処理
    switch (_currentError)
    {
    case SENSOR_ERROR:
      recovered = recoverFromSensorError();
      break;

    case CALIBRATION_ERROR:
      recovered = recoverFromCalibrationError();
      break;

    case BUTTON_ERROR:
      recovered = recoverFromButtonError();
      break;

    case COMMUNICATION_ERROR:
      recovered = recoverFromCommunicationError();
      break;

    case MEMORY_ERROR:
      recovered = recoverFromMemoryError();
      break;

    case SYSTEM_ERROR:
      recovered = recoverFromSystemError();
      break;

    case NO_ERROR:
      recovered = true;
      break;
    }

    if (recovered)
    {
      Serial.print("エラー復帰成功: コード=");
      Serial.println(_currentError);
      clearError();
    }
    else
    {
      Serial.print("エラー復帰処理中: コード=");
      Serial.println(_currentError);
    }
  }

  return recovered;
}

// エラーがあるか確認
bool ErrorHandler::hasError()
{
  return _currentError != NO_ERROR;
}

// エラー回数取得
int ErrorHandler::getErrorCount(ErrorCode code)
{
  return _errorCounts[code];
}

// センサーエラーからの復帰処理
bool ErrorHandler::recoverFromSensorError()
{
  // センサーエラーの場合、システムリセットまたは再初期化が必要かもしれない
  // とりあえず自動復帰を試みる（次のループで再チェック）
  return true;
}

// キャリブレーションエラーからの復帰処理
bool ErrorHandler::recoverFromCalibrationError()
{
  // デフォルトのキャリブレーション値に戻す
  // 実際の実装ではCalibrationクラスと連携する
  return true;
}

// ボタンエラーからの復帰処理
bool ErrorHandler::recoverFromButtonError()
{
  // 時間経過で自動復帰を試みる
  if (millis() - _errorStartTime > 5000)
  {
    return true;
  }
  return false;
}

// 通信エラーからの復帰処理
bool ErrorHandler::recoverFromCommunicationError()
{
  // 通信の再初期化を試みる
  // 実際の実装ではCommunicationクラスと連携する
  return true;
}

// メモリエラーからの復帰処理
bool ErrorHandler::recoverFromMemoryError()
{
  // メモリ関連エラーは重大なので、システムリセットが必要かもしれない
  return false; // 自動復帰は難しい
}

// システムエラーからの復帰処理
bool ErrorHandler::recoverFromSystemError()
{
  // 一般的なシステムエラーからの復帰
  // 深刻な場合はハードウェアリセットが必要かもしれない
  return false; // 自動復帰は難しい
}