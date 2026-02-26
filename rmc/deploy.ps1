# Stop on error
$ErrorActionPreference = "Stop"

$server = "190.133.168.179"
$user = "ubuntu"
$remoteDir = "/home/ubuntu/iskilocal/rmc"
# To avoid typing the password, we use sshpass which has to be installed or use ssh public key
# For now we'll rely on normal ssh, you'll be prompted for password if key is not matched.
# A better way is using a key.

Write-Host "1. Building the Next.js app locally..." -ForegroundColor Cyan
# Klasör adındaki "İ" harfi Next.js derleyicisinde bug yarattığı için (Webpack path regex hatası),
# projeyi geçici olarak T: sürücüsüne map edip derliyoruz.
$originalPath = $PWD.Path
$tempDrive = "T:"
subst $tempDrive /D 2>$null
subst $tempDrive $originalPath
cmd /c "$tempDrive && npm run build"
cd $originalPath
subst $tempDrive /D

Write-Host "2. Preparing standalone package..." -ForegroundColor Cyan
# Standalone folder doesnt contain static and public files by default. We need to copy them
if (Test-Path ".next/standalone/.next/static") { Remove-Item -Recurse -Force ".next/standalone/.next/static" }
if (Test-Path ".next/standalone/public") { Remove-Item -Recurse -Force ".next/standalone/public" }

Copy-Item -Path ".next/static" -Destination ".next/standalone/.next/" -Recurse
Copy-Item -Path "public" -Destination ".next/standalone/" -Recurse

Write-Host "3. Compressing the standalone directory to speed up transfer..." -ForegroundColor Cyan
if (Test-Path "deploy.tar.gz") { Remove-Item "deploy.tar.gz" }
tar -czf deploy.tar.gz -C .next/standalone .

Write-Host "4. Uploading package to server..." -ForegroundColor Cyan
scp -o StrictHostKeyChecking=no deploy.tar.gz ${user}@${server}:${remoteDir}/

Write-Host "5. Extracting and restarting on the server..." -ForegroundColor Cyan
# Note: we are passing an inline bash script to ssh
$sshCommand = "cd $remoteDir && rm -rf .next_backup && mv .next .next_backup 2>/dev/null || true; mkdir -p .next/standalone && tar -xzf $remoteDir/deploy.tar.gz -C .next/standalone && cd .next/standalone && if [ ! -f .env ]; then echo DB_HOST=127.0.0.1 > .env; fi && npm install pg && (pm2 restart rmc || pm2 start server.js --name rmc)"

ssh -o StrictHostKeyChecking=no ${user}@${server} $sshCommand

Write-Host "Deployment completed successfully!" -ForegroundColor Green
