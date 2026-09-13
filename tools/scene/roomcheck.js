/**
 * Soi lại mọi chỗ đặt trong ba căn phòng, **với cả ba bộ trang trí**.
 *
 * Bản kế nhiệm của `navcheck.js` cho cơ chế chọn room. Khác biệt đáng kể: bộ
 * trang trí là thứ người chơi chọn *sau khi* scene đã dựng xong, nên một tổ quái
 * đặt vào chỗ trống ở bộ này có thể nằm gọn trong cái bệ đá của bộ kia — phải
 * kiểm cả 3×3 tổ hợp chứ không phải một.
 *
 * Bake lại đúng luật của `NavGrid.bake()`: ô sàn lấy từ AABB thế giới của mesh
 * dưới `floor`, tường + vật cản lấy từ BoxCollider rồi nở thêm `agentRadius`.
 * Nhờ vậy câu trả lời ở đây bằng đúng câu trả lời lúc chạy — ước lượng bằng mắt
 * trên bản đồ ASCII thì rộng tay hơn thực tế, và một tổ đặt lệch nửa mét là cả
 * tổ đẻ ra rồi kẹt trong tường.
 *
 * Ngoài chỗ đứng, còn kiểm ba luật khoảng cách mà chỉ chạy game mới lộ ra:
 *   - tổ nào cũng phải cách chỗ hero xuất phát hơn `aggroRadius` (không thì
 *     người chơi chưa nhúc nhích đã bị lao vào);
 *   - mọi tổ trong một phòng phải nối được với nhau qua `alertRadius` (không thì
 *     nửa phòng đứng nhìn nửa kia đánh, và chặng không bao giờ sạch);
 *   - `leashRadius` phải rộng hơn hẳn `aggroRadius` (không thì đang đánh đã chạm
 *     dây, quái chạy ra chạy vào không dứt).
 *
 * Cả ba luật đó là luật của lối chơi *canh sân*. Tổ nào để "đuổi khắp map"
 * (`aggroRadius` phủ trọn phòng — xem `chase_whole_map.js`) thì cả ba đều không
 * còn nghĩa: không có tổ nào ngủ để mà báo động, cũng không có dây để mà chạm.
 * Với tổ như thế nó chỉ in ra một dòng nhắc rằng thứ duy nhất còn giữ cho người
 * chơi khỏi bị lao vào ngay lúc vào phòng là `RunDirector.combatOnFirstMove`.
 *
 * Chạy: tools/node.sh tools/scene/roomcheck.js
 */
const L = require('./lib.js');
const G = require('./room_geometry.js');
const { DECORS } = require('./room_layout.js');

const d = L.load();

const T = {
    RoomSlot: L.scriptType('assets/Scripts/Gameplay/Map/RoomSlot.ts'),
    RoomDecor: L.scriptType('assets/Scripts/Gameplay/Map/RoomDecor.ts'),
    NavGrid: L.scriptType('assets/Scripts/Gameplay/Map/NavGrid.ts'),
    EnemySpawnPoint: L.scriptType('assets/Scripts/Gameplay/Managers/EnemySpawnPoint.ts'),
    AllyRescue: L.scriptType('assets/Scripts/Gameplay/Hero/AllyRescue.ts'),
    RoomSelectManager: L.scriptType('assets/Scripts/Gameplay/Map/RoomSelectManager.ts'),
    RunDirector: L.scriptType('assets/Scripts/Gameplay/Managers/RunDirector.ts'),
};

const nav = d.find((o) => o && o.__type__ === T.NavGrid);
if (!nav) throw new Error('không thấy NavGrid trong scene');

