@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo LeverScope を起動しています...
echo ========================================

REM ポータブル版Node.jsのパスを確認
set "NODE_PATH=%~dp0node-portable\node.exe"
set "NPM_PATH=%~dp0node-portable\npm.cmd"
set "USE_PORTABLE=0"

REM ポータブル版Node.jsが存在するか確認
if exist "%NODE_PATH%" (
    echo [確認] ポータブル版Node.jsを使用します。
    set "USE_PORTABLE=1"
    set "PATH=%~dp0node-portable;%PATH%"
    goto :check_dependencies
)

REM システムのNode.jsがインストールされているか確認
where node >nul 2>&1
if %errorlevel% equ 0 (
    echo [確認] システムのNode.jsを使用します。
    goto :check_dependencies
)

REM Node.jsが見つからない場合
echo [警告] Node.jsが見つかりません。
echo.
echo ポータブル版Node.jsが含まれていないようです。
echo.
echo 以下のいずれかの方法でNode.jsをインストールできます:
echo.
echo 1. 自動インストール（Chocolateyが必要、管理者権限が必要）
echo 2. 手動インストール（推奨）
echo 3. ポータブル版をダウンロード（システムにインストール不要）
echo.
set /p choice="選択してください (1/2/3): "

if "%choice%"=="1" goto :install_choco
if "%choice%"=="2" goto :install_manual
if "%choice%"=="3" goto :download_portable
goto :error_exit

:install_choco
echo.
echo [情報] Chocolateyを使用してNode.jsをインストールします...
echo 管理者権限が必要です。
echo.
powershell -Command "Start-Process cmd -ArgumentList '/c choco install nodejs -y && pause' -Verb RunAs"
if %errorlevel% equ 0 (
    echo [成功] Node.jsのインストールが開始されました。
    echo インストール完了後、再度このバッチファイルを実行してください。
    pause
    exit /b 0
) else (
    echo [エラー] Chocolateyのインストールに失敗しました。
    echo Chocolateyがインストールされていない場合は、先にインストールしてください。
    echo https://chocolatey.org/install
    pause
    exit /b 1
)

:install_manual
echo.
echo [情報] Node.jsのインストーラーをダウンロードします...
echo.
start https://nodejs.org/
echo.
echo ブラウザでNode.jsのダウンロードページが開きました。
echo インストール完了後、再度このバッチファイルを実行してください。
pause
exit /b 0

:download_portable
echo.
echo [情報] ポータブル版Node.jsをダウンロードします...
echo.
echo 注意: ポータブル版は約50MBのダウンロードが必要です。
set /p confirm="続行しますか？ (Y/N): "
if /i not "%confirm%"=="Y" goto :error_exit

REM ポータブル版Node.jsのダウンロード（Win32 x64版）
set "NODE_VERSION=v20.11.0"
set "NODE_URL=https://nodejs.org/dist/%NODE_VERSION%/node-%NODE_VERSION%-win-x64.zip"
set "NODE_ZIP=%~dp0node-portable.zip"
set "NODE_DIR=%~dp0node-portable"

echo [ダウンロード] Node.jsポータブル版をダウンロードしています...
powershell -Command "Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_ZIP%'"
if %errorlevel% neq 0 (
    echo [エラー] ダウンロードに失敗しました。
    pause
    exit /b 1
)

echo [展開] ファイルを展開しています...
powershell -Command "Expand-Archive -Path '%NODE_ZIP%' -DestinationPath '%NODE_DIR%' -Force"
if %errorlevel% neq 0 (
    echo [エラー] 展開に失敗しました。
    pause
    exit /b 1
)

REM 展開されたフォルダ内のnode-*フォルダをnode-portableにリネーム
for /d %%i in ("%NODE_DIR%\node-*") do (
    move "%%i\*" "%NODE_DIR%\" >nul 2>&1
    rmdir "%%i" >nul 2>&1
)

del "%NODE_ZIP%" >nul 2>&1
echo [成功] ポータブル版Node.jsの準備が完了しました。
set "USE_PORTABLE=1"
set "PATH=%NODE_DIR%;%PATH%"
goto :check_dependencies

:check_dependencies
REM Node.jsのバージョンを確認
if "%USE_PORTABLE%"=="1" (
    "%NODE_PATH%" --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo [エラー] ポータブル版Node.jsの起動に失敗しました。
        pause
        exit /b 1
    )
    "%NODE_PATH%" --version
) else (
    node --version
)

REM node_modulesが存在するか確認
if not exist "node_modules" (
    echo.
    echo [情報] 依存関係をインストールしています...
    if "%USE_PORTABLE%"=="1" (
        call "%NPM_PATH%" install
    ) else (
        call npm install
    )
    if %errorlevel% neq 0 (
        echo [エラー] 依存関係のインストールに失敗しました。
        pause
        exit /b 1
    )
)

REM bridge-server.jsを起動（新しいウィンドウで）
echo.
echo [起動] WebSocketサーバーを起動しています...
if "%USE_PORTABLE%"=="1" (
    start "Bridge Server" cmd /k "cd /d %~dp0 && %NODE_PATH% bridge-server.js"
) else (
    start "Bridge Server" cmd /k "cd /d %~dp0 && node bridge-server.js"
)
timeout /t 2 /nobreak >nul

REM メインウィンドウを起動
echo [起動] メインウィンドウを起動しています...
start "" "positionVisualizer\index.html"

REM 少し待ってからオーバーレイウィンドウを起動
timeout /t 1 /nobreak >nul
echo [起動] オーバーレイウィンドウを起動しています...
start "" "positionVisualizer\overlay.html"

echo.
echo ========================================
echo 起動完了しました。
echo ========================================
echo.
echo 注意: Bridge Serverウィンドウを閉じると、アプリが動作しなくなります。
echo 終了する場合は、Bridge Serverウィンドウを閉じてください。
echo.
timeout /t 3 /nobreak >nul
exit /b 0

:error_exit
echo.
echo [エラー] Node.jsのセットアップをキャンセルしました。
pause
exit /b 1
