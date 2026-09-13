/**
 * Tắt **meshopt** (`meshCompress.encode`) cho mọi model, và ép nhập lại những
 * asset đang có mesh bị mã hoá sẵn trong `library/`.
 *
 *   tools/node.sh tools/scene/no_mesh_encode.js          # xem sẽ làm gì
 *   tools/node.sh tools/scene/no_mesh_encode.js --write  # làm thật
 *   tools/node.sh tools/scene/no_mesh_encode.js --write --all
 *
 * Vì sao: bản build một-file (super-html playable) **không nạp được wasm**, mà
 * meshopt thì cần đúng cái wasm đó để giải mã. Mở game ra là một tràng
 *
 *     Error 16352 ... PD.decodeVertexBuffer is not a function
 *
 * — mỗi mesh bị mã hoá một dòng, và mesh đó không hiện. Trên trình duyệt lúc
 * `Preview` thì lại chạy, nên lỗi chỉ lộ ra sau khi build.
 *
 * Hai tầng phải cùng tắt, và đây là chỗ dễ nhầm nhất:
 *
 *  - `meshCompress.compress` (**zlib**) — engine tự giải nén, **không cần wasm**,
 *    cứ để bật cho nhẹ file. Cả bộ `assets/ancient_setup/` đang dùng đường này và
 *    chạy tốt trong build.
 *  - `meshCompress.encode` (**meshopt**) — chính là thủ phạm. Phải tắt.
 *
 * Và tắt trong `.meta` thôi thì **chưa đủ**: `library/` giữ bản đã nhập từ trước.
 * Ba asset gây lỗi đều đã ghi `"encode": false` trong meta rồi, mà mesh trong
 * `library/` vẫn `"encoded": true` — meta bị sửa mà asset không được nhập lại.
 * Nên script này còn xoá phần `library/` + `temp/asset-db/` của chúng để Cocos
 * Creator dựng lại lúc mở project.
 *
 * Mặc định chỉ đụng vào những asset **thật sự nằm trong build** — đi từ
 * `scene.scene` ra, theo cả tham chiếu trong `library/` chứ không riêng file
 * `.prefab`. Thiếu bước đọc `library/` là bỏ sót đúng mấy mesh nằm sâu: `.prefab`
 * chỉ nhắc tới *cây node* của glb, còn mesh thì nằm thêm một tầng nữa (cây kiếm
 * gắn vào tay hero là ví dụ).
 *
 * `--all` thì sửa và nhập lại **mọi** model trong `assets/`. Đó mới là luật đúng
 * cho cả project (không bao giờ encode), nhưng sửa `userData` của một `.meta` là
 * Cocos nhập lại asset đó lúc mở project — mà `Dungeon_Necropolis_1.fbx` một mình
 * đã 1447 mesh và không nằm trong build. Nên mặc định để hẹp.
 *
 * Chạy xong **phải mở Cocos Creator một lần** cho nó nhập lại, rồi mới build.
 */

const fs = require('fs');
const path = require('path');

const WRITE = process.argv.includes('--write');
const ALL = process.argv.includes('--all');

const SCENE = 'assets/Scene/scene.scene';
const LIB = 'library';
const TEMP = path.join('temp', 'asset-db', 'assets');

/** Bộ nén muốn có ở mọi model: zlib bật (engine tự giải), meshopt tắt. */
const WANT = { enable: true, compress: true, encode: false };

// ------------------------------------------------------------------ quét file

/** Ghi `.meta` đúng kiểu editor ghi: 2 dấu cách, và **có** dấu xuống dòng cuối. */
function writeMeta(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function walkDir(dir, out) {
    if (!fs.existsSync(dir)) return out;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walkDir(p, out);
        else out.push(p);
    }
    return out;
}

const metaFiles = walkDir('assets', []).filter((f) => f.endsWith('.meta'));

/** uuid (kể cả subasset) -> file nguồn. */
const owner = new Map();
/** file nguồn -> mọi uuid của nó. */
const uuidsOf = new Map();

function note(src, uuid) {
    if (!uuid) return;
    owner.set(uuid, src);
    if (!uuidsOf.has(src)) uuidsOf.set(src, new Set());
    uuidsOf.get(src).add(uuid);
}

const models = [];
for (const f of metaFiles) {
    let d;
    try { d = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { continue; }
    const src = f.slice(0, -5);
    note(src, d.uuid);
    for (const k of Object.keys(d.subMetas || {})) note(src, d.subMetas[k] && d.subMetas[k].uuid);
    const af = d.userData && d.userData.assetFinder;
    if (af) {
        for (const arr of Object.values(af)) {
            if (Array.isArray(arr)) for (const u of arr) note(src, u);
        }
        if (Array.isArray(af.meshes) && af.meshes.length > 0) models.push({ meta: f, src, data: d });
    }
}

// --------------------------------------------------- mesh nào đang bị meshopt

const RE_ENC = /"encoded"\s*:\s*true/;

function libJson(uuid) {
    const f = path.join(LIB, uuid.slice(0, 2), uuid + '.json');
    return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
}

/** Asset nào có ít nhất một mesh đã bị mã hoá trong `library/`. */
const encoded = new Map();
for (const m of models) {
    const list = (m.data.userData.assetFinder.meshes || []).filter((u) => {
        const t = libJson(u);
        return t !== null && RE_ENC.test(t);
    });
    if (list.length) encoded.set(m.src, list);
}

// ------------------------------------------- asset nào thật sự nằm trong build

const RE_UUID = /"__uuid__"\s*:\s*"([^"]+)"/g;

