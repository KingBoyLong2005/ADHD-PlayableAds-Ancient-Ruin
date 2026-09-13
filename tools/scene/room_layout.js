/**
 * Bảng bố cục của ba căn phòng — **nguồn duy nhất** cho mọi chỗ đặt trong ván.
 *
 * `apply_rooms.js` đọc bảng này lúc dựng scene lần đầu; chạy thẳng file này thì
 * nó *đặt lại* các node đã có theo bảng, nên chỉnh số ở đây rồi chạy lại bao
 * nhiêu lần cũng được:
 *   tools/node.sh tools/scene/room_layout.js
 *   tools/node.sh tools/scene/roomcheck.js        # soi lại
 *
 * Mọi toạ độ là **cục bộ trong phòng** (phòng nào cũng cùng một cái vỏ), x ngang
 * z dọc, hero đi theo +Z. Lòng phòng: x ∈ [-5.6, 5.6], z ∈ [1.9, 23.3].
 *
 * Luật phải giữ, `roomcheck.js` kiểm được:
 *
 *  1. **Chỗ đặt phải trống với cả ba bộ trang trí.** Bộ nào cũng chọn được, mà
 *     mỗi bộ chắn một chỗ khác nhau — vùng dùng được là phần giao, hẹp hơn căn
 *     phòng khá nhiều (`roomcheck.js --mask` in ra vùng đó).
 *
 * Hai luật khoảng cách kia (tổ phải cách chỗ hero xuất phát hơn `aggroRadius`;
 * hai tổ vào trận cùng đợt phải cách nhau dưới `alertRadius`) là luật của lối
 * chơi *canh sân*, và **không còn áp** cho bố cục hiện tại: cả 12 tổ để "đuổi
 * khắp map" (`aggroRadius` 100, `leashRadius` 0 — xem `chase_whole_map.js`), nên
 * không có tổ nào ngủ để mà báo động, cũng không có dây để mà chạm. Thứ duy nhất
 * giữ cho người chơi khỏi bị lao vào ngay lúc vào phòng là
 * `RunDirector.combatOnFirstMove`. `roomcheck.js` vẫn giữ nguyên hai luật đó và
 * tự bỏ qua cho tổ nào có aggro phủ trọn phòng — quay lại lối chơi canh sân thì
 * chúng sống lại, khỏi phải viết lại.
 */

/** Chỗ cả đội đứng khi vào phòng. */
const HERO_START = { x: 0, z: 3.6 };

/**
 * Khung hình lúc đánh. Camera **không bám hero**: nó đứng yên ở khung hình của
 * phòng và chỉ trôi sang phòng kế sau khi dọn sạch quái.
 *
 * Bốn số này ra từ một phép giải, không phải ướm mắt. Ba ràng buộc chọi nhau:
 *
 * 1. **Bề ngang mới là thứ chặn, không phải chiều dài.** Lòng phòng rộng 11.2m;
 *    với `fovAxis = VERTICAL`, fov 45 và khung dọc thì nửa góc ngang chỉ 13.1°
 *    (9:16) hay 10.8° (9:19.5) — phải lùi rất xa mới ôm hết bề ngang, trong khi
 *    chiều dài 21.4m thì lùi thế đã thừa chỗ.
 * 2. **Vì `fitHeight`, máy càng cao thì khung càng hẹp ngang.** Một khung vừa khít
 *    trên 9:16 vẫn cắt hai bên trên 9:19.5.
 * 3. **Phòng là hộp kín, tường cao 6m, ba phòng dính lưng nhau.** Lùi xa mà chúc
 *    thoải thì *bức tường đầu phòng* che mất dải sàn gần: sàn chỉ thấy được từ
 *    z ≈ 1.7 + 6/tan(góc tia qua đỉnh tường) trở đi. Ở chúc 40° xa 30m thì dải bị
 *    che kéo tới z ≈ 8.8 — nuốt luôn cả chỗ hero xuất phát (z 3.6). Đây là lý do
 *    khung phải chúc dốc, không phải vì thẩm mỹ.
 *
 * Bộ số hiện tại (B): thấy trọn lòng phòng trên 9:16, trên 9:19.5 thì hai mép
 * tường trôi ra ngoài (118%) còn vùng chơi vẫn lọt (90%). Hai bộ khác đã tính
 * sẵn, đổi thẳng vào đây rồi chạy lại file này:
 *
 *   A.  { aimZ: 9,    dist: 21.5, pitch: 59 }  gần nhất -> nhân vật to nhất,
 *       nhưng hai mép tường trôi ra ngoài khung ở mọi máy (129%).
 *   B.  { aimZ: 8.5,  dist: 27,   pitch: 64 }  ← đang dùng. Trọn lòng phòng trên
 *       9:16 (100%), trên 9:19.5 thì hai mép tường trôi ra (122%).
 *   C.  { aimZ: 9.5,  dist: 31.5, pitch: 80 }  trọn phòng trên *mọi* máy, gần như
 *       nhìn thẳng từ trên xuống.
 *   D.  { aimZ: 12.6, dist: 26.5, pitch: 90 }  thẳng đứng hẳn, trọn phòng 9:16.
 *   D+. { aimZ: 12.6, dist: 30,   pitch: 90 }  thẳng đứng, trọn phòng mọi máy.
 *
 * `pitch: 90` cho euler (-90, 180, 0): nhìn thẳng xuống, và chiều "lên" trên màn
 * hình là +Z — tức là càng vào sâu trong phòng càng lên phía trên khung, đúng
 * chiều hero đi.
 *
 * `roomcheck.js` kiểm lại cả ba ràng buộc sau mỗi lần đổi.
 */
