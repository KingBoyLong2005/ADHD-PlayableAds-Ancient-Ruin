/**
 * Soi nhanh một file scene: tham chiếu `__id__` có trỏ ra ngoài mảng không, `_id`
 * có trùng không, cây node có đứt đoạn không, `__uuid__` có trỏ tới asset có
 * thật không. Chạy sau mọi lần sửa scene bằng script.
 */
const fs = require('fs');
const nodePath = require('path');
const path = process.argv[2] || 'assets/Scene/scene.scene';
const d = JSON.parse(fs.readFileSync(path, 'utf8'));
let bad = 0;

function walkRefs(o, where) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach((v, i) => walkRefs(v, `${where}[${i}]`)); return; }
    if (typeof o.__id__ === 'number') {
        if (o.__id__ < 0 || o.__id__ >= d.length) { console.log(`REF HỎNG ${where} -> ${o.__id__}`); bad++; }
        return;
    }
    for (const k of Object.keys(o)) walkRefs(o[k], `${where}.${k}`);
}
d.forEach((o, i) => walkRefs(o, `[${i}]`));

const ids = new Map();
d.forEach((o, i) => {
    if (!o || typeof o._id !== 'string') return;
    if (ids.has(o._id)) { console.log(`_id TRÙNG "${o._id}": [${ids.get(o._id)}] và [${i}]`); bad++; }
    ids.set(o._id, i);
});

d.forEach((o, i) => {
    if (!o || o.__type__ !== 'cc.Node') return;
    for (const c of (o._children || [])) {
        const ch = d[c.__id__];
        if (!ch || ch.__type__ !== 'cc.Node') { console.log(`[${i}] ${o._name}: con [${c.__id__}] không phải node`); bad++; continue; }
        if (ch._parent?.__id__ !== i) { console.log(`[${i}] ${o._name}: con [${c.__id__}] có _parent=[${ch._parent && ch._parent.__id__}]`); bad++; }
    }
    for (const c of (o._components || [])) {
        const comp = d[c.__id__];
        if (!comp) { console.log(`[${i}] ${o._name}: component [${c.__id__}] rỗng`); bad++; continue; }
        if (comp.node?.__id__ !== i) { console.log(`[${i}] ${o._name}: component [${c.__id__}] trỏ node=[${comp.node && comp.node.__id__}]`); bad++; }
    }
    if (o._parent) {
        const p = d[o._parent.__id__];
        const listed = (p._children || []).some((c) => c.__id__ === i);
        if (!listed) { console.log(`[${i}] ${o._name}: cha [${o._parent.__id__}] không liệt kê nó`); bad++; }
    }
});

// ------------------------------------------------------------ asset uuid
//
// Sprite/font/prefab viết tay trong script sửa scene chỉ là chuỗi uuid — gõ sai
// một ký tự thì Cocos nạp ra null và ô đó im lặng trống trơn. Ở đây đối chiếu
// với toàn bộ .meta trong assets/, kể cả sub-asset (`<uuid>@f9941` = sprite frame).
const known = new Set();

// Asset nội bộ của engine (nút mặc định, sprite splash...) không có .meta trong
// assets/ nhưng vẫn nằm trong library/ sau khi editor import. Thiếu bước này thì
// mấy nút có sẵn trong scene bị báo oan là hỏng.
if (fs.existsSync('library')) {
    for (const dir of fs.readdirSync('library')) {
        const p = nodePath.join('library', dir);
        if (!fs.statSync(p).isDirectory()) continue;
        for (const f of fs.readdirSync(p)) {
            const dot = f.indexOf('.');
            if (dot > 0) known.add(f.slice(0, dot));
        }
    }
}
(function scanMeta(dir) {
    for (const f of fs.readdirSync(dir)) {
        const p = nodePath.join(dir, f);
        if (fs.statSync(p).isDirectory()) { scanMeta(p); continue; }
        if (!p.endsWith('.meta')) continue;
        let m;
        try { m = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { continue; }
        if (m.uuid) known.add(m.uuid);
        for (const key of Object.keys(m.subMetas || {})) {
            const sub = m.subMetas[key];
            if (sub && sub.uuid) known.add(sub.uuid);
        }
    }
})('assets');

const missing = new Map(); // uuid -> nơi dùng đầu tiên
(function walkUuid(o, where) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach((v, i) => walkUuid(v, `${where}[${i}]`)); return; }
    if (typeof o.__uuid__ === 'string') {
        if (!known.has(o.__uuid__) && !missing.has(o.__uuid__)) missing.set(o.__uuid__, where);
        return;
    }
    for (const k of Object.keys(o)) walkUuid(o[k], `${where}.${k}`);
})(d, '');
for (const [uuid, where] of missing) {
    console.log(`ASSET KHÔNG CÓ ${uuid} (dùng ở ${where})`);
    bad++;
}

console.log(bad === 0 ? `ok — ${d.length} object, không thấy lỗi` : `${bad} lỗi`);
process.exit(bad === 0 ? 0 : 1);
