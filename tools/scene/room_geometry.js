/**
 * Đọc *hình học thật* của mấy phòng ancient_* rồi sinh ra danh sách hộp chặn.
 *
 * Vì sao phải đọc tới từng tam giác chứ không lấy AABB của mesh như
 * `MapColliderBaker`: cả bức tường bao của phòng là **một mesh gộp duy nhất**
 * (`SM_AncientRuins_Combine`), AABB của nó là cả căn phòng — bake theo AABB là
 * bịt kín chỗ chơi. Còn đám trang trí thì ngược lại: AABB của một cái cây gồm cả
 * tán lá rộng 5m trong khi thân cây chỉ chừng 1m.
 *
 * Cách làm: giải nén mesh trong `library/`, đưa tam giác về toạ độ thế giới, giữ
 * lại những tam giác nằm trong dải cao ngang tầm người, rồi rasterize xuống lưới
 * ô vuông và gộp ô thành hộp. Kết quả là mấy chục hộp bám sát hình thật.
 *
 * Chạy thẳng để xem bản đồ ASCII của cả ba phòng:
 *   tools/node.sh tools/scene/room_geometry.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const L = require('./lib.js');

/** Cạnh một ô khi rasterize. Bằng `NavGrid.cellSize` để hai bên nói cùng một thứ. */
const CELL = 0.4;

/**
 * Dải cao (mét, toạ độ thế giới) coi là "chặn đường".
 *
 * Dưới `lo` là bụi cỏ và rễ bò sát đất — nhân vật bước qua được, chặn lại thì
 * căn phòng bị băm nát. Trên `hi` là tán cây và mái vòm, đi *ở dưới* được.
 */
const BAND = { lo: 1.0, hi: 2.6 };

// -------------------------------------------------------------- ma trận world

function matFromTRS(t, q, s) {
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
    for (let c = 0; c < 4; c++) {
        for (let r = 0; r < 4; r++) {
            let sum = 0;
            for (let k = 0; k < 4; k++) sum += a[k * 4 + r] * b[c * 4 + k];
            o[c * 4 + r] = sum;
        }
    }
    return o;
}

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const scaleMat = (s) => [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1];

/**
 * Ma trận thế giới của node, tính từ scene chứ không hỏi engine.
 *
 * `extra` nhân *trước* ma trận của node — dùng để hỏi "phòng này sẽ trông thế
 * nào sau khi phóng to 2 lần", trước khi thật sự sửa scene.
 */
function worldMatrix(d, i, cache, extra) {
    if (cache.has(i)) return cache.get(i);
    const o = d[i];
    const local = matFromTRS(
        o._lpos || { x: 0, y: 0, z: 0 },
        o._lrot || { x: 0, y: 0, z: 0, w: 1 },
        o._lscale || { x: 1, y: 1, z: 1 },
    );
    let m = o._parent ? mul(worldMatrix(d, o._parent.__id__, cache, extra), local) : mul(extra || IDENTITY, local);
    cache.set(i, m);
    return m;
}

function apply(m, x, y, z) {
    return [
        m[0] * x + m[4] * y + m[8] * z + m[12],
        m[1] * x + m[5] * y + m[9] * z + m[13],
        m[2] * x + m[6] * y + m[10] * z + m[14],
    ];
}

// --------------------------------------------------------------- đọc mesh

const FORMAT_SIZE = { 11: 4, 21: 8, 25: 4, 26: 8, 32: 12, 44: 16 };
const meshCache = new Map();

function libFile(uuid, ext) {
    const dir = path.join('library', uuid.slice(0, 2));
    const f = path.join(dir, uuid + ext);
    return fs.existsSync(f) ? f : null;
}

