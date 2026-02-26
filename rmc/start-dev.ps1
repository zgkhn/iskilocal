$ErrorActionPreference = "Stop"

# Klasör adındaki "İ" harfi Next.js'in çökmesine neden olduğu için
# local geliştirme sunucusunu da sanal sürücü üzerinden başlatıyoruz.
$originalPath = $PWD.Path
$tempDrive = "T:"

Write-Host "Creating virtual drive $tempDrive to avoid path characters bug..." -ForegroundColor Yellow
subst $tempDrive /D 2>$null
subst $tempDrive $originalPath

Write-Host "Starting Next.js Dev Server on http://localhost:3001" -ForegroundColor Green
cmd /c "$tempDrive && npm run dev"

# When dev server stops, cleanup
cd $originalPath
subst $tempDrive /D
