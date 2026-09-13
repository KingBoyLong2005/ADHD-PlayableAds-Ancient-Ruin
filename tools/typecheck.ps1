<#
.SYNOPSIS
    Typecheck the project's TypeScript without a system-wide Node install.

.DESCRIPTION
    This machine has no `node` / `npx` on PATH, but Cocos Creator ships an
    Electron runtime and a bundled `typescript`. Electron acts as plain Node
    when ELECTRON_RUN_AS_NODE=1, so we drive the bundled `tsc.js` with it.

    Two Windows-specific wrinkles this script works around:
      * CocosCreator.exe is a GUI-subsystem binary, so its stdout never reaches
        the parent console — output has to be redirected to a file and read back.
      * The editor version must match the project's `creator.version`, otherwise
        tsc checks against the wrong `cc` engine declarations.

    Requires the editor to have opened the project at least once: the compiler
    options and `cc` typings live in temp/, which the editor generates.

    The editor itself is located by tools/find-editor.ps1, which probes several
    install roots -- the Dashboard's default is only one of them. Override with
    -EditorsRoot or $env:COCOS_EDITORS_ROOT.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File tools/typecheck.ps1
#>
[CmdletBinding()]
param(
    # Override the editor version. Defaults to package.json's creator.version.
    [string] $EditorVersion,

    # Where CocosCreator installs its editors. Leave empty and the editor is
    # located automatically -- see tools/find-editor.ps1.
    [string] $EditorsRoot
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'find-editor.ps1')

if (-not $EditorVersion) {
    $pkgPath = Join-Path $projectRoot 'package.json'
    if (-not (Test-Path $pkgPath)) { throw "No package.json at $pkgPath" }
    $EditorVersion = (Get-Content $pkgPath -Raw | ConvertFrom-Json).creator.version
    if (-not $EditorVersion) { throw "package.json has no creator.version field" }
}

$editor   = Resolve-CocosEditor -Version $EditorVersion -EditorsRoot $EditorsRoot
$electron = $editor.Exe
$tsc      = $editor.Tsc
if (-not (Test-Path $tsc)) { throw "Bundled tsc.js not found at $tsc" }

# The editor regenerates these on project open; without them tsc has no `cc` types.
$cocosTsconfig = Join-Path $projectRoot 'temp\tsconfig.cocos.json'
if (-not (Test-Path $cocosTsconfig)) {
    throw "temp/tsconfig.cocos.json is missing. Open the project in Cocos Creator once to generate it."
}

$outFile = Join-Path $env:TEMP "adhd-tsc-out-$PID.txt"
$errFile = Join-Path $env:TEMP "adhd-tsc-err-$PID.txt"

Push-Location $projectRoot
try {
    $env:ELECTRON_RUN_AS_NODE = '1'
    $checkConfig = Join-Path $PSScriptRoot 'tsconfig.check.json'
    $proc = Start-Process -FilePath $electron `
        -ArgumentList @("`"$tsc`"", '-p', "`"$checkConfig`"") `
        -NoNewWindow -Wait -PassThru `
        -RedirectStandardOutput $outFile -RedirectStandardError $errFile

    Get-Content $outFile -ErrorAction SilentlyContinue
    Get-Content $errFile -ErrorAction SilentlyContinue

    if ($proc.ExitCode -eq 0) { Write-Host "`ntypecheck: clean" -ForegroundColor Green }
    else { Write-Host "`ntypecheck: FAILED (exit $($proc.ExitCode))" -ForegroundColor Red }
    exit $proc.ExitCode
}
finally {
    Remove-Item $outFile, $errFile -ErrorAction SilentlyContinue
    Remove-Item Env:\ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
    Pop-Location
}