/**
 * `nudgeZ`: kéo máy về phía +Z thêm bấy nhiêu mét **sau** khi đã tính theo công
 * thức trên, mà **không** dời mốc ngắm.
 *
 * Đây là chỗ ghi lại một lần chỉnh tay trong editor: công thức đặt máy ở
 * z = 8.5 − 27·cos64° = −3.34, còn trong scene thì máy đứng ở z = 0. Hai thứ đó
 * không quy về nhau bằng cách sửa `aimZ` được — đổi `aimZ` là dời cả
 * `RoomSlot.cameraAnchor`, mà `CameraFollow.useAuthoredFraming` chốt khung hình
 * bằng đúng *khoảng cách máy–mốc*, nên khung sẽ đổi theo. Máy lệch mốc 8.5m thay
 * vì 11.84m là khung hình khác hẳn.
 *
 * Để 0 thì máy về đúng công thức (khung ôm trọn lòng phòng trên 9:16, 100%);
 * để 3.336 thì máy giữ đúng chỗ đang chỉnh tay (lùi gần hơn, lòng phòng tràn
 * khung 106% trên 9:16 — hai mép tường trôi ra ngoài). `roomcheck.js` in ra con
 * số đó sau mỗi lần đổi.
 */
const CAMERA = { aimZ: 8.5, dist: 27, pitch: 64, nudgeZ: 3.3360209633050916, lerp: 3, arriveDistance: 0.4 };

