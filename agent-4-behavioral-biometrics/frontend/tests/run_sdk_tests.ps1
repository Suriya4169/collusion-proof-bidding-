# Runs an HTML test page in a headless Chromium browser (Edge or Chrome) and prints the
# contents of its <pre id="out"> element. No Node.js required.
#
#   powershell -File frontend\tests\run_sdk_tests.ps1               # run the SDK self-test
#   powershell -File frontend\tests\run_sdk_tests.ps1 -Page x.html -Raw   # print the result block only
#
# Without -Raw the script exits 0 only if the page reports "ALL PASSED".
param(
    [string]$Page = "",
    [switch]$Raw
)

$ErrorActionPreference = "Stop"
$candidates = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
)
$browser = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $browser) { Write-Error "No Edge or Chrome installation found."; exit 2 }

if (-not $Page) { $Page = Join-Path $PSScriptRoot "sdk_test.html" }
$pagePath = (Resolve-Path $Page).Path
$url = "file:///" + ($pagePath -replace "\\", "/" -replace " ", "%20")
$profile = Join-Path $env:TEMP ("agent4-sdk-test-" + [guid]::NewGuid().ToString("N"))
$stdout = Join-Path $env:TEMP ("agent4-sdk-out-" + [guid]::NewGuid().ToString("N") + ".txt")

try {
    Start-Process -FilePath $browser -ArgumentList @(
        "--headless", "--disable-gpu", "--no-first-run", "--user-data-dir=`"$profile`"",
        "--virtual-time-budget=8000", "--dump-dom", $url
    ) -RedirectStandardOutput $stdout -Wait -NoNewWindow | Out-Null
    $dom = Get-Content $stdout -Raw
} finally {
    Remove-Item $stdout -ErrorAction SilentlyContinue
    Remove-Item $profile -Recurse -Force -ErrorAction SilentlyContinue
}

if ($dom -match '(?s)<pre id="out">(.*?)</pre>') {
    $report = [System.Net.WebUtility]::HtmlDecode($Matches[1])
    Write-Output $report
    if ($Raw) { exit 0 }
    if ($report -match "ALL PASSED") { exit 0 } else { exit 1 }
}
Write-Error "The test page produced no result block."
exit 2
