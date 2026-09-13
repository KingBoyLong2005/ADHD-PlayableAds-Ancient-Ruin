/**
 * Dựng (hoặc dựng lại) panel chọn room + sân khấu preview.
 *
 * **Chạy lại được bao nhiêu lần cũng được**: nó gỡ panel cũ đi rồi dựng lại từ
 * đầu và nối lại mọi tham chiếu (`RoomSelectManager.panel`, `RoomSelectUI.cards`,
 * `ModelPreview.targetSprite`, ba camera preview). Sửa bố cục ở đây rồi chạy:
 *
 *   tools/node.sh tools/scene/room_panel.js
 *   tools/node.sh tools/scene/uilayout.js assets/Scene/scene.scene <panel> --all
 *
 * Bố cục: ba phòng **xếp dọc**, tên phòng nằm trên hình phòng — như màn chọn
 * phòng trong mấy game dungeon idle.
 *
 * Khung ngắm của preview là chỗ dễ sai nhất, ba điều đã đo:
 *
 * - **Ngắm từ đầu z nhỏ nhìn tới, không ngắm ngang hông.** Tường bao cao 6m; ngắm
 *   ngang hông thì bức tường gần che mất 6/tan(45°) = 6m sàn, tức gần nửa căn
 *   phòng. Ngắm dọc trục phòng thì bức tường gần lại nằm sát ngay dưới máy nên
 *   tia nhìn qua nó rất dốc, chỉ che chừng 2m.
 * - **Chúc xuống dốc (57°) chứ không phải 45°**: chúc thoải thì máy tụt về phía
 *   sau và rơi đúng vào bức tường đầu phòng. Ở thông số hiện tại máy đứng *bên
 *   trong* phòng, cao hơn tường, nhìn thấy dải sàn z ≈ 8 → 20.
 * - **`ModelPreview.autoFit` phải tắt.** Cả căn phòng nằm ngang; autoFit kéo máy
 *   về nhìn thẳng mặt bên và căn phòng đọc ra thành một vệt.
 */
const L = require('./lib.js');
const B = require('./build.js');
const { DECOR_NAMES } = require('./room_layout.js');

// ------------------------------------------------------------------ bố cục

/** Khung hình của một card: ngang, tỉ lệ 2:1. */
const CARD = { w: 800, h: 400, gap: 430 };
const PREVIEW = { w: 720, h: 360, texW: 512, texH: 256 };

/**
 * Khung ngắm preview, toạ độ cục bộ so với sân khấu.
 * `aim` là điểm ngắm trong phòng, `dist` là khoảng cách, `pitch` là độ chúc.
 */
const SHOT = { aimZ: 12.5, dist: 11, pitch: 57 };

const SPRITE_WHITE = '57520716-48c8-4a19-8acf-41c9f8777fb0@f9941';     // ô trắng builtin
const SPRITE_NAMEPLATE = '734b476b-e4e5-42df-bbfb-1b1f41dfc3e1@f9941'; // Name_box2
const SPRITE_GLOW = 'a16cbb62-63aa-4b6d-8884-06a4ae348620@f9941';      // glow_01

/**
 * Ảnh bàn tay hướng dẫn — **cùng hai ảnh với màn chọn skill**, để hai màn "bấm chọn một
 * cái" trong ván nói cùng một thứ tiếng. `HAND` là bàn tay, `HAND_TAP` là vệt chạm nhỏ
 * ở đầu ngón trỏ.
 */
const SPRITE_HAND = 'e80f27f1-6c08-49ea-91c0-a93ac2a607ac@f9941';
const SPRITE_HAND_TAP = '59fa1a1e-a7e0-4ace-827e-7efc49b33ff9@f9941';

const HAND_SCRIPT = 'assets/Scripts/Gameplay/UI/SkillSpin/SkillTutorialHand.ts';

/**
 * Bàn tay hướng dẫn, chép đúng bộ số của `SkillSelectPanel/TutorialHand`.
 *
 * `Hand` là node bọc rỗng 100x100 — `SkillTutorialHand` lái **node này**, còn hai ảnh
 * bên trong lệch đi sao cho đầu ngón trỏ rơi đúng gốc toạ độ của node bọc. Nhờ vậy
 * `handOffset` để (0,0) là ngón tay chỉ đúng tâm card.
 */
const HAND = {
    holder: { w: 100, h: 100, scale: 2 },
    tap: { pos: [17.634, -16.019], w: 102, h: 49 },
    palm: { pos: [-30.446, -46.368], w: 274, h: 107 },
};

/**
 * Dựng panel dưới `canvas` và trả về mọi thứ cần nối dây.
 * @returns {{panel:number, handRoot:number, hand:number, handComp:number,
 *   cards:{card:number,button:number,previewSprite:number,nameLabel:number,highlight:number}[]}}
 */