// `damage` ở đây là bộ số **đang chạy**, không phải số gốc: cả 12 tổ đều bật
// `overrideStats` nên prefab quái không còn nói gì, và CLI bên dưới ghi đè cả bộ
// này xuống scene mỗi lần chạy — sửa damage trong scene mà quên sửa ở đây thì lần
// chạy sau là mất.
//
// `separationRadius` **phải khớp với thân thật, và phải nhỏ hơn tầm đứng đánh** —
// đây là chỗ dễ hỏng nhất trong bảng này. Ba con số ràng buộc nhau:
//
//   thân thật     `CapsuleCharacterController` để mặc định (bán kính 0.5) nhân
//                 scale 1.5 = 0.75 -> hai thân chạm nhau ở **1.5m**.
//   đứng đánh     `EnemyMeleeAI` áp vào tới `meleeRange * approachPercent`
//                 = 2 * 0.85 = **1.7m** mới dừng, và phải rớt quá `meleeRange`
//                 (2m) mới chạy tiếp.
//   giãn cách     `EntitySeparation` giữ hai con cách nhau `sep + sep`.
//
// Để `sep` 1.2 là hai con quái giữ nhau **2.4m** — mà vòng tròn bán kính 1.7m
// quanh hero chỉ dài 10.7m, tức **vừa đúng 4 con**. Phòng nào cũng 5–12 con, nên
// số còn lại vĩnh viễn nằm ngoài vạch: đi vào, bị đồng bọn hất ra quá 2m, lại đi
// vào. Nhìn ra đúng cảnh "cả đám cứ dí sát vào người hero mà không con nào đứng
// yên đánh". Ở 0.8 thì hai con giữ nhau 1.6m (vừa chạm thân) và vòng trong chứa
// được 6 con, số còn lại xếp thành vòng thứ hai chứ không chen.
const STATS_MELEE = {
    __type__: 'StatsProfile',
    hpMax: 90, moveSpeed: 5, damage: 12.6, attackCooldown: 0.8,
    meleeRange: 2, rangedRange: 8, separationRadius: 0.8,
    critChance: 0, critMultiplier: 2, lifestealPercent: 0,
};
const STATS_RANGED = {
    __type__: 'StatsProfile',
    hpMax: 95, moveSpeed: 5, damage: 18.2, attackCooldown: 1.4,
    meleeRange: 0, rangedRange: 9, separationRadius: 0.8,
    critChance: 0, critMultiplier: 2, lifestealPercent: 0,
};

/**
 * Ba bộ trang trí chọn được, theo **thứ tự card trên panel**.
 *
 * `prefab` là tên file trong `assets/ancient_setup/Environment/Anicent/` —
 * `tools/scene/room_decors.js` đọc bảng này rồi nhập thẳng prefab đó vào cả ba
 * phòng và sinh lại hộp vật cản theo mesh của nó. Trong thư mục đó có năm bộ
 * (`ancient_1..5`), panel chỉ có ba card nên mỗi lần dùng được ba; đổi bộ thì sửa
 * ở đây rồi chạy lại `room_decors.js`.
 *
 * Đổi bộ là **đổi luôn vùng đặt được**: chỗ đứng của hero, đồng đội và các tổ
 * quái phải trống với cả ba bộ, mà vùng dùng được là *phần giao* của cả ba.
 * Chạy `roomcheck.js` (và `roomcheck.js --mask`) ngay sau khi đổi.
 */
const DECORS = [
    { prefab: 'ancient_3', name: 'Fallen Pillars' },
    { prefab: 'ancient_4', name: 'Tangled Roots' },
    { prefab: 'ancient_5', name: 'Overgrown Ruins' },
];

/** Tên ba bộ trang trí, theo thứ tự card trên panel. */
const DECOR_NAMES = DECORS.map((x) => x.name);

