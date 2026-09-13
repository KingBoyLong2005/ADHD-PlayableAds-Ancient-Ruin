/**
 * Dựng lại scene theo cơ chế "chọn room": bỏ map dài cũ, dựng ba căn phòng nối
 * tiếp nhau dọc trục Z, và xếp lại nhịp ván thành ba chặng có màn chọn phòng.
 *
 * Chạy đúng một lần trên scene cũ (nó tự chặn khi đã chạy rồi):
 *   tools/node.sh tools/scene/apply_rooms.js
 *
 * **Đóng Cocos Creator trước khi chạy.** Xong thì soi lại bằng
 *   tools/node.sh tools/scene/validate.js
 *   tools/node.sh tools/scene/roomcheck.js
 *
 * Cơ chế map, và mọi con số toạ độ dưới đây suy ra từ đó:
 *
 * - `ancient_0.glb` (`P_AcientEasy0`) là **cái vỏ phòng**, dùng chung. Ba bản của
 *   nó xếp liên tiếp dọc trục Z, cách nhau đúng bằng chiều dài tấm sàn nên hai
 *   phòng kề nhau khít vào nhau. Dọn sạch phòng này thì cả đội được dời lên phòng
 *   kế và camera trôi theo.
 * - `ancient_1..5.glb` là các **bộ trang trí**, mỗi lần dùng ba (bảng `DECORS` trong
 *   `room_layout.js` nói là ba bộ nào). Mỗi phòng có sẵn cả ba ở trạng thái tắt; chọn
 *   room = bật một bộ lên. Có sẵn cả ba trong từng phòng chứ không dời qua dời lại,
 *   vì người chơi được phép chọn trùng bộ ở hai phòng liên tiếp. File này dựng theo
 *   ba bộ có sẵn trong scene cũ; đổi bộ về sau là việc của `room_decors.js`.
 * - Phóng to 2 lần thì lòng phòng là x ∈ [-5.6, 5.6], z ∈ [1.9, 23.3] (toạ độ
 *   *cục bộ so với node phòng*); cửa vào ở đầu z nhỏ. Hero đi dọc theo +Z.
 * - Tường bao là **một mesh gộp duy nhất**, AABB của nó là cả căn phòng — nên
 *   collider tường không bake bằng `MapColliderBaker` được mà phải sinh từ tam
 *   giác thật (`tools/scene/room_geometry.js`, chạy thẳng để xem bản đồ ASCII).
 */
const L = require('./lib.js');
const B = require('./build.js');
const G = require('./room_geometry.js');
const { buildPanel, shotTransform, PREVIEW } = require('./room_panel.js');
// Bảng bố cục (chỗ hero, chỗ đồng đội, các tổ quái) là của `room_layout.js` —
// chỉnh ở đó rồi chạy lại file đó, khỏi phải dựng lại cả scene.
const {
    HERO_START, CAMERA, LAYOUTS, ALLIES, DECOR_NAMES, STATS_MELEE, STATS_RANGED, setGround, setCamera,
} = require('./room_layout.js');

const SCALE = 2;
/** Sàn phòng ở y = 0; tường cao 3m, vật cản trong phòng lấy 2.2m. */
const WALL_H = 3;
const OBSTACLE_H = 2.2;

/** uuid prefab quái, bê nguyên từ các tổ cũ. */
const ENEMY_MELEE = '722f7ef0-6f42-4731-ad3c-792da32d95d2';
const ENEMY_RANGED = 'fc441764-45c9-4b3d-983a-6d230074021d';


// ---------------------------------------------------------------- tiện dựng

const d = L.load();
const b = B.makeBuilder(d);
const { nextId, node, comp, value, reparent, uiTransform, boxCollider } = b;
const { ref, uuid, color, euler, LAYER_3D, LAYER_PREVIEW } = B;