/** Tam giác của một mesh, ở toạ độ *cục bộ* của mesh. */
function meshTriangles(uuid) {
    if (meshCache.has(uuid)) return meshCache.get(uuid);

    const jf = libFile(uuid, '.json');
    const bf = libFile(uuid, '.bin');
    if (!jf || !bf) {
        meshCache.set(uuid, null);
        return null;
    }

    const struct = JSON.parse(fs.readFileSync(jf, 'utf8'))._struct;
    let raw = fs.readFileSync(bf);
    // Mesh nén (`compressed`) là zlib thẳng — không giải nén thì offset trong
    // `_struct` trỏ ra ngoài buffer và đọc ra số rác.
    if (struct.compressed) raw = zlib.inflateSync(raw);

    const tris = [];
    for (const p of struct.primitives) {
        const bundle = struct.vertexBundles[p.vertexBundelIndices[0]];
        const view = bundle.view;
        let posOffset = 0;
        for (const a of bundle.attributes) {
            if (a.name === 'a_position') break;
            posOffset += FORMAT_SIZE[a.format] || 0;
        }
        const verts = new Array(view.count);
        for (let i = 0; i < view.count; i++) {
            const at = view.offset + i * view.stride + posOffset;
            verts[i] = [raw.readFloatLE(at), raw.readFloatLE(at + 4), raw.readFloatLE(at + 8)];
        }
        const iv = p.indexView;
        const read = iv && iv.stride === 2 ? (o) => raw.readUInt16LE(o) : (o) => raw.readUInt32LE(o);
        const count = iv ? iv.count : view.count;
        for (let i = 0; i + 2 < count; i += 3) {
            const a = iv ? read(iv.offset + i * iv.stride) : i;
            const b = iv ? read(iv.offset + (i + 1) * iv.stride) : i + 1;
            const c = iv ? read(iv.offset + (i + 2) * iv.stride) : i + 2;
            tris.push([verts[a], verts[b], verts[c]]);
        }
    }
    meshCache.set(uuid, tris);
    return tris;
}

/** Tam giác thế giới của mọi MeshRenderer dưới `root`. */
function worldTriangles(d, root, extra) {
    const cache = new Map();
    const out = [];
    const walk = (i) => {
        for (const c of d[i]._components || []) {
            const comp = d[c.__id__];
            if (comp.__type__ !== 'cc.MeshRenderer' || !comp._mesh) continue;
            const tris = meshTriangles(comp._mesh.__uuid__);
            if (!tris) continue;
            const m = worldMatrix(d, i, cache, extra);
            for (const t of tris) out.push(t.map((v) => apply(m, v[0], v[1], v[2])));
        }
        for (const c of d[i]._children || []) walk(c.__id__);
    };
    walk(root);
    return out;
}

// ------------------------------------------------------- rasterize + gộp hộp

/** Lưới ô đánh dấu, dùng chung cho cả sàn lẫn vật chặn. */
function rasterize(tris, band) {
    const cells = new Set();
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const t of tris) {
        const ys = [t[0][1], t[1][1], t[2][1]];
        if (Math.max(...ys) < band.lo || Math.min(...ys) > band.hi) continue;
        const xs = [t[0][0], t[1][0], t[2][0]];
        const zs = [t[0][2], t[1][2], t[2][2]];
        const x0 = Math.floor(Math.min(...xs) / CELL);
        const x1 = Math.floor(Math.max(...xs) / CELL);
        const z0 = Math.floor(Math.min(...zs) / CELL);
        const z1 = Math.floor(Math.max(...zs) / CELL);
        for (let z = z0; z <= z1; z++) {
            for (let x = x0; x <= x1; x++) {
                cells.add(`${x},${z}`);
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (z < minZ) minZ = z;
                if (z > maxZ) maxZ = z;
            }
        }
    }
    return { cells, minX, minZ, maxX, maxZ };
}

/**
 * Gộp các ô đã đánh dấu thành ít hộp nhất có thể (tham lam: nới ngang trước,
 * rồi nới dọc chừng nào cả hàng còn khớp).
 *
 * Một collider cho mỗi ô 0.4m thì một cái bệ đá thành 90 collider — vừa nặng
 * vừa không đọc nổi trên Inspector.
 */
