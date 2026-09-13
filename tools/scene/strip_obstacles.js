/**
 * Dọn node hộp chặn của trang trí ra khỏi scene.
 *
 *   tools/node.sh tools/scene/strip_obstacles.js          # xem sẽ dọn gì
 *   tools/node.sh tools/scene/strip_obstacles.js --write  # dọn thật
 *
 * Mỗi phòng để sẵn cả ba bộ trang trí, mỗi bộ có một node `Obstacles` chứa mấy
 * chục node `Obs_*` kèm `cc.BoxCollider`. Ba bộ, ba phòng — vài trăm node và
 * chừng ấy collider nằm trong scene.
 *
 * Mà **không cái nào được bật**: `RoomSelectManager.decorBlocks` đang tắt, tức
 * trang trí đi xuyên qua được, và `applyDecorBlocking` tắt hẳn node `Obstacles`
 * của cả ba bộ mỗi lần vào phòng. Chúng chỉ còn tốn lúc nạp scene và tốn mỗi lần
 * `CharacterCollision.refreshWorldColliders()` quét cả cây.
 *
 * Nên dọn — nhưng **giữ lại node `Obstacles` rỗng**:
 *  - `RoomDecor.obstacles` vẫn trỏ được vào đó, `applyDecorBlocking` và
 *    `rebakeNav` không phải sửa một dòng nào;
 *  - `roomcheck.js` lấy ma trận world của chính node ấy để đặt hộp nó tự tính;
 *  - `room_decors.js` dựng lại đám `Obs_*` vào đúng đó bất cứ lúc nào — bật
 *    `decorBlocks` trở lại thì chạy `room_decors.js` một lần là có đủ.
 *
 * Trước khi xoá, đối chiếu từng hộp đang có với hộp mà `room_geometry.js` tính
 * lại từ prefab. Lệch một cái là **không xoá gì**: lệch nghĩa là đám hộp trong
 * scene không dựng lại được, mà xoá xong mới biết thì đã muộn.
 */

const L = require('./lib.js');
const G = require('./room_geometry.js');
const { DECORS } = require('./room_layout.js');

const write = process.argv.includes('--write');
const d = L.load();

const boxKey = (x, z, sx, sz, h) => [x, z, sx, sz, h].map((v) => v.toFixed(3)).join(',');

const rooms = L.nodePath(d, 'CombatScene/Environment/Rooms');
const slots = d[rooms]._children.map((c) => c.__id__);

const cache = new Map();
const doomed = [];
let problems = 0;
let boxes = 0;

for (const room of slots) {
    const decorsRoot = L.childIndex(d, room, 'Decors');
    if (decorsRoot < 0) throw new Error(`${d[room]._name}: không có node "Decors"`);

    for (const ref of d[decorsRoot]._children) {
        const decor = ref.__id__;
        const obstacles = L.childIndex(d, decor, 'Obstacles');
        if (obstacles < 0) throw new Error(`${d[room]._name}/${d[decor]._name}: không có node "Obstacles"`);

        const kids = (d[obstacles]._children || []).map((c) => c.__id__);
        if (kids.length === 0) continue;

        // Bộ nào: hỏi `RoomDecor.displayName` chứ không tin thứ tự node.
        const comp = d[L.componentOf(d, decor, L.scriptType('assets/Scripts/Gameplay/Map/RoomDecor.ts'))];
        const set = DECORS.find((s) => s.name === comp.displayName);
        if (!set) {
            console.log(`  LỖI  ${d[room]._name}/${d[decor]._name}: displayName "${comp.displayName}" `
                + `không có trong bảng DECORS (${DECORS.map((s) => s.name).join(', ')})`);
            problems += 1;
            continue;
        }
        if (!cache.has(set.prefab)) cache.set(set.prefab, G.decorObstacleBoxes(set.prefab));

        // Đối chiếu: dựng lại được thì mới xoá.
        const want = cache.get(set.prefab)
            .map((b) => boxKey(b.x, b.z, b.sx, b.sz, G.OBSTACLE_H)).sort();
        const got = kids.map((k) => {
            const bc = d[L.componentOf(d, k, 'cc.BoxCollider')];
            const p = d[k]._lpos;
            return boxKey(p.x, p.z, bc._size.x, bc._size.z, bc._size.y);
        }).sort();

        if (got.length !== want.length || got.some((v, i) => v !== want[i])) {
            console.log(`  LỖI  ${d[room]._name}/${d[decor]._name} ("${set.prefab}"): scene có ${got.length} hộp, `
                + `tính lại từ prefab ra ${want.length} hộp và không khớp -> room_decors.js sẽ không dựng lại đúng`);
            problems += 1;
            continue;
        }

        // Node `Obstacles` phải để transform gốc: `roomcheck.js` đặt hộp nó tự
        // tính theo ma trận world của node này, mà hộp thì ở toạ độ cục bộ.
        const p = d[obstacles]._lpos;
        const s = d[obstacles]._lscale;
        if (p.x || p.y || p.z || s.x !== 1 || s.y !== 1 || s.z !== 1) {
            console.log(`  LỖI  ${d[room]._name}/${d[decor]._name}: node Obstacles không ở transform gốc`);
            problems += 1;
            continue;
        }

        doomed.push(...kids);
        boxes += kids.length;
        console.log(`  ${d[room]._name}/${d[decor]._name} ("${set.prefab}"): ${kids.length} hộp`);
    }
}

if (problems) {
    console.log(`\n${problems} chỗ không đối chiếu được — không xoá gì.`);
    process.exit(1);
}
if (boxes === 0) {
    console.log('không còn node hộp nào để dọn.');
    process.exit(0);
}

const nodesBefore = d.filter((o) => L.isNode(o)).length;
for (const k of doomed) L.detach(d, k);
const dropped = L.gc(d);
const nodesAfter = d.filter((o) => L.isNode(o)).length;

console.log(`\nbỏ ${boxes} node hộp + collider: scene ${nodesBefore} -> ${nodesAfter} node, dọn ${dropped} phần tử`);
if (write) {
    L.save(d);
    console.log('đã ghi scene. Bật lại decorBlocks thì chạy room_decors.js để dựng lại.');
} else {
    console.log('chạy lại với --write để dọn thật.');
}