/**
 * Bố cục quái từng phòng. Phòng thứ i là chặng thứ i.
 *
 * **Rải dọc nửa sau căn phòng** (z ≈ 10 → 21.6), không dồn hết vào một túi ở cuối:
 * dồn cả ổ vào z 18–23 thì trên khung hình chúng chồng lên nhau thành một đám,
 * còn hai phần ba sàn phía dưới trống trơn. Rải ra thì mỗi con đọc được riêng, và
 * người chơi thấy mình đang đi *xuyên qua* một căn phòng có quái chứ không phải
 * đi tới một cái ổ.
 *
 * Vẫn giữ hai nhịp cũ:
 *  - **hero vào phòng một mình**: tổ gần nhất cũng cách chỗ xuất phát (z 3.6) gần
 *    7m, tức vẫn ở nửa trên khung hình. Quái để "đuổi khắp map" nên khoảng cách đó
 *    không giữ chúng đứng yên — `RunDirector.combatOnFirstMove` mới là thứ giữ:
 *    `combatEnabled` tắt thì AI không chạy, cả phòng đứng như tượng cho tới lúc
 *    người chơi thật sự đẩy hero đi bước đầu tiên.
 *  - **người bị trói giữa vòng vây**: hai tổ cuối của phòng 2 và 3 vẫn quây quanh
 *    chỗ đồng đội bị nhốt (-0.6, 20.6), đó là cảnh đoạn lướt camera phải quay được.
 *
 * Vùng đặt được là **giao của cả ba bộ trang trí** và nó không liền mạch —
 * `roomcheck.js --mask`, với bộ ba đang dùng (`ancient_3/4/5`):
 *
 *   z 4.0–5.0    x [-3.0, 4.3]   rộng, nhưng đây là chỗ hero xuất phát
 *   z 5.5–12     x [-1.7, 1.9]   hành lang hẹp dần, chỗ hẹp nhất 0.9m
 *   z 12.5–13.5  x [-4.2, 1.9]   khoảng rộng duy nhất giữa phòng
 *   z 14.0–14.5  x [-4.2, -1.4]  một túi lệch hẳn về phía -x
 *   z 15–17.5    (không có gì)   bộ nào cũng chắn một khúc, giao lại thành đứt
 *   z 18–22      x [-1.3, 1.9]   túi cuối phòng, chếch về +x
 *
 * Đoạn đứt ở z 15–17.5 là lý do bảng này nhảy từ 14.2 sang 18.6 chứ không rải đều
 * tăm tắp. Đổi bộ trang trí là **đo lại toàn bộ**, đừng chép số cũ — và chạy
 * `roomcheck.js` ngay sau đó, nó đếm cả số ô "lọt thân" trong tầm tán của từng tổ.
 * `EnemySpawnPoint.scatterRadius` (1.6m) tự rải quái quanh điểm đặt theo đúng chỗ
 * trống của *bộ đang chọn*.
 */
const LAYOUTS = [
    {
        zone: 'room_1',
        points: [
            { name: 'SP_R1_Left', x: 0.6, z: 11.0, count: 2, ranged: false },
            { name: 'SP_R1_Right', x: -1.4, z: 13.2, count: 2, ranged: false },
            { name: 'SP_R1_Center', x: 0.8, z: 19.4, count: 1, ranged: false },
        ],
    },
    {
        zone: 'room_2',
        points: [
            { name: 'SP_R2_West', x: 0.6, z: 11.0, count: 2, ranged: false },
            { name: 'SP_R2_East', x: -1.4, z: 13.2, count: 2, ranged: false },
            // Hai tổ cuối quây quanh Mage bị trói ở (-0.6, 20.6).
            { name: 'SP_R2_North', x: 0.8, z: 19.4, count: 2, ranged: false },
            { name: 'SP_R2_Archers', x: 0.2, z: 21.6, count: 2, ranged: true },
        ],
    },
    {
        zone: 'room_3',
        points: [
            // Đây là phòng cuối: đông hơn hai phòng trước (12 con so với 5 và 8),
            // để sức ép đủ cho cảnh Mage gục đọc ra là bị đánh gục chứ không phải tự ngã.
            //
            // Từng là 16. Hạ xuống 12 vì hai chuyện cùng lúc: damage quái vừa lên
            // 40% nên 12 con giờ ra đòn nặng hơn 16 con lúc trước, và mỗi con là
            // 42–56 node phải dựng — 16 con vào phòng cùng một nhịp là cú khựng
            // nặng nhất của cả ván. Kho quái dựng sẵn + rải đẻ qua nhiều frame
            // (`RunDirector.prewarmPerFrame` / `spawnPerFrame`) đã gánh phần lớn,
            // đây là phần còn lại.
            { name: 'SP_R3_GateWest', x: 0.6, z: 10.4, count: 2, ranged: false },
            { name: 'SP_R3_GateEast', x: -1.4, z: 12.8, count: 2, ranged: false },
            { name: 'SP_R3_MidWest', x: -2.6, z: 14.2, count: 3, ranged: false },
            // Hai tổ cuối quây quanh Ranger bị trói ở (-0.6, 20.6) — Mage ở phòng 2
            // cũng đứng đúng toạ độ cục bộ ấy, xem `ALLIES`.
            { name: 'SP_R3_MidEast', x: 1.0, z: 18.6, count: 2, ranged: true },
            { name: 'SP_R3_Back', x: 0.2, z: 21.4, count: 3, ranged: true },
        ],
    },
];

