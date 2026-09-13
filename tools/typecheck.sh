#!/bin/bash
# Typecheck bằng `typescript` nhúng sẵn trong Cocos Creator — không cần cài gì.
#
# Bản macOS của tools/typecheck.ps1; xem file đó cho phần vì sao dùng
# tools/tsconfig.check.json chứ không phải tsconfig.json ở gốc.
# In "typecheck: clean" và trả 0 khi sạch.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CREATOR=$("$ROOT/tools/find-editor.sh")
RES="$(cd "$(dirname "$CREATOR")/../Resources" && pwd)"
# Chỗ đặt tsc.js đổi theo bản Creator (app/ hay app.asar.unpacked/), nên dò chứ
# đừng ghép chuỗi cứng.
TSC=""
for c in "$RES/app.asar.unpacked/node_modules/typescript/lib/tsc.js" \
         "$RES/app/node_modules/typescript/lib/tsc.js" \
         "$RES/resources/3d/engine/node_modules/typescript/lib/tsc.js"; do
    [ -f "$c" ] && { TSC="$c"; break; }
done
if [ -z "$TSC" ]; then
    echo "không thấy tsc.js trong Creator ($RES)" >&2
    exit 2
fi
out=$(cd "$ROOT" && ELECTRON_RUN_AS_NODE=1 "$CREATOR" "$TSC" -p tools/tsconfig.check.json 2>&1)
code=$?
if [ $code -eq 0 ]; then
    echo "typecheck: clean"
else
    echo "$out"
fi
exit $code