/**
 * Trang trí có chặn đường lúc chạy không (`RoomSelectManager.decorBlocks`).
 *
 * Tắt thì node `Obstacles` không bao giờ được bật: người và đạn đi xuyên qua cột
 * đổ, thùng, bụi cây, và `NavGrid` lúc chạy chỉ trừ đi tường bao. Mọi phép kiểm
 * chỗ đặt bên dưới **vẫn xét cả ba bộ trang trí**, nhưng lúc đó chúng chỉ còn nói
 * về *hình ảnh* — đặt tổ vào chỗ trống để quái khỏi mọc lẫn trong bụi cây — chứ
 * không còn là chuyện kẹt đường nữa. Và `EnemySpawnPoint.spawnClearance` thì hết
 * tác dụng hẳn: nó hỏi lưới nav, mà lưới lúc chạy không biết tới trang trí.
 */
const DECOR_BLOCKS = (() => {
    const rs = d.find((o) => o && o.__type__ === T.RoomSelectManager);
    return rs && rs.decorBlocks != null ? !!rs.decorBlocks : false;
})();
if (!DECOR_BLOCKS) {
    console.log('chú ý  decorBlocks tắt: trang trí đi xuyên qua được, lưới nav lúc chạy chỉ có tường bao.');
    console.log('       Mấy phép kiểm chỗ đặt dưới đây vì thế chỉ còn nói về hình ảnh, không phải chuyện kẹt đường,');
    console.log('       và EnemySpawnPoint.spawnClearance không còn tác dụng (nó hỏi lưới, mà lưới không biết trang trí).');
}

/**
 * Cửa ra của mỗi phòng, toạ độ **cục bộ trong phòng**: chỗ cả đội tự chạy tới sau
 * khi dọn sạch, trước khi panel chọn room bung ra.
 *
 * Đọc từ `RunDirector.exitLocalPos` trong scene nếu có. Chưa có thì lấy hằng số
 * bên dưới — `@property` mới thêm vào một component **chưa nằm trong file scene**
 * cho tới khi mở editor lưu lại một lần, mà lúc chạy thì engine vẫn lấy giá trị
 * mặc định của class. Giữ hằng số này bằng đúng default trong `RunDirector.ts`.
 */
const EXIT = (() => {
    const rd = d.find((o) => o && o.__type__ === T.RunDirector);
    const p = rd && rd.exitLocalPos;
    return p ? { x: p.x, z: p.z } : { x: 0.2, z: 21.8 };
})();
const CELL = Math.max(0.1, nav.cellSize);
const AGENT = nav.agentRadius;

// ------------------------------------------------------------- ma trận world

const _wm = new Map();
function worldMatrix(i) {
    if (_wm.has(i)) return _wm.get(i);
    const o = d[i];
    const local = trs(o._lpos || { x: 0, y: 0, z: 0 }, o._lrot || { x: 0, y: 0, z: 0, w: 1 }, o._lscale || { x: 1, y: 1, z: 1 });
    const m = o._parent ? mul(worldMatrix(o._parent.__id__), local) : local;
    _wm.set(i, m);
    return m;
}
function trs(t, q, s) {
    const { x, y, z, w } = q;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    return [
        (1 - (yy + zz)) * s.x, (xy + wz) * s.x, (xz - wy) * s.x, 0,
        (xy - wz) * s.y, (1 - (xx + zz)) * s.y, (yz + wx) * s.y, 0,
        (xz + wy) * s.z, (yz - wx) * s.z, (1 - (xx + yy)) * s.z, 0,
        t.x, t.y, t.z, 1,
    ];
}
function mul(a, b) {
    const o = new Array(16).fill(0);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
        o[c * 4 + r] = s;
    }
    return o;
}
function worldPos(i) {
    const m = worldMatrix(i);
    return { x: m[12], y: m[13], z: m[14] };
}
function cornersXZ(m, lo, hi) {
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < 8; i++) {
        const x = i & 1 ? hi.x : lo.x;
        const y = i & 2 ? hi.y : lo.y;
        const z = i & 4 ? hi.z : lo.z;
        const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
        const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
        if (wx < minX) minX = wx;
        if (wx > maxX) maxX = wx;
        if (wz < minZ) minZ = wz;
        if (wz > maxZ) maxZ = wz;
    }
    return [minX, minZ, maxX, maxZ];
}

