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
echo [WARNING] Node.js not found.
echo.
echo [情報] ポータブル版Node.jsをダウンロードします...
echo [INFO] Downloading portable Node.js...
echo.
echo 注意: ポータブル版は約50MBのダウンロードが必要です。
echo Note: Portable version requires approximately 50MB download.
echo.
echo 重要: インターネット接続が必要です。
echo IMPORTANT: Internet connection is required.
echo.
echo オフライン環境の場合:
echo - setup-node-portable.bat を事前に実行してポータブル版をセットアップしてください
echo - または、システムにNode.jsをインストールしてください
echo.
echo For offline environments:
echo - Run setup-node-portable.bat beforehand to set up portable version
echo - Or install Node.js on your system
echo.
set /p confirm="続行しますか？ (Y/N): Continue? (Y/N): "
if /i not "%confirm%"=="Y" goto :error_exit

REM ポータブル版Node.jsのダウンロード（Win32 x64版）
set "NODE_VERSION=v20.11.0"
set "NODE_URL=https://nodejs.org/dist/%NODE_VERSION%/node-%NODE_VERSION%-win-x64.zip"
set "NODE_ZIP=%~dp0node-portable.zip"
set "NODE_DIR=%~dp0node-portable"

REM 絶対パスに変換
for %%A in ("%NODE_ZIP%") do set "NODE_ZIP_FULL=%%~fA"
for %%A in ("%NODE_DIR%") do set "NODE_DIR_FULL=%%~fA"