/**
 * Đồng đội bị trói: phòng nào, đứng ở đâu trong phòng đó.
 *
 * Cả hai đứng **giữa ổ quái ở cuối phòng**, không đứng lẻ giữa đường đi. Đó là cả
 * cảnh mà đoạn lướt camera phải quay được (người bị trói giữa vòng vây) lẫn lý do
 * để luật "dọn sạch khu vực mới cứu được" đọc ra có nghĩa. Để Mage ở giữa map
 * (z 13.8) thì người chơi đi ngang qua cái lồng trước khi gặp con quái nào.
 */
const ALLIES = {
    Ally_Mage_Trap: { slot: 1, x: -0.6, z: 20.6 },
    Ally_Ranger_Trap: { slot: 2, x: -0.6, z: 20.6 },
};

/**
 * Đặt lại hộp sàn ảo cho trùm cả ba phòng.
 *
 * Sàn phòng là mesh trần, **không có collider nào** — hộp này là thứ duy nhất đỡ
 * `CharacterController`. Hụt một đoạn là hero với quái rơi xuyên đúng đoạn đó, mà
 * lúc chơi chỉ thấy "nhân vật biến mất ở cuối phòng 3".
 */
function setGround(d, pitch) {
    const L = require('./lib.js');
    const ground = L.nodePath(d, 'CombatScene/Environment/Ground_Collider');
    const box = L.componentOf(d, ground, 'cc.BoxCollider');
    // Ba phòng trải từ z ≈ 0 tới z ≈ 3 * pitch; tâm hộp phải ở giữa quãng đó.
    d[ground]._lpos = L.V3(0, -1, 1.5 * pitch);
    d[box]._size = L.V3(16, 2, 3 * pitch + 6);
    return { z: 1.5 * pitch, len: 3 * pitch + 6 };
}

/**
 * Đặt mốc ngắm camera trong từng phòng, rồi canh camera chính vào phòng đầu.
 *
 * `CameraFollow.useAuthoredFraming` chốt offset bằng đúng khoảng cách
 * camera–mục tiêu *đang đặt trong scene*, ở frame đầu tiên. Nên chỉ cần đặt máy
 * đúng chỗ so với mốc của phòng 0 là mọi phòng sau đều được khung y hệt.
 */
function setCamera(d) {
    const L = require('./lib.js');
    const B = require('./build.js');
    const T = L.scriptType('assets/Scripts/Gameplay/Camera/CameraFollow.ts');
    const TSlot = L.scriptType('assets/Scripts/Gameplay/Map/RoomSlot.ts');

    const b = B.makeBuilder(d);
    const rooms = L.nodePath(d, 'CombatScene/Environment/Rooms');
    const slots = d[rooms]._children.map((c) => c.__id__);
    const anchors = slots.map((room) => {
        // Dựng nếu thiếu chứ không ném lỗi: mở Cocos Creator rồi lưu là editor ghi
        // đè scene bằng bản nó giữ trong bộ nhớ, và node nào thêm sau lúc nó mở
        // thì mất. File này phải vá lại được chỗ đó.
        let a = L.childIndex(d, room, 'CameraAnchor');
        if (a < 0) a = b.node('CameraAnchor', room);
        d[a]._lpos = L.V3(0, 0, CAMERA.aimZ);
        return a;
    });

    const rad = (CAMERA.pitch * Math.PI) / 180;
    const rot = B.euler(-CAMERA.pitch, 180, 0);
    const cam = L.nodePath(d, 'CombatScene/Main Camera');
    // Mốc phòng 0 ở z = aimZ (phòng 0 đứng tại gốc), máy lùi lại và nâng lên.
    // Làm tròn: số thực thô ghi vào scene thành "-0.000021" — diff git nhiễu mà
    // đọc cũng khó, trong khi sai số 1e-6 mét thì không ai thấy.
    const round6 = (v) => Math.round(v * 1e6) / 1e6;
    d[cam]._lpos = L.V3(
        0,
        round6(CAMERA.dist * Math.sin(rad)),
        round6(CAMERA.aimZ - CAMERA.dist * Math.cos(rad) + (CAMERA.nudgeZ || 0)),
    );
    d[cam]._lrot = L.QUAT(rot.q.x, rot.q.y, rot.q.z, rot.q.w);
    d[cam]._euler = L.V3(rot.e[0], rot.e[1], rot.e[2]);

    // Nối lại `RoomSlot.cameraAnchor` — cũng có thể đã mất cùng node.
    slots.forEach((room, i) => {
        const slot = L.componentOf(d, room, TSlot);
        if (slot >= 0) d[slot].cameraAnchor = { __id__: anchors[i] };
    });

    const follow = d[L.componentOf(d, cam, T)];
    follow.target = { __id__: anchors[0] };
    // Bám hero là hết đứng yên: `usePartyAnchor` lờ luôn `target`.
    follow.usePartyAnchor = false;
    follow.useAuthoredFraming = true;
    follow.followLerp = CAMERA.lerp;
    follow.arriveDistance = CAMERA.arriveDistance;
    return { anchors, pos: d[cam]._lpos };
}