// ------------------------------------------------------------------ thu gom

function collectFloor(i, out) {
    for (const c of d[i]._components || []) {
        const comp = d[c.__id__];
        if (comp.__type__ !== 'cc.MeshRenderer' || !comp._mesh) continue;
        // Chỉ cần khung bao của sàn, không cần từng tam giác: `NavGrid` cũng chỉ
        // lấy AABB của mesh sàn.
        const tris = G.worldTriangles(d, i, null);
        let lo = { x: Infinity, y: Infinity, z: Infinity };
        let hi = { x: -Infinity, y: -Infinity, z: -Infinity };
        for (const t of tris) for (const p of t) {
            lo = { x: Math.min(lo.x, p[0]), y: Math.min(lo.y, p[1]), z: Math.min(lo.z, p[2]) };
            hi = { x: Math.max(hi.x, p[0]), y: Math.max(hi.y, p[1]), z: Math.max(hi.z, p[2]) };
        }
        out.push(lo.x, lo.z, hi.x, hi.z);
    }
    for (const c of d[i]._children || []) collectFloor(c.__id__, out);
}

function collectBlockers(i, out) {
    for (const c of d[i]._components || []) {
        const comp = d[c.__id__];
        if (comp.__type__ !== 'cc.BoxCollider' || comp._isTrigger || comp._enabled === false) continue;
        const h = comp._size;
        const ctr = comp._center;
        const lo = { x: ctr.x - h.x / 2, y: ctr.y - h.y / 2, z: ctr.z - h.z / 2 };
        const hi = { x: ctr.x + h.x / 2, y: ctr.y + h.y / 2, z: ctr.z + h.z / 2 };
        out.push(...cornersXZ(worldMatrix(i), lo, hi));
    }
    for (const c of d[i]._children || []) collectBlockers(c.__id__, out);
}

// ------------------------------------------------------------------- lưới

/**
 * Hộp chặn của một bộ trang trí, trong toạ độ thế giới.
 *
 * Tính thẳng từ prefab (`room_geometry.decorObstacleBoxes`) chứ **không** đọc node
 * `Obs_*` trong scene: scene không giữ mấy node đó nữa (`strip_obstacles.js` dọn
 * đi vì `decorBlocks` đang tắt, chúng chỉ tốn lúc nạp). Cùng một hàm mà
 * `room_decors.js` dùng để dựng lại chúng khi cần, nên hai bên không lệch được.
 *
 * Node `Obstacles` thì vẫn còn (rỗng) và đây là chỗ lấy ma trận world của nó —
 * hộp trả về ở toạ độ cục bộ trong node ấy.
 */
const _decorBoxes = new Map();
function decorWorldBoxes(dec) {
    const name = dec.displayName;
    const set = DECORS.find((s) => s.name === name);
    if (!set) {
        throw new Error(`RoomDecor "${name}" không có trong bảng DECORS của room_layout.js `
            + `(đang có: ${DECORS.map((s) => s.name).join(', ')}) — chạy room_decors.js chưa?`);
    }
    if (!_decorBoxes.has(set.prefab)) _decorBoxes.set(set.prefab, G.decorObstacleBoxes(set.prefab));

    const anchor = dec.obstacles ? dec.obstacles.__id__ : -1;
    if (anchor < 0) throw new Error(`RoomDecor "${name}" không trỏ tới node Obstacles`);
    const m = worldMatrix(anchor);

    const out = [];
    for (const b of _decorBoxes.get(set.prefab)) {
        const lo = { x: b.x - b.sx / 2, y: 0, z: b.z - b.sz / 2 };
        const hi = { x: b.x + b.sx / 2, y: G.OBSTACLE_H, z: b.z + b.sz / 2 };
        out.push(...cornersXZ(m, lo, hi));
    }
    return out;
}

