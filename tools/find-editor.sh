#!/bin/bash
# In ra đường dẫn tới binary Electron của Cocos Creator (chế độ Node).
#
# Bản macOS của tools/find-editor.ps1. Chỗ cài editor phải dò chứ không hardcode
# được: Dashboard mặc định /Applications/Cocos/Creator/<ver> nhưng cho cài đi đâu
# cũng được. Thứ tự dò: $COCOS_EDITORS_ROOT -> tiến trình đang chạy -> mấy chỗ
# hay gặp. Phiên bản mới nhất thắng.
set -euo pipefail

version_of() { basename "$(dirname "$(dirname "$1")")"; }

candidates=()
if [ -n "${COCOS_EDITORS_ROOT:-}" ]; then
    while IFS= read -r p; do candidates+=("$p"); done < <(
        find "$COCOS_EDITORS_ROOT" -maxdepth 3 -name CocosCreator.app -type d 2>/dev/null)
fi

# Editor đang mở là câu trả lời chắc chắn nhất.
running=$(ps -Ao args= 2>/dev/null | grep -o '/[^ ]*/CocosCreator\.app' | head -1 || true)
[ -n "$running" ] && candidates+=("$running")

for root in "$HOME/Applications/Cocos/Creator" /Applications/Cocos/Creator \
            "$HOME/Applications/CocosCreator" /Applications/CocosCreator; do
    [ -d "$root" ] || continue
    while IFS= read -r p; do candidates+=("$p"); done < <(
        find "$root" -maxdepth 3 -name CocosCreator.app -type d 2>/dev/null)
done

best=""; bestver=""
for app in "${candidates[@]:-}"; do
    bin="$app/Contents/MacOS/CocosCreator"
    [ -x "$bin" ] || continue
    ver=$(version_of "$bin")
    if [ -z "$best" ] || [ "$(printf '%s\n%s\n' "$bestver" "$ver" | sort -V | tail -1)" = "$ver" ]; then
        best="$bin"; bestver="$ver"
    fi
done

if [ -z "$best" ]; then
    echo "không tìm thấy CocosCreator.app — đặt COCOS_EDITORS_ROOT tới thư mục chứa các bản Creator" >&2
    exit 1
fi
echo "$best"
