<#
.SYNOPSIS
    Run a JS file with Cocos Creator's bundled Electron acting as plain Node.

.DESCRIPTION
    Same trick as tools/typecheck.ps1: this machine has no `node` on PATH, but
    CocosCreator.exe behaves as Node when ELECTRON_RUN_AS_NODE=1. Because it is a
    GUI-subsystem binary its stdout never reaches the console, so it is
    redirected to a temp file and echoed back here.

    Where the editor lives is probed, not hard-coded -- see tools/find-editor.ps1.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File tools/node.ps1 tools/scene/foo.js
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)] [string] $Script,
    [Parameter(ValueFromRemainingArguments = $true)] [string[]] $ScriptArgs,
    [string] $EditorVersion,
    # Leave empty and the editor is located automatically -- see tools/find-editor.ps1.
    [string] $EditorsRoot
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'find-editor.ps1')

if (-not $EditorVersion) {
    $EditorVersion = (Get-Content (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).creator.version
}
$electron = (Resolve-CocosEditor -Version $EditorVersion -EditorsRoot $EditorsRoot).Exe

$outFile = Join-Path $env:TEMP "adhd-node-out-$PID.txt"
$errFile = Join-Path $env:TEMP "adhd-node-err-$PID.txt"

Push-Location $projectRoot
try {
    $env:ELECTRON_RUN_AS_NODE = '1'
    $argList = @("`"$Script`"")
    if ($ScriptArgs) { $argList += $ScriptArgs }
    $proc = Start-Process -FilePath $electron -ArgumentList $argList `
        -NoNewWindow -Wait -PassThru `
        -RedirectStandardOutput $outFile -RedirectStandardError $errFile
    Get-Content $outFile -ErrorAction SilentlyContinue
    Get-Content $errFile -ErrorAction SilentlyContinue
    exit $proc.ExitCode
}
finally {
    Remove-Item $outFile, $errFile -ErrorAction SilentlyContinue
    Remove-Item Env:\ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
    Pop-Location
}