const T = {
    RoomDecor: L.scriptType('assets/Scripts/Gameplay/Map/RoomDecor.ts'),
    RoomSlot: L.scriptType('assets/Scripts/Gameplay/Map/RoomSlot.ts'),
    RoomSelectManager: L.scriptType('assets/Scripts/Gameplay/Map/RoomSelectManager.ts'),
    RoomSelectUI: L.scriptType('assets/Scripts/Gameplay/UI/RoomSelectUI.ts'),
    ModelPreview: L.scriptType('assets/Scripts/Gameplay/UI/ModelPreview.ts'),
    NavGrid: L.scriptType('assets/Scripts/Gameplay/Map/NavGrid.ts'),
    EnemySpawnPoint: L.scriptType('assets/Scripts/Gameplay/Managers/EnemySpawnPoint.ts'),
    RunDirector: L.scriptType('assets/Scripts/Gameplay/Managers/RunDirector.ts'),
    AllyRescue: L.scriptType('assets/Scripts/Gameplay/Hero/AllyRescue.ts'),
    CameraFollow: L.scriptType('assets/Scripts/Gameplay/Camera/CameraFollow.ts'),
};

// ==========================================================================
// 0. chốt chặn + tra node cũ
// ==========================================================================

if (L.nodesNamed(d, 'Rooms').length > 0) {
    throw new Error('scene đã có node "Rooms" — script này chỉ chạy được một lần trên scene cũ');
}

const combat = L.nodePath(d, 'CombatScene');
const environment = L.nodePath(d, 'CombatScene/Environment');
const systems = L.nodePath(d, 'CombatScene/Systems');
const canvas = L.nodePath(d, 'CombatScene/Canvas');
const mainCharacter = L.nodePath(d, 'CombatScene/MainCharacter');
const mainCamera = L.nodePath(d, 'CombatScene/Main Camera');
const enemyRoot = L.nodePath(d, 'CombatScene/Runtime/Enemies');

// Ba glb là con *trực tiếp* của scene — tra theo tên trong cả file thì dính cả
// node trang trí bên trong ancient_0 (nó cũng tên "ancient_1").
const artRoots = d[1]._children
    .map((c) => c.__id__)
    .filter((i) => /^ancient_\d+$/.test(d[i]._name))
    .sort((a, b) => d[a]._name.localeCompare(d[b]._name));
if (artRoots.length !== 3) throw new Error(`cần đúng 3 node ancient_* ở gốc scene, thấy ${artRoots.length}`);

// Mỗi glb gồm hai nhóm: cái vỏ (`P_AcientEasy0`, giống nhau ở cả ba) và một bộ
// trang trí riêng.
const shells = [];
const decorSources = [];
for (const art of artRoots) {
    const kids = d[art]._children.map((c) => c.__id__);
    const shell = kids.find((i) => d[i]._name === 'P_AcientEasy0');
    const decor = kids.find((i) => i !== shell);
    if (!shell || !decor) throw new Error(`${d[art]._name}: thiếu vỏ phòng hoặc bộ trang trí`);
    shells.push(shell);
    decorSources.push(decor);
}

// ==========================================================================
// 1. đo cái vỏ phòng
// ==========================================================================

const scaleMat = G.scaleMat(SCALE);
const floorSource = d[shells[0]]._children.map((c) => c.__id__).find((i) => d[i]._name === 'Floor');
const floorTris = G.worldTriangles(d, floorSource, scaleMat);
let floorMinZ = Infinity;
let floorMaxZ = -Infinity;
for (const t of floorTris) {
    for (const p of t) {
        if (p[2] < floorMinZ) floorMinZ = p[2];
        if (p[2] > floorMaxZ) floorMaxZ = p[2];
    }
}
// Khoảng cách giữa hai phòng = đúng chiều dài tấm sàn, nên sàn phòng này nối
// khít vào sàn phòng kia. Chừa khe thì camera lúc chuyển phòng lướt qua một
// vệt trống.
const PITCH = floorMaxZ - floorMinZ;

