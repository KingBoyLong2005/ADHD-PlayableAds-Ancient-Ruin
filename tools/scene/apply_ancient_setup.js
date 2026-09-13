/**
 * Áp bộ material đã dựng ở `assets/ancient_setup/` vào hình phòng trong scene.
 *
 * Vì sao cần script này: `apply_rooms.js` **chép** cây node của glb vào scene
 * (vỏ phòng dời thẳng vào, ba bộ trang trí nhân bản ra chín bản). Bản chép giữ
 * luôn `_mesh` + `_materials` của lúc chép, nên sửa material ở asset gốc không
 * chảy ngược vào scene được — phải gán lại tay, và đây là chỗ làm việc đó.
 *
 * Nguồn là bốn asset trong `assets/ancient_setup/`:
 *   - vỏ phòng: prefab nội bộ của `ancient_0.glb` (đọc từ `library/`, vì prefab
 *     của glb là sub-asset chứ không phải file `.prefab` rời);
 *   - ba bộ trang trí: prefab nào thì bảng `DECORS` trong `room_layout.js` nói — cùng bảng
 *     mà `room_decors.js` dùng để nhập hình vào scene, nên hai bên không lệch nhau được.
 *
 * Đối chiếu bằng cách **đi song song hai cây theo tên**, không ghép theo chuỗi
 * đường dẫn: lệch cấu trúc thì nó báo ngay chứ không âm thầm bỏ sót một nhánh.
 *
 * Lấy cả `_mesh` lẫn `_materials` để scene chỉ còn trỏ vào một chỗ
 * (`assets/ancient_setup/`). Mesh trong đó giống hệt bản cũ tới từng byte — script
 * tự dựng lại hộp chặn từ mesh mới rồi so với hộp đang có để chắc chuyện đó.
 *
 * Chạy lại được bao nhiêu lần cũng được (đóng Cocos Creator trước):
 *   tools/node.sh tools/scene/apply_ancient_setup.js
 */
const fs = require('fs');
const path = require('path');

const L = require('./lib.js');
const G = require('./room_geometry.js');
const { DECORS } = require('./room_layout.js');

const SETUP = 'assets/ancient_setup/Environment/Anicent';

// --------------------------------------------------------------- đọc nguồn

