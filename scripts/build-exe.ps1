$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$inputFile = Join-Path $scriptDir "StartDiscordBot.ps1"
$outputFile = Join-Path $projectRoot "StartDiscordBot.exe"

if (-not (Get-Module -ListAvailable -Name ps2exe)) {
    Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Scope CurrentUser -Force | Out-Null
    Set-PSRepository -Name PSGallery -InstallationPolicy Trusted
    Install-Module -Name ps2exe -Scope CurrentUser -Force -AllowClobber
}

Import-Module ps2exe -ErrorAction Stop
Invoke-PS2EXE -InputFile $inputFile -OutputFile $outputFile
Write-Host "Built $outputFile"
