# プロジェクト構造とテスト環境

## ディレクトリ構造

プロジェクトはArduino/ESP向けのベストプラクティスに従って以下の構造に整理されています：

```
LeverFirmware/
├── src/                    # メインソースコード
│   ├── core/               # コア機能
│   │   ├── Calibration.cpp
│   │   └── Calibration.h
│   ├── display/            # 表示機能
│   │   ├── LedDisplay.cpp
│   │   └── LedDisplay.h
│   ├── communication/      # 通信関連
│   │   ├── Communication.cpp
│   │   └── Communication.h
│   └── error/              # エラー処理
│       ├── ErrorHandler.cpp
│       └── ErrorHandler.h
├── include/                # グローバルヘッダー
├── test/                   # テストコード
│   ├── test_calibration/
│   ├── test_communication/
│   ├── test_error/
│   └── test_led_display/
├── tools/                  # 開発・テスト用ツール
│   └── serial_test_harness/ # シリアル通信テストハーネス
├── docs/                   # ドキュメント
├── scripts/                # ビルド・デプロイスクリプト
└── LeverFirmware.ino       # メインスケッチ
```

## テスト環境

### 1. PlatformIOテスト環境

プロジェクトは[PlatformIO](https://platformio.org/)を使ったテスト環境を整備しています。これにより、コードをマイコン上に実際にデプロイしなくても、PC上でユニットテストを実行できます。

#### セットアップ手順

1. PlatformIOをインストール（VSCode拡張機能として、またはコマンドラインツールとして）
2. プロジェクトルートディレクトリで以下のコマンドを実行

```bash
# ユニットテストを実行
platformio test -e native

# カバレッジレポートを生成するテスト
platformio test -e test_coverage
```

### 2. シリアル通信テストハーネス

実機と連携して動作確認するためのPythonスクリプトが用意されています。

#### 必要なパッケージ

```bash
pip install pyserial
```

#### 使用方法

```bash
# 対話モード
python tools/serial_test_harness/serial_test_harness.py --port [シリアルポート]

# 自動テストモード
python tools/serial_test_harness/serial_test_harness.py --port [シリアルポート] --auto

# ヘルプ
python tools/serial_test_harness/serial_test_harness.py --help
```

#### 機能

- データ取得：センサー値の取得と表示
- キャリブレーション：リセットと設定
- デバイスID設定：任意のIDを設定
- 応答時間テスト：通信の応答性能測定
- データモニタリング：一定時間のデータ監視
- テスト結果の保存：CSVファイルとして保存

### 3. テストカバレッジ評価

PlatformIO環境の`test_coverage`ターゲットを使用して、コードカバレッジレポートを生成できます。

#### レポート生成

```bash
platformio test -e test_coverage
```

このコマンドを実行すると、以下の処理が行われます：
1. テストコードがコンパイルされ実行される
2. LCOVツールを使ってカバレッジデータが収集される
3. HTMLレポートが `coverage_report/` ディレクトリに生成される

#### カバレッジ目標

- ライン・カバレッジ：80%以上
- 分岐カバレッジ：70%以上
- 関数カバレッジ：90%以上