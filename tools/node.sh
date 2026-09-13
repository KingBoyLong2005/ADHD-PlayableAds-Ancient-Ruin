#!/bin/bash
# Chạy một file JS bằng Electron của Cocos Creator ở chế độ Node.
#
# Bản macOS của tools/node.ps1. Máy này không có `node` trên PATH, đây là đường
# duy nhất. Khác bản Windows một điểm: binary trên macOS không phải GUI-subsystem
# nên stdout ra thẳng console, không phải chuyển qua file rồi đọc ngược lại.
set -euo pipefail
CREATOR=$("$(dirname "$0")/find-editor.sh")
exec env ELECTRON_RUN_AS_NODE=1 "$CREATOR" "$@"
