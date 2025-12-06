/**
 * LedDisplay.cpp - LED表示機能の実装
 * 【注意】このクラスは現在使用されていません。代わりにSingleLedDisplayクラスが使用されています。
 *
 * マイコン非依存のLED表示機能を実装したソースファイル。
 * 実際のLED制御はマイコンごとに具体的な実装を追加する。
 */

#include "LedDisplay.h"

// コンストラクタ
LedDisplay::LedDisplay()
{
  _ledCount = 8; // デフォルトのLED数
  _value = 0;
  _mode = STARTUP_SEQUENCE;
  _errorCode = 0;
  _lastUpdateTime = 0;
  _animationStep = 0;
  _blinkState = false;
}

// 初期化
void LedDisplay::begin()
{
  // この関数内でピン設定などを行う
  // 現時点ではマイコン非依存のスタブ実装
  Serial.println("LED表示機能初期化");

  // 起動シーケンスを表示（5秒間）
  setDisplayMode(STARTUP_SEQUENCE);
}

// LEDの数を設定
void LedDisplay::setLedCount(int count)
{
  _ledCount = count;
}

// 表示を更新（毎ループで呼び出す）
void LedDisplay::update()
{
  // 現在のモードに応じた表示処理を実行
  switch (_mode)
  {
  case NORMAL:
    showNormal();
    break;
  case STARTUP_SEQUENCE:
    showStartupSequence();
    break;
  case CALIBRATING:
    showCalibrating();
    break;
  case CALIB_SUCCESS:
    showCalibSuccess();
    break;
  case CALIB_FAILURE:
    showCalibFailure();
    break;
  case ERROR_DISPLAY:
    showError();
    break;
  case COMMUNICATION:
    showCommunication();
    break;
  }
}

// 値を設定（0-100）
void LedDisplay::setValue(int value)
{
  // 0-100の範囲に制限
  _value = constrain(value, 0, 100);
}

// 表示モードを設定
void LedDisplay::setDisplayMode(DisplayMode mode)
{
  _mode = mode;
  _animationStep = 0;
  _lastUpdateTime = millis();
}

// エラーコードを設定
void LedDisplay::setErrorCode(int errorCode)
{
  _errorCode = errorCode;
}

// 通常モード: 値に応じたLEDの点灯
void LedDisplay::showNormal()
{
  // 値（0-100）に応じたLEDの点灯数を計算
  int ledsToLight = map(_value, 0, 100, 0, _ledCount);

  // ここでは実際のLED制御は行わず、シリアル出力のみ
  // 実際の実装では、ここでLEDを制御するコードを記述
  Serial.print("LED表示 [");
  for (int i = 0; i < _ledCount; i++)
  {
    if (i < ledsToLight)
    {
      Serial.print("*");
    }
    else
    {
      Serial.print("-");
    }
  }
  Serial.print("] 値: ");
  Serial.println(_value);
}

// 起動シーケンス: アニメーション表示
void LedDisplay::showStartupSequence()
{
  unsigned long currentTime = millis();

  // 200ms間隔でアニメーションステップを進める
  if (currentTime - _lastUpdateTime >= 200)
  {
    _lastUpdateTime = currentTime;
    _animationStep++;

    // アニメーションパターン（例: 左から右へ点灯）
    int pattern = _animationStep % (_ledCount * 2);

    Serial.print("起動シーケンス [");
    for (int i = 0; i < _ledCount; i++)
    {
      if (pattern < _ledCount)
      {
        // 左から右へ点灯
        if (i == pattern)
        {
          Serial.print("*");
        }
        else
        {
          Serial.print("-");
        }
      }
      else
      {
        // 右から左へ消灯
        if (i == (_ledCount * 2 - pattern - 1))
        {
          Serial.print("*");
        }
        else
        {
          Serial.print("-");
        }
      }
    }
    Serial.println("]");

    // 一定時間（5秒）経過したらNORMALモードに切り替える
    if (_animationStep >= 25)
    { // 5秒 = 25ステップ（200ms × 25）
      setDisplayMode(NORMAL);
    }
  }
}

// キャリブレーション中: 点滅表示
void LedDisplay::showCalibrating()
{
  unsigned long currentTime = millis();

  // 200ms間隔で点滅
  if (currentTime - _lastUpdateTime >= 200)
  {
    _lastUpdateTime = currentTime;
    _blinkState = !_blinkState;

    Serial.print("キャリブレーション中 [");
    if (_blinkState)
    {
      for (int i = 0; i < _ledCount; i++)
      {
        Serial.print("*");
      }
    }
    else
    {
      for (int i = 0; i < _ledCount; i++)
      {
        Serial.print("-");
      }
    }
    Serial.println("]");
  }
}

// キャリブレーション成功: 左から右へのアニメーション
void LedDisplay::showCalibSuccess()
{
  unsigned long currentTime = millis();

  // 100ms間隔でアニメーションステップを進める
  if (currentTime - _lastUpdateTime >= 100)
  {
    _lastUpdateTime = currentTime;
    _animationStep++;

    Serial.print("キャリブレーション成功 [");
    for (int i = 0; i < _ledCount; i++)
    {
      if (i <= _animationStep && _animationStep < _ledCount)
      {
        Serial.print("*");
      }
      else
      {
        Serial.print("-");
      }
    }
    Serial.println("]");

    // アニメーション完了後、通常モードに戻る
    if (_animationStep >= _ledCount + 5)
    { // +5は表示を少し長く維持する
      setDisplayMode(NORMAL);
    }
  }
}

// キャリブレーション失敗: 全点滅後に消灯
void LedDisplay::showCalibFailure()
{
  unsigned long currentTime = millis();

  // 200ms間隔で点滅
  if (currentTime - _lastUpdateTime >= 200)
  {
    _lastUpdateTime = currentTime;
    _animationStep++;
    _blinkState = !_blinkState;

    Serial.print("キャリブレーション失敗 [");
    if (_blinkState && _animationStep < 6)
    { // 3回点滅
      for (int i = 0; i < _ledCount; i++)
      {
        Serial.print("*");
      }
    }
    else
    {
      for (int i = 0; i < _ledCount; i++)
      {
        Serial.print("-");
      }
    }
    Serial.println("]");

    // 3回点滅後、通常モードに戻る
    if (_animationStep >= 6)
    {
      setDisplayMode(NORMAL);
    }
  }
}

// エラー表示: エラーコードに対応したパターン
void LedDisplay::showError()
{
  unsigned long currentTime = millis();

  // 500ms間隔で点滅
  if (currentTime - _lastUpdateTime >= 500)
  {
    _lastUpdateTime = currentTime;
    _blinkState = !_blinkState;

    // エラーコードに応じたパターン
    Serial.print("エラー表示 (コード ");
    Serial.print(_errorCode);
    Serial.print(") [");

    if (_blinkState)
    {
      for (int i = 0; i < _ledCount; i++)
      {
        Serial.print("*");
      }
    }
    else
    {
      for (int i = 0; i < _ledCount; i++)
      {
        Serial.print("-");
      }
    }
    Serial.println("]");
  }
}

// 通信中: 端のLEDが点滅
void LedDisplay::showCommunication()
{
  unsigned long currentTime = millis();

  // 通常表示をベースに、端のLEDが点滅
  showNormal();

  // 200ms間隔で点滅
  if (currentTime - _lastUpdateTime >= 200)
  {
    _lastUpdateTime = currentTime;
    _blinkState = !_blinkState;

    if (_blinkState)
    {
      Serial.println("通信中 [*]");
    }
    else
    {
      Serial.println("通信中 [ ]");
    }
  }
}