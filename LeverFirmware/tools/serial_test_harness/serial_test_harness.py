#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
シリアル通信テストハーネス

レバー制御ファームウェアのシリアル通信テスト用ツール。
コマンド送信と応答確認、自動テストを実行できます。
"""

import serial
import json
import time
import argparse
import os
import sys
import datetime
import csv

class LeverTestHarness:
    """レバー制御テストハーネスクラス"""

    def __init__(self, port, baud=115200):
        """初期化"""
        try:
            self.ser = serial.Serial(port, baud, timeout=1)
            time.sleep(2)  # 接続安定化待ち
            print(f"接続成功: {port} @ {baud}bps")
            self.data_log = []
            self.test_results = []
        except serial.SerialException as e:
            print(f"エラー: シリアルポートに接続できません: {e}")
            sys.exit(1)

    def send_command(self, command):
        """JSONコマンドを送信"""
        print(f"送信: {command}")
        self.ser.write((command + '\n').encode())
        time.sleep(0.1)
        return self.get_response()

    def get_response(self):
        """レスポンスを受信してJSONとして解析"""
        try:
            response = self.ser.readline().decode().strip()
            if response:
                print(f"受信: {response}")
                return json.loads(response)
            return None
        except json.JSONDecodeError:
            print(f"JSON解析エラー: {response}")
            return None
        except UnicodeDecodeError:
            print("デコードエラー: バイナリデータを受信")
            return None

    def get_data(self):
        """データ取得コマンド"""
        result = self.send_command("GET_DATA")
        if result:
            self.data_log.append({
                'timestamp': time.time(),
                'data': result
            })
        return result

    def reset_calibration(self):
        """キャリブレーションリセット"""
        return self.send_command("RESET_CALIB")

    def set_device_id(self, device_id):
        """デバイスID設定"""
        return self.send_command(f"SET_ID:{device_id}")

    def run_test_case(self, name, command_func, validation_func=None, args=None):
        """テストケース実行"""
        print(f"\nテストケース: {name}")
        start_time = time.time()

        # コマンド実行
        if args:
            response = command_func(*args)
        else:
            response = command_func()

        elapsed = time.time() - start_time

        # 結果検証
        result = True
        message = "OK"
        if validation_func:
            result, message = validation_func(response)

        # 結果記録
        test_result = {
            'name': name,
            'timestamp': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'duration_ms': round(elapsed * 1000, 2),
            'result': 'PASS' if result else 'FAIL',
            'message': message
        }
        self.test_results.append(test_result)

        # 結果表示
        if result:
            print(f"✅ {name}: 成功")
            if message != "OK":
                print(f"   {message}")
        else:
            print(f"❌ {name}: 失敗")
            print(f"   {message}")

        return result

    def run_automated_test(self):
        """自動テスト実行"""
        print("===== 自動テスト開始 =====")

        # 1. デバイスID設定テスト
        self.run_test_case(
            "デバイスID設定",
            self.set_device_id,
            lambda resp: (resp and resp.get("status") == "OK", "ステータスOKを受信"),
            ["test_lever"]
        )

        # 2. キャリブレーションリセットテスト
        self.run_test_case(
            "キャリブレーションリセット",
            self.reset_calibration,
            lambda resp: (resp and resp.get("status") == "OK", "ステータスOKを受信")
        )

        # 3. データ取得テスト
        def validate_data(response):
            if response and "data" in response:
                data = response["data"]
                return (True, f"生値: {data['raw']}, 平滑化値: {data['smoothed']}, 値: {data['value']}")
            return (False, "データフィールドがレスポンスにありません")

        self.run_test_case(
            "データ取得",
            self.get_data,
            validate_data
        )

        # 4. 応答時間テスト
        def run_response_time_test():
            iterations = 10
            total_time = 0

            for i in range(iterations):
                start = time.time()
                self.get_data()
                elapsed = time.time() - start
                total_time += elapsed

            return total_time / iterations

        def validate_response_time(avg_time):
            if avg_time < 0.1:
                return (True, f"平均応答時間: {avg_time:.4f}秒")
            else:
                return (False, f"平均応答時間: {avg_time:.4f}秒 (0.1秒以上)")

        self.run_test_case(
            "応答時間テスト (10回)",
            run_response_time_test,
            validate_response_time
        )

        print(f"\n===== テスト完了 {sum(1 for r in self.test_results if r['result']=='PASS')}/{len(self.test_results)} =====")

    def save_log(self, filename="test_log.json"):
        """テストログを保存"""
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.data_log, f, indent=2, ensure_ascii=False)
        print(f"データログを保存しました: {filename}")

    def save_test_results(self, filename="test_results.csv"):
        """テスト結果をCSVに保存"""
        if not self.test_results:
            print("テスト結果がありません")
            return

        with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['name', 'timestamp', 'duration_ms', 'result', 'message']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

            writer.writeheader()
            for result in self.test_results:
                writer.writerow(result)

        print(f"テスト結果を保存しました: {filename}")

def main():
    """メイン関数"""
    parser = argparse.ArgumentParser(description="レバー制御テストハーネス")
    parser.add_argument("--port", required=True, help="シリアルポート名")
    parser.add_argument("--baud", type=int, default=115200, help="ボーレート")
    parser.add_argument("--auto", action="store_true", help="自動テスト実行")
    parser.add_argument("--log", default="test_log.json", help="データログ保存ファイル名")
    parser.add_argument("--results", default="test_results.csv", help="テスト結果保存ファイル名")
    args = parser.parse_args()

    tester = LeverTestHarness(args.port, args.baud)

    if args.auto:
        tester.run_automated_test()
        tester.save_log(args.log)
        tester.save_test_results(args.results)
        return

    # 対話モード
    print("レバー制御テストハーネス")
    print("1. データ取得")
    print("2. キャリブレーションリセット")
    print("3. デバイスID設定")
    print("4. データモニター（60秒）")
    print("5. 応答時間テスト")
    print("6. 自動テスト実行")
    print("7. ログ保存")
    print("8. テスト結果保存")
    print("0. 終了")

    try:
        while True:
            choice = input("\n選択してください: ")

            if choice == "1":
                print(json.dumps(tester.get_data(), indent=2, ensure_ascii=False))
            elif choice == "2":
                print(json.dumps(tester.reset_calibration(), indent=2, ensure_ascii=False))
            elif choice == "3":
                device_id = input("新しいデバイスID: ")
                print(json.dumps(tester.set_device_id(device_id), indent=2, ensure_ascii=False))
            elif choice == "4":
                print("60秒間データをモニター（Ctrl+Cで中断）...")
                try:
                    for i in range(60):
                        data = tester.get_data()
                        if data and "data" in data:
                            print(f"生値: {data['data']['raw']}, "
                                f"平滑化値: {data['data']['smoothed']}, "
                                f"値: {data['data']['value']}")
                        time.sleep(1)
                except KeyboardInterrupt:
                    print("モニター中断")
            elif choice == "5":
                iterations = int(input("測定回数 (デフォルト: 10): ") or 10)
                total_time = 0
                for i in range(iterations):
                    start = time.time()
                    tester.get_data()
                    elapsed = time.time() - start
                    total_time += elapsed
                avg_time = total_time / iterations
                print(f"平均応答時間: {avg_time:.4f}秒 ({iterations}回測定)")
            elif choice == "6":
                tester.run_automated_test()
            elif choice == "7":
                filename = input("保存ファイル名 (デフォルト: test_log.json): ") or "test_log.json"
                tester.save_log(filename)
            elif choice == "8":
                filename = input("保存ファイル名 (デフォルト: test_results.csv): ") or "test_results.csv"
                tester.save_test_results(filename)
            elif choice == "0":
                break
            else:
                print("無効な選択です")
    except KeyboardInterrupt:
        print("\nプログラムを終了します")

if __name__ == "__main__":
    main()