#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
キャッシュモジュール

このモジュールは、アプリケーション全体で使用される各種キャッシュの実装を提供します。
TTL（Time To Live）付きのキャッシュ機能により、高頻度アクセス時のパフォーマンスを最適化します。
"""

import time
import logging
from datetime import datetime
from threading import Lock

# ロギング設定
logger = logging.getLogger(__name__)

class ValueCache:
    """デバイス値のキャッシュを管理するクラス"""

    def __init__(self, default_ttl=5.0):
        """
        初期化

        Args:
            default_ttl (float): デフォルトのキャッシュ有効期間（秒）
        """
        self.cache = {}  # {key: {'value': any, 'timestamp': float, 'ttl': float}}
        self.default_ttl = default_ttl
        self.lock = Lock()  # スレッドセーフ操作のためのロック
        self.hit_count = 0  # キャッシュヒット数
        self.miss_count = 0  # キャッシュミス数
        self.created_at = time.time()  # キャッシュ作成時間

    def get(self, key, ttl=None):
        """
        キャッシュから値を取得

        Args:
            key (str): キャッシュキー
            ttl (float, optional): このリクエスト用のTTL（指定がなければデフォルト値）

        Returns:
            any: キャッシュされた値、または無効/不存在の場合はNone
        """
        with self.lock:
            current_time = time.time()
            ttl = ttl if ttl is not None else self.default_ttl

            if key in self.cache:
                cache_entry = self.cache[key]
                # キャッシュが有効期限内かチェック
                if current_time - cache_entry['timestamp'] < cache_entry['ttl']:
                    self.hit_count += 1
                    logger.debug(f"キャッシュヒット: {key}")
                    return cache_entry['value']
                else:
                    # 有効期限切れのエントリを削除
                    del self.cache[key]
                    logger.debug(f"キャッシュ期限切れ: {key}")

            self.miss_count += 1
            logger.debug(f"キャッシュミス: {key}")
            return None

    def set(self, key, value, ttl=None):
        """
        値をキャッシュに保存

        Args:
            key (str): キャッシュキー
            value (any): 保存する値
            ttl (float, optional): このエントリのTTL（指定がなければデフォルト値）

        Returns:
            bool: 保存が成功した場合True
        """
        with self.lock:
            ttl = ttl if ttl is not None else self.default_ttl
            self.cache[key] = {
                'value': value,
                'timestamp': time.time(),
                'ttl': ttl
            }
            logger.debug(f"キャッシュ保存: {key}, TTL: {ttl}秒")
            return True

    def invalidate(self, key=None):
        """
        キャッシュを無効化

        Args:
            key (str, optional): 無効化するキー。Noneの場合は全て無効化

        Returns:
            int: 無効化されたエントリ数
        """
        with self.lock:
            if key:
                if key in self.cache:
                    del self.cache[key]
                    logger.debug(f"キャッシュ無効化: {key}")
                    return 1
                return 0
            else:
                count = len(self.cache)
                self.cache.clear()
                logger.debug(f"全キャッシュ無効化: {count}エントリ")
                return count

    def get_or_set(self, key, value_func, ttl=None):
        """
        キャッシュから値を取得するか、なければ関数を実行して設定

        Args:
            key (str): キャッシュキー
            value_func (callable): キャッシュミス時に値を生成する関数
            ttl (float, optional): キャッシュTTL（指定がなければデフォルト値）

        Returns:
            any: キャッシュまたは新しく生成された値
        """
        with self.lock:
            # キャッシュチェック
            value = self.get(key, ttl)
            if value is not None:
                return value

            # キャッシュがなければ関数を実行して値を取得
            value = value_func()
            if value is not None:
                self.set(key, value, ttl)
            return value

    def cleanup(self, force=False):
        """
        期限切れのキャッシュエントリを削除

        Args:
            force (bool): Trueの場合、有効期限内でも古いエントリを削除

        Returns:
            int: 削除されたエントリ数
        """
        with self.lock:
            current_time = time.time()
            keys_to_remove = []

            # 期限切れのエントリを特定
            for key, entry in self.cache.items():
                if current_time - entry['timestamp'] >= entry['ttl']:
                    keys_to_remove.append(key)
                elif force and len(self.cache) > 100:
                    # キャッシュサイズが大きい場合、古いエントリを削除（任意の上限数）
                    if current_time - entry['timestamp'] > self.default_ttl * 2:
                        keys_to_remove.append(key)

            # 特定したエントリを削除
            for key in keys_to_remove:
                del self.cache[key]

            logger.debug(f"キャッシュクリーンアップ: {len(keys_to_remove)}エントリ削除")
            return len(keys_to_remove)

    def get_stats(self):
        """
        キャッシュの統計情報を取得

        Returns:
            dict: キャッシュ統計情報
        """
        with self.lock:
            total_requests = self.hit_count + self.miss_count
            hit_rate = (self.hit_count / total_requests) * 100 if total_requests > 0 else 0

            return {
                'size': len(self.cache),
                'hit_count': self.hit_count,
                'miss_count': self.miss_count,
                'hit_rate': hit_rate,
                'uptime': time.time() - self.created_at
            }


class StatsCache(ValueCache):
    """統計情報のキャッシュを管理する特殊化されたクラス"""

    def __init__(self, default_ttl=1.0):
        """
        初期化

        Args:
            default_ttl (float): デフォルトのキャッシュ有効期間（秒）
        """
        super().__init__(default_ttl)

    def adaptive_ttl(self, value, min_ttl=0.5, max_ttl=5.0):
        """
        データ特性に基づいて適応的TTLを計算

        Args:
            value (dict): キャッシュする値（統計情報）
            min_ttl (float): 最小TTL（秒）
            max_ttl (float): 最大TTL（秒）

        Returns:
            float: 算出されたTTL（秒）
        """
        # デバイス数や更新頻度に基づいてTTLを調整
        # より多くのデバイス = 統計が変化しにくい = 長いTTL
        device_count = value.get('count', 0)
        online_count = value.get('online_count', 0)

        # オンラインデバイスが多いほどTTLを長く設定（ただし最大値制限あり）
        ttl = min(max_ttl, max(min_ttl, online_count * 0.3))

        # オンラインデバイスがなければTTLを短くする（データの変化を期待）
        if online_count == 0:
            ttl = min_ttl

        logger.debug(f"適応的TTL計算: デバイス数={device_count}, オンライン数={online_count}, TTL={ttl}秒")
        return ttl


class SummaryCache(ValueCache):
    """サマリー情報のキャッシュを管理する特殊化されたクラス"""

    def __init__(self, default_ttl=2.0):
        """
        初期化

        Args:
            default_ttl (float): デフォルトのキャッシュ有効期間（秒）
        """
        super().__init__(default_ttl)

    def adaptive_ttl(self, value, min_ttl=0.5, max_ttl=5.0):
        """
        データ特性に基づいて適応的TTLを計算

        Args:
            value (dict): キャッシュする値（サマリー情報）
            min_ttl (float): 最小TTL（秒）
            max_ttl (float): 最大TTL（秒）

        Returns:
            float: 算出されたTTL（秒）
        """
        # サマリーのデバイス情報に基づいてTTLを調整
        devices = value.get('devices', [])
        device_count = len(devices)
        online_devices = [d for d in devices if d.get('status') == 'online']
        online_count = len(online_devices)

        # デバイス数とオンライン率によってTTL調整
        if device_count > 0:
            online_ratio = online_count / device_count
            # オンライン率が高いほど値は変化する可能性が高いためTTLを短く
            ttl = min(max_ttl, max(min_ttl, 3.0 - 2.0 * online_ratio))
        else:
            ttl = min_ttl

        logger.debug(f"適応的TTL計算: デバイス数={device_count}, オンライン数={online_count}, TTL={ttl}秒")
        return ttl