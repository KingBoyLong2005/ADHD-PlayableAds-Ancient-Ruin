/**
 * Soi từng component tự viết trong scene: khoá đã serialize có khớp tên
 * `@property` trong file .ts không.
 *
 * Lệch một chữ thì Cocos im lặng bỏ qua khoá lạ và để property nằm nguyên ở giá
 * trị mặc định — chạy không báo gì, chỉ là mọi thứ nối vào đó thành null.
 *
 * Chạy: powershell -ExecutionPolicy Bypass -File tools/node.ps1 \
 *           tools/scene/audit_props.js [scene] [TênScript ...]
 * Không truyền tên script thì soi hết.
 */
const fs = require('fs');
const path = require('path');
const { compress } = require('./uuid.js');

const SCENE = process.argv[2] || 'assets/Scene/scene.scene';
const ONLY = process.argv.slice(3);

// ------------------------------------------------- uuid nén -> đường dẫn .ts

const byType = new Map();
(function walk(dir) {
    for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) { walk(p); continue; }
        if (!p.endsWith('.ts.meta')) continue;
        const uuid = JSON.parse(fs.readFileSync(p, 'utf8')).uuid;
        byType.set(compress(uuid), p.slice(0, -5));
    }
})('assets/Scripts');

// ------------------------------------------------------ đọc @property từ .ts

/** Bỏ comment `//` và `/* *​/`, giữ nguyên số dòng. Đủ dùng cho mã nguồn của project. */
function stripComments(src) {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
        .replace(/^([^\n'"`]*?)\/\/.*$/gm, '$1');
}

/**
 * Tên các `@property` khai báo trong một file .ts, theo từng class.
 *
 * Phải đếm ngoặc chứ không bắt theo dòng: `@property({ type: ..., tooltip: ... })`
 * trải nhiều dòng, bắt theo dòng thì `type`/`tooltip` bị nhận nhầm là property.
 */
function declaredProps(tsPath) {
    // Bỏ comment trước đã: mấy chỗ cố tình *không* dùng @property lại giải thích
    // điều đó ngay trong comment, và chữ "@property" trong đó làm parser tưởng
    // field ngay dưới là property thật.
    const src = stripComments(fs.readFileSync(tsPath, 'utf8'));
    const out = new Map();
    let cls = null;
    let depth = 0;     // độ sâu ngoặc còn dở của @property(...)
    let armed = false; // vừa đóng một @property, đang chờ tên field

    for (const line of src.split('\n')) {
        const cm = line.match(/^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+(\w+)/);
        if (cm) { cls = cm[1]; if (!out.has(cls)) out.set(cls, new Set()); }

        if (depth > 0 || line.indexOf('@property') >= 0) {
            const tail = depth > 0 ? line : line.slice(line.indexOf('@property'));
            const opens = (tail.match(/\(/g) || []).length;
            const closes = (tail.match(/\)/g) || []).length;
            if (depth === 0 && opens === 0) { armed = true; continue; } // `@property` trần
            depth += opens - closes;
            if (depth <= 0) { depth = 0; armed = true; }
            continue;
        }

        if (!armed || !cls) continue;
        // `private`/`protected` vẫn serialize được khi có @property — SoundManager
        // giữ cả danh sách âm thanh trong một field private.
        const pm = line.match(/^\s*(?:(?:public|private|protected|declare|readonly)\s+)*(\w+)\s*[:=!?]/);
        if (pm) { out.get(cls).add(pm[1]); armed = false; }
    }
    return out;
}

// ------------------------------------------------------------------- so khớp

// khoá engine tự thêm vào mọi component, không phải @property
const ENGINE_KEYS = new Set([
    '__type__', '_name', '_objFlags', '__editorExtras__', 'node', '_enabled', '__prefab', '_id',
]);

const d = JSON.parse(fs.readFileSync(SCENE, 'utf8'));
const seen = new Map();
for (let i = 0; i < d.length; i++) {
    const o = d[i];
    if (!o || typeof o.__type__ !== 'string' || !byType.has(o.__type__)) continue;
    if (!seen.has(o.__type__)) seen.set(o.__type__, []);
    seen.get(o.__type__).push(i);
}

let bad = 0;
for (const [type, idxs] of seen) {
    const ts = byType.get(type);
    const name = path.basename(ts, '.ts');
    if (ONLY.length && !ONLY.includes(name)) continue;

    const props = declaredProps(ts).get(name) || new Set();
    // Gộp khoá của *mọi* bản: một bản có thể thiếu khoá mà bản khác có.
    const keys = new Set();
    for (const i of idxs) for (const k of Object.keys(d[i])) if (!ENGINE_KEYS.has(k)) keys.add(k);

    const unknown = [...keys].filter((k) => !props.has(k));
    const missing = [...props].filter((k) => !keys.has(k));
    if (unknown.length || missing.length) bad++;
    const tag = unknown.length ? 'LẠ   ' : (missing.length ? 'THIẾU' : 'ok   ');
    console.log(`${tag} ${name} — ${idxs.length} bản, ví dụ [${idxs[0]}]`);
    if (unknown.length) console.log(`      khoá trong scene mà .ts không có: ${unknown.join(', ')}`);
    if (missing.length) console.log(`      @property chưa serialize (nhận mặc định): ${missing.join(', ')}`);
}
console.log(bad ? `\n${bad} component lệch` : '\nkhông có component nào lệch');
process.exit(bad ? 1 : 0);