// Tường bao: giống hệt nhau ở cả ba phòng, tính một lần rồi dựng lại ba lần.
const wallBoxes = G.mergeCells(G.rasterize(G.worldTriangles(d, shells[0], scaleMat), { lo: 0.5, hi: 5 }).cells);
// Vật cản của từng bộ trang trí, cũng tính một lần cho mỗi bộ.
const decorBoxes = decorSources.map((src) => G.obstacleBoxes(d, src, SCALE));

console.log(`sàn dài ${PITCH.toFixed(2)}m -> ba phòng đặt ở z = 0 / ${PITCH.toFixed(2)} / ${(2 * PITCH).toFixed(2)}`);
console.log(`tường bao: ${wallBoxes.length} hộp; vật cản mỗi bộ: ${decorBoxes.map((b) => b.length).join(' / ')}`);

// ==========================================================================
// 2. bỏ map cũ
// ==========================================================================

L.detach(d, L.nodePath(d, 'CombatScene/Environment/Map'));
const spawnRootOld = L.nodePath(d, 'CombatScene/Systems/EnemySpawnPoints');
L.detach(d, spawnRootOld);
console.log('đã gỡ map cũ (Dungeon_Necropolis_1 + FOW + Collider) và toàn bộ tổ quái cũ');

// ==========================================================================
// 3. ba căn phòng
// ==========================================================================

const rooms = node('Rooms', environment);
const slotComps = [];
const slotNodes = [];
const layoutNodes = [];
let previewShell = -1;

for (let i = 0; i < 3; i++) {
    const room = node(`Room_${i}`, rooms, { pos: [0, 0, i * PITCH] });
    slotNodes.push(room);

    // Vỏ phòng: dời thẳng node glb vào, và cái *node bọc ngoài* mang scale 2 —
    // node glb bên trong giữ nguyên scale 0.01 của nó.
    const shellHolder = node('Shell', room, { scale: SCALE });
    reparent(shells[i], shellHolder);
    if (i === 0) previewShell = shellHolder;
    const floor = d[shells[i]]._children.map((c) => c.__id__).find((j) => d[j]._name === 'Floor');

    const walls = node('Walls', room);
    wallBoxes.forEach((b, k) => {
        const n = node(`Wall_${k}`, walls, { pos: [b.x, WALL_H / 2, b.z] });
        boxCollider(n, b.sx, WALL_H, b.sz);
    });

    // Cả ba bộ trang trí có mặt sẵn trong mọi phòng, tắt hết. Không dời một bộ
    // qua lại giữa các phòng: người chơi được phép chọn trùng bộ hai lần liền.
    const decorsRoot = node('Decors', room);
    const decors = [];
    for (let j = 0; j < 3; j++) {
        const decorNode = node(`Decor_${j}`, decorsRoot, { active: false });
        const artHolder = node('Art', decorNode, { scale: SCALE });
        L.cloneSubtree(d, decorSources[j], artHolder, nextId);

        const obstacles = node('Obstacles', decorNode);
        decorBoxes[j].forEach((b, k) => {
            const n = node(`Obs_${k}`, obstacles, { pos: [b.x, OBSTACLE_H / 2, b.z] });
            boxCollider(n, b.sx, OBSTACLE_H, b.sz);
        });

        decors.push(comp(decorNode, T.RoomDecor, {
            displayName: DECOR_NAMES[j],
            art: ref(artHolder),
            obstacles: ref(obstacles),
        }));
    }

    const heroStart = node('HeroStart', room, { pos: [HERO_START.x, 0, HERO_START.z] });
    // Camera ngắm vào đây suốt trận — nó không bám hero, chỉ trôi khi đổi phòng.
    const cameraAnchor = node('CameraAnchor', room, { pos: [0, 0, CAMERA.aimZ] });

    // Tổ quái của phòng này. Tắt sẵn: `EnemySpawnPoint` tự ghi tên vào danh sách
    // tĩnh ở `onEnable` rồi tự đẻ khi ván chạy, nên phòng chưa tới lượt phải nằm im.
    const spawns = node('Spawns', room, { active: false });
    layoutNodes.push(spawns);
    const layout = LAYOUTS[i];
    for (const p of layout.points) {
        const n = node(p.name, spawns, { pos: [p.x, 0, p.z] });
        comp(n, T.EnemySpawnPoint, {
            prefab: uuid(p.ranged ? ENEMY_RANGED : ENEMY_MELEE, 'cc.Prefab'),
            enemyType: p.ranged ? 2 : 1,
            attackType: p.ranged ? 1 : 0,
            count: p.count,
            spawnInterval: 0.12,
            startDelay: 0,
            enemyParent: ref(enemyRoot),
            scatterRadius: 1.6,
            trigger: 0,                 // OnStart — cả nhóm đẻ ngay khi được bật
            activationRadius: 14,
            addAggro: true,
            // "Đuổi khắp map": hero vừa nhúc nhích là cả ổ quái của chặng lao
            // tới và bám theo tới chết. Ba ô này đi cùng nhau — xem
            // `chase_whole_map.js` để biết vì sao thiếu một là hỏng cả ba.
            aggroRadius: 100,
            leashRadius: 0,
            giveUpDistance: 4,
            requireLineOfSight: false,
            alertGroup: true,
            alertRadius: 7,
            zoneId: layout.zone,
            overrideStats: true,
            stats: ref(value(Object.assign({}, p.ranged ? STATS_RANGED : STATS_MELEE))),
        });
    }

    slotComps.push(comp(room, T.RoomSlot, {
        floor: ref(floor),
        walls: ref(walls),
        decors: decors.map(ref),
        heroStart: ref(heroStart),
        cameraAnchor: ref(cameraAnchor),
    }));

    console.log(`phòng ${i}: ${layout.points.length} tổ, ${layout.points.reduce((s, p) => s + p.count, 0)} con quái`);
}