function bake(floorNode, blockerNodes, extraBoxes) {
    const floors = [];
    collectFloor(floorNode, floors);
    const blockers = extraBoxes ? [...extraBoxes] : [];
    for (const n of blockerNodes) if (n >= 0) collectBlockers(n, blockers);

    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < floors.length; i += 4) {
        minX = Math.min(minX, floors[i]);
        minZ = Math.min(minZ, floors[i + 1]);
        maxX = Math.max(maxX, floors[i + 2]);
        maxZ = Math.max(maxZ, floors[i + 3]);
    }
    const w = Math.max(1, Math.ceil((maxX - minX) / CELL));
    const h = Math.max(1, Math.ceil((maxZ - minZ) / CELL));
    const walk = new Uint8Array(w * h);

    const raster = (boxes, grow, v) => {
        for (let b = 0; b < boxes.length; b += 4) {
            const x0 = Math.max(0, Math.floor((boxes[b] - grow - minX) / CELL));
            const z0 = Math.max(0, Math.floor((boxes[b + 1] - grow - minZ) / CELL));
            const x1 = Math.min(w - 1, Math.ceil((boxes[b + 2] + grow - minX) / CELL));
            const z1 = Math.min(h - 1, Math.ceil((boxes[b + 3] + grow - minZ) / CELL));
            for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) walk[z * w + x] = v;
        }
    };
    raster(floors, 0, 1);
    raster(blockers, AGENT, 0);

    return {
        walkable(x, z) {
            const cx = Math.floor((x - minX) / CELL);
            const cz = Math.floor((z - minZ) / CELL);
            if (cx < 0 || cz < 0 || cx >= w || cz >= h) return false;
            return walk[cz * w + cx] === 1;
        },
    };
}

// ------------------------------------------------------------------ kiểm

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

let problems = 0;
function fail(msg) {
    problems += 1;
    console.log(`  LỖI  ${msg}`);
}

/**
 * Thứ tự phòng lấy từ `RoomSelectManager.slots`, **không** lấy theo thứ tự phần
 * tử trong mảng scene: mở Cocos Creator lưu một lần là editor xếp lại cả mảng,
 * và phòng đầu tiên quét được có thể là Room_1. Thứ tự đó quan trọng vì
 * `CameraFollow` chốt offset khung hình theo mốc của **phòng đầu**.
 */
const manager = d.find((o) => o && o.__type__ === T.RoomSelectManager);
let slots = [];
if (manager && manager.slots && manager.slots.length) {
    slots = manager.slots.map((r) => d[r.__id__]);
} else {
    for (let i = 0; i < d.length; i++) if (d[i] && d[i].__type__ === T.RoomSlot) slots.push(d[i]);
}
if (slots.length === 0) throw new Error('không thấy RoomSlot nào — scene chưa chạy apply_rooms.js?');

/**
 * Hộp sàn ảo phải trùm **cả ba** phòng.
 *
 * Sàn phòng là mesh trần, không có collider nào, nên `Ground_Collider` là thứ
 * duy nhất đỡ `CharacterController`. Hụt một đoạn thì lúc chơi chỉ thấy "nhân
 * vật biến mất ở cuối phòng cuối" — không có lỗi nào được in ra cả.
 */
{
    const ground = L.nodePath(d, 'CombatScene/Environment/Ground_Collider');
    const box = d[L.componentOf(d, ground, 'cc.BoxCollider')];
    const gz = worldPos(ground).z;
    const gx = worldPos(ground).x;
    const lo = gz - box._size.z / 2;
    const hi = gz + box._size.z / 2;
    const xlo = gx - box._size.x / 2;
    const xhi = gx + box._size.x / 2;
    for (const slot of slots) {
        const floors = [];
        collectFloor(slot.floor.__id__, floors);
        for (let i = 0; i < floors.length; i += 4) {
            const name = d[slot.node.__id__]._name;
            if (floors[i + 1] < lo || floors[i + 3] > hi) {
                fail(`sàn ảo phủ z [${lo.toFixed(1)}, ${hi.toFixed(1)}] nhưng sàn ${name} trải `
                    + `[${floors[i + 1].toFixed(1)}, ${floors[i + 3].toFixed(1)}] — nhân vật rơi xuyên chỗ hụt`);
            }
            if (floors[i] < xlo || floors[i + 2] > xhi) {
                fail(`sàn ảo phủ x [${xlo.toFixed(1)}, ${xhi.toFixed(1)}] nhưng sàn ${name} trải `
                    + `[${floors[i].toFixed(1)}, ${floors[i + 2].toFixed(1)}]`);
            }
        }
    }
}

