/**
 * In ra dải chữ nhật mà từng phần tử UI *có vẽ* chiếm, quy về toạ độ của node gốc.
 *
 * Dựng UI bằng script thì không có canvas để nhìn, mà `_lpos` lồng nhiều tầng cộng
 * dồn rất dễ nhầm — nhãn mới đặt xong đè lên một node trang trí có sẵn là chuyện
 * bình thường. Ở đây quy hết về một hệ toạ độ để đọc bằng mắt, kèm cảnh báo khi
 * hai phần tử chồng lên nhau cả hai chiều.
 *
 * Chạy: powershell -ExecutionPolicy Bypass -File tools/node.ps1 \
 *           tools/scene/uilayout.js <scene> <chỉ-số-node-gốc> [--all]
 *
 * `--all` xét cả node đang tắt: panel UI gần như luôn được dựng ở trạng thái tắt,
 * không có cờ này thì chạy trên đúng thứ mình vừa dựng lại ra bảng rỗng.
 */
const fs = require('fs');

const SCENE = process.argv[2] || 'assets/Scene/scene.scene';
const ROOT = Number(process.argv[3]);
const INCLUDE_INACTIVE = process.argv.includes('--all');
if (!Number.isFinite(ROOT)) throw new Error('thiếu chỉ số node gốc');

const d = JSON.parse(fs.readFileSync(SCENE, 'utf8'));
const DRAWS = new Set(['cc.Sprite', 'cc.Label', 'cc.RichText']);

function uiOf(i) {
    for (const c of (d[i]._components || [])) {
        if (d[c.__id__].__type__ === 'cc.UITransform') return d[c.__id__];
    }
    return null;
}

const rows = [];
(function walk(i, ox, oy, pathPrefix) {
    const o = d[i];
    if (o._active === false && !INCLUDE_INACTIVE) return;
    const x = ox + (o._lpos ? o._lpos.x : 0);
    const y = oy + (o._lpos ? o._lpos.y : 0);
    const path = `${pathPrefix}/${o._name}`;
    const t = uiOf(i);
    const drawn = (o._components || []).some((c) => DRAWS.has(d[c.__id__].__type__));
    if (t && drawn) {
        const { width: w, height: h } = t._contentSize;
        const a = t._anchorPoint;
        rows.push({
            path,
            x0: x - w * a.x, x1: x + w * (1 - a.x),
            y0: y - h * a.y, y1: y + h * (1 - a.y),
        });
    }
    for (const c of (o._children || [])) walk(c.__id__, x, y, path);
})(ROOT, 0, 0, '');

rows.sort((a, b) => b.y1 - a.y1);
const n = (v) => String(Math.round(v)).padStart(6);
for (const r of rows) console.log(`x ${n(r.x0)}..${n(r.x1)}   y ${n(r.y0)}..${n(r.y1)}   ${r.path}`);

// Chồng nhau chỉ đáng ngại khi cả hai đều nhỏ — nền và vệt sáng cỡ toàn màn hình
// thì nằm dưới mọi thứ là chuyện bình thường, báo ra chỉ thành nhiễu.
const SMALL = 1000;
console.log('');
let hits = 0;
for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
        const a = rows[i], b = rows[j];
        const big = (r) => (r.x1 - r.x0) > SMALL || (r.y1 - r.y0) > SMALL;
        if (big(a) || big(b)) continue;
        // Nhãn nằm trong nút, chữ nằm trong khung — con lồng trong cha thì đương
        // nhiên chồng, báo ra chỉ làm chìm mất cặp chồng thật.
        if (a.path.startsWith(b.path + '/') || b.path.startsWith(a.path + '/')) continue;
        if (a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0) continue;
        console.log(`chồng: ${a.path}  <->  ${b.path}`);
        hits++;
    }
}
console.log(hits ? `${hits} cặp chồng nhau (xem lại xem có cố ý không)` : 'không cặp nhỏ nào chồng nhau');