function mergeCells(cells) {
    const left = new Set(cells);
    const boxes = [];
    const key = (x, z) => `${x},${z}`;
    const sorted = [...left].map((k) => k.split(',').map(Number)).sort((a, b) => a[1] - b[1] || a[0] - b[0]);

    for (const [sx, sz] of sorted) {
        if (!left.has(key(sx, sz))) continue;
        let w = 1;
        while (left.has(key(sx + w, sz))) w++;
        let h = 1;
        for (;;) {
            let ok = true;
            for (let x = sx; x < sx + w; x++) {
                if (!left.has(key(x, sz + h))) { ok = false; break; }
            }
            if (!ok) break;
            h++;
        }
        for (let z = sz; z < sz + h; z++) {
            for (let x = sx; x < sx + w; x++) left.delete(key(x, z));
        }
        boxes.push({
            x: (sx + w / 2) * CELL,
            z: (sz + h / 2) * CELL,
            sx: w * CELL,
            sz: h * CELL,
        });
    }
    return boxes;
}

/** Hộp chặn của phần trang trí trong một phòng, ở toạ độ thế giới. */
function obstacleBoxes(d, decorRoot, scale) {
    const tris = worldTriangles(d, decorRoot, scaleMat(scale));
    const { cells } = rasterize(tris, BAND);
    return mergeCells(cells);
}

/** Bản đồ ASCII để mắt người soi lại — sàn `.`, vỏ phòng `#`, vật cản `O`. */
function asciiMap(d, shellRoot, decorRoot, floorNode, scale) {
    const floor = rasterize(worldTriangles(d, floorNode, scaleMat(scale)), { lo: -1, hi: 1 });
    const shell = rasterize(worldTriangles(d, shellRoot, scaleMat(scale)), { lo: 0.5, hi: 5 });
    const decor = rasterize(worldTriangles(d, decorRoot, scaleMat(scale)), BAND);

    const minX = Math.min(floor.minX, shell.minX);
    const maxX = Math.max(floor.maxX, shell.maxX);
    const minZ = Math.min(floor.minZ, shell.minZ);
    const maxZ = Math.max(floor.maxZ, shell.maxZ);

    const lines = [];
    for (let z = maxZ; z >= minZ; z--) {
        let row = '';
        for (let x = minX; x <= maxX; x++) {
            const k = `${x},${z}`;
            row += decor.cells.has(k) ? 'O' : shell.cells.has(k) ? '#' : floor.cells.has(k) ? '.' : ' ';
        }
        const label = (z * CELL) % 2 === 0 ? String((z * CELL).toFixed(0)).padStart(5) : '     ';
        lines.push(label + row);
    }
    return lines.join('\n');
}

/** Thư mục chứa ba bộ trang trí đang dùng. */
const DECOR_DIR = 'assets/ancient_setup/Environment/Anicent';

/** Node `Art` của mỗi bộ trang trí phóng to bấy nhiêu lần trong scene. */
const DECOR_SCALE = 2;

/** Hộp chặn của trang trí cao đều bấy nhiêu, bất kể vật thật cao bao nhiêu. */
const OBSTACLE_H = 2.2;

/**
 * Hộp chặn của một bộ trang trí, tính thẳng từ file prefab.
 *
 * **Đây là nguồn duy nhất** của mấy cái hộp đó: `room_decors.js` gọi nó để dựng
 * node `Obs_*` trong scene khi cần, còn `roomcheck.js` gọi nó để biết vùng đứng
 * được — nên hai bên không thể lệch nhau, kể cả khi scene *không* giữ node nào.
 *
 * Và scene thì cố tình không giữ: `RoomSelectManager.decorBlocks` đang tắt (trang
 * trí đi xuyên qua được) nên mấy trăm node hộp đó nằm chết trong scene, chỉ tốn
 * lúc nạp. `strip_obstacles.js` dọn chúng đi, `room_decors.js` dựng lại được bất
 * cứ lúc nào.
 *
 * Toạ độ trả về là **cục bộ trong node `Obstacles`** của bộ đó (node ấy để
 * transform gốc), đúng như `room_decors.js` ghi vào scene.
 */
