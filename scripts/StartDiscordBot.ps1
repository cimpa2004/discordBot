$launcherDir = if ($PSScriptRoot) {
    $PSScriptRoot
} else {
    Split-Path -Parent ([System.Diagnostics.Process]::GetCurrentProcess().MainModule.FileName)
}

# When running the raw script, it lives in scripts/. When compiled exe runs, it lives in project root.
$projectRoot = if ((Split-Path -Leaf $launcherDir) -ieq "scripts") {
    Split-Path -Parent $launcherDir
} else {
    $launcherDir
}

Start-Process -FilePath "cmd.exe" -WorkingDirectory $projectRoot -ArgumentList @(
    "/k",
    "cd /d `"$projectRoot`" && pnpm start"
)

$webRoot = Join-Path $projectRoot "web"
if (Test-Path $webRoot) {
    Start-Process -FilePath "cmd.exe" -WorkingDirectory $webRoot -ArgumentList @(
        "/k",
        "cd /d `"$webRoot`" && pnpm dev"
    )
}
