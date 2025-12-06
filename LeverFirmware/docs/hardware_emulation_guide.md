# ハードウェアエミュレーションガイド

このドキュメントでは、レバー制御ファームウェアの開発とテストをハードウェアなしで行うためのエミュレーション環境のセットアップと使用方法について説明します。

## 1. エミュレーション環境の概要

ハードウェアエミュレーションには主に以下の手法を使用します：

1. **仮想ハードウェア（Wokwi）** - ブラウザ上でマイコンとセンサー/表示をシミュレーション
2. **ユニットテスト用のモック** - ArduinoFakeを使用したハードウェア依存部分の代替
3. **シリアル通信エミュレーター** - 仮想シリアルポートを使用した通信テスト
4. **統合テスト環境** - 複数のコンポーネントを連携させたテスト

## 2. PlatformIOを使用したネイティブ環境テスト

### 設定方法

PlatformIO環境で以下の設定を`platformio.ini`に追加します：

```ini
[env:native]
platform = native
lib_compat_mode = off
lib_deps =
    ArduinoFake
    Unity

[env:test_coverage]
platform = native
build_flags =
    -lgcov
    --coverage
    -g
    -O0
build_unflags = -Os
lib_deps =
    ArduinoFake
    Unity
```

### 実行方法

```bash
# ユニットテストの実行
platformio test -e native

# カバレッジレポートの生成
platformio test -e test_coverage
```

## 3. ArduinoFakeを使用したモックの作成

### 基本的なモック例

```cpp
#include <ArduinoFake.h>
using namespace fakeit;

void test_led_display() {
    // digitalWrite関数のモック化
    When(Method(ArduinoFake(), digitalWrite)).AlwaysReturn();

    // テスト対象のクラスを初期化
    LedDisplay display(LED_PIN);
    display.showValue(50);

    // digitalWrite関数が正しいパラメータで呼び出されたか検証
    Verify(Method(ArduinoFake(), digitalWrite).Using(LED_PIN, HIGH));
}
```

### ハードウェアインターフェースの抽象化

```cpp
// include/interfaces/IPotentiometer.h
class IPotentiometer {
public:
    virtual int read() = 0;
    virtual ~IPotentiometer() = default;
};

// 実際のハードウェア用の実装
class RealPotentiometer : public IPotentiometer {
private:
    int pin;
public:
    explicit RealPotentiometer(int pin) : pin(pin) {}
    int read() override {
        return analogRead(pin);
    }
};

// テスト用のモック実装
class MockPotentiometer : public IPotentiometer {
private:
    int value;
public:
    MockPotentiometer(int initialValue = 512) : value(initialValue) {}
    int read() override { return value; }
    void setValue(int newValue) { value = newValue; }
};
```

## 4. シリアル通信エミュレーター

### 仮想シリアルポートの作成（Linux）

```bash
# socat を使用して仮想シリアルポートのペアを作成
socat -d -d pty,raw,echo=0 pty,raw,echo=0
# 出力例: 2023/04/01 12:34:56 PTY is /dev/pts/2
#        2023/04/01 12:34:56 PTY is /dev/pts/3
```

### Pythonによるエミュレーター実装

