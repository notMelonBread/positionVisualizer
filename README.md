# Encoder Monitor (ESP8266 + Qt Visualizer)
ESP8266（NodeMCU）でロータリーエンコーダの値を0–100に正規化して表示・配信し、Windows 等のPCで Python を使ってリアルタイム可視化（円/棒グラフ）する最小構成。

## ハードウェア（最低限）
- ESP8266 (NodeMCU)
- ポテンショメータ（3端子：VCC, AOut, GND）
- TM1637 4桁7セグLED（CLK, DIO, VCC, GND）
- キャリブ用タクトスイッチ（GNDに落とす）
- 5V/3.3V 電源（NodeMCUの3V3使用）
## 配線（NodeMCU 例）
- Pot：VCC→3V3, Analog→A0, GND→GND
- キャリブボタン：D3（内部プルアップ、押下＝LOW）
- TM1637：CLK=D1, DIO=D2, VCC→3V3, GND→GND

※ピンはスケッチ先頭の #define で変更可。

## 可視化アプリ（Python / Qt）
### 依存のインストール
```
# どちらか一方（PySide6推奨）
pip install PySide6
# or
pip install PyQt5

# 共通
pip install matplotlib requests
```
### 使い方
1. 「検出(UDP)」→ 同一LANのESP一覧取得
2. ✔を付けたデバイスが右側にキャンバスとして生成
3. /api を既定 200ms 周期でポーリング → 円／棒をリアルタイム更新
4. 「円グラフで表示」チェックで方式切替、周期はUIで変更可能