/**
 * Camera đứng yên theo phòng, nên **cả căn phòng phải lọt khung** — không còn ai
 * kéo khung theo hero nữa.
 *
 * Và vì Canvas để `fitHeight` với `fovAxis = VERTICAL`, **máy càng cao thì khung
 * càng hẹp ngang**: một khung vừa khít trên 9:16 vẫn cắt mất hai bên trên 9:19.5.
 * Kiểm cả hai tỉ lệ, và kiểm *vùng chơi* (chỗ hero/quái/đồng đội thật sự đứng)
 * chặt hơn lòng phòng — tường trôi ra ngoài mép thì thôi, chứ hero mà trôi ra là
 * người chơi mất dấu nhân vật.
 */
{
    const cam = L.nodePath(d, 'CombatScene/Main Camera');
    const camComp = d[L.componentOf(d, cam, 'cc.Camera')];
    const m = worldMatrix(cam);
    const authored = { x: m[12], y: m[13], z: m[14] };
    // `CameraFollow.useAuthoredFraming` chốt offset bằng khoảng cách camera–mốc
    // *đang đặt trong scene*, rồi dùng lại đúng offset đó ở mọi phòng. Nên phải
    // dời máy theo mốc từng phòng mới ra khung thật, chứ không đo cả ba phòng
    // bằng chỗ máy đang đứng.
    const anchor0 = worldPos(slots[0].cameraAnchor.__id__);
    const offset = { x: authored.x - anchor0.x, y: authored.y - anchor0.y, z: authored.z - anchor0.z };
    let pos = authored;
    const right = [m[0], m[1], m[2]];
    const up = [m[4], m[5], m[6]];
    const fwd = [-m[8], -m[9], -m[10]];       // camera nhìn theo -Z cục bộ
    const tanV = Math.tan((camComp._fov / 2) * Math.PI / 180);

    const frame = (p, aspect) => {
        const v = [p.x - pos.x, p.y - pos.y, p.z - pos.z];
        const dot = (a) => a[0] * v[0] + a[1] * v[1] + a[2] * v[2];
        const depth = dot(fwd);
        if (depth <= 0) return { h: Infinity, v: Infinity };
        return { h: Math.abs(dot(right) / depth / (tanV * aspect)), v: Math.abs(dot(up) / depth / tanV) };
    };

    // Lòng phòng, và vùng thật sự có người đứng (xem room_layout.js).
    const AREAS = [
        { name: 'lòng phòng', x: 5.6, z0: 1.9, z1: 23.3, warnOnly: true },
        { name: 'vùng chơi', x: 3.4, z0: 3.6, z1: 22.2, warnOnly: false },
    ];
    const ASPECTS = [{ name: '9:16', a: 0.5625 }, { name: '9:19.5', a: 0.4615 }];

    console.log(`\n=== khung hình (camera ${pos.y.toFixed(1)}m cao, fov ${camComp._fov}°) ===`);
    for (const slot of slots) {
        const roomZ = worldPos(slot.node.__id__).z;
        const a = worldPos(slot.cameraAnchor.__id__);
        pos = { x: a.x + offset.x, y: a.y + offset.y, z: a.z + offset.z };
        for (const area of AREAS) {
            for (const asp of ASPECTS) {
                let worst = 0;
                for (const sx of [-1, 1]) for (const z of [area.z0, area.z1]) {
                    const q = frame({ x: sx * area.x, y: 0, z: roomZ + z }, asp.a);
                    worst = Math.max(worst, q.h, q.v);
                }
                const pct = (worst * 100).toFixed(0);
                if (worst <= 1) continue;
                const msg = `${d[slot.node.__id__]._name}: ${area.name} tràn khung ${asp.name} (${pct}% > 100%)`;
                if (area.warnOnly) console.log(`  chú ý  ${msg} — tường trôi ra ngoài mép, chấp nhận được`);
                else fail(`${msg} — hero chạy tới đó là ra ngoài màn hình`);
            }
        }
    }
    // Phòng là hộp kín, tường cao 6m, và ba phòng dính lưng nhau — nên bức tường
    // đầu phòng che mất một dải sàn gần. Lùi xa mà chúc thoải là dải đó nuốt luôn
    // chỗ hero xuất phát: người chơi vào phòng mà không thấy nhân vật của mình.
    pos = authored;
    {
        const WALL = { zTop: 1.7, h: 6.0 };
        // z của camera tính theo gốc phòng nó đang ngắm (phòng 0 với máy đã dựng).
        const camZLocal = pos.z - worldPos(slots[0].node.__id__).z;
        // Tia đi qua đỉnh tường rơi xuống sàn ở đâu: đó là mép gần nhất còn thấy.
        const zSeen = WALL.zTop + (WALL.h * (WALL.zTop - camZLocal)) / (pos.y - WALL.h);
        const heroZ = 3.6;
        if (pos.y <= WALL.h) {
            fail(`camera cao ${pos.y.toFixed(1)}m, thấp hơn tường 6m — nhìn thẳng vào mặt tường`);
        } else if (zSeen > heroZ) {
            fail(`tường đầu phòng che sàn tới z=${zSeen.toFixed(1)}, mà hero xuất phát ở z=${heroZ}`
                + ' — vào phòng không thấy nhân vật đâu. Chúc dốc hơn hoặc kéo camera lại gần.');
        } else {
            console.log(`  tường đầu phòng che sàn tới z=${zSeen.toFixed(1)} (hero xuất phát z=${heroZ}) — ok`);
        }
    }

    for (const asp of ASPECTS) {
        let worst = 0;
        for (const sx of [-1, 1]) for (const z of [3.6, 22.2]) {
            const q = frame({ x: sx * 3.4, y: 0, z }, asp.a);
            worst = Math.max(worst, q.h, q.v);
        }
        console.log(`  ${asp.name}: vùng chơi lấp ${(worst * 100).toFixed(0)}% khung`);
    }
}

