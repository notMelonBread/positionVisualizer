# カバレッジ計測用スクリプト
Import("env")
import os
import sys
from platformio.util import get_project_dir

def generate_coverage(source, target, env):
    """テストカバレッジレポートを生成する"""
    print("==== テストカバレッジレポートを生成します ====")
    os.system("lcov --directory . --capture --output-file coverage.info")
    os.system("lcov --remove coverage.info '/usr/*' '*/ArduinoFake/*' --output-file coverage.info")
    os.system("lcov --list coverage.info")
    os.system("genhtml coverage.info --output-directory coverage_report")
    print("カバレッジレポート生成完了: " + os.path.join(get_project_dir(), "coverage_report/index.html"))

env.AddPostAction("$BUILD_DIR/${PROGNAME}", generate_coverage)