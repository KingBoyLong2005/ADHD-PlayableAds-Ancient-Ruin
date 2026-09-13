/**
 * Cắt cây điều khiển (`MotionSystem`) ra khỏi prefab nhân vật.
 *
 *   tools/node.sh tools/scene/strip_rig.js          # xem sẽ cắt gì
 *   tools/node.sh tools/scene/strip_rig.js --write  # cắt thật
 *
 * Bộ model xuất từ DCC mang theo **hai** cây xương:
 *
 *   Group/DeformationSystem   xương thật — `cc.Skeleton._joints` trỏ vào đây,
 *                             `SkinnedMeshRenderer` bám vào đây, clip animation
 *                             cũng chỉ nhắc tới đây.
 *   Group/MotionSystem        cây *điều khiển* của người dựng (FK/IK handle).
 *                             Không một node nào trong đó có component, không
 *                             asset nào trỏ tới, và glTF thì bake sẵn transform
 *                             của xương thật nên nó cũng chẳng lái gì.
 *
 * Mà nó chiếm 85% số node của prefab: quái cận chiến 263/305 node, quái bắn xa
 * 295/351, Warrior và Ranger mỗi bên 353/424. Mỗi con quái đẻ ra là chừng ấy node
 * được dựng, và phòng cuối đẻ 16 con **trong đúng một frame** — đó là cú khựng
 * lúc vào phòng, không phải trang trí hay bake lưới.
 *
 * `Character_Mage.prefab` đã sạch từ trước (71 node), nên đây không phải nước đi
 * liều: nó chạy suốt cả ván rồi.
 *
 * Bốn phép kiểm trước khi cắt, sai một cái là dừng, không ghi gì:
 *
 *  1. cả cây `MotionSystem` không có component nào;
 *  2. `cc.Skeleton._joints` của mọi skeleton prefab đang dùng không có đường nào
 *     đi qua `MotionSystem`;
 *  3. `SkeletalAnimation._sockets[].path` cũng vậy — socket là chỗ gắn vũ khí
 *     vào xương, trỏ nhầm là cây kiếm rơi về gốc toạ độ;
 *  4. file clip trong `library/` không nhắc tới chuỗi "MotionSystem" (clip là
 *     `.cconb`, đường dẫn node nằm thẳng trong đó dưới dạng chuỗi UTF-8).
 *
 * Cắt xong phải mở Cocos Creator một lần cho nó nhập lại prefab.
 */

const fs = require('fs');
const L = require('./lib.js');

const TARGETS = [
    'assets/source/ADHD_asset/Prefab/Enemy/Enemy_SkeletonMelee.prefab',
    'assets/source/ADHD_asset/Prefab/Enemy/Enemy_SkeletonMage.prefab',
    'assets/source/ADHD_asset/Prefab/Character/Character_Warrior.prefab',
    'assets/source/ADHD_asset/Prefab/Character/Character_Ranger.prefab',
    'assets/source/ADHD_asset/Prefab/Character/Character_Mage.prefab',
];

const RIG = 'MotionSystem';

/** Đường tới file trong `library/` từ uuid (có thể kèm `@subasset`). */
function libPath(uuid, ext) {
    return `library/${uuid.slice(0, 2)}/${uuid}.${ext}`;
}

function subtree(d, i, out = []) {
    out.push(i);
    for (const c of d[i]._children || []) subtree(d, c.__id__, out);
    return out;
}

/** Mọi uuid asset được nhắc tới trong một phần tử. */
function uuidsIn(o, out = new Set()) {
    if (!o || typeof o !== 'object') return out;
    if (Array.isArray(o)) { for (const v of o) uuidsIn(v, out); return out; }
    if (typeof o.__uuid__ === 'string') out.add(o.__uuid__);
    for (const v of Object.values(o)) uuidsIn(v, out);
    return out;
}

function check(d, path) {
    const problems = [];

    // (1) cây điều khiển phải trống rỗng
    const rigs = [];
    d.forEach((o, i) => { if (o && o.__type__ === 'cc.Node' && o._name === RIG) rigs.push(i); });
    for (const r of rigs) {
        for (const i of subtree(d, r)) {
            const n = (d[i]._components || []).length;
            if (n > 0) problems.push(`${d[i]._name} trong ${RIG} có ${n} component — không phải cây điều khiển trống`);
        }
    }

    // (2) xương thật: joint của mọi cc.Skeleton được nhắc tới
    for (const u of uuidsIn(d)) {
        const f = libPath(u, 'json');
        if (!fs.existsSync(f)) continue;
        let a;
        try { a = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { continue; }
        if (a.__type__ !== 'cc.Skeleton') continue;
        const bad = (a._joints || []).filter((p) => p.split('/').includes(RIG));
        if (bad.length) problems.push(`cc.Skeleton ${u} có ${bad.length} joint đi qua ${RIG}: ${bad[0]}`);
    }

    // (3) socket gắn vũ khí
    for (const o of d) {
        if (!o || o.__type__ !== 'cc.SkeletalAnimation') continue;
        for (const s of o._sockets || []) {
            const sk = d[s.__id__];
            if (sk && typeof sk.path === 'string' && sk.path.split('/').includes(RIG)) {
                problems.push(`socket trỏ vào ${RIG}: ${sk.path}`);
            }
        }
    }

    // (4) clip animation
    let clipsSeen = 0;
    for (const u of uuidsIn(d)) {
        const f = libPath(u, 'cconb');
        if (!fs.existsSync(f)) continue;
        clipsSeen += 1;
        if (fs.readFileSync(f).includes(RIG)) problems.push(`clip ${u} nhắc tới ${RIG}`);
    }
    if (clipsSeen === 0) {
        console.log(`  chú ý  ${path}: không đọc được clip nào trong library/ — mở Cocos Creator một lần rồi chạy lại để phép kiểm (4) có tác dụng`);
    }

    return { rigs, problems };
}

const write = process.argv.includes('--write');
let totalBefore = 0;
let totalAfter = 0;
let failed = 0;

for (const path of TARGETS) {
    if (!fs.existsSync(path)) {
        console.log(`  LỖI  không thấy ${path}`);
        failed += 1;
        continue;
    }
    const d = L.load(path);
    const before = d.filter((o) => L.isNode(o)).length;
    const { rigs, problems } = check(d, path);

    if (problems.length) {
        failed += 1;
        console.log(`  LỖI  ${path}:`);
        for (const p of problems) console.log(`        ${p}`);
        continue;
    }
    if (rigs.length === 0) {
        console.log(`  bỏ qua ${path.split('/').pop()} — đã sạch (${before} node)`);
        totalBefore += before;
        totalAfter += before;
        continue;
    }

    for (const r of rigs) L.detach(d, r);
    L.gc(d);
    const after = d.filter((o) => L.isNode(o)).length;
    totalBefore += before;
    totalAfter += after;
    console.log(`  ${path.split('/').pop()}: ${before} -> ${after} node (bỏ ${before - after})`);
    if (write) L.save(d, path);
}

console.log(`\ntổng: ${totalBefore} -> ${totalAfter} node mỗi bộ prefab`);
if (failed) {
    console.log(`${failed} file không cắt được`);
    process.exit(1);
}
console.log(write ? 'đã ghi. Mở Cocos Creator một lần cho nó nhập lại prefab.' : 'chạy lại với --write để cắt thật.');
