/**
 * Đặt lại **ba bộ trang trí** của cả ba phòng theo bảng `DECORS` trong
 * `room_layout.js`, lấy hình thẳng từ prefab trong `assets/ancient_setup/`.
 *
 * Trong `assets/ancient_setup/Environment/Anicent/` có năm bộ (`ancient_1..5`)
 * mà panel chọn room chỉ có ba card, nên mỗi lần chỉ ba bộ được dùng. Đây là chỗ
 * đổi: sửa `DECORS` rồi chạy lại file này. **Chạy lại được bao nhiêu lần cũng
 * được** — nó gỡ hình cũ lẫn hộp vật cản cũ rồi dựng lại từ đầu, còn `Decor_j`,
 * `Art`, `Obstacles` và component `RoomDecor` thì giữ nguyên node nên mọi tham
 * chiếu (`RoomSlot.decors`, `RoomDecor.art/obstacles`) không phải nối lại.
 *
 *   tools/node.sh tools/scene/room_decors.js
 *   powershell -ExecutionPolicy Bypass -File tools/node.ps1 tools/scene/room_decors.js
 *
 * **Đóng Cocos Creator trước khi chạy.** Xong thì soi lại — đổi bộ là đổi luôn
 * vùng đặt được, `roomcheck.js` là thứ duy nhất biết chỗ đặt cũ còn trống không:
 *   tools/node.sh tools/scene/validate.js
 *   tools/node.sh tools/scene/roomcheck.js
 *
 * Ba chỗ dễ sai, cả ba đều không kêu tiếng nào lúc chạy game:
 *
 * - **Node bọc ngoài của prefab mang euler y = 180** (quy ước của glb import).
 *   `apply_rooms.js` bỏ hẳn node đó lúc dời vỏ phòng vào scene, nên vỏ phòng
 *   không có vòng xoay ấy. Giữ nó lại ở bộ trang trí là quay cả bộ quanh gốc
 *   phòng: phòng nằm ở z ∈ [1.9, 23.3], quay 180° thì mọi món văng sang z âm,
 *   tức ra ngoài phòng — mở scene lên chỉ thấy phòng trống trơn. Nên node gốc
 *   bản chép bị **đặt lại về xoay 0**, đúng như ba bộ đang có trong scene.
 * - **`_prefab` / `__prefab` phải để `null`.** Bản chép là node thường, không
 *   phải thể hiện prefab — giữ lại thì chúng trỏ vào `cc.PrefabInfo` của file
 *   prefab, mà những phần tử đó không được chép sang, và `validate.js` báo
 *   `__id__` trỏ ra ngoài mảng.
 * - **Hộp vật cản phải sinh lại từ mesh**, không bê hộp cũ sang: bộ khác thì cột
 *   đá với gốc cây đứng chỗ khác. Sinh bằng đúng luật của `room_geometry.js`
 *   (rasterize dải cao 1.0–2.6m rồi gộp ô), giống hệt lúc `apply_rooms.js` dựng.
 */
const fs = require('fs');

const L = require('./lib.js');
const B = require('./build.js');
const G = require('./room_geometry.js');
const { DECORS } = require('./room_layout.js');

// Ba hằng số này ở `room_geometry.js`, không chép lại: `roomcheck.js` và
// `strip_obstacles.js` cũng đọc từ đó, mà lệch một con số là ba bên nói ba kiểu.
const SETUP = G.DECOR_DIR;
const OBSTACLE_H = G.OBSTACLE_H;

const d = L.load();
const b = B.makeBuilder(d);
const { nextId, node, boxCollider } = b;

const T = { RoomDecor: L.scriptType('assets/Scripts/Gameplay/Map/RoomDecor.ts') };

// ------------------------------------------------------------- nhập prefab

/**
 * Khoá không đi theo lúc gom cây: `_parent` trỏ *ngược lên trên* (đi theo là gom
 * luôn cả file), hai khoá prefab thì bỏ hẳn vì bản chép không phải thể hiện prefab.
 */
const SKIP = new Set(['_parent', '_prefab', '__prefab']);

function collectRefs(o, visit) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) {
        for (const v of o) collectRefs(v, visit);
        return;
    }
    if (typeof o.__id__ === 'number') {
        visit(o.__id__);
        return;
    }
    for (const k of Object.keys(o)) if (!SKIP.has(k)) collectRefs(o[k], visit);
}

/** Đổi số mọi `__id__` theo `map`; gặp cái không có trong `map` là ném lỗi. */
function remap(o, map) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) {
        for (const v of o) remap(v, map);
        return;
    }
    if (typeof o.__id__ === 'number') {
        if (!map.has(o.__id__)) throw new Error(`tham chiếu ra ngoài cây được chép: ${o.__id__}`);
        o.__id__ = map.get(o.__id__);
        return;
    }
    for (const k of Object.keys(o)) remap(o[k], map);
}

/**
 * Chép cả cây node từ mảng `src` (một file prefab) vào scene, dưới `parent`.
 *
 * Khác `lib.cloneSubtree` ở chỗ nguồn nằm ở *mảng khác*, và phải đi theo mọi
 * tham chiếu chứ không riêng node/component: `cc.MeshRenderer` còn trỏ sang
 * `cc.ModelBakeSettings`, bỏ sót là `__id__` trỏ ra ngoài mảng.
 *
 * @returns chỉ số node gốc bản chép trong scene.
 */
