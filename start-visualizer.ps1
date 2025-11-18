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

# bridge-server.jsを起動（新しいウィンドウで）
Write-Host "[起動] WebSocketサーバーを起動しています..." -ForegroundColor Cyan
$bridgePath = Join-Path $scriptPath "bridge-server.js"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptPath'; node bridge-server.js" -WindowStyle Normal
Start-Sleep -Seconds 2

# メインウィンドウを起動
Write-Host "[起動] メインウィンドウを起動しています..." -ForegroundColor Cyan
$mainPath = Join-Path $scriptPath "positionVisualizer\index.html"
Start-Process $mainPath

# 少し待ってからオーバーレイウィンドウを起動
Start-Sleep -Seconds 1
Write-Host "[起動] オーバーレイウィンドウを起動しています..." -ForegroundColor Cyan
$overlayPath = Join-Path $scriptPath "positionVisualizer\overlay.html"
Start-Process $overlayPath

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "起動完了しました。" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "注意: Bridge Serverウィンドウを閉じると、アプリが動作しなくなります。" -ForegroundColor Yellow
Write-Host "終了する場合は、Bridge Serverウィンドウを閉じてください。" -ForegroundColor Yellow
Write-Host ""
Start-Sleep -Seconds 3