```python
#!/usr/bin/env python3
# tools/serial_emulator/lever_emulator.py

import serial
import json
import time
import argparse
import signal
import sys

class LeverEmulator:
    def __init__(self, port, baud=115200):
        self.port = port
        self.baud = baud
        self.running = True
        self.ser = None
        self.value = 512
        self.calib_min = 0
        self.calib_max = 1023
        self.calibrated = True

    def connect(self):
        try:
            self.ser = serial.Serial(self.port, self.baud, timeout=1)
            print(f"エミュレーター起動: {self.port} @ {self.baud}bps")
            return True
        except serial.SerialException as e:
            print(f"エラー: {e}")
            return False

    def run(self):
        if not self.connect():
            return

        signal.signal(signal.SIGINT, self.signal_handler)

        while self.running:
            if self.ser.in_waiting:
                cmd = self.ser.readline().decode('utf-8').strip()
                response = self.handle_command(cmd)
                if response:
                    self.ser.write((response + '\n').encode('utf-8'))
            time.sleep(0.01)

        self.ser.close()

    def handle_command(self, cmd):
        print(f"受信コマンド: {cmd}")

        if cmd == "STATUS" or cmd == "GET":
            return self.get_status()
        elif cmd.startswith("CALIBRATE"):
            return self.calibrate(cmd)
        elif cmd.startswith("SET"):
            parts = cmd.split()
            if len(parts) >= 2:
                try:
                    self.value = int(parts[1])
                    return '{"status":"ok"}'
                except ValueError:
                    return '{"status":"error","message":"Invalid value"}'

        return '{"status":"error","message":"Unknown command"}'

    def get_status(self):
        calibrated_value = self.map_value()
        data = {
            "raw": self.value,
            "calibrated_value": calibrated_value,
            "calibrated": self.calibrated,
            "calib_min": self.calib_min,
            "calib_max": self.calib_max
        }
        return json.dumps(data)

    def calibrate(self, cmd):
        parts = cmd.split()
        if len(parts) >= 3:
            try:
                self.calib_min = int(parts[1])
                self.calib_max = int(parts[2])
                self.calibrated = True
                return '{"status":"ok","message":"Calibration complete"}'
            except ValueError:
                return '{"status":"error","message":"Invalid calibration values"}'
        return '{"status":"error","message":"Missing calibration parameters"}'

    def map_value(self):
        if not self.calibrated or self.calib_min == self.calib_max:
            return 0
        return max(0, min(100, int(100 * (self.value - self.calib_min) / (self.calib_max - self.calib_min))))

    def signal_handler(self, sig, frame):
        print("\nエミュレーターを停止します...")
        self.running = False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='レバーエミュレーター')
    parser.add_argument('port', help='シリアルポート名')
    parser.add_argument('-b', '--baud', type=int, default=115200, help='ボーレート (デフォルト: 115200)')
    args = parser.parse_args()

    emulator = LeverEmulator(args.port, args.baud)
    emulator.run()
```

### 使用例

```bash
# エミュレーターの起動
python tools/serial_emulator/lever_emulator.py /dev/pts/2

# 別のターミナルからテスト実行
python tools/serial_test_harness/serial_test_harness.py /dev/pts/3
```

## 5. Wokwi シミュレーターの利用

[Wokwi](https://wokwi.com/) はオンラインで Arduino や ESP マイコンをシミュレーションできるサービスです。

### セットアップ手順

1. [Wokwi](https://wokwi.com/) にアクセスし、新しいESP8266/ESP32プロジェクトを作成
2. 以下の構成をシミュレーター上に作成：
   - ESP8266/ESP32マイコン
   - ポテンショメータ（アナログ入力用）
   - 7セグメントLEDディスプレイ（TM1637）
   - ボタン（キャリブレーション用）
3. `diagram.json` をプロジェクトに追加：

```json
{
  "version": 1,
  "author": "Lever Firmware Team",
  "editor": "wokwi",
  "parts": [
    { "type": "wokwi-esp32-devkit-v1", "id": "esp", "top": 0, "left": 0, "attrs": {} },
    { "type": "wokwi-potentiometer", "id": "pot", "top": 150, "left": 20, "attrs": {} },
    { "type": "wokwi-tm1637-7segment", "id": "disp", "top": 50, "left": 200, "attrs": {} },
    { "type": "wokwi-pushbutton", "id": "btn", "top": 150, "left": 150, "attrs": { "color": "green" } }
  ],
  "connections": [
    [ "esp:TX", "$serialMonitor:RX", "", [] ],
    [ "esp:RX", "$serialMonitor:TX", "", [] ],
    [ "esp:GND.1", "pot:GND", "black", [] ],
    [ "esp:3V3", "pot:VCC", "red", [] ],
    [ "esp:D34", "pot:SIG", "green", [] ],
    [ "esp:D21", "disp:CLK", "blue", [] ],
    [ "esp:D22", "disp:DIO", "purple", [] ],
    [ "esp:GND.1", "disp:GND", "black", [] ],
    [ "esp:3V3", "disp:VCC", "red", [] ],
    [ "esp:D4", "btn:1.l", "green", [] ],
    [ "btn:2.l", "esp:GND.1", "black", [] ]
  ]
}
```

4. プロジェクトのソースコードを Wokwi に適用し、必要に応じて修正

## 6. Visual Studio Codeでの設定

### launch.json

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "PlatformIO Debug",
            "type": "platformio",
            "request": "launch",
            "args": ["--environment", "native", "--target", "test"]
        },
        {
            "name": "エミュレーター起動",
            "type": "python",
            "request": "launch",
            "program": "${workspaceFolder}/tools/serial_emulator/lever_emulator.py",
            "args": ["/dev/pts/2"],
            "console": "integratedTerminal"
        },
        {
            "name": "テストハーネス実行",
            "type": "python",
            "request": "launch",
            "program": "${workspaceFolder}/tools/serial_test_harness/serial_test_harness.py",
            "args": ["/dev/pts/3"],
            "console": "integratedTerminal"
        }
    ]
}
```

### tasks.json

```json
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "仮想シリアルポート作成",
            "type": "shell",
            "command": "socat -d -d pty,raw,echo=0 pty,raw,echo=0",
            "isBackground": true,
            "problemMatcher": {
                "pattern": {
                    "regexp": "PTY is (.*)",
                    "line": 1
                },
                "background": {
                    "activeOnStart": true,
                    "beginsPattern": ".",
                    "endsPattern": "."
                }
            }
        },
        {
            "label": "テスト実行",
            "type": "shell",
            "command": "platformio test -e native",
            "group": {
                "kind": "test",
                "isDefault": true
            }
        },
        {
            "label": "カバレッジ測定",
            "type": "shell",
            "command": "platformio test -e test_coverage",
            "group": "test"
        }
    ]
}
```

## 7. ハードウェアインターフェースの抽象化実装

### ディレクトリとファイルの構造

```
include/
└── interfaces/
    ├── ILedDisplay.h
    ├── IPotentiometer.h
    ├── ICommunication.h
    └── IStorage.h