// Ba node glb gốc giờ rỗng ruột (vỏ đã dời đi, trang trí đã nhân bản) — bỏ đi,
// `gc()` dọn nốt phần bên trong.
for (const art of artRoots) L.detach(d, art);

// Sàn ảo đỡ nhân vật: phải trùm **cả ba** phòng, hộp cũ chỉ vừa cái map cũ.
// Sàn phòng không có collider nào, nên đây là thứ duy nhất đỡ `CharacterController`
// — hụt một đoạn là hero với quái rơi xuyên đúng đoạn đó.
setGround(d, PITCH);

const navNode = node('Nav', environment);
const navComp = comp(navNode, T.NavGrid, {
    floorRoots: [],
    blockerRoots: [],
    blockerSource: 1,          // Colliders
    cellSize: 0.4,
    agentRadius: 0.55,
    blockerMinHeight: 0.3,
    ignoreNames: ['arch'],
    sampleRadius: 4,
    // `RoomSelectManager` mới là chỗ bake: nó biết phòng nào đang đứng. Bật ô này
    // là bake thừa một lần bằng roots rỗng, và tệ hơn là thứ tự `start()` giữa
    // hai node thì không đảm bảo.
    bakeOnLoad: false,
});

// ==========================================================================
// 4. đồng đội bị trói + hero chính
// ==========================================================================

for (const [name, spot] of Object.entries(ALLIES)) {
    const n = L.nodePath(d, `CombatScene/Allies/${name}`);
    // Dời hẳn vào trong phòng của người đó: toạ độ cục bộ, dời phòng là đi theo.
    reparent(n, slotNodes[spot.slot]);
    d[n]._lpos = L.V3(spot.x, 0, spot.z);
    // Tắt sẵn — `RunDirector.enterStage` mới bật lên, đúng chặng của người đó.
    d[n]._active = false;
}

d[mainCharacter]._lpos = L.V3(HERO_START.x, 0, HERO_START.z);
d[mainCharacter]._lrot = L.QUAT();
d[mainCharacter]._euler = L.V3();

// ==========================================================================
// 5. camera chính
// ==========================================================================

// Khung hình do `room_layout.js` quyết định (file đó chạy lại được, nên chỉnh
// khung không phải dựng lại cả scene). Camera **không bám hero**: nó ngắm vào
// `CameraAnchor` của phòng đang đánh và chỉ trôi khi đổi phòng.
setCamera(d);