function decorObstacleBoxes(prefabName) {
    const file = `${DECOR_DIR}/${prefabName}.prefab`;
    if (!fs.existsSync(file)) throw new Error(`không thấy prefab trang trí: ${file}`);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const asset = data[0];
    if (!asset || asset.__type__ !== 'cc.Prefab' || !asset.data) throw new Error(`${file}: không phải cc.Prefab`);
    const root = asset.data.__id__;

    // Node bọc ngoài của prefab mang euler y = 180 (quy ước glb); bản chép vào
    // scene bị đặt lại về xoay 0, nên bản dò ở đây cũng phải bỏ vòng xoay đó —
    // giữ lại là cả bộ hộp quay quanh gốc phòng và văng sang z âm.
    const probe = JSON.parse(JSON.stringify(data));
    probe[root]._lrot = L.QUAT();
    probe[root]._euler = L.V3();
    return mergeCells(rasterize(worldTriangles(probe, root, scaleMat(DECOR_SCALE)), BAND).cells);
}

module.exports = {
    CELL, BAND, DECOR_DIR, DECOR_SCALE, OBSTACLE_H,
    worldTriangles, rasterize, mergeCells, obstacleBoxes, asciiMap, scaleMat, decorObstacleBoxes,
};

// --------------------------------------------------------------------- CLI

if (require.main === module) {
    const d = L.load();

    // Hai kiểu scene: đã dựng phòng rồi (đọc từ `Environment/Rooms/Room_0`, hình
    // đã mang scale sẵn) hay còn là scene cũ với mấy node `ancient_*` ở gốc (phải
    // tự nhân thêm hệ số phóng to). `apply_rooms.js` tiêu thụ mấy node gốc đó, nên
    // sau khi dựng xong thì chỉ còn đường thứ nhất.
    let sets = [];
    let scale = Number(process.argv[2] || 2);
    let room = -1;
    try {
        room = L.nodePath(d, 'CombatScene/Environment/Rooms/Room_0');
    } catch (e) { /* scene cũ */ }

    if (room >= 0) {
        scale = 1;   // node `Shell` / `Art` đã mang scale rồi
        const shell = d[L.childIndex(d, room, 'Shell')]._children[0].__id__;
        const floor = d[shell]._children.map((c) => c.__id__).find((i) => d[i]._name === 'Floor');
        const decors = L.childIndex(d, room, 'Decors');
        sets = d[decors]._children.map((c, j) => ({
            name: `Decor_${j}`,
            shell,
            floor,
            decor: d[L.childIndex(d, c.__id__, 'Art')]._children[0].__id__,
        }));
    } else {
        const roots = d[1]._children.map((c) => c.__id__).filter((i) => /^ancient_\d+$/.test(d[i]._name));
        sets = roots.map((root) => {
            const kids = d[root]._children.map((c) => c.__id__);
            const shell = kids.find((i) => d[i]._name === 'P_AcientEasy0');
            const decor = kids.find((i) => i !== shell);
            const floor = d[shell]._children.map((c) => c.__id__).find((i) => d[i]._name === 'Floor');
            return { name: d[root]._name, shell, floor, decor };
        });
    }
    if (sets.length === 0) throw new Error('không thấy phòng nào để đọc');

    for (const set of sets) {
        console.log(`===== ${set.name} (scale ${scale}) =====`);
        console.log(asciiMap(d, set.shell, set.decor, set.floor, scale));
        const boxes = mergeCells(rasterize(worldTriangles(d, set.decor, scale === 1 ? null : scaleMat(scale)), BAND).cells);
        console.log(`${boxes.length} hộp chặn:`);
        for (const b of boxes) {
            console.log(`  x ${b.x.toFixed(2)} z ${b.z.toFixed(2)}  ${b.sx.toFixed(1)} x ${b.sz.toFixed(1)}`);
        }
    }
}
