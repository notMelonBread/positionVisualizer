#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
データ変換モジュール (BFF機能)

このモジュールは、フロントエンド向けのデータ変換ロジックを集中管理します。
デバイス情報や値データをフロントエンド用に整形するための関数が含まれています。
"""

from datetime import datetime

def format_timestamp(timestamp):
    """
    タイムスタンプを人間が読みやすいフォーマットに変換

    Args:
        timestamp (float): UNIXタイムスタンプ（秒単位）

    Returns:
        str: フォーマットされた日時文字列
    """
    if not timestamp:
        return "N/A"

    dt = datetime.fromtimestamp(timestamp)
    return dt.strftime("%Y-%m-%d %H:%M:%S")

def transform_device_for_frontend(device):
    """
    デバイス情報をフロントエンド用に変換

    Args:
        device (dict): 元のデバイス情報

    Returns:
        dict: フロントエンド用に整形されたデバイス情報
    """
    # デバイス情報がない場合は空辞書を返す
    if not device:
        return {}

    # 必要なフィールドを選択
    transformed = {
        "id": device.get("id", "unknown"),
        "name": device.get("name", "Unknown Device"),
        "status": device.get("status", "unknown"),
    }

    # オプションフィールドを追加
    if "ip" in device:
        transformed["ip"] = device["ip"]

    if "last_seen" in device:
        transformed["last_seen"] = device["last_seen"]
        transformed["last_seen_formatted"] = format_timestamp(device["last_seen"])

    return transformed

def transform_value_for_frontend(device_id, value_data, device_info=None):
    """
    デバイス値をフロントエンド用に変換

    Args:
        device_id (str): デバイスID
        value_data (dict): 元の値データ
        device_info (dict, optional): デバイス情報。指定されない場合はIDのみ使用。

    Returns:
        dict: フロントエンド用に整形された値データ
    """
    # 値データがない場合は空辞書を返す
    if not value_data:
        return {}

    # デバイス情報がなければ空の辞書を使用
    device_info = device_info or {}

    # 基本情報
    transformed = {
        "device_id": device_id,
        "name": device_info.get("name", "Unknown"),
        "value": value_data.get("value", 0),
    }

    # オプションフィールドを追加
    if "raw" in value_data:
        transformed["raw"] = value_data["raw"]

    if "timestamp" in value_data:
        transformed["timestamp"] = value_data["timestamp"]
        transformed["timestamp_formatted"] = format_timestamp(value_data["timestamp"])

    if "calibrated" in value_data:
        transformed["calibrated"] = value_data["calibrated"]

    return transformed

def transform_statistics_for_frontend(stats_data):
    """
    統計情報をフロントエンド用に変換

    Args:
        stats_data (dict): 元の統計情報

    Returns:
        dict: フロントエンド用に整形された統計情報
    """
    if not stats_data:
        return {}

    # 必要な統計情報をコピー
    transformed = stats_data.copy()

    # 生成時刻を追加
    transformed["generated_at"] = datetime.now().timestamp()
    transformed["generated_at_formatted"] = format_timestamp(transformed["generated_at"])

    return transformed

def transform_device_summary_for_frontend(devices, values):
    """
    デバイス一覧と値のサマリーをフロントエンド用に変換

    Args:
        devices (list): デバイス情報のリスト
        values (dict): デバイスIDをキーとする値データの辞書

    Returns:
        dict: フロントエンド用に整形されたサマリー情報
    """
    if not devices:
        return {"devices": [], "statistics": {}}

    # デバイス情報を変換
    transformed_devices = []
    for device in devices:
        device_id = device.get("id")
        transformed_device = transform_device_for_frontend(device)

        # 値データがあれば追加
        if device_id in values:
            value_data = values[device_id]
            transformed_device.update({
                "value": value_data.get("value", 0),
                "raw": value_data.get("raw", 0),
                "timestamp": value_data.get("timestamp", 0),
                "timestamp_formatted": format_timestamp(value_data.get("timestamp", 0))
            })

        transformed_devices.append(transformed_device)

    # オンラインデバイスだけの値リスト
    online_devices = [d for d in transformed_devices if d.get("status") == "online"]
    device_values = [d.get("value", 0) for d in online_devices if "value" in d]

    # 統計情報
    statistics = {
        "count": len(devices),
        "online_count": len(online_devices),
    }

    # 値が存在する場合のみ統計情報を追加
    if device_values:
        statistics.update({
            "average_value": sum(device_values) / len(device_values),
            "min_value": min(device_values),
            "max_value": max(device_values)
        })

    return {
        "devices": transformed_devices,
        "statistics": statistics
    }