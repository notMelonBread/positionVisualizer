# PedanticLeverController BFF API Server

## 概要

このプロジェクトは、レバーデバイス（ポテンショメータ搭載ESP8266）を検出、監視、管理するための
BFF（Backend For Frontend）APIサーバーを提供します。

## 特徴

- UDP検出による自動デバイス検出
- デバイス状態と値のリアルタイム監視
- BFFとしてのデータ集約と変換機能
- シミュレーションモード対応
- 包括的なAPIドキュメント
- テスト用シンプルUI

## ディレクトリ構造

```
LeverAPI/
├── api/                     - APIコア機能モジュール
│   ├── __init__.py
│   ├── discovery.py         - デバイス検出機能
│   └── device_manager.py    - デバイス管理機能
├── test_ui/                 - テスト用UI（本番環境では使用しない）
│   ├── static/              - 静的ファイル
│   ├── templates/           - HTMLテンプレート
│   └── test_app.py          - テスト用UIサーバー
├── app.py                   - メインAPIサーバー（BFF実装）
├── requirements.txt         - 依存パッケージ
├── API_DOCUMENTATION.md     - API詳細ドキュメント
└── README.md                - このファイル
```

## 要件

- Python 3.7以上
- Flask 2.0.0以上
- その他の依存関係は`requirements.txt`を参照

## インストール

1. リポジトリをクローン：
```
git clone https://github.com/your-username/PedanticLeverController.git
cd PedanticLeverController
```

2. 依存パッケージのインストール：
```
pip install -r LeverAPI/requirements.txt
```

## 使用方法

### APIサーバーの起動

```
cd LeverAPI
python app.py
```

APIサーバーはデフォルトで`http://0.0.0.0:5000`でリッスンします。

### テスト用UIサーバーの起動

```
cd LeverAPI/test_ui
python test_app.py
```

テスト用UIは`http://0.0.0.0:5001`でアクセスできます。

## APIエンドポイント

すべてのAPIエンドポイントは `/api/` プレフィックス付きで提供されています：

### コアAPI
- `GET /api/devices` - 検出されたデバイスのリストを取得
- `GET /api/devices/{device_id}/value` - 特定デバイスの値を取得
- `GET /api/values` - すべてのデバイスの値を一括取得
- `POST /api/scan` - デバイス検出スキャンを実行
- `PUT /api/devices/{device_id}/name` - デバイス名を更新
- `GET /api/status` - APIサーバーのステータスを取得

### BFF機能エンドポイント
- `GET /api/statistics` - デバイス統計情報を取得
- `GET /api/devices/summary` - デバイス情報と値をまとめて取得
- `POST /api/batch` - 複数操作の一括処理

### シミュレーションモード
- `POST /api/simulation/toggle` - シミュレーションモードの切り替え
- `GET /api/simulation/status` - シミュレーションモードの状態確認

詳細なAPIドキュメントは`API_DOCUMENTATION.md`を参照してください。

## シミュレーションモード

シミュレーションモードはテスト環境で実際のデバイスなしでAPIの動作をテストするための機能です。

- `POST /api/simulation/toggle` - シミュレーションモードの切り替え
- `GET /api/simulation/status` - シミュレーションモードの状態確認
