#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
PedanticLeverController - テスト用UIサーバー

このモジュールはテスト用のUIサーバーを提供します。
本番環境では使用せず、動作確認用途のみに使用してください。
"""

import os
import sys
import logging
from flask import Flask, render_template, redirect, url_for

# 親ディレクトリのモジュールをインポートするためにパスを追加
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

# APIサーバーのインポート
from app import app as api_app

# ロギング設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('test_ui')

# テスト用UIアプリケーション設定
app = Flask(__name__,
            static_folder='static',
            template_folder='templates')

# CORS等の設定はAPIサーバーが行うので省略

# メインページ
@app.route('/')
def index():
    """テスト用UIのメインページを表示"""
    logger.info("テスト用UIが表示されました")
    return render_template('index.html')

# リアルタイムテストページ
@app.route('/realtime')
def realtime():
    """リアルタイムテスト用UIページを表示"""
    logger.info("リアルタイムテスト用UIが表示されました")
    return render_template('realtime.html')

# APIへのルーティング - すべてのAPIリクエストを本体のAPIサーバーにプロキシ
@app.route('/api/<path:subpath>', methods=['GET', 'POST', 'PUT', 'DELETE'])
def api_proxy(subpath):
    """APIリクエストを本体のAPIサーバーに転送"""
    # ここでは単純なリダイレクトを行う
    # 実際の開発では、フレームワークやライブラリを使った適切なプロキシ実装が必要
    return redirect(f'/{subpath}')

if __name__ == '__main__':
    # テスト用アプリケーション起動
    print("====================================================")
    print(" 警告: これはテスト用UIサーバーです")
    print(" 本番環境での使用は避けてください")
    print("====================================================")

    # APIサーバーを別プロセスで起動する方法を提示
    print("\n本来のAPIサーバーを起動するには:")
    print("  python ../app.py")
    print("\nテスト用UIサーバーを起動中...")

    # 開発モードでの起動
    app.run(host='0.0.0.0', port=5001, debug=True)