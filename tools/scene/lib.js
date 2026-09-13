/**
 * Bộ dùng chung cho mấy script sửa `assets/Scene/scene.scene`.
 *
 * File scene là một mảng JSON phẳng, mọi tham chiếu là `__id__` = chỉ số trong
 * mảng. Vì thế **xoá một phần tử là dịch hết phần còn lại** — đó là lý do trước
 * giờ các script chỉ dám thêm vào cuối mảng. Ở đây có `gc()` làm chuyện đó cho
 * đúng: bỏ tham chiếu tới thứ muốn xoá, rồi quét từ phần tử 0 xem còn với tới
 * được những gì, dọn phần còn lại và **đánh số lại toàn bộ** `__id__`.
 *
 * Chạy: tools/node.sh tools/scene/<script>.js  (macOS)
 *       powershell -File tools/node.ps1 tools/scene/<script>.js  (Windows)
 *
 * **Đóng Cocos Creator trước khi chạy** — editor đang mở sẽ ghi đè lại scene.
 */
const fs = require('fs');

const SCENE = 'assets/Scene/scene.scene';

function load(path = SCENE) {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
}

/** Ghi ra đúng kiểu xuống dòng của editor — một dòng dài thì diff git thành "cả file đổi". */
function save(d, path = SCENE) {
    fs.writeFileSync(path, JSON.stringify(d, null, 2), 'utf8');
}

// ------------------------------------------------------------------ tra cứu

function isNode(o) {
    return !!o && o.__type__ === 'cc.Node';
}

/** Chỉ số của node con tên `name` trong `parent`. -1 khi không có. */
function childIndex(d, parent, name) {
    for (const c of d[parent]._children || []) {
        if (d[c.__id__]._name === name) return c.__id__;
    }
    return -1;
}

/**
 * Tra node theo đường dẫn tên, ví dụ `CombatScene/Systems/RunDirector`.
 * Ném lỗi khi không thấy — **đừng hardcode chỉ số**, mở editor lưu scene một lần
 * là cả mảng bị đánh số lại.
 */
function nodePath(d, path, root = 1) {
    let cur = root;
    for (const part of path.split('/')) {
        const next = childIndex(d, cur, part);
        if (next < 0) throw new Error(`không thấy node "${part}" trong đường dẫn "${path}"`);
        cur = next;
    }
    return cur;
}

/** Mọi node tên `name` trong cả scene. */
function nodesNamed(d, name) {
    const out = [];
    for (let i = 0; i < d.length; i++) if (isNode(d[i]) && d[i]._name === name) out.push(i);
    return out;
}

/** Đúng một node tên `name`, ném lỗi khi 0 hoặc >1 — chốt chặn cho việc tra theo tên. */
function nodeNamed(d, name) {
    const hits = nodesNamed(d, name);
    if (hits.length !== 1) throw new Error(`cần đúng 1 node tên "${name}", tìm được ${hits.length}`);
    return hits[0];
}

/** Component kiểu `type` trên node, hoặc -1. `type` là uuid nén của script tự viết. */
function componentOf(d, node, type) {
    for (const c of d[node]._components || []) {
        if (d[c.__id__].__type__ === type) return c.__id__;
    }
    return -1;
}

// -------------------------------------------------------------------- sửa

/** Bỏ node ra khỏi cây. Phần tử vẫn nằm trong mảng cho tới lúc `gc()`. */
function detach(d, id) {
    const p = d[id]._parent;
    if (p) {
        const kids = d[p.__id__]._children;
        const at = kids.findIndex((c) => c.__id__ === id);
        if (at >= 0) kids.splice(at, 1);
    }
    d[id]._parent = null;
}

/**
 * Dọn mọi phần tử không còn với tới được từ phần tử 0, rồi đánh số lại `__id__`.
 *
 * Quét từ 0 là đủ và an toàn: mảng scene được nối hoàn toàn bằng `__id__` từ
 * `cc.SceneAsset` xuống, không có phần tử nào chỉ tồn tại nhờ vị trí của nó.
 *
 * @returns số phần tử đã dọn.
 */
function gc(d) {
    const keep = new Set();
    const stack = [0];
    while (stack.length) {
        const i = stack.pop();
        if (keep.has(i)) continue;
        keep.add(i);
        walkRefs(d[i], (id) => stack.push(id));
    }

    const order = [];
    for (let i = 0; i < d.length; i++) if (keep.has(i)) order.push(i);
    const remap = new Map();
    order.forEach((old, next) => remap.set(old, next));

    const out = order.map((i) => d[i]);
    for (const o of out) walkRefs(o, null, remap);

    const dropped = d.length - out.length;
    d.length = 0;
    for (const o of out) d.push(o);
    return dropped;
}

/** Duyệt mọi `{__id__: n}` trong một phần tử; `remap` có thì ghi đè luôn. */
function walkRefs(o, visit, remap) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) {
        for (const v of o) walkRefs(v, visit, remap);
        return;
    }
    // `{"__id__": n}` là một *phần tử* của mảng cũng thường xuyên như là giá trị
    // của một khoá (`_children` toàn thế), nên phải bắt ở đây chứ không phải lúc
    // duyệt khoá — bắt nhầm chỗ thì `_children` không bao giờ được đi qua và cả
    // cây node biến thành rác.
    if (typeof o.__id__ === 'number') {
        if (visit) visit(o.__id__);
        if (remap) {
            if (!remap.has(o.__id__)) throw new Error(`tham chiếu tới phần tử đã bị dọn: ${o.__id__}`);
            o.__id__ = remap.get(o.__id__);
        }
        return;
    }
    for (const k of Object.keys(o)) walkRefs(o[k], visit, remap);
}

/**
 * Nhân bản cả một cây node (node + component của chúng) vào dưới `parent`.
 *
 * Chỉ đổi số những tham chiếu trỏ *vào trong* cây được chép (`_parent`,
 * `_children`, `node` của component); tham chiếu ra ngoài giữ nguyên, và
 * `__uuid__` của asset thì không đụng tới.
 *
 * @param newId hàm sinh `_id` — bản sao phải mang `_id` mới, trùng `_id` là
 *              editor lẫn lộn hai node và một trong hai biến mất khi lưu.
 * @returns chỉ số của node gốc bản sao.
 */
function cloneSubtree(d, root, parent, newId) {
    const ids = [];
    const collect = (i) => {
        ids.push(i);
        for (const c of d[i]._components || []) ids.push(c.__id__);
        for (const c of d[i]._children || []) collect(c.__id__);
    };
    collect(root);

    const map = new Map();
    ids.forEach((old, k) => map.set(old, d.length + k));

    const copies = ids.map((old) => JSON.parse(JSON.stringify(d[old])));
    for (const o of copies) {
        remapInside(o, map);
        if (typeof o._id === 'string') o._id = newId('k');
    }
    for (const o of copies) d.push(o);

    const newRoot = map.get(root);
    d[newRoot]._parent = { __id__: parent };
    d[parent]._children.push({ __id__: newRoot });
    return newRoot;
}

/** Đổi số các `__id__` có trong `map`, bỏ qua những cái không có. */
function remapInside(o, map) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) {
        for (const v of o) remapInside(v, map);
        return;
    }
    if (typeof o.__id__ === 'number') {
        if (map.has(o.__id__)) o.__id__ = map.get(o.__id__);
        return;
    }
    for (const k of Object.keys(o)) remapInside(o[k], map);
}

// ------------------------------------------------------------------ dựng mới

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** `_id` của node/component: 22 ký tự và phải duy nhất trong file. */
function makeIdFactory(d) {
    const used = new Set();
    for (const o of d) if (o && typeof o._id === 'string') used.add(o._id);
    let n = 0;
    return (prefix) => {
        for (;;) {
            const raw = `${prefix}${(n++).toString(36)}`;
            const id = (raw + '0'.repeat(22)).slice(0, 22);
            if (!used.has(id)) {
                used.add(id);
                return id;
            }
        }
    };
}

/** uuid nén của một script — 5 ký tự đầu, 27 hex còn lại gộp 3 số một thành 2 ký tự base64. */
function compressUuid(uuid) {
    const u = uuid.replace(/-/g, '');
    let out = u.slice(0, 5);
    for (let i = 5; i < u.length; i += 3) {
        const v = parseInt(u.slice(i, i + 3), 16);
        out += BASE64[v >> 6] + BASE64[v & 63];
    }
    return out;
}

/** Đọc uuid nén của script từ file `.ts.meta` cạnh nó. */
function scriptType(tsPath) {
    const meta = JSON.parse(fs.readFileSync(`${tsPath}.meta`, 'utf8'));
    return compressUuid(meta.uuid);
}

const V3 = (x = 0, y = 0, z = 0) => ({ __type__: 'cc.Vec3', x, y, z });
const QUAT = (x = 0, y = 0, z = 0, w = 1) => ({ __type__: 'cc.Quat', x, y, z, w });

module.exports = {
    SCENE, load, save,
    isNode, childIndex, nodePath, nodesNamed, nodeNamed, componentOf,
    detach, gc, walkRefs, cloneSubtree,
    makeIdFactory, compressUuid, scriptType,
    V3, QUAT,
};
