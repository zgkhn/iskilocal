$ServiceName = "Iski Industrial Data Collector"
$ServiceDisplayName = "Iski Industrial Data Collector"
$ServiceDescription = "İSKİ Ömerli Otomasyon Veri Toplayıcı Servisi"
$BinaryPath = "C:\Users\Gokhan\Desktop\İski\IndustrialDataCollector\bin\Debug\net8.0\IndustrialDataCollector.exe"

# Servis varsa önce durdur ve sil
$existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Host "Eski servis durduruluyor ve siliniyor..." -ForegroundColor Yellow
    Stop-Service -Name $ServiceName -ErrorAction SilentlyContinue
    # Servisin tamamen durması için kısa bir bekleme
    Start-Sleep -Seconds 2
    sc.exe delete $ServiceName
}

Write-Host "Servis kuruluyor: $ServiceDisplayName" -ForegroundColor Cyan
New-Service -Name $ServiceName `
    -BinaryPathName $BinaryPath `
    -DisplayName $ServiceDisplayName `
    -Description $ServiceDescription `
    -StartupType Automatic

Write-Host "Servis başlatılıyor..." -ForegroundColor Cyan
Start-Service -Name $ServiceName

Write-Host "İşlem tamamlandı. Servis durumu:" -ForegroundColor Green
Get-Service -Name $ServiceName
