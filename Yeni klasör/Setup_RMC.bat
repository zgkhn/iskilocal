@echo off
title Omerli Otomasyon Rapor Kurulum

:: Yönetici kontrol
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Yonetici olarak calistiriniz!
    pause
    exit
)

echo ===============================
echo Omerli Otomasyon Rapor Kurulum
echo ===============================
echo.

:: Kurulum klasoru
set INSTALL_DIR=C:\OmerliRapor

if not exist "%INSTALL_DIR%" (
    mkdir "%INSTALL_DIR%"
)

echo Dosyalar C:\OmerliRapor klasorune kopyalaniyor...

copy "%~f0" "%INSTALL_DIR%\omerli_kurulum.bat" /Y >nul
copy "%~dp0iski_rapor_logo.ico" "%INSTALL_DIR%\" /Y >nul
copy "%~dp0server_cert.crt" "%INSTALL_DIR%\" /Y >nul

echo Kopyalama tamam.
echo.

:: Masaustu yolu
set DESKTOP=%USERPROFILE%\Desktop
set SHORTCUT_NAME=Ömerli Otomasyon Rapor.lnk
set TARGET_URL=https://190.133.168.179:3043
set ICON_FILE=%INSTALL_DIR%\icon-watchos-1024x1024.ico

echo Masaustune kisayol olusturuluyor...

powershell -command ^
$WshShell = New-Object -comObject WScript.Shell; ^
$Shortcut = $WshShell.CreateShortcut('%DESKTOP%\%SHORTCUT_NAME%'); ^
$Shortcut.TargetPath = '%TARGET_URL%'; ^
$Shortcut.IconLocation = '%ICON_FILE%'; ^
$Shortcut.Save()

echo Kısayol olusturuldu.
echo.

echo Sertifika yukleniyor...

certutil -addstore "Root" "%INSTALL_DIR%\server_cert.crt"

echo.
echo ===============================
echo Kurulum Tamamlandi
echo ===============================
pause