echo [ダウンロード] Node.jsポータブル版をダウンロードしています...
echo [DOWNLOAD] Downloading portable Node.js...
echo これには数分かかる場合があります... This may take a few minutes...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $ProgressPreference = 'SilentlyContinue'; try { Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_ZIP_FULL%' -UseBasicParsing; exit 0 } catch { Write-Host $_.Exception.Message; exit 1 }"
if %errorlevel% neq 0 (
    echo [エラー] ダウンロードに失敗しました。
    echo [ERROR] Download failed.
    echo.
    echo インターネット接続を確認してください。
    echo Please check your internet connection.
    echo.
    echo オフライン環境の場合:
    echo - setup-node-portable.bat を事前に実行してください
    echo - または、システムにNode.jsをインストールしてください
    echo.
    echo For offline environments:
    echo - Run setup-node-portable.bat beforehand
    echo - Or install Node.js on your system
    pause
    exit /b 1
)

if not exist "%NODE_ZIP_FULL%" (
    echo [エラー] ダウンロードしたファイルが見つかりません。
    pause
    exit /b 1
)

echo [展開] ファイルを展開しています...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; try { if (-not (Test-Path '%NODE_DIR_FULL%')) { New-Item -ItemType Directory -Path '%NODE_DIR_FULL%' -Force | Out-Null }; Expand-Archive -Path '%NODE_ZIP_FULL%' -DestinationPath '%NODE_DIR_FULL%' -Force; exit 0 } catch { Write-Host $_.Exception.Message; exit 1 }"
if %errorlevel% neq 0 (
    echo [エラー] 展開に失敗しました。
    pause
    exit /b 1
)

REM 展開されたフォルダ内のnode-*フォルダをnode-portableにリネーム
for /d %%i in ("%NODE_DIR_FULL%\node-*") do (
    if exist "%%i" (
        xcopy /E /I /Y "%%i\*" "%NODE_DIR_FULL%\" >nul 2>&1
        rd /S /Q "%%i" >nul 2>&1
    )
)

del "%NODE_ZIP_FULL%" >nul 2>&1
echo [成功] ポータブル版Node.jsの準備が完了しました。
set "USE_PORTABLE=1"
set "PATH=%NODE_DIR_FULL%;%PATH%"
set "NODE_PATH=%NODE_DIR_FULL%\node.exe"
set "NPM_PATH=%NODE_DIR_FULL%\npm.cmd"
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

REM positionVisualizer の依存関係を確認（モジュール構成変更後）
set "PV_DIR=%~dp0positionVisualizer"
pushd "%PV_DIR%"
if not exist "node_modules" (
    echo.
    echo [情報] positionVisualizer の依存関係をインストールしています...
    if "%USE_PORTABLE%"=="1" (
        call "%NPM_PATH%" install
    ) else (
        call npm install
    )
    if %errorlevel% neq 0 (
        echo [エラー] positionVisualizer の依存関係のインストールに失敗しました。
        popd
        pause
        exit /b 1
    )
)
popd

REM ポータブル版Pythonのパスを確認
set "PYTHON_PORTABLE_PATH=%~dp0python-portable\python.exe"
set "USE_PORTABLE_PYTHON=0"

REM ポータブル版Pythonが存在するか確認
if exist "%PYTHON_PORTABLE_PATH%" (
    echo [確認] ポータブル版Pythonを使用します。
    set "USE_PORTABLE_PYTHON=1"
    set "PYTHON_CMD=%PYTHON_PORTABLE_PATH%"
    set "PIP_CMD=%~dp0python-portable\Scripts\pip.exe"
    if not exist "%PIP_CMD%" (
        REM pipが存在しない場合、get-pip.pyを使用してインストール
        set "PIP_CMD=%~dp0python-portable\python.exe -m pip"
    )
    goto :check_python_venv
)

REM システムのPythonがインストールされているか確認
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
echo [WARNING] Python not found.
echo.
echo [情報] ポータブル版Pythonをダウンロードします...
echo [INFO] Downloading portable Python...
echo.
echo 注意: ポータブル版は約25MBのダウンロードが必要です。
echo Note: Portable version requires approximately 25MB download.
echo.
echo 重要: インターネット接続が必要です。
echo IMPORTANT: Internet connection is required.
echo.
echo オフライン環境の場合:
echo - システムにPythonをインストールしてください
echo - または、Pythonなしで続行できます（LeverAPIは起動しません）
echo.
echo For offline environments:
echo - Install Python on your system
echo - Or continue without Python (LeverAPI will not start)
echo.
set /p continue="続行しますか？ (Y/N): Continue? (Y/N): "
if /i not "!continue!"=="Y" (
    echo.
    echo Pythonなしで続行しますか？ (Y/N): 
    set /p skip_python="Skip Python? (Y/N): "
    if /i not "!skip_python!"=="Y" goto :error_exit
    goto :skip_api
)

REM ポータブル版Pythonのダウンロード（Windows x64版）
set "PYTHON_VERSION=3.11.9"
set "PYTHON_URL=https://www.python.org/ftp/python/%PYTHON_VERSION%/python-%PYTHON_VERSION%-embed-amd64.zip"
set "PYTHON_ZIP=%~dp0python-portable.zip"
set "PYTHON_DIR=%~dp0python-portable"
set "GET_PIP_URL=https://bootstrap.pypa.io/get-pip.py"

REM 絶対パスに変換
for %%A in ("%PYTHON_ZIP%") do set "PYTHON_ZIP_FULL=%%~fA"
for %%A in ("%PYTHON_DIR%") do set "PYTHON_DIR_FULL=%%~fA"

REM ディレクトリを作成
if not exist "%PYTHON_DIR_FULL%" (
    mkdir "%PYTHON_DIR_FULL%" >nul 2>&1
)

echo [ダウンロード] Pythonポータブル版をダウンロードしています...
echo [DOWNLOAD] Downloading portable Python...
echo これには数分かかる場合があります... This may take a few minutes...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $ProgressPreference = 'SilentlyContinue'; try { Invoke-WebRequest -Uri '%PYTHON_URL%' -OutFile '%PYTHON_ZIP_FULL%' -UseBasicParsing; exit 0 } catch { Write-Host $_.Exception.Message; exit 1 }"
if %errorlevel% neq 0 (
    echo [エラー] Pythonのダウンロードに失敗しました。
    echo [ERROR] Python download failed.
    echo.
    echo インターネット接続を確認してください。
    echo Please check your internet connection.
    echo.
    echo Pythonなしで続行しますか？ (Y/N): 
    set /p skip_python="Continue without Python? (Y/N): "
    if /i not "!skip_python!"=="Y" goto :error_exit
    goto :skip_api
)

if not exist "%PYTHON_ZIP_FULL%" (
    echo [エラー] ダウンロードしたファイルが見つかりません。
    pause
    exit /b 1
)

echo [展開] ファイルを展開しています...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; try { Expand-Archive -Path '%PYTHON_ZIP_FULL%' -DestinationPath '%PYTHON_DIR_FULL%' -Force; exit 0 } catch { Write-Host $_.Exception.Message; exit 1 }"
if %errorlevel% neq 0 (
    echo [エラー] 展開に失敗しました。
    pause
    exit /b 1
)

del "%PYTHON_ZIP_FULL%" >nul 2>&1

REM pipをセットアップ
echo [セットアップ] pipをインストールしています...
set "GET_PIP_SCRIPT=%PYTHON_DIR_FULL%\get-pip.py"
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $ProgressPreference = 'SilentlyContinue'; try { Invoke-WebRequest -Uri '%GET_PIP_URL%' -OutFile '%GET_PIP_SCRIPT%' -UseBasicParsing; exit 0 } catch { Write-Host $_.Exception.Message; exit 1 }"
if %errorlevel% equ 0 (
    "%PYTHON_DIR_FULL%\python.exe" "%GET_PIP_SCRIPT%" --quiet
    del "%GET_PIP_SCRIPT%" >nul 2>&1
)

REM python._pthファイルを修正してpipが動作するようにする
set "PYTHON_PTH=%PYTHON_DIR_FULL%\python311._pth"
if exist "%PYTHON_PTH%" (
    REM import siteを有効にする
    powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-Content '%PYTHON_PTH%') -replace '^#import site', 'import site' | Set-Content '%PYTHON_PTH%'"
)

echo [成功] ポータブル版Pythonの準備が完了しました。
set "USE_PORTABLE_PYTHON=1"
set "PYTHON_CMD=%PYTHON_DIR_FULL%\python.exe"
if exist "%PYTHON_DIR_FULL%\Scripts\pip.exe" (
    set "PIP_CMD=%PYTHON_DIR_FULL%\Scripts\pip.exe"
) else (
    set "PIP_CMD=%PYTHON_DIR_FULL%\python.exe -m pip"
)
goto :check_python_venv

:check_python_venv
REM ポータブル版Pythonを使用している場合は仮想環境をスキップ（既に分離されているため）
if "%USE_PORTABLE_PYTHON%"=="1" (
    echo [情報] ポータブル版Pythonを使用するため、仮想環境はスキップします。
    goto :check_api_deps
)

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
echo [エラー] セットアップをキャンセルしました。
echo [ERROR] Setup was cancelled.
pause
exit /b 1
