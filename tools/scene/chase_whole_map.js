/**
 * Đổi luật đuổi của quái sang "đuổi khắp map".
 *
 * Bản gốc giữ quái trong phòng của nó bằng tầm phát hiện ngắn (aggro 6/7) cộng
 * dây xích (leash 12). Bản này bỏ cả hai: hero vừa nhúc nhích là cả ổ quái của
 * chặng lao tới, và không con nào quay về chỗ canh nữa.
 *
 * Ba ô phải đổi cùng lúc, thiếu một là không ra hiệu ứng mong muốn:
 *   - `aggroRadius` phủ cả phòng — không thì đám cuối phòng (cách chỗ hero xuất
 *     phát 14–19m) vẫn đứng canh tới khi hero đi tới tận nơi;
 *   - `leashRadius` = 0 — không thì đuổi được 12m là quay đầu về;
 *   - `requireLineOfSight` = false — không thì con nấp sau cột/vại không bao giờ
 *     "thấy" hero và đứng nguyên tới hết trận, cùng một phòng mà con chạy con đứng.
 *
 * Chỉ đụng `EnemySpawnPoint` trong scene (`EnemyAggro` được nó gắn lúc chạy,
 * không có bản serialize nào trong scene lẫn prefab). Chạy lại bao nhiêu lần
 * cũng được. **Đóng Cocos Creator trước khi chạy.**
 *
 *   tools/node.sh  tools/scene/chase_whole_map.js
 *   tools/node.ps1 tools/scene/chase_whole_map.js
 */
const fs = require('fs');
const path = require('path');
const lib = require('./lib');

const SCENE = path.join(__dirname, '..', '..', 'assets', 'Scene', 'scene.scene');

/** Lòng phòng dài 21.4m, rộng 11.2m — 100 là thừa sức phủ, và còn thừa cho map dài hơn. */
const AGGRO = 100;
/** Số tổ đúng như `LAYOUTS` trong room_layout.js dựng ra. Lệch là scene đã đổi. */
const EXPECT = 12;

const d = JSON.parse(fs.readFileSync(SCENE, 'utf8'));
const type = lib.scriptType('assets/Scripts/Gameplay/Managers/EnemySpawnPoint.ts');

let n = 0;
for (const e of d) {
    if (!e || e.__type__ !== type) continue;
    n++;
    e.aggroRadius = AGGRO;
    e.leashRadius = 0;
    e.requireLineOfSight = false;
}

if (n !== EXPECT) {
    throw new Error(`tìm thấy ${n} EnemySpawnPoint, chờ ${EXPECT} — scene đã đổi, xem lại trước khi ghi`);
}

fs.writeFileSync(SCENE, JSON.stringify(d, null, 2));
console.log(`${n} tổ quái: aggroRadius = ${AGGRO}, leashRadius = 0, requireLineOfSight = false`);
