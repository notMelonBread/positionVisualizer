/**
 * ErrorHandler.h - エラー検出と復帰処理
 *
 * レバー制御システムで発生するエラーを検出し、復帰処理を行うためのクラス。
 * 様々なエラー状態を監視し、適切な復帰手順を実装する。
 */

#ifndef ERROR_HANDLER_H
#define ERROR_HANDLER_H

#include <Arduino.h>

class ErrorHandler
{
public:
  // エラーコード定義
  enum ErrorCode
  {
    NO_ERROR = 0,            // エラーなし
    SENSOR_ERROR = 1,        // センサー読み取りエラー
    CALIBRATION_ERROR = 2,   // キャリブレーションデータエラー
    BUTTON_ERROR = 3,        // ボタン入力エラー
    COMMUNICATION_ERROR = 4, // 通信エラー
    MEMORY_ERROR = 5,        // メモリエラー
    SYSTEM_ERROR = 99        // 一般的なシステムエラー
  };

  ErrorHandler();

  // 初期化
  void begin();

  // エラー検出メソッド
  bool checkSensorError(int rawValue, int previousRaw[], int sampleCount);
  bool checkCalibrationData(int minValue, int maxValue, bool isCalibrated);
  bool checkButtonStuck(bool buttonState, unsigned long stuckDuration);
  bool checkCommunicationTimeout(unsigned long lastComTime, unsigned long timeoutLimit);

  // エラー状態設定
  void setError(ErrorCode code, bool active = true);

  // 現在のエラー状態を取得
  ErrorCode getCurrentError();

  // エラー状態クリア
  void clearError();

  // エラー処理
  bool handleError();

  // エラーがあるか確認
  bool hasError();

  // エラー回数取得
  int getErrorCount(ErrorCode code);

private:
  ErrorCode _currentError;       // 現在のエラーコード
  unsigned long _errorStartTime; // エラー発生時刻
  int _errorCounts[100];         // エラーコード別の発生回数
  bool _inRecovery;              // 復帰処理中フラグ

  // エラー復帰処理（エラーコード別）
  bool recoverFromSensorError();
  bool recoverFromCalibrationError();
  bool recoverFromButtonError();
  bool recoverFromCommunicationError();
  bool recoverFromMemoryError();
  bool recoverFromSystemError();
};

#endif // ERROR_HANDLER_H