// ==========================================================================
// 6. sân khấu preview (ba phòng thu nhỏ cho ba card)
// ==========================================================================

const previewRoot = node('RoomPreview', combat, { pos: [2000, 0, 0], layer: LAYER_PREVIEW });
const previewStages = [];
const previewCams = [];
const shot = shotTransform();
for (let i = 0; i < 3; i++) {
    previewStages.push(node(`Stage_${i}`, previewRoot, { pos: [i * 100, 0, 0], layer: LAYER_PREVIEW }));

    // Khung ngắm do `room_panel.js` quyết định (nó cũng đặt lại được khi chạy lại).
    const cam = node(`Cam_${i}`, previewRoot, {
        pos: [i * 100 + shot.pos[0], shot.pos[1], shot.pos[2]],
        rot: shot.rot,
        layer: LAYER_PREVIEW,
    });
    previewCams.push(comp(cam, 'cc.Camera', {
        _projection: 1,
        _priority: 0,
        _fov: 45,
        _fovAxis: 0,
        _orthoHeight: 10,
        _near: 1,
        _far: 100,
        _color: color(0, 0, 0, 0),
        _depth: 1,
        _stencil: 0,
        _clearFlags: 7,
        _rect: { __type__: 'cc.Rect', x: 0, y: 0, width: 1, height: 1 },
        _aperture: 19,
        _shutter: 7,
        _iso: 0,
        _screenScale: 1,
        _visibility: LAYER_PREVIEW,
        _targetTexture: null,
        _postProcess: null,
        _usePostProcess: false,
        _cameraType: -1,
        _trackingType: 0,
    }));
}

// Sân khấu preview **không** có đèn riêng: `cc.DirectionalLight` trong Cocos là
// đèn chính của cả scene, thêm cái thứ hai là hai cái tranh nhau và ánh sáng
// gameplay đổi theo. Đèn chính sẵn có chiếu tới mọi layer nên mấy phòng thu nhỏ
// vẫn sáng đúng như lúc chơi.

// ==========================================================================
// 7. panel chọn room
// ==========================================================================

// Bố cục panel nằm ở `room_panel.js` — file đó chạy lại được, nên chỉnh giao diện
// không phải dựng lại cả scene.
const { panel, cards: cardData, handComp } = buildPanel(b, canvas);

// `ModelPreview` đứng *ngoài* panel, trên node luôn bật: nó cần `onLoad` chạy sớm
// để dựng RenderTexture rồi gắn vào sprite của card. Tắt cho khỏi tốn GPU thì
// `RoomSelectUI` làm bằng `camera.enabled`.
const previewComps = [];
for (let i = 0; i < 3; i++) {
    const holder = node(`Preview_${i}`, previewRoot, { layer: LAYER_PREVIEW });
    previewComps.push(comp(holder, T.ModelPreview, {
        previewCamera: ref(previewCams[i]),
        targetSprite: ref(cardData[i].previewSprite),
        stage: ref(previewStages[i]),
        textureWidth: PREVIEW.texW,
        textureHeight: PREVIEW.texH,
        transparentBackground: true,
        spinSpeed: 0,
        flipY: false,
        disableScripts: true,
        // Cả căn phòng nằm ngang, khung ngắm phải là góc chéo từ trên xuống đã đặt
        // tay ở `Cam_i`. Bật autoFit là camera nhảy về nhìn thẳng mặt bên, và căn
        // phòng đọc ra thành một vệt.
        autoFit: false,
        fitPadding: 1.12,
        cacheModels: true,
        defaultModel: null,
    }));
}

// ==========================================================================
// 8. bộ chọn room
// ==========================================================================

const roomSelectNode = node('RoomSelect', systems);
const cameraFollow = L.componentOf(d, mainCamera, T.CameraFollow);

const roomSelect = comp(roomSelectNode, T.RoomSelectManager, {
    slots: slotComps.map(ref),
    nav: ref(navComp),
    camera: ref(cameraFollow),
    snapCamera: false,
    partySpacing: 1.4,
    panel: ref(panel),
    pauseWhileOpen: true,
    autoPickAfter: 0,
    startDecor: 0,
});