function importSubtree(src, srcRoot, parent) {
    const ids = [];
    const seen = new Set();
    const visit = (i) => {
        if (seen.has(i)) return;
        seen.add(i);
        ids.push(i);
        collectRefs(src[i], visit);
    };
    visit(srcRoot);

    const map = new Map();
    ids.forEach((old, k) => map.set(old, d.length + k));

    const copies = ids.map((i) => JSON.parse(JSON.stringify(src[i])));
    for (const o of copies) {
        // Cắt hai khoá prefab *trước* khi đổi số: chúng trỏ vào phần tử không
        // được chép sang, để nguyên là `remap` ném lỗi.
        if ('_prefab' in o) o._prefab = null;
        if ('__prefab' in o) o.__prefab = null;
        // `_parent` của node gốc là null trong prefab; nối lại ngay sau vòng này.
        if (o.__type__ === 'cc.Node' && o._parent === null) o._parent = { __id__: srcRoot };
        remap(o, map);
        // `_id` phải 22 ký tự và duy nhất trong file; trong prefab nó là chuỗi rỗng.
        if (typeof o._id === 'string') o._id = nextId(o.__type__ === 'cc.Node' ? 'n' : 'c');
    }
    for (const o of copies) d.push(o);

    const root = map.get(srcRoot);
    d[root]._parent = { __id__: parent };
    d[parent]._children.push({ __id__: root });
    // Xoá vòng xoay 180° của node bọc glb — xem chú thích ở đầu file.
    d[root]._lrot = L.QUAT();
    d[root]._euler = L.V3();
    return root;
}

// --------------------------------------------------------------- đọc nguồn

const sources = DECORS.map((set) => {
    const file = `${SETUP}/${set.prefab}.prefab`;
    if (!fs.existsSync(file)) throw new Error(`không thấy prefab: ${file}`);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const asset = data[0];
    if (!asset || asset.__type__ !== 'cc.Prefab' || !asset.data) throw new Error(`${file}: không phải cc.Prefab`);
    const root = asset.data.__id__;

    // Hộp vật cản: `room_geometry.decorObstacleBoxes` là **nguồn duy nhất**, vì
    // `roomcheck.js` cũng gọi đúng hàm đó để biết vùng đứng được. Chép lại phép
    // tính ở đây là hai bên lệch nhau lúc nào không hay — mà scene thì có thể
    // không giữ node hộp nào (xem `strip_obstacles.js`).
    const boxes = G.decorObstacleBoxes(set.prefab);

    return { set, data, root, boxes };
});

console.log(`ba bộ: ${sources.map((s) => `${s.set.prefab} (${s.set.name}, ${s.boxes.length} hộp)`).join(' / ')}`);

// -------------------------------------------------------------------- chạy

const rooms = L.nodePath(d, 'CombatScene/Environment/Rooms');
const slots = d[rooms]._children.map((c) => c.__id__);

for (const room of slots) {
    const decorsRoot = L.childIndex(d, room, 'Decors');
    if (decorsRoot < 0) throw new Error(`${d[room]._name}: không có node "Decors"`);
    const decorNodes = d[decorsRoot]._children.map((c) => c.__id__);
    if (decorNodes.length !== sources.length) {
        throw new Error(`${d[room]._name}: có ${decorNodes.length} bộ trang trí, bảng DECORS có ${sources.length}`);
    }

    decorNodes.forEach((decor, j) => {
        const { set, data, root, boxes } = sources[j];

        // Hình: gỡ cây cũ rồi chép cây mới vào đúng node `Art` đang có.
        const art = L.childIndex(d, decor, 'Art');
        if (art < 0) throw new Error(`${d[room]._name}/${d[decor]._name}: không có node "Art"`);
        for (const c of [...d[art]._children]) L.detach(d, c.__id__);
        importSubtree(data, root, art);

        // Hộp vật cản: gỡ hết rồi dựng lại theo mesh của bộ mới.
        const obstacles = L.childIndex(d, decor, 'Obstacles');
        if (obstacles < 0) throw new Error(`${d[room]._name}/${d[decor]._name}: không có node "Obstacles"`);
        for (const c of [...d[obstacles]._children]) L.detach(d, c.__id__);
        boxes.forEach((box, k) => {
            const n = node(`Obs_${k}`, obstacles, { pos: [box.x, OBSTACLE_H / 2, box.z] });
            boxCollider(n, box.sx, OBSTACLE_H, box.sz);
        });

        const comp = L.componentOf(d, decor, T.RoomDecor);
        if (comp < 0) throw new Error(`${d[room]._name}/${d[decor]._name}: không có component RoomDecor`);
        d[comp].displayName = set.name;
    });

    console.log(`${d[room]._name}: ${sources.map((s) => s.set.prefab).join(', ')}`);
}

const dropped = L.gc(d);
console.log(`dọn ${dropped} phần tử của hình cũ`);

L.save(d);
console.log('đã ghi scene.');
