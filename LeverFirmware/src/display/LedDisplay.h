/**
 * LedDisplay.h - LED表示機能
 * 【注意】このクラスは現在使用されていません。代わりにSingleLedDisplayクラスが使用されています。
 *
 * マイコン非依存のLED表示機能を提供するヘッダファイル。
 * 様々なLED表示パターンの制御を行う。
 */

#ifndef LEDDISPLAY_H
#define LEDDISPLAY_H

#include <Arduino.h>

class LedDisplay
{
public:
  // 表示モード
  enum DisplayMode
  {
    NORMAL,           // 通常表示（0-100の値）
    STARTUP_SEQUENCE, // 起動シーケンス
    CALIBRATING,      // キャリブレーション中
    CALIB_SUCCESS,    // キャリブレーション成功
    CALIB_FAILURE,    // キャリブレーション失敗
    ERROR_DISPLAY,    // エラー表示
    COMMUNICATION     // 通信中
  };

  LedDisplay();

  // 初期化（起動時に呼び出す）
  void begin();

  // LEDの数を設定
  void setLedCount(int count);

  // 表示を更新（毎ループで呼び出す）
  void update();

  // 値を表示（0-100）
  void setValue(int value);

  // 表示モードを設定
  void setDisplayMode(DisplayMode mode);

  // エラーコードを設定
  void setErrorCode(int errorCode);

private:
  int _ledCount;     // LEDの数
  int _value;        // 表示する値（0-100）
  DisplayMode _mode; // 現在の表示モード
  int _errorCode;    // エラーコード

  // アニメーション用変数
  unsigned long _lastUpdateTime;
  int _animationStep;
  bool _blinkState;

  // 各モードの表示処理
  void showNormal();
  void showStartupSequence();
  void showCalibrating();
  void showCalibSuccess();
  void showCalibFailure();
  void showError();
  void showCommunication();
};

#endif // LEDDISPLAY_H