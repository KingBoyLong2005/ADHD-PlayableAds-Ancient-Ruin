<#
.SYNOPSIS
    Locate the CocosCreator.exe that matches the project's creator.version.

.DESCRIPTION
    Dot-sourced by tools/typecheck.ps1 and tools/node.ps1. Both drive the
    editor's bundled Electron as Node (ELECTRON_RUN_AS_NODE=1), so both need the
    same answer to "where is the editor?".

    The install location is NOT fixed. The Cocos Dashboard defaults to
    C:\ProgramData\cocos\editors\Creator but lets you install anywhere, and it
    keeps no machine-readable record of where it put things. Hard-coding one path
    means the tools break silently on the next machine — with an error that reads
    like the editor is missing rather than merely moved. So probe, in order:

      1. -EditorsRoot passed by the caller (always wins).
      2. $env:COCOS_EDITORS_ROOT — the escape hatch for an odd layout.
      3. A running CocosCreator.exe. Strongest signal there is: the editor is
         open right now, and its own path says where the family lives
         (...\Creator\<version>\CocosCreator.exe -> root is the grandparent).
      4. Common roots on every fixed drive. Covers "installed on D: instead
         of C:", which is the usual reason this lookup fails.

    Every probe is still checked against the requested version — a root that
    exists but has no <version> folder is not an answer.
#>

# Thư mục con hay gặp dưới mỗi ổ đĩa. Dashboard cho chọn chỗ cài nên danh sách này
# là phỏng đoán, không phải chân lý — hụt thì dùng $env:COCOS_EDITORS_ROOT.
$script:CocosRootPatterns = @(
    'ProgramData\cocos\editors\Creator',
    'CocosVersion\Creator',
    'CocosCreator\Creator',
    'Cocos\Creator',
    'Program Files\Cocos\Creator',
    'Program Files (x86)\Cocos\Creator'
)

function Get-CocosEditorRootCandidates {
    param([string] $EditorsRoot)

    $roots = [System.Collections.Generic.List[string]]::new()
    $addRoot = { param($p) if ($p -and -not $roots.Contains($p)) { $roots.Add($p) } }

    if ($EditorsRoot) { & $addRoot $EditorsRoot }
    if ($env:COCOS_EDITORS_ROOT) { & $addRoot $env:COCOS_EDITORS_ROOT }

    # Editor đang mở: ...\Creator\<version>\CocosCreator.exe -> root là ông nội.
    foreach ($proc in @(Get-Process CocosCreator -ErrorAction SilentlyContinue)) {
        if (-not $proc.Path) { continue }
        $versionDir = Split-Path -Parent $proc.Path
        & $addRoot (Split-Path -Parent $versionDir)
    }

    if ($env:LOCALAPPDATA) { & $addRoot (Join-Path $env:LOCALAPPDATA 'Programs\Cocos\Creator') }

    foreach ($drive in @(Get-PSDrive -PSProvider FileSystem -ErrorAction SilentlyContinue)) {
        if (-not $drive.Root) { continue }
        foreach ($pattern in $script:CocosRootPatterns) { & $addRoot (Join-Path $drive.Root $pattern) }
    }

    return $roots
}

<#
    Trả về hashtable { Root, Dir, Exe, Tsc } cho đúng phiên bản, hoặc ném lỗi kèm
    danh sách đã dò và những phiên bản thật sự thấy được — báo "không tìm thấy"
    trơ trọi thì người đọc chẳng biết bắt đầu tìm từ đâu.
#>
function Resolve-CocosEditor {
    param(
        [Parameter(Mandatory = $true)] [string] $Version,
        [string] $EditorsRoot
    )

    $tried = [System.Collections.Generic.List[string]]::new()
    $seen = [System.Collections.Generic.List[string]]::new()

    foreach ($root in (Get-CocosEditorRootCandidates -EditorsRoot $EditorsRoot)) {
        $tried.Add($root) | Out-Null
        $dir = Join-Path $root $Version
        $exe = Join-Path $dir 'CocosCreator.exe'
        if (Test-Path $exe) {
            return @{
                Root = $root
                Dir  = $dir
                Exe  = $exe
                Tsc  = Join-Path $dir 'resources\app.asar.unpacked\node_modules\typescript\lib\tsc.js'
            }
        }
        if (Test-Path $root) {
            foreach ($d in @(Get-ChildItem $root -Directory -ErrorAction SilentlyContinue)) {
                $seen.Add("$root -> $($d.Name)") | Out-Null
            }
        }
    }

    $haveMsg = if ($seen.Count) { ($seen -join '; ') } else { '(none)' }
    throw @"
Cocos Creator $Version not found.
  Looked in: $($tried -join '; ')
  Editors seen: $haveMsg
  Fix: pass -EditorsRoot '<path>\Creator', or set `$env:COCOS_EDITORS_ROOT.
"@
}