slots.forEach((slot, si) => {
    const roomName = d[slot.node.__id__]._name;
    const heroStart = worldPos(slot.heroStart.__id__);

    // Tổ quái + đồng đội của phòng này.
    const spawns = [];
    const allies = [];
    const walkChildren = (i) => {
        for (const c of d[i]._components || []) {
            const comp = d[c.__id__];
            if (comp.__type__ === T.EnemySpawnPoint) spawns.push({ comp, pos: worldPos(i), name: d[i]._name });
            if (comp.__type__ === T.AllyRescue) allies.push({ comp, pos: worldPos(i), name: d[i]._name });
        }
        for (const c of d[i]._children || []) walkChildren(c.__id__);
    };
    walkChildren(slot.node.__id__);

    console.log(`\n=== ${roomName}: ${spawns.length} tổ, ${allies.length} đồng đội ===`);

    // --- luật khoảng cách, không phụ thuộc bộ trang trí
    // Tổ "đuổi khắp map": tầm phát hiện phủ trọn lòng phòng (z ∈ [1.9, 23.3])
    // nên chẳng con nào còn ngủ để mà báo động, cũng không có dây để mà chạm.
    const ROOM_LEN = 23.3 - 1.9;
    const wholeMap = (c) => c.aggroRadius >= ROOM_LEN;
    const guards = spawns.filter((s) => !wholeMap(s.comp));
    if (guards.length < spawns.length) {
        console.log(`  ${spawns.length - guards.length}/${spawns.length} tổ để "đuổi khắp map" `
            + '(aggro phủ trọn phòng) -> bỏ qua luật aggro/alert/leash cho mấy tổ đó; '
            + 'thứ duy nhất còn giữ chúng đứng yên lúc vào phòng là RunDirector.combatOnFirstMove');
    }
    for (const s of guards) {
        const aggro = s.comp.aggroRadius;
        const dHero = dist(heroStart, s.pos);
        if (dHero <= aggro) {
            fail(`${s.name} cách chỗ hero xuất phát ${dHero.toFixed(1)}m, không quá aggroRadius ${aggro} `
                + '-> người chơi chưa nhúc nhích đã bị lao vào');
        }
        if (s.comp.leashRadius > 0 && s.comp.leashRadius < aggro * 1.5) {
            fail(`${s.name}: leashRadius ${s.comp.leashRadius} quá sát aggroRadius ${aggro} `
                + '-> đang đánh đã chạm dây, quái chạy ra chạy vào');
        }
    }

    // Báo động lan theo khoảng cách; cả phòng phải nối thành một cụm, không thì
    // nửa phòng đứng canh mãi và chặng không bao giờ sạch. Chỉ xét tổ còn canh
    // sân — tổ đuổi khắp map tự vào trận, không cần ai báo.
    if (guards.length > 1) {
        const seen = new Set([0]);
        const stack = [0];
        while (stack.length) {
            const i = stack.pop();
            for (let j = 0; j < guards.length; j++) {
                if (seen.has(j)) continue;
                const reach = Math.max(guards[i].comp.alertRadius, guards[j].comp.alertRadius);
                if (dist(guards[i].pos, guards[j].pos) <= reach) {
                    seen.add(j);
                    stack.push(j);
                }
            }
        }
        if (seen.size !== guards.length) {
            const lost = guards.filter((_, j) => !seen.has(j)).map((s) => s.name);
            console.log(`  chú ý  báo động không lan tới: ${lost.join(', ')} `
                + '-> chỉ vào trận nhờ lưới vớt regroupAt của RunDirector');
        }
    }

    // --- chỗ đứng: phải trống với **mọi** bộ trang trí, vì bộ nào cũng chọn được
    const grids = slot.decors.map((decRef) => {
        const dec = d[decRef.__id__];
        return { name: dec.displayName, grid: bake(slot.floor.__id__, [slot.walls.__id__], decorWorldBoxes(dec)) };
    });
    const freeEverywhere = (x, z) => grids.every((g) => g.grid.walkable(x, z));
    const roomZ = worldPos(slot.node.__id__).z;

    const checkSpot = (name, pos) => {
        const bad = grids.filter((g) => !g.grid.walkable(pos.x, pos.z)).map((g) => `"${g.name}"`);
        if (bad.length === 0) return;
        fail(`${roomName}: ${name} (cục bộ ${pos.x.toFixed(1)}, ${(pos.z - roomZ).toFixed(1)}) `
            + `nằm trong vật cản của ${bad.join(', ')}${suggest(pos, roomZ)}`);
    };

    checkSpot('chỗ hero xuất phát', heroStart);
    for (const s of spawns) checkSpot(s.name, s.pos);
    for (const a of allies) checkSpot(a.name, a.pos);
    // Cửa ra: chỗ cả đội tự chạy tới sau khi dọn sạch, trước khi panel chọn room
    // bung ra. Nằm trong vật cản của *một* bộ trang trí thôi là đội chạy tới húc
    // tường, hết `exitTimeout` rồi panel mới mở — không có lỗi nào được in ra.
    checkSpot('cửa ra (RunDirector.exitLocalPos)', { x: EXIT.x, z: roomZ + EXIT.z });

    // Đủ chỗ *đứng lọt thân* trong tầm tán chưa. Lưới nav nở vật cản theo
    // `agentRadius` (0.55) còn thân quái ở scale 1.5 rộng hơn thế, nên một ô "đi
    // được" vẫn có thể để nửa con quái lún vào cái thùng — `EnemySpawnPoint` vì
    // vậy đòi thêm `spawnClearance` quanh chỗ đẻ. Hết chỗ đạt chuẩn thì nó nới
    // dần điều kiện chứ không treo, nên đây là *chú ý* chứ không phải lỗi: nó nói
    // trước tổ nào sẽ phải rơi xuống nhánh nới lỏng và mọc chen vào đống thùng.
    for (const s of spawns) {
        const R = s.comp.scatterRadius || 0;
        if (R <= 0) continue;
        const c = s.comp.spawnClearance != null ? s.comp.spawnClearance : 0.3;
        const roomFor = (x, z) => grids.every((g) => g.grid.walkable(x, z)
            && (c <= 0 || (g.grid.walkable(x + c, z) && g.grid.walkable(x - c, z)
                && g.grid.walkable(x, z + c) && g.grid.walkable(x, z - c))));
        let fit = 0;
        for (let x = s.pos.x - R; x <= s.pos.x + R; x += CELL) {
            for (let z = s.pos.z - R; z <= s.pos.z + R; z += CELL) {
                const dx = x - s.pos.x;
                const dz = z - s.pos.z;
                if (dx * dx + dz * dz > R * R) continue;
                if (roomFor(x, z)) fit += 1;
            }
        }
        if (fit < s.comp.count) {
            console.log(`  chú ý  ${s.name}: chỉ ${fit} ô lọt thân trong tầm tán ${R}m `
                + `nhưng đẻ ${s.comp.count} con -> sẽ có con mọc chen vào vật trang trí`);
        }
    }

    console.log(`  đã kiểm ${grids.length} bộ trang trí`);

    // `--mask`: in ra vùng đứng được với *mọi* bộ trang trí, kèm chỗ đang đặt.
    // Đây là bản đồ để chọn chỗ mới — chọn trên bản đồ của một bộ là chắc chắn
    // đụng bộ khác.
    if (process.argv.includes('--mask')) {
        const marks = new Map();
        const mark = (pos, ch) => marks.set(
            `${Math.floor(pos.x / CELL)},${Math.floor((pos.z - roomZ) / CELL)}`, ch);
        mark(heroStart, 'H');
        for (const s of spawns) mark(s.pos, 'S');
        for (const a of allies) mark(a.pos, 'A');

        console.log(`  vùng đứng được với cả ${grids.length} bộ (H=hero, S=tổ quái, A=đồng đội):`);
        for (let cz = Math.ceil(26 / CELL); cz >= 0; cz--) {
            let row = '';
            for (let cx = Math.floor(-8 / CELL); cx <= Math.ceil(8 / CELL); cx++) {
                const key = `${cx},${cz}`;
                const x = (cx + 0.5) * CELL;
                const z = roomZ + (cz + 0.5) * CELL;
                row += marks.has(key) ? marks.get(key) : (freeEverywhere(x, z) ? '.' : ' ');
            }
            const zm = (cz + 0.5) * CELL;
            console.log(`  ${Math.abs(zm - Math.round(zm)) < CELL / 2 ? String(Math.round(zm)).padStart(4) : '    '}${row}`);
        }
    }

    /** Chỗ trống gần nhất, tính theo toạ độ *cục bộ* để chép thẳng vào bảng bố cục. */
    function suggest(pos, baseZ) {
        for (let r = CELL; r <= 6; r += CELL) {
            for (let a = 0; a < 24; a++) {
                const ang = (a / 24) * Math.PI * 2;
                const x = pos.x + Math.cos(ang) * r;
                const z = pos.z + Math.sin(ang) * r;
                if (freeEverywhere(x, z)) {
                    return ` -> gần nhất trống ở (${x.toFixed(1)}, ${(z - baseZ).toFixed(1)}), cách ${r.toFixed(1)}m`;
                }
            }
        }
        return '';
    }
});

console.log(problems === 0 ? '\nok — mọi chỗ đặt đều đứng được ở cả ba bộ trang trí' : `\n${problems} chỗ phải sửa`);
process.exit(problems === 0 ? 0 : 1);