/** Prefab nội bộ của một glb — sub-asset, nằm trong `library/` chứ không phải assets/. */
function glbPrefab(glbPath) {
    const meta = JSON.parse(fs.readFileSync(`${glbPath}.meta`, 'utf8'));
    const sub = Object.entries(meta.subMetas || {}).find(([, v]) => v.importer === 'gltf-scene');
    if (!sub) throw new Error(`${glbPath}: không thấy sub-asset gltf-scene`);
    const uuid = `${meta.uuid}@${sub[0]}`;
    const file = path.join('library', uuid.slice(0, 2), `${uuid}.json`);
    if (!fs.existsSync(file)) {
        throw new Error(`chưa import: ${file}\nMở Cocos Creator một lần cho nó dựng library rồi chạy lại.`);
    }
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function prefabRoot(data) {
    const asset = data[0];
    if (!asset || asset.__type__ !== 'cc.Prefab' || !asset.data) throw new Error('không phải cc.Prefab');
    return asset.data.__id__;
}

// ------------------------------------------------------- đi song song hai cây

let applied = 0;
let skipped = 0;
const problems = [];

/**
 * Chép `_mesh` + `_materials` từ cây nguồn sang cây trong scene.
 *
 * `dst`/`src` là chỉ số node trong hai mảng khác nhau, nên mọi thứ phải truyền
 * kèm mảng của nó.
 */
function applyTree(d, dst, srcData, src, trail) {
    const here = `${trail}/${srcData[src]._name}`;
    if (d[dst]._name !== srcData[src]._name) {
        problems.push(`tên lệch: scene "${d[dst]._name}" vs nguồn "${srcData[src]._name}" (${trail})`);
        return;
    }

    const dstMr = (d[dst]._components || []).filter((c) => d[c.__id__].__type__ === 'cc.MeshRenderer');
    const srcMr = (srcData[src]._components || []).filter((c) => srcData[c.__id__].__type__ === 'cc.MeshRenderer');
    if (dstMr.length !== srcMr.length) {
        problems.push(`số MeshRenderer lệch ở ${here}: scene ${dstMr.length} vs nguồn ${srcMr.length}`);
    } else {
        for (let i = 0; i < dstMr.length; i++) {
            const a = d[dstMr[i].__id__];
            const b = srcData[srcMr[i].__id__];
            const before = JSON.stringify([a._mesh, a._materials]);
            a._mesh = b._mesh ? JSON.parse(JSON.stringify(b._mesh)) : null;
            a._materials = JSON.parse(JSON.stringify(b._materials || []));
            if (JSON.stringify([a._mesh, a._materials]) === before) skipped += 1;
            else applied += 1;
        }
    }

    const dstKids = d[dst]._children || [];
    const srcKids = srcData[src]._children || [];
    if (dstKids.length !== srcKids.length) {
        problems.push(`số node con lệch ở ${here}: scene ${dstKids.length} vs nguồn ${srcKids.length}`);
    }
    const n = Math.min(dstKids.length, srcKids.length);
    for (let i = 0; i < n; i++) applyTree(d, dstKids[i].__id__, srcData, srcKids[i].__id__, here);
}

// ------------------------------------------------------------------- chạy

const d = L.load();

const shellSrc = glbPrefab(`${SETUP}/ancient_0.glb`);
const shellRoot = prefabRoot(shellSrc);
// Prefab của glb bọc thêm một tầng node cùng tên file; phần hình nằm ở node con.
const shellArt = shellSrc[shellRoot]._children[0].__id__;

const decorSrc = DECORS.map((set) => {
    const data = JSON.parse(fs.readFileSync(`${SETUP}/${set.prefab}.prefab`, 'utf8'));
    return { data, root: prefabRoot(data) };
});

const rooms = L.nodePath(d, 'CombatScene/Environment/Rooms');
const slots = d[rooms]._children.map((c) => c.__id__);

for (const room of slots) {
    const shell = L.childIndex(d, room, 'Shell');
    // Dưới `Shell` là đúng một node hình (`P_AcientEasy0`).
    applyTree(d, d[shell]._children[0].__id__, shellSrc, shellArt, d[room]._name);

    const decors = L.childIndex(d, room, 'Decors');
    d[decors]._children.forEach((c, j) => {
        const art = L.childIndex(d, c.__id__, 'Art');
        applyTree(d, d[art]._children[0].__id__, decorSrc[j].data, decorSrc[j].root, `${d[room]._name}/Decor_${j}`);
    });
}

console.log(`gán lại ${applied} MeshRenderer (${skipped} cái đã đúng sẵn)`);
for (const p of problems) console.log(`  LỖI  ${p}`);

// ---------------------------------------------- soi lại: hình học có đổi không

// Hộp chặn sinh từ *mesh*, mà mesh vừa bị đổi sang bản trong ancient_setup. Hai
// bản glb giống nhau tới từng byte nên hộp phải y hệt — nếu lệch thì hoặc model
// đã khác thật, hoặc gán nhầm mesh; cả hai đều phải biết ngay chứ không để tới
// lúc chạy game mới thấy nhân vật xuyên qua cái bệ đá.
{
    const room0 = slots[0];
    const shell = d[L.childIndex(d, room0, 'Shell')]._children[0].__id__;
    const walls = G.mergeCells(G.rasterize(G.worldTriangles(d, shell, null), { lo: 0.5, hi: 5 }).cells);
    const have = d[L.childIndex(d, room0, 'Walls')]._children.length;
    console.log(`tường bao: sinh lại từ mesh mới ra ${walls.length} hộp, scene đang có ${have}`
        + (walls.length === have ? ' — khớp' : '  <-- LỆCH'));
    if (walls.length !== have) problems.push('hình học tường đổi -> phải dựng lại collider');

    const decorsNode = L.childIndex(d, room0, 'Decors');
    d[decorsNode]._children.forEach((c, j) => {
        const art = d[L.childIndex(d, c.__id__, 'Art')]._children[0].__id__;
        // `null` chứ không phải SCALE: node `Art` trong scene **đã** mang scale 2
        // rồi, truyền thêm hệ số nữa là tính ra căn phòng to gấp đôi.
        const boxes = G.mergeCells(G.rasterize(G.worldTriangles(d, art, null), G.BAND).cells);
        const cur = d[L.childIndex(d, c.__id__, 'Obstacles')]._children.length;
        console.log(`  Decor_${j}: ${boxes.length} hộp vật cản, scene đang có ${cur}`
            + (boxes.length === cur ? ' — khớp' : '  <-- LỆCH'));
        if (boxes.length !== cur) problems.push(`hình học Decor_${j} đổi -> phải dựng lại collider`);
    });
}

if (problems.length) {
    console.log(`\n${problems.length} chỗ phải xem lại — KHÔNG ghi scene.`);
    process.exit(1);
}

L.save(d);
console.log('đã ghi scene.');
