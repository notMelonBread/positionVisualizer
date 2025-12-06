#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
レバーディスカバリーツール

ネットワーク上のレバーデバイスを検出するためのUDPディスカバリー実装。
単独で実行可能なテスト用ツールとしても機能します。
"""

import socket
import json
import time
import sys
from datetime import datetime

# 設定
UDP_PORT = 4210
DISCOVERY_TOKEN = "DISCOVER_LEVER"
BROADCAST_IP = "255.255.255.255"

def discover_devices(timeout=3):
    """
    UDPブロードキャストを使用してネットワーク上のレバーデバイスを検出する

    Args:
        timeout (int): スキャンのタイムアウト時間（秒）

    Returns:
        list: 検出されたデバイスのリスト
    """
    discovered_devices = []

    try:
        # UDPソケットの作成
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            # ブロードキャスト有効化
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            # タイムアウト設定
            sock.settimeout(2)

            # ディスカバリーパケットの送信
            print(f"ディスカバリーパケットをブロードキャスト中: {DISCOVERY_TOKEN}")
            sock.sendto(DISCOVERY_TOKEN.encode(), (BROADCAST_IP, UDP_PORT))

            # 応答の待機と処理
            print(f"{timeout}秒間応答を待機中...")
            start_time = time.time()
            while time.time() - start_time < timeout:
                try:
                    data, addr = sock.recvfrom(1024)
                    print(f"応答を受信: {addr[0]}:{addr[1]}")

                    # JSONレスポンスの解析
                    try:
                        response = json.loads(data.decode())
                        print(f"JSON応答: {response}")

                        if "type" in response and response["type"] == "lever":
                            device_id = response["id"]
                            ip = response["ip"]

                            device_info = {
                                "id": device_id,
                                "ip": ip,
                                "discovery_time": datetime.now().isoformat()
                            }

                            discovered_devices.append(device_info)
                            print(f"レバーデバイス発見: {device_id} ({ip})")

                    except json.JSONDecodeError:
                        print(f"無効なJSONレスポンス: {data}")

                except socket.timeout:
                    continue

    except Exception as e:
        print(f"エラー: {e}")

    return discovered_devices

if __name__ == "__main__":
    print("レバーディスカバリーツール")
    print("-------------------------")

    timeout = 3
    if len(sys.argv) > 1:
        try:
            timeout = int(sys.argv[1])
        except ValueError:
            pass

    print(f"タイムアウト: {timeout}秒")

    devices = discover_devices(timeout)

    print("\n検出結果:")
    if not devices:
        print("デバイスが見つかりませんでした。")
    else:
        print(f"{len(devices)}台のデバイスが見つかりました:")
        for i, device in enumerate(devices):
            print(f"  {i+1}. ID: {device['id']}")
            print(f"     IP: {device['ip']}")
            print(f"     検出時刻: {device['discovery_time']}")