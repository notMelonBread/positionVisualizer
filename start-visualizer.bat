@echo off
setlocal enabledelayedexpansion
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

REM Pythonがインストールされているか確認
where python >nul 2>&1
if %errorlevel% equ 0 (
    echo [確認] システムのPythonを使用します。
    for /f "delims=" %%i in ('where python') do set "PYTHON_CMD=%%i"
    set "PIP_CMD=pip"
    goto :check_python_venv
)

where py >nul 2>&1
if %errorlevel% equ 0 (
    echo [確認] システムのPythonを使用します。
    set "PYTHON_CMD=py"
    set "PIP_CMD=py -m pip"
    goto :check_python_venv
)

REM Pythonが見つからない場合
echo [警告] Pythonが見つかりません。
echo.
echo LeverAPIを起動するにはPythonが必要です。
echo Pythonをインストールしてください: https://www.python.org/downloads/
echo.
echo インストール後、このスクリプトを再度実行してください。
echo.
set /p continue="Pythonなしで続行しますか？ (Y/N): "
if /i not "!continue!"=="Y" goto :error_exit
goto :skip_api

:check_python_venv
REM LeverAPIの仮想環境を確認
if not exist "LeverAPI\venv" (
    echo.
    echo [情報] LeverAPIの仮想環境を作成しています...
    "%PYTHON_CMD%" -m venv "%~dp0LeverAPI\venv"
    if !errorlevel! neq 0 (
        echo [警告] 仮想環境の作成に失敗しました。Pythonを直接使用します。
        goto :check_api_deps
    )
    set "PYTHON_CMD=%~dp0LeverAPI\venv\Scripts\python.exe"
    set "PIP_CMD=%~dp0LeverAPI\venv\Scripts\pip.exe"
) else (
    set "PYTHON_CMD=%~dp0LeverAPI\venv\Scripts\python.exe"
    set "PIP_CMD=%~dp0LeverAPI\venv\Scripts\pip.exe"
)

REM 仮想環境のPythonが存在するか確認
if not exist "%PYTHON_CMD%" (
    echo [警告] 仮想環境のPythonが見つかりません。システムのPythonを使用します。
    where python >nul 2>&1
    if !errorlevel! equ 0 (
        set "PYTHON_CMD=python"
        set "PIP_CMD=pip"
    ) else (
        where py >nul 2>&1
        if !errorlevel! equ 0 (
            set "PYTHON_CMD=py"
            set "PIP_CMD=py -m pip"
        ) else (
            echo [エラー] Pythonが見つかりません。
            goto :skip_api
        )
    )
)

:check_api_deps
REM LeverAPIの依存関係をインストール
echo.
echo [情報] LeverAPIの依存関係を確認しています...
%PIP_CMD% install -q -r LeverAPI\requirements.txt >nul 2>&1
if !errorlevel! neq 0 (
    echo [警告] 依存関係のインストールに失敗しました。続行します...
)

REM LeverAPIを起動
echo.
echo [起動] LeverAPIサーバーを起動しています...

REM 起動コマンドを実行
cd /d "%~dp0LeverAPI"
start "LeverAPI Server" cmd /k "%PYTHON_CMD% app.py"
cd /d "%~dp0"
timeout /t 3 /nobreak >nul

:skip_api
REM HTTPサーバーを起動
echo.
echo [起動] HTTPサーバーを起動しています...
if "%USE_PORTABLE%"=="1" (
    start "HTTP Server" cmd /k "cd /d %~dp0 && %NODE_PATH% positionVisualizer\tools\http-server.js"
) else (
    start "HTTP Server" cmd /k "cd /d %~dp0 && node positionVisualizer\tools\http-server.js"
)
timeout /t 2 /nobreak >nul

REM bridge-server.jsを起動
echo.
echo [起動] WebSocketブリッジサーバーを起動しています（レガシー互換性）...
if "%USE_PORTABLE%"=="1" (
    start "Bridge Server" cmd /k "cd /d %~dp0 && %NODE_PATH% positionVisualizer\tools\bridge-server.js"
) else (
    start "Bridge Server" cmd /k "cd /d %~dp0 && node positionVisualizer\tools\bridge-server.js"
)
timeout /t 2 /nobreak >nul

REM メインウィンドウを起動
echo [起動] メインウィンドウを起動しています...
powershell -Command "Start-Process 'http://127.0.0.1:8000/'"

REM 少し待ってからオーバーレイウィンドウを起動
timeout /t 1 /nobreak >nul
echo [起動] オーバーレイウィンドウを起動しています...
powershell -Command "Start-Process 'http://127.0.0.1:8000/overlay.html'"

echo.
echo ========================================
echo 起動完了しました。
echo ========================================
echo.
echo 注意: 以下のウィンドウを閉じると、アプリが動作しなくなります。
echo   - LeverAPI Server (ポート5000)
echo   - HTTP Server (ポート8000)
echo   - Bridge Server (ポート8123)
echo.
echo 終了する場合は、これらのウィンドウを閉じてください。
echo.
timeout /t 3 /nobreak >nul
exit /b 0

:error_exit
echo.
echo [エラー] Node.jsのセットアップをキャンセルしました。
pause
exit /b 1