function buildPanel(b, canvas) {
    const { node, comp, uiTransform, sprite, label, button, widgetFull } = b;
    const { ref } = B;
    const { color, LAYER_UI } = B;

    const panel = node('RoomSelectPanel', canvas, { layer: LAYER_UI, active: false });
    uiTransform(panel, 1080, 1920);
    widgetFull(panel);

    const dim = node('Dim', panel, { layer: LAYER_UI });
    uiTransform(dim, 10000, 10000);
    sprite(dim, SPRITE_WHITE, color(0, 0, 0, 200));

    const title = node('Title', panel, { pos: [0, 800, 0], layer: LAYER_UI });
    uiTransform(title, 900, 110);
    label(title, 'CHOOSE A ROOM', 84, color(255, 226, 138));

    const cardsRoot = node('Cards', panel, { pos: [0, -30, 0], layer: LAYER_UI });
    const cards = [];
    for (let i = 0; i < 3; i++) {
        // Card đầu ở trên cùng, đúng thứ tự đọc từ trên xuống.
        const card = node(`Card_${i}`, cardsRoot, { pos: [0, (1 - i) * CARD.gap, 0], layer: LAYER_UI });
        uiTransform(card, CARD.w, CARD.h);

        // Thứ tự con = thứ tự vẽ: hào quang dưới cùng, chữ trên cùng.
        const highlight = node('Highlight', card, { layer: LAYER_UI, active: false });
        uiTransform(highlight, CARD.w + 100, CARD.h + 60);
        sprite(highlight, SPRITE_GLOW, color(255, 226, 96, 180));

        const frame = node('Frame', card, { pos: [0, -18, 0], layer: LAYER_UI });
        uiTransform(frame, PREVIEW.w + 20, PREVIEW.h + 20);
        sprite(frame, SPRITE_WHITE, color(58, 40, 28, 235));

        const preview = node('Preview', card, { pos: [0, -18, 0], layer: LAYER_UI });
        uiTransform(preview, PREVIEW.w, PREVIEW.h);
        // Chưa có frame: `ModelPreview` gắn RenderTexture của nó vào lúc chạy.
        const previewSprite = sprite(preview, null);

        // Bảng tên nằm *đè lên mép trên* hình phòng, như trong bản ref.
        const plate = node('NamePlate', card, { pos: [0, 178, 0], layer: LAYER_UI });
        uiTransform(plate, 420, 78);
        sprite(plate, SPRITE_NAMEPLATE, color(214, 158, 44));

        const nameNode = node('Name', card, { pos: [0, 178, 0], layer: LAYER_UI });
        uiTransform(nameNode, 390, 62);
        const nameLabel = label(nameNode, DECOR_NAMES[i] || `Room ${i + 1}`, 44, color(90, 46, 12), { outline: false });

        cards.push({ card, button: button(card, card), previewSprite, nameLabel, highlight });
    }

    // Bàn tay hướng dẫn: dựng **sau** `Cards` nên nó vẽ đè lên card (thứ tự con = thứ
    // tự vẽ). Không gắn `Button` hay `BlockInputEvents` lên nhánh này — gắn vào là nó
    // ăn mất cú chạm của người chơi, tay chỉ vào card mà bấm card không ăn.
    const handRoot = node('TutorialHand', panel, { layer: LAYER_UI });
    uiTransform(handRoot, 1080, 1920);
    const hand = node('Hand', handRoot, { layer: LAYER_UI, scale: HAND.holder.scale });
    uiTransform(hand, HAND.holder.w, HAND.holder.h);
    const handTap = node('hand1', hand, { pos: [HAND.tap.pos[0], HAND.tap.pos[1], 0], layer: LAYER_UI });
    uiTransform(handTap, HAND.tap.w, HAND.tap.h);
    sprite(handTap, SPRITE_HAND_TAP);
    const handPalm = node('hand', hand, { pos: [HAND.palm.pos[0], HAND.palm.pos[1], 0], layer: LAYER_UI });
    uiTransform(handPalm, HAND.palm.w, HAND.palm.h);
    sprite(handPalm, SPRITE_HAND);

    // Cùng component với màn chọn skill — `SkillTutorialHand` cố ý chỉ nhận `Node[]`
    // chứ không biết gì về card skill, nên dùng lại được nguyên si. `RoomSelectUI` gọi
    // `play()` khi panel bung ra và `stop()` khi có người bấm.
    const handComp = comp(handRoot, L.scriptType(HAND_SCRIPT), {
        hand: ref(hand),
        targets: [],
        handOffset: L.V3(),
        moveTime: 0.45,
        pressTime: 0.12,
        releaseTime: 0.18,
        holdTime: 0.1,
        startDelay: 0.25,
        fadeTime: 0.2,
        handPressScale: 0.82,
        // Card phòng rộng 800px, gấp đôi card skill — cùng một tỉ lệ thì lúc lún xuống nó
        // dịch gấp đôi số pixel. Ở đây lấy nhẹ tay hơn (0.96 so với 0.93 của màn skill).
        cardPressScale: 0.96,
        speedScale: 2,
        maxLoops: 0,
        bringToFront: true,
    });

    return { panel, cards, handRoot, hand, handComp };
}