src/
└── emulation/
    ├── EmulatedPotentiometer.cpp
    ├── EmulatedPotentiometer.h
    ├── EmulatedLedDisplay.cpp
    ├── EmulatedLedDisplay.h
    ├── EmulatedCommunication.cpp
    └── EmulatedCommunication.h
```

### インターフェース定義例

```cpp
// include/interfaces/IPotentiometer.h
#pragma once

class IPotentiometer {
public:
    virtual int read() = 0;
    virtual void setup() = 0;
    virtual bool isConnected() = 0;
    virtual ~IPotentiometer() = default;
};

// include/interfaces/ILedDisplay.h
#pragma once

class ILedDisplay {
public:
    virtual void setup() = 0;
    virtual void showValue(int value) = 0;
    virtual void showError(int errorCode) = 0;
    virtual void setBrightness(int level) = 0;
    virtual void clear() = 0;
    virtual ~ILedDisplay() = default;
};
```

### エミュレーション実装例

```cpp
// src/emulation/EmulatedPotentiometer.h
#pragma once

#include "interfaces/IPotentiometer.h"

class EmulatedPotentiometer : public IPotentiometer {
private:
    int value;
    bool connected;

public:
    EmulatedPotentiometer();
    void setup() override;
    int read() override;
    bool isConnected() override;
    void setValue(int newValue); // エミュレーション用の追加メソッド
};

// src/emulation/EmulatedPotentiometer.cpp
#include "emulation/EmulatedPotentiometer.h"

EmulatedPotentiometer::EmulatedPotentiometer() : value(512), connected(true) {}

void EmulatedPotentiometer::setup() {
    // エミュレーションでは何もしない
}

int EmulatedPotentiometer::read() {
    return value;
}

bool EmulatedPotentiometer::isConnected() {
    return connected;
}

void EmulatedPotentiometer::setValue(int newValue) {
    value = newValue;
}
```

## 8. テスト自動化スクリプト

```python
#!/usr/bin/env python3
# tools/run_emulation_tests.py

import subprocess
import time
import os
import signal
import sys
import argparse

