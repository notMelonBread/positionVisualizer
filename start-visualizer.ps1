# LeverScope 起動スクリプト
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "LeverScope を起動しています..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Node.jsがインストールされているか確認
try {
    $nodeVersion = node --version 2>$null
    if (-not $nodeVersion) {
        throw "Node.js not found"
    }
    Write-Host "[確認] Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[エラー] Node.jsがインストールされていません。" -ForegroundColor Red
    Write-Host "Node.jsをインストールしてください: https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Enterキーを押して終了"
    exit 1
}

# node_modulesが存在するか確認
if (-not (Test-Path "node_modules")) {
    Write-Host "[情報] 依存関係をインストールしています..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[エラー] 依存関係のインストールに失敗しました。" -ForegroundColor Red
        Read-Host "Enterキーを押して終了"
        exit 1
    }
}

# Pythonがインストールされているか確認
$pythonCmd = $null
$pipCmd = $null

try {
    $pythonVersion = python --version 2>$null
    if ($pythonVersion) {
        $pythonCmd = "python"
        $pipCmd = "pip"
        Write-Host "[確認] Python: $pythonVersion" -ForegroundColor Green
    }
} catch {
    try {
        $pythonVersion = py --version 2>$null
        if ($pythonVersion) {
            $pythonCmd = "py"
            $pipCmd = "py -m pip"
            Write-Host "[確認] Python: $pythonVersion" -ForegroundColor Green
        }
    } catch {
        # Pythonが見つからない場合
        Write-Host "[警告] Pythonが見つかりません。" -ForegroundColor Yellow
        Write-Host "LeverAPIを起動するにはPythonが必要です。" -ForegroundColor Yellow
        Write-Host "Pythonをインストールしてください: https://www.python.org/downloads/" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "インストール後、このスクリプトを再度実行してください。" -ForegroundColor Yellow
        Write-Host ""
        $continue = Read-Host "Pythonなしで続行しますか？ (Y/N)"
        if ($continue -ne "Y" -and $continue -ne "y") {
            exit 1
        }
        $pythonCmd = $null
    }
}

# LeverAPIの起動
if ($pythonCmd) {
    $leverApiPath = Join-Path $scriptPath "LeverAPI"
    
    # 仮想環境の確認と作成
    $venvPath = Join-Path $leverApiPath "venv"
    if (-not (Test-Path $venvPath)) {
        Write-Host "[情報] LeverAPIの仮想環境を作成しています..." -ForegroundColor Yellow
        & $pythonCmd -m venv $venvPath
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[警告] 仮想環境の作成に失敗しました。Pythonを直接使用します。" -ForegroundColor Yellow
        } else {
            $pythonCmd = Join-Path $venvPath "Scripts\python.exe"
            $pipCmd = Join-Path $venvPath "Scripts\pip.exe"
        }
    } else {
        $pythonCmd = Join-Path $venvPath "Scripts\python.exe"
        $pipCmd = Join-Path $venvPath "Scripts\pip.exe"
    }
    
    # 依存関係のインストール
    Write-Host "[情報] LeverAPIの依存関係を確認しています..." -ForegroundColor Yellow
    $requirementsPath = Join-Path $leverApiPath "requirements.txt"
    & $pipCmd install -q -r $requirementsPath 2>$null
    
    # LeverAPIを起動
    Write-Host "[起動] LeverAPIサーバーを起動しています..." -ForegroundColor Cyan
    
    # Pythonコマンドのパスを絶対パスに変換
    if (-not [System.IO.Path]::IsPathRooted($pythonCmd)) {
        if ($pythonCmd.StartsWith("LeverAPI")) {
            $pythonCmd = Join-Path $scriptPath $pythonCmd
        } else {
            $pythonCmd = Join-Path $scriptPath $pythonCmd
        }
    }
    
    # パスにスペースが含まれる場合は引用符で囲む
    if ($pythonCmd -match '\s') {
        $pythonCmd = "`"$pythonCmd`""
    }
    
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$leverApiPath'; & $pythonCmd app.py" -WindowStyle Normal
    Start-Sleep -Seconds 3
}

# HTTPサーバーを起動（新しいウィンドウで）
Write-Host "[起動] HTTPサーバーを起動しています..." -ForegroundColor Cyan
$httpServerPath = Join-Path $scriptPath "positionVisualizer\tools\http-server.js"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptPath'; node positionVisualizer\tools\http-server.js" -WindowStyle Normal
Start-Sleep -Seconds 2

# bridge-server.jsを起動（新しいウィンドウで）
Write-Host "[起動] WebSocketブリッジサーバーを起動しています..." -ForegroundColor Cyan
$bridgePath = Join-Path $scriptPath "positionVisualizer\tools\bridge-server.js"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptPath'; node positionVisualizer\tools\bridge-server.js" -WindowStyle Normal
Start-Sleep -Seconds 2

# メインウィンドウを起動（HTTPサーバー経由）
Write-Host "[起動] メインウィンドウを起動しています..." -ForegroundColor Cyan
Start-Process "http://127.0.0.1:8000/"

# 少し待ってからオーバーレイウィンドウを起動
Start-Sleep -Seconds 1
Write-Host "[起動] オーバーレイウィンドウを起動しています..." -ForegroundColor Cyan
Start-Process "http://127.0.0.1:8000/overlay.html"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "起動完了しました。" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "注意: 以下のウィンドウを閉じると、アプリが動作しなくなります。" -ForegroundColor Yellow
Write-Host "  - LeverAPI Server (ポート5000)" -ForegroundColor Yellow
Write-Host "  - HTTP Server (ポート8000)" -ForegroundColor Yellow
Write-Host "  - Bridge Server (ポート8123)" -ForegroundColor Yellow
Write-Host ""
Write-Host "終了する場合は、これらのウィンドウを閉じてください。" -ForegroundColor Yellow
Write-Host ""
Start-Sleep -Seconds 3

