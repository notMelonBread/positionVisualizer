# PedanticLeverController

## 概要

PedanticLeverControllerは、物理レバー（ポテンショメータ）の値を読み取り、処理し、ネットワーク経由で提供するシステムです。「白黒つけない会議」などでの使用に適したツールで、2つの主要コンポーネントから構成されています。

1. **LeverFirmware**: ESP8266/ESP32/Arduino用のファームウェア。ポテンショメータの値を読み取り、キャリブレーションし、ネットワーク経由で共有します。

2. **LeverAPI**: バックエンド・フォー・フロントエンド（BFF）として機能するAPIサーバー。レバーデバイスを自動検出し、それらからデータを収集、変換して、フロントエンドアプリケーションに提供します。

## ドキュメント

詳細な情報は各コンポーネントのドキュメントを参照してください：

### メインドキュメント

- [LeverFirmware README](./LeverFirmware/README.md) - ファームウェアの機能、ハードウェア要件、セットアップ方法など
- [LeverAPI README](./LeverAPI/README.md) - APIサーバーの機能、エンドポイント、使用方法など
- [API詳細ドキュメント](./LeverAPI/API_DOCUMENTATION.md) - 利用可能なAPIエンドポイントの詳細な説明

### 技術ドキュメント (ファームウェア)

- [プロジェクト構造](./LeverFirmware/docs/project_structure.md) - ファームウェアプロジェクトの詳細な構造と説明
- [テストガイド](./LeverFirmware/docs/testing_guide.md) - ユニットテストや統合テストの実行方法
- [ハードウェアエミュレーションガイド](./LeverFirmware/docs/hardware_emulation_guide.md) - シミュレーション環境でのテスト方法

## システム構成

```
         HTTP/WebSocket
      ┌─────────────────┐
      │                 │
 ┌────▼─────┐     ┌─────┴──────┐
 │LeverAPI  │◄────┤LeverFirmware│
 │(サーバー)│UDP   │(デバイス)   │
 └──────────┘     └─────────────┘
      │
      │HTTP/WebSocket
      ▼
┌───────────────┐
│フロントエンド  │
│アプリケーション│
└───────────────┘
```

## 通信プロトコル

1. **デバイスディスカバリー**:
   - UDPブロードキャスト（ポート4210）で「DISCOVER_LEVER」メッセージを送信
   - デバイスはJSONレスポンスで応答: `{"type":"lever","id":"[device-id]","ip":"[ip-address]"}`

2. **データフォーマット**:
   ```json
   {
     "device_id": "lever1",
     "timestamp": 1646916712,
     "data": {
       "raw": 512,
       "value": 50,
       "calibrated": true,
       "calib_min": 0,
       "calib_max": 1023
     },
     "status": {
       "error_code": 0
     }
   }
   ```

## 開発状況

基本的な機能は実装済みです。複数レバーの識別と管理機能は開発中です。