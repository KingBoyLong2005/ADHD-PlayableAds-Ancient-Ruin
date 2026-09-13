/**
 * Ghi giá trị mặc định của mấy `@property` mới vào scene.
 *
 * `@property` mới thêm vào một component **không có trong file scene** cho tới
 * khi mở Cocos Creator lưu lại một lần. Lúc chạy thì engine vẫn lấy giá trị mặc
 * định của class nên game đúng, nhưng:
 *   - Inspector không bày ra ô nào để chỉnh;
 *   - `tools/scene/audit_props.js` báo lệch (đúng việc của nó — đó là cách bắt
 *     lỗi gõ sai tên khoá serialize);
 *   - mấy công cụ đọc scene (`roomcheck.js`) phải dùng hằng số dự phòng.
 *
 * Script này viết thẳng mấy khoá đó vào, **đúng bằng default trong file .ts** —
 * sửa default bên đó thì sửa cả ở đây. Chạy lại bao nhiêu lần cũng được; khoá đã
 * có sẵn thì để nguyên, không đè giá trị người ta đã chỉnh tay.
 *
 * **Đóng Cocos Creator trước khi chạy.**
 *
 *   tools/node.sh  tools/scene/apply_flow_props.js
 *   tools/node.ps1 tools/scene/apply_flow_props.js
 */
const fs = require('fs');
const path = require('path');
const lib = require('./lib');

const SCENE = path.join(__dirname, '..', '..', 'assets', 'Scene', 'scene.scene');

const vec3 = (x, y, z) => ({ __type__: 'cc.Vec3', x, y, z });

/**
 * Khoá phải có, theo từng component. Giữ đúng thứ tự khai báo trong file .ts —
 * editor ghi theo thứ tự đó, nên khớp thứ tự thì lần lưu sau không sinh diff.
 */
const WANTED = [
    {
        ts: 'assets/Scripts/Gameplay/Managers/RunDirector.ts',
        props: [
            ['spawnOnRoomPick', true],
            ['exitRun', true],
            ['exitLocalPos', vec3(0.2, 0, 21.8)],
            ['exitArrive', 0.8],
            ['exitTimeout', 8],
            ['prewarmPerFrame', 2],
            ['spawnPerFrame', 4],
        ],
    },
    {
        ts: 'assets/Scripts/Gameplay/Managers/EnemySpawnPoint.ts',
        props: [
            ['spawnClearance', 0.3],
            ['spawnSpacing', 1],
        ],
    },
    {
        ts: 'assets/Scripts/Gameplay/Map/RoomSelectManager.ts',
        props: [
            ['decorBlocks', false],
        ],
    },
    {
        ts: 'assets/Scripts/Gameplay/UI/HpBarAttacher.ts',
        props: [
            ['hideOnDeath', true],
        ],
    },
];

const d = JSON.parse(fs.readFileSync(SCENE, 'utf8'));
let changed = 0;

for (const entry of WANTED) {
    const type = lib.scriptType(entry.ts);
    const name = path.basename(entry.ts, '.ts');
    const hits = d.map((o, i) => [o, i]).filter(([o]) => o && o.__type__ === type);
    if (hits.length === 0) throw new Error(`không thấy ${name} trong scene`);

    let added = 0;
    for (const [comp, i] of hits) {
        if (!('_id' in comp)) throw new Error(`${name}[${i}] không có _id — scene hỏng?`);
        // `_id` phải nằm cuối như editor ghi, nên dựng lại object thay vì gán thêm.
        const out = {};
        for (const [k, v] of Object.entries(comp)) {
            if (k === '_id') {
                for (const [nk, nv] of entry.props) {
                    if (nk in comp) continue;
                    out[nk] = nv;
                    added += 1;
                }
            }
            out[k] = v;
        }
        d[i] = out;
    }
    changed += added;
    console.log(added === 0
        ? `${name}: ${hits.length} bản, không thiếu khoá nào`
        : `${name}: thêm ${added} khoá trên ${hits.length} bản`);
}

if (changed === 0) {
    console.log('scene giữ nguyên');
} else {
    fs.writeFileSync(SCENE, JSON.stringify(d, null, 2));
    console.log(`đã ghi scene (${changed} khoá)`);
}
