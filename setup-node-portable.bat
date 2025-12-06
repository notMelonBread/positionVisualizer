@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo Node.jsポータブル版のセットアップ
echo ========================================
echo.

set "NODE_VERSION=v20.11.0"
set "NODE_URL=https://nodejs.org/dist/%NODE_VERSION%/node-%NODE_VERSION%-win-x64.zip"
set "NODE_ZIP=%~dp0node-portable.zip"
set "NODE_DIR=%~dp0node-portable"

REM 既に存在するか確認
if exist "%NODE_DIR%\node.exe" (
    echo [情報] ポータブル版Node.jsは既にセットアップされています。
    echo 場所: %NODE_DIR%
    pause
    exit /b 0
)

echo [情報] Node.jsポータブル版をダウンロードします。
echo バージョン: %NODE_VERSION%
echo サイズ: 約50MB
echo.
set /p confirm="続行しますか？ (Y/N): "
if /i not "%confirm%"=="Y" (
    echo キャンセルしました。
    pause
    exit /b 0
)

echo.
echo [ダウンロード] Node.jsポータブル版をダウンロードしています...
echo これには数分かかる場合があります...
powershell -Command "Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_ZIP%' -UseBasicParsing"
if %errorlevel% neq 0 (
    echo [エラー] ダウンロードに失敗しました。
    echo インターネット接続を確認してください。
    pause
    exit /b 1
)

echo [展開] ファイルを展開しています...
if not exist "%NODE_DIR%" mkdir "%NODE_DIR%"
powershell -Command "Expand-Archive -Path '%NODE_ZIP%' -DestinationPath '%NODE_DIR%' -Force"
if %errorlevel% neq 0 (
    echo [エラー] 展開に失敗しました。
    pause
    exit /b 1
)

REM 展開されたフォルダ内のnode-*フォルダをnode-portableにリネーム
for /d %%i in ("%NODE_DIR%\node-*") do (
    echo [整理] ファイルを整理しています...
    xcopy "%%i\*" "%NODE_DIR%\" /E /Y /Q >nul 2>&1
    rmdir /s /q "%%i" >nul 2>&1
)

del "%NODE_ZIP%" >nul 2>&1

echo.
echo ========================================
echo [成功] セットアップが完了しました！
echo ========================================
echo.
echo 場所: %NODE_DIR%
"%NODE_DIR%\node.exe" --version
echo.
echo.
pause

