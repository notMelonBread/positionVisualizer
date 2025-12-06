@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo Pythonポータブル版のセットアップ
echo ========================================
echo.

set "PYTHON_VERSION=3.11.9"
set "PYTHON_URL=https://www.python.org/ftp/python/%PYTHON_VERSION%/python-%PYTHON_VERSION%-embed-amd64.zip"
set "PYTHON_ZIP=%~dp0python-portable.zip"
set "PYTHON_DIR=%~dp0python-portable"
set "GET_PIP_URL=https://bootstrap.pypa.io/get-pip.py"

REM 既に存在するか確認
if exist "%PYTHON_DIR%\python.exe" (
    echo [情報] ポータブル版Pythonは既にセットアップされています。
    echo 場所: %PYTHON_DIR%
    "%PYTHON_DIR%\python.exe" --version
    echo.
    pause
    exit /b 0
)

echo [情報] Pythonポータブル版をダウンロードします。
echo バージョン: %PYTHON_VERSION%
echo サイズ: 約25MB
echo.
set /p confirm="続行しますか？ (Y/N): "
if /i not "%confirm%"=="Y" (
    echo キャンセルしました。
    pause
    exit /b 0
)

echo.
echo [ダウンロード] Pythonポータブル版をダウンロードしています...
echo これには数分かかる場合があります...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $ProgressPreference = 'SilentlyContinue'; try { Invoke-WebRequest -Uri '%PYTHON_URL%' -OutFile '%PYTHON_ZIP%' -UseBasicParsing; exit 0 } catch { Write-Host $_.Exception.Message; exit 1 }"
if %errorlevel% neq 0 (
    echo [エラー] ダウンロードに失敗しました。
    echo インターネット接続を確認してください。
    pause
    exit /b 1
)

echo [展開] ファイルを展開しています...
if not exist "%PYTHON_DIR%" mkdir "%PYTHON_DIR%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; try { Expand-Archive -Path '%PYTHON_ZIP%' -DestinationPath '%PYTHON_DIR%' -Force; exit 0 } catch { Write-Host $_.Exception.Message; exit 1 }"
if %errorlevel% neq 0 (
    echo [エラー] 展開に失敗しました。
    pause
    exit /b 1
)

del "%PYTHON_ZIP%" >nul 2>&1

REM pipをセットアップ
echo.
echo [セットアップ] pipをインストールしています...
set "GET_PIP_SCRIPT=%PYTHON_DIR%\get-pip.py"
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $ProgressPreference = 'SilentlyContinue'; try { Invoke-WebRequest -Uri '%GET_PIP_URL%' -OutFile '%GET_PIP_SCRIPT%' -UseBasicParsing; exit 0 } catch { Write-Host $_.Exception.Message; exit 1 }"
if %errorlevel% equ 0 (
    "%PYTHON_DIR%\python.exe" "%GET_PIP_SCRIPT%" --quiet
    if %errorlevel% neq 0 (
        echo [警告] pipのインストールに失敗しました。
    ) else (
        echo [成功] pipのインストールが完了しました。
    )
    del "%GET_PIP_SCRIPT%" >nul 2>&1
) else (
    echo [警告] get-pip.pyのダウンロードに失敗しました。
)

REM python._pthファイルを修正してpipが動作するようにする
set "PYTHON_PTH=%PYTHON_DIR%\python311._pth"
if exist "%PYTHON_PTH%" (
    echo [セットアップ] python311._pthファイルを修正しています...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-Content '%PYTHON_PTH%') -replace '^#import site', 'import site' | Set-Content '%PYTHON_PTH%'"
    echo [成功] python311._pthファイルの修正が完了しました。
)

echo.
echo ========================================
echo [成功] セットアップが完了しました！
echo ========================================
echo.
echo 場所: %PYTHON_DIR%
"%PYTHON_DIR%\python.exe" --version
if exist "%PYTHON_DIR%\Scripts\pip.exe" (
    echo.
    echo pipのバージョン:
    "%PYTHON_DIR%\Scripts\pip.exe" --version
) else (
    echo.
    echo [警告] pipが見つかりません。手動でセットアップしてください。
)
echo.
echo 次回から start-visualizer.bat を実行すると、
echo 自動的にこのポータブル版Pythonが使用されます。
echo.
pause