def start_socat():
    """仮想シリアルポートのペアを作成"""
    process = subprocess.Popen(
        ["socat", "-d", "-d", "pty,raw,echo=0", "pty,raw,echo=0"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    # デバイス名を抽出
    ports = []
    for _ in range(2):
        line = process.stderr.readline().decode('utf-8').strip()
        if "PTY is " in line:
            port = line.split("PTY is ")[1]
            ports.append(port)

    if len(ports) != 2:
        print("エラー: 仮想シリアルポートの作成に失敗しました")
        process.kill()
        sys.exit(1)

    print(f"仮想シリアルポートを作成: {ports[0]} <-> {ports[1]}")
    return process, ports

def run_emulator(port):
    """エミュレーターの起動"""
    emulator_path = os.path.join(os.getcwd(), "tools/serial_emulator/lever_emulator.py")
    process = subprocess.Popen(["python3", emulator_path, port])
    print(f"エミュレーター起動: {port}")
    time.sleep(1)  # エミュレーター初期化待ち
    return process

def run_tests(port):
    """テストハーネスの実行"""
    test_path = os.path.join(os.getcwd(), "tools/serial_test_harness/serial_test_harness.py")
    print(f"テスト実行: {port}")
    result = subprocess.run(["python3", test_path, port, "--auto"])
    return result.returncode

def cleanup(processes):
    """プロセスの終了処理"""
    for process in processes:
        try:
            process.terminate()
            process.wait(timeout=1)
        except:
            process.kill()
    print("全プロセスを終了しました")

def main():
    parser = argparse.ArgumentParser(description='エミュレーションテスト自動実行')
    parser.add_argument('--skip-socat', action='store_true', help='socatの起動をスキップ')
    parser.add_argument('--emulator-port', help='エミュレーター用ポート')
    parser.add_argument('--test-port', help='テスト用ポート')
    args = parser.parse_args()

    processes = []
    ports = []

    try:
        if args.skip_socat and args.emulator_port and args.test_port:
            ports = [args.emulator_port, args.test_port]
        else:
            socat_process, ports = start_socat()
            processes.append(socat_process)

        emulator_process = run_emulator(ports[0])
        processes.append(emulator_process)

        exit_code = run_tests(ports[1])

        cleanup(processes)
        sys.exit(exit_code)

    except KeyboardInterrupt:
        print("\nテストを中断しました")
        cleanup(processes)
        sys.exit(1)
    except Exception as e:
        print(f"エラー: {e}")
        cleanup(processes)
        sys.exit(1)

if __name__ == "__main__":
    main()
```

## 9. 実装手順

1. **必要なライブラリのインストール**:
   ```bash
   # Pythonライブラリ
   pip install pyserial

   # PlatformIO環境
   platformio pkg install --global tool-scons
   platformio pkg install --library ArduinoFake
   platformio pkg install --library Unity
   ```

2. **インターフェースの抽象化**:
   - 現在のハードウェア依存コードを特定
   - 適切なインターフェースを定義
   - 実装クラスとエミュレーションクラスを作成

3. **エミュレーション環境のセットアップ**:
   - 仮想シリアルポート用のソフトウェアインストール
   - テストハーネスとエミュレーターの実装
   - VSCode設定ファイルの作成

4. **テストの作成と実行**:
   - ユニットテストでコア機能をテスト
   - エミュレーターを使用した統合テスト
   - カバレッジレポートの生成と分析

## 10. トラブルシューティング

### 一般的な問題と解決策

1. **"Arduino.h" ファイルが見つからない**:
   - `platformio.ini`に`framework = arduino`が指定されていることを確認
   - PlatformIOの場合、環境リフレッシュ: `platformio run -t clean`

2. **エミュレーターとの通信エラー**:
   - ポート設定が正しいことを確認
   - 権限問題: `sudo chmod 666 /dev/pts/*`

3. **テストが失敗する**:
   - モックが正しく設定されているか確認
   - インターフェースの実装が一致しているか確認

4. **カバレッジレポートが生成されない**:
   - 必要なツールのインストール: `sudo apt-get install lcov`
   - ビルドフラグの確認: `--coverage -lgcov`

## 11. 参考資料

- [PlatformIO Native Development](https://docs.platformio.org/en/latest/platforms/native.html)
- [ArduinoFake GitHub](https://github.com/FabioBatSilva/ArduinoFake)
- [Unity Test Framework](http://www.throwtheswitch.org/unity)
- [Wokwi Documentation](https://docs.wokwi.com/)
- [socat Manual](https://linux.die.net/man/1/socat)