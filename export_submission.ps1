$src = "C:\Users\DELL\Downloads\files\DBSE-DBD-PROJECT"
$destZip1 = "C:\Users\DELL\Downloads\files\MediBook_DBSE_DBD_Submission.zip"
$destZip2 = "C:\Users\DELL\Downloads\MediBook_DBSE_DBD_Submission.zip"

$tempGuid = [System.Guid]::NewGuid().ToString("N")
$tempDir = Join-Path $env:TEMP $tempGuid
$targetDir = Join-Path $tempDir "DBSE-DBD-PROJECT"

Write-Host "Creating temporary staging directory at $targetDir..."
New-Item -ItemType Directory -Path $targetDir -Force | Out-Null

$items = Get-ChildItem -Path $src -Exclude "node_modules", "export_submission.ps1"
foreach ($item in $items) {
    Copy-Item -Path $item.FullName -Destination $targetDir -Recurse -Force
}

# Ensure any nested node_modules is deleted
$nestedNm = Join-Path $targetDir "backend\node_modules"
if (Test-Path $nestedNm) {
    Remove-Item -Path $nestedNm -Recurse -Force
}

if (Test-Path $destZip1) { Remove-Item -Path $destZip1 -Force }
if (Test-Path $destZip2) { Remove-Item -Path $destZip2 -Force }

Write-Host "Compressing archive to $destZip1..."
Compress-Archive -Path "$targetDir\*" -DestinationPath $destZip1 -CompressionLevel Optimal
Copy-Item -Path $destZip1 -Destination $destZip2 -Force

Remove-Item -Path $tempDir -Recurse -Force

$z1 = Get-Item $destZip1
$z2 = Get-Item $destZip2

Write-Host "SUCCESS: Academic submission packages generated:"
Write-Host "1. $destZip1 ($([Math]::Round($z1.Length / 1KB, 1)) KB)"
Write-Host "2. $destZip2 ($([Math]::Round($z2.Length / 1KB, 1)) KB)"
