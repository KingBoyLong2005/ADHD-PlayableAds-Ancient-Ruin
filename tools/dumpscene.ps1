param([string]$Path, [int]$MaxDepth = 99)
$json = Get-Content -Raw -Encoding UTF8 $Path | ConvertFrom-Json
$n = $json.Count
# index -> object
function TypeOf($o) { if ($o.PSObject.Properties['__type__']) { return $o.__type__ } return '?' }

# find scene root(s): objects of type cc.Node with no _parent
$lines = New-Object System.Collections.ArrayList
function Dump($idx, $depth) {
  if ($depth -gt $MaxDepth) { return }
  $o = $json[$idx]
  $name = $o._name
  $comps = @()
  if ($o.PSObject.Properties['_components']) {
    foreach ($c in $o._components) {
      $ci = $c.__id__
      $comps += (TypeOf $json[$ci])
    }
  }
  $act = ''
  if ($o.PSObject.Properties['_active'] -and -not $o._active) { $act = ' [INACTIVE]' }
  $pad = ' ' * ($depth * 2)
  $cs = ''
  if ($comps.Count -gt 0) { $cs = '  {' + ($comps -join ', ') + '}' }
  [void]$lines.Add("$pad- [$idx] $name$act$cs")
  if ($o.PSObject.Properties['_children']) {
    foreach ($ch in $o._children) { Dump $ch.__id__ ($depth+1) }
  }
}
for ($i=0; $i -lt $n; $i++) {
  $o = $json[$i]
  if ((TypeOf $o) -eq 'cc.SceneAsset') { continue }
  if ((TypeOf $o) -eq 'cc.Scene') {
    [void]$lines.Add("SCENE [$i] $($o._name)")
    foreach ($ch in $o._children) { Dump $ch.__id__ 1 }
  }
}
$lines -join "`n"