module.exports = {
    HERO_START, CAMERA, LAYOUTS, ALLIES, DECORS, DECOR_NAMES, STATS_MELEE, STATS_RANGED, setGround, setCamera,
};

// --------------------------------------------------------------------- CLI

if (require.main === module) {
    const L = require('./lib.js');
    const d = L.load();
    const T = {
        EnemySpawnPoint: L.scriptType('assets/Scripts/Gameplay/Managers/EnemySpawnPoint.ts'),
    };

    const rooms = L.nodePath(d, 'CombatScene/Environment/Rooms');
    const slots = d[rooms]._children.map((c) => c.__id__);
    let moved = 0;

    const put = (id, x, z) => {
        const p = d[id]._lpos;
        if (p.x !== x || p.z !== z) moved += 1;
        d[id]._lpos = L.V3(x, p.y, z);
    };

    slots.forEach((room, i) => {
        put(L.childIndex(d, room, 'HeroStart'), HERO_START.x, HERO_START.z);

        const spawns = L.childIndex(d, room, 'Spawns');
        const layout = LAYOUTS[i];
        for (const p of layout.points) {
            const n = L.childIndex(d, spawns, p.name);
            if (n < 0) throw new Error(`${d[room]._name}: không thấy tổ "${p.name}" — chạy apply_rooms.js trước`);
            put(n, p.x, p.z);
            const c = L.componentOf(d, n, T.EnemySpawnPoint);
            d[c].count = p.count;
            d[c].zoneId = layout.zone;
            // Ghi đè cả bộ chỉ số: `overrideStats` đang bật nên ô này mới là thứ quyết định,
            // và sửa `STATS_*` ở trên mà không chảy xuống đây thì bảng chỉ là tờ giấy.
            const stats = d[c].stats && d[d[c].stats.__id__];
            if (stats) Object.assign(stats, p.ranged ? STATS_RANGED : STATS_MELEE);
        }
    });

    for (const [name, spot] of Object.entries(ALLIES)) {
        const n = L.childIndex(d, slots[spot.slot], name);
        if (n < 0) throw new Error(`không thấy "${name}" trong phòng ${spot.slot}`);
        put(n, spot.x, spot.z);
    }

    // Khoảng cách giữa hai phòng đọc thẳng từ scene, khỏi phải chép lại hằng số.
    const pitch = d[slots[1]]._lpos.z - d[slots[0]]._lpos.z;
    const g = setGround(d, pitch);
    const c = setCamera(d);

    L.save(d);
    console.log(`đặt lại bố cục: ${moved} chỗ đổi vị trí`);
    console.log(`sàn ảo: tâm z=${g.z.toFixed(2)}, dài ${g.len.toFixed(2)} -> phủ z ${(g.z - g.len / 2).toFixed(2)} .. ${(g.z + g.len / 2).toFixed(2)}`);
    console.log(`camera: chúc ${CAMERA.pitch}° xa ${CAMERA.dist}m -> (0, ${c.pos.y.toFixed(2)}, ${c.pos.z.toFixed(2)}), ngắm mốc z=${CAMERA.aimZ} của từng phòng`);
}