/** Vị trí + góc của camera preview, cục bộ so với gốc sân khấu. */
function shotTransform() {
    const rad = (SHOT.pitch * Math.PI) / 180;
    return {
        pos: [0, SHOT.dist * Math.sin(rad), SHOT.aimZ - SHOT.dist * Math.cos(rad)],
        rot: B.euler(-SHOT.pitch, 180, 0),
    };
}

module.exports = { buildPanel, shotTransform, CARD, PREVIEW, SHOT };

// --------------------------------------------------------------------- CLI

if (require.main === module) {
    const d = L.load();
    const b = B.makeBuilder(d);
    const { ref } = B;

    const T = {
        RoomSelectManager: L.scriptType('assets/Scripts/Gameplay/Map/RoomSelectManager.ts'),
        RoomSelectUI: L.scriptType('assets/Scripts/Gameplay/UI/RoomSelectUI.ts'),
        ModelPreview: L.scriptType('assets/Scripts/Gameplay/UI/ModelPreview.ts'),
    };

    const canvas = L.nodePath(d, 'CombatScene/Canvas');
    const old = L.childIndex(d, canvas, 'RoomSelectPanel');
    if (old >= 0) L.detach(d, old);

    const { panel, cards, handComp } = buildPanel(b, canvas);

    // Ba camera preview: đặt lại khung ngắm theo `SHOT`.
    const previewRoot = L.nodePath(d, 'CombatScene/RoomPreview');
    const shot = shotTransform();
    for (let i = 0; i < 3; i++) {
        const cam = L.childIndex(d, previewRoot, `Cam_${i}`);
        if (cam < 0) throw new Error(`không thấy Cam_${i} — chạy apply_rooms.js trước`);
        const stageX = d[L.childIndex(d, previewRoot, `Stage_${i}`)]._lpos.x;
        d[cam]._lpos = L.V3(stageX + shot.pos[0], shot.pos[1], shot.pos[2]);
        d[cam]._lrot = L.QUAT(shot.rot.q.x, shot.rot.q.y, shot.rot.q.z, shot.rot.q.w);
        d[cam]._euler = L.V3(shot.rot.e[0], shot.rot.e[1], shot.rot.e[2]);
    }

    // Nối lại dây: ModelPreview -> sprite mới, và kích thước texture theo card mới.
    const previews = [];
    for (let i = 0; i < 3; i++) {
        const holder = L.childIndex(d, previewRoot, `Preview_${i}`);
        const mp = L.componentOf(d, holder, T.ModelPreview);
        if (mp < 0) throw new Error(`không thấy ModelPreview trên Preview_${i}`);
        d[mp].targetSprite = ref(cards[i].previewSprite);
        d[mp].textureWidth = PREVIEW.texW;
        d[mp].textureHeight = PREVIEW.texH;
        d[mp].autoFit = false;
        previews.push(mp);
    }

    const roomSelectNode = L.nodePath(d, 'CombatScene/Systems/RoomSelect');
    const manager = L.componentOf(d, roomSelectNode, T.RoomSelectManager);
    const ui = L.componentOf(d, roomSelectNode, T.RoomSelectUI);
    d[manager].panel = ref(panel);
    d[ui].panel = ref(panel);
    // Ghi cả ba ô, không để nhận mặc định của class: `audit_props.js` coi khoá thiếu là lệch.
    d[ui].tutorialHand = ref(handComp);
    d[ui].tutorialDelay = 0.6;
    d[ui].tutorialOnce = false;
    // Khoá mới gán vào một object đã có thì rơi xuống *sau* `_id`, mà editor luôn ghi
    // `_id` cuối cùng — không dọn thì lần lưu sau nó xáo lại và đẻ ra một diff giả.
    const uid = d[ui]._id;
    delete d[ui]._id;
    d[ui]._id = uid;
    d[ui].cards = cards.map((c, i) => ref(b.value({
        __type__: 'RoomSelectCard',
        root: ref(c.card),
        button: ref(c.button),
        preview: ref(previews[i]),
        nameLabel: ref(c.nameLabel),
        highlight: ref(c.highlight),
    })));

    const dropped = L.gc(d);
    L.save(d);
    console.log(`dựng lại panel chọn room (dọc, ${cards.length} card); dọn ${dropped} phần tử cũ`);
    console.log(`camera preview: z=${shot.pos[2].toFixed(2)} y=${shot.pos[1].toFixed(2)} chúc ${SHOT.pitch}°`);
}