function reachable() {
    const seen = new Set();
    const queue = [];
    const scan = (txt) => {
        let m;
        RE_UUID.lastIndex = 0;
        while ((m = RE_UUID.exec(txt))) {
            if (!seen.has(m[1])) { seen.add(m[1]); queue.push(m[1]); }
        }
    };
    scan(fs.readFileSync(SCENE, 'utf8'));
    const doneFiles = new Set([SCENE]);
    while (queue.length) {
        const u = queue.shift();
        const src = owner.get(u) || owner.get(u.split('@')[0]);
        // Prefab/scene: đọc file gốc, tham chiếu nằm thẳng trong đó.
        if (src && (src.endsWith('.prefab') || src.endsWith('.scene')) && !doneFiles.has(src)) {
            doneFiles.add(src);
            try { scan(fs.readFileSync(src, 'utf8')); } catch (e) { /* ignore */ }
        }
        // Còn quan hệ *subasset* (cây node của glb -> mesh của nó) thì chỉ có
        // trong `library/`, file `.prefab` không nhắc tới. Thiếu bước này là bỏ
        // sót đúng những mesh nằm sâu, ví dụ cây kiếm gắn vào tay hero.
        const t = libJson(u);
        if (t) scan(t);
    }
    return seen;
}

const inBuild = reachable();
const used = new Set();
for (const [src, list] of encoded) {
    if (list.some((u) => inBuild.has(u))) used.add(src);
}

// ------------------------------------------------------------------ báo cáo

console.log(`${models.length} model trong assets/, ${encoded.size} cái có mesh đã bị meshopt trong library/`);
console.log('');
console.log('Nằm trong build (đi từ scene ra) — phải nhập lại:');
if (used.size === 0) console.log('  (không có)');
for (const src of used) {
    console.log(`  ${String(encoded.get(src).length).padStart(4)} mesh  ${src.split(path.sep).join('/')}`);
}
if (encoded.size > used.size) {
    console.log('');
    console.log(`Không nằm trong build (${encoded.size - used.size} asset)${ALL ? ' — --all nên vẫn nhập lại' : ' — bỏ qua, dùng --all nếu muốn'}:`);
    for (const [src, list] of encoded) {
        if (used.has(src)) continue;
        console.log(`  ${String(list.length).padStart(4)} mesh  ${src.split(path.sep).join('/')}`);
    }
}

// ---------------------------------------------------------------- sửa `.meta`

/** Model có ít nhất một uuid nằm trong build. */
const modelInBuild = (m) => [...(uuidsOf.get(m.src) || [])].some((u) => inBuild.has(u));

console.log('');
console.log('meta phải đặt lại meshCompress.encode = false:');
let metaChanged = 0;
for (const m of models) {
    if (!ALL && !modelInBuild(m)) continue;
    const ud = m.data.userData;
    const mc = ud.meshCompress;
    const need = !mc || mc.encode !== false;
    if (!need) continue;
    // Meta không có `meshCompress` thì importer lấy mặc định của editor — mà mặc
    // định đó chính là cái đã mã hoá cả đống mesh trong `library/`. Phải ghi hẳn
    // ra, không để trống.
    const before = JSON.stringify(mc || null);
    ud.meshCompress = mc ? Object.assign({}, mc, { encode: false }) : Object.assign({}, WANT);
    metaChanged += 1;
    console.log(`  ${before} -> ${JSON.stringify(ud.meshCompress)}  ${m.src.split(path.sep).join('/')}`);
    if (WRITE) writeMeta(m.meta, m.data);
}
console.log('');
console.log(`meta: ${metaChanged} model cần đặt lại meshCompress.encode = false`
    + (ALL ? ' (mọi model)' : ' (chỉ model nằm trong build)'));

// ------------------------------------------------------- ép nhập lại (xoá cache)

const targets = ALL ? [...encoded.keys()] : [...used];
let removed = 0;

function rmAll(p) {
    if (!fs.existsSync(p)) return 0;
    if (WRITE) fs.rmSync(p, { recursive: true, force: true });
    return 1;
}

for (const src of targets) {
    const ids = uuidsOf.get(src) || new Set();
    let n = 0;
    for (const u of ids) {
        const dir = path.join(LIB, u.slice(0, 2));
        if (fs.existsSync(dir)) {
            for (const name of fs.readdirSync(dir)) {
                if (name.startsWith(u + '.') || name === u) n += rmAll(path.join(dir, name));
            }
        }
        n += rmAll(path.join(TEMP, u.slice(0, 2), u));
    }
    // `imported: false` để asset-db chắc chắn nhập lại, không chỉ trông vào việc
    // thiếu file trong `library/`.
    const meta = src + '.meta';
    if (WRITE && fs.existsSync(meta)) {
        const d = JSON.parse(fs.readFileSync(meta, 'utf8'));
        d.imported = false;
        writeMeta(meta, d);
    }
    removed += n;
    console.log(`  ${src.split(path.sep).join('/')}: ${ids.size} uuid, ${n} mục cache`);
}

console.log('');
if (!WRITE) {
    console.log(`(xem trước) sẽ sửa ${metaChanged} meta và xoá ${removed} mục cache. Chạy lại với --write.`);
} else {
    console.log(`đã sửa ${metaChanged} meta, xoá ${removed} mục cache.`);
    console.log('Giờ mở Cocos Creator một lần cho nó nhập lại, rồi build lại.');
}