const cardValues = cardData.map((c, i) => value({
    __type__: 'RoomSelectCard',
    root: ref(c.card),
    button: ref(c.button),
    preview: ref(previewComps[i]),
    nameLabel: ref(c.nameLabel),
    highlight: ref(c.highlight),
}));

comp(roomSelectNode, T.RoomSelectUI, {
    manager: ref(roomSelect),
    panel: ref(panel),
    previewShell: ref(previewShell),
    cards: cardValues.map(ref),
    confirmButton: null,
    tapToEnter: true,
    // Bàn tay hướng dẫn "bấm chọn một phòng", dựng sẵn trong `buildPanel`.
    tutorialHand: ref(handComp),
    tutorialDelay: 0.6,
    tutorialOnce: false,
});

// ==========================================================================
// 9. nhịp ván
// ==========================================================================

const runNode = L.nodePath(d, 'CombatScene/Systems/RunDirector');
const run = L.componentOf(d, runNode, T.RunDirector);
const allyMage = L.componentOf(d, L.nodePath(d, `CombatScene/Environment/Rooms/Room_1/Ally_Mage_Trap`), T.AllyRescue);
const allyRanger = L.componentOf(d, L.nodePath(d, `CombatScene/Environment/Rooms/Room_2/Ally_Ranger_Trap`), T.AllyRescue);

d[run].roomSelect = ref(roomSelect);
// Ghi thẳng vào scene chứ không để nhận mặc định của class: `audit_props.js` coi
// khoá thiếu là lệch, và người mở Inspector cũng nên thấy con số thật.
d[run].travelTimeout = 5;
d[run].stages = [
    {
        __type__: 'RunStage',
        name: 'Phong 1 - lam quen',
        zoneId: 'room_1',
        selectRoom: true,
        layout: ref(layoutNodes[0]),
        introOnStart: false,
        ally: null,
        objective: 'CLEAR THE ROOM',
        // Lượt skill mở màn: chốt phòng xong mới bày, không bày trước màn chọn phòng.
        skillPickOnEnter: true,
        skillPickAfterIntro: false,
        // Dọn sạch phòng 1 xong thì **không** bày skill ngay: lượt ấy dọn sang chặng 2,
        // sau đoạn lướt camera qua Mage bị trói — xem `skillPickAfterIntro` ở dưới.
        skillPickAfterClear: false,
        endsWithRevive: false,
        victim: null,
        forceDeathAfter: 0,
    },
    {
        __type__: 'RunStage',
        name: 'Phong 2 - cuu Mage',
        zoneId: 'room_2',
        selectRoom: true,
        layout: ref(layoutNodes[1]),
        introOnStart: true,
        ally: ref(allyMage),
        objective: 'RESCUE {hero}',
        skillPickOnEnter: false,
        // Thấy Mage bị trói giữa vòng vây + dòng nhắc việc đã lên -> rồi mới chọn skill.
        skillPickAfterIntro: true,
        skillPickAfterClear: true,
        endsWithRevive: false,
        victim: null,
        forceDeathAfter: 0,
    },
    {
        __type__: 'RunStage',
        name: 'Phong 3 - cuu Ranger',
        zoneId: 'room_3',
        selectRoom: true,
        layout: ref(layoutNodes[2]),
        introOnStart: true,
        ally: ref(allyRanger),
        objective: 'RESCUE {hero}',
        skillPickOnEnter: false,
        skillPickAfterIntro: false,
        skillPickAfterClear: false,
        endsWithRevive: true,
        victim: ref(allyMage),
        forceDeathAfter: 0,
    },
].map((s) => ref(value(s)));

// ==========================================================================
// 10. dọn và ghi
// ==========================================================================

const dropped = L.gc(d);
L.save(d);
console.log(`dọn ${dropped} phần tử không còn ai trỏ tới; scene còn ${d.length} phần tử`);
