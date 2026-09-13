/**
 * Khung Revive thành CTA cuối: bỏ đếm ngược, bỏ màn `Failed` nối sau, cho hai
 * cái nút nhấp nháy scale đan xen nhau.
 *
 * Ba việc, đúng theo ba thứ đã đổi trong code:
 *
 *   1. `RevivePopupUI` không còn `countdownLabel` / `autoAnswerAfter` /
 *      `endCard*` — xoá luôn mấy khoá đó khỏi scene (khoá thừa thì Cocos bỏ qua,
 *      nhưng `audit_props.js` sẽ kêu, mà kêu đúng), thêm `openStoreOnAnswer`.
 *   2. Tắt node `Countdown` và kéo `Title`/`Sub` về giữa khung — bỏ con số ở giữa
 *      mà để nguyên chỗ thì khung thủng một lỗ to đúng giữa.
 *   3. Gắn `ButtonPulseGuide` lên node `Panel`, trỏ vào `BtnYes` + `BtnNo`.
 *
 * Tra node theo *tên trong đúng nhánh* chứ không theo chỉ số, và chạy lại được
 * nhiều lần: có rồi thì ghi đè tại chỗ, không xoá phần tử nào (xoá là dịch chỉ số
 * của mọi tham chiếu phía sau).
 *
 * CHỈ CHẠY KHI ĐÃ ĐÓNG COCOS CREATOR.
 * Chạy: powershell -ExecutionPolicy Bypass -File tools/node.ps1 tools/scene/apply_revive_cta.js
 */
const fs = require('fs');

const SCENE = 'assets/Scene/scene.scene';
const d = JSON.parse(fs.readFileSync(SCENE, 'utf8'));

// __type__ nén từ uuid trong .ts.meta — xem tools/scene/uuid.js.
const T = {
    RevivePopupUI: 'd45c84rfzZMAqHpZM0KV7cE',
    ButtonPulseGuide: 'b3a75uc3eBG1IAXXRq737tn',
};

// ------------------------------------------------------------ tra cứu theo tên

function nodesNamed(name, expect = 1) {
    const hits = [];
    for (let i = 0; i < d.length; i++) {
        if (d[i] && d[i].__type__ === 'cc.Node' && d[i]._name === name) hits.push(i);
    }
    if (expect >= 0 && hits.length !== expect) {
        throw new Error(`mong ${expect} node tên "${name}", tìm thấy ${hits.length}`);
    }
    return hits;
}
const nodeNamed = (name) => nodesNamed(name, 1)[0];

/** Con trực tiếp mang tên này. Tên như "Panel"/"Title" trùng nhau khắp scene nên phải tra trong nhánh. */
function childNamed(parentIdx, name) {
    const hits = (d[parentIdx]._children || [])
        .map((c) => c.__id__)
        .filter((i) => d[i] && d[i]._name === name);
    if (hits.length !== 1) {
        throw new Error(`mong đúng 1 con tên "${name}" dưới "${d[parentIdx]._name}", tìm thấy ${hits.length}`);
    }
    return hits[0];
}

function compOn(nodeIdx, type) {
    for (const c of d[nodeIdx]._components || []) {
        if (d[c.__id__] && d[c.__id__].__type__ === type) return c.__id__;
    }
    return -1;
}

// `_id` phải 22 ký tự và duy nhất trong file.
const usedIds = new Set();
for (const o of d) if (o && typeof o._id === 'string') usedIds.add(o._id);
let idSeq = 0;
function nid(tag) {
    for (;;) {
        const seq = String(idSeq++).padStart(5, '0');
        const id = (`reviveCta${tag}${seq}` + '00000000000000000000').slice(0, 22);
        if (usedIds.has(id)) continue;
        usedIds.add(id);
        return id;
    }
}

/** Có component kiểu đó rồi thì ghi đè tại chỗ, chưa có thì thêm. */
function upsertComp(nodeIdx, type, props) {
    let idx = compOn(nodeIdx, type);
    if (idx < 0) {
        idx = d.push(null) - 1;
        d[nodeIdx]._components.push({ __id__: idx });
        d[idx] = { _id: nid('C') };
    }
    const keepId = d[idx]._id;
    for (const k of Object.keys(d[idx])) delete d[idx][k];
    Object.assign(d[idx], {
        __type__: type,
        _name: '', _objFlags: 0, __editorExtras__: {},
        node: { __id__: nodeIdx },
        _enabled: true, __prefab: null,
        ...props,
        _id: keepId,
    });
    return idx;
}

// ------------------------------------------------------------------- 1. khung

const popupRoot = nodeNamed('RevivePopup');
const panel = childNamed(popupRoot, 'Panel');
const frame = childNamed(panel, 'Frame');
const title = childNamed(frame, 'Title');
const countdown = childNamed(frame, 'Countdown');
const sub = childNamed(frame, 'Sub');
const btnYes = childNamed(panel, 'BtnYes');
const btnNo = childNamed(panel, 'BtnNo');

const popupIdx = compOn(popupRoot, T.RevivePopupUI);
if (popupIdx < 0) throw new Error('không thấy RevivePopupUI trên node RevivePopup');
const popup = d[popupIdx];

// Giữ lại đúng ba ô tham chiếu cũ; mấy ô đã bỏ khỏi class thì xoá hẳn.
const yesButton = popup.yesButton;
const noButton = popup.noButton;
for (const k of ['countdownLabel', 'autoAnswerAfter', 'endCard', 'endCardIsWin', 'endCardDelay']) {
    delete popup[k];
}
popup.panel = { __id__: panel };
popup.yesButton = yesButton;
popup.noButton = noButton;
popup.openStoreOnAnswer = true;

// ------------------------------------------------------------ 2. bố cục khung

// Frame cao 560, tâm ở y=120. Bỏ con số ở giữa thì hai dòng chữ phải xích lại,
// không thì trên một dòng dưới một dòng và trống hoác chính giữa.
d[countdown]._active = false;
d[title]._lpos.y = 70;
d[sub]._lpos.y = -80;

// --------------------------------------------------- 3. nhấp nháy hai cái nút

upsertComp(panel, T.ButtonPulseGuide, {
    targets: [{ __id__: btnYes }, { __id__: btnNo }],
    period: 0.9,
    minScale: 0.94,
    maxScale: 1.1,
    interleave: true,
    fadeIn: 0.25,
});

// Nhấp nháy ghi scale mỗi frame, nên scale trong scene phải là 1 — nó là cỡ gốc
// được nhân lên, chụp lúc `onLoad`.
for (const n of [btnYes, btnNo]) {
    d[n]._lscale.x = 1;
    d[n]._lscale.y = 1;
    d[n]._lscale.z = 1;
}

// ------------------------------------------------------------------ ghi ra

fs.writeFileSync(SCENE, JSON.stringify(d, null, 2));
console.log(`xong: ${d.length} object`);
console.log(`  RevivePopup=[${popupRoot}] Panel=[${panel}] BtnYes=[${btnYes}] BtnNo=[${btnNo}]`);
console.log(`  Countdown=[${countdown}] -> tắt; Title y=70, Sub y=-80`);
console.log(`  ButtonPulseGuide=[${compOn(panel, T.ButtonPulseGuide)}]`);
