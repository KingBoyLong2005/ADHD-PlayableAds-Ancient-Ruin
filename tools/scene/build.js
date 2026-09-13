/**
 * Bộ dựng node/component cho mấy script sửa scene.
 *
 * Tách khỏi `lib.js` (vốn lo phần *đọc và dọn* scene) vì đây là phần *ghi*: mỗi
 * loại component có một đống khoá phải điền đúng tên, thiếu một khoá là property
 * nằm im ở giá trị mặc định mà Cocos không kêu tiếng nào (xem `audit_props.js`).
 * Gom một chỗ để hai script không chép qua chép lại rồi lệch nhau.
 *
 *   const B = require('./build.js').makeBuilder(d);
 *   const n = B.node('Foo', parent, { pos: [0, 1, 2] });
 *   B.uiTransform(n, 100, 50);
 */
const L = require('./lib.js');

const LAYER_3D = 1073741824;
const LAYER_UI = 33554432;
/** Layer "HeroPreview" — camera chính **không** vẽ layer này (bit 1 tắt trong `_visibility`). */
const LAYER_PREVIEW = 2;

/** Font dùng chung của mọi label trong game. */
const FONT = '8e8a4a1f-8a23-4ff1-b395-a8ab4397dfda';

const ref = (id) => ({ __id__: id });
const uuid = (u, type = 'cc.SpriteFrame') => ({ __uuid__: u, __expectedType__: type });
const color = (r, g, b, a = 255) => ({ __type__: 'cc.Color', r, g, b, a });
const size = (width, height) => ({ __type__: 'cc.Size', width, height });
const vec2 = (x, y) => ({ __type__: 'cc.Vec2', x, y });

/**
 * Quaternion + euler cho một góc quay, theo đúng công thức `Quat.fromEuler` của
 * engine. Phải ghi cả hai: `_lrot` là thứ engine dùng, còn `_euler` là số hiện
 * trên Inspector — lệch nhau thì lần đầu ai đó chỉnh góc trong editor là node
 * nhảy một phát.
 */
function euler(x, y, z) {
    const h = 0.5 * Math.PI / 180;
    const [sx, cx] = [Math.sin(x * h), Math.cos(x * h)];
    const [sy, cy] = [Math.sin(y * h), Math.cos(y * h)];
    const [sz, cz] = [Math.sin(z * h), Math.cos(z * h)];
    return {
        e: [x, y, z],
        q: {
            x: sx * cy * cz + cx * sy * sz,
            y: cx * sy * cz + sx * cy * sz,
            z: cx * cy * sz - sx * sy * cz,
            w: cx * cy * cz - sx * sy * sz,
        },
    };
}

function makeBuilder(d, nextId = L.makeIdFactory(d)) {
    function node(name, parent, { pos = [0, 0, 0], rot = null, scale = 1, layer = LAYER_3D, active = true } = {}) {
        const id = d.length;
        d.push({
            __type__: 'cc.Node',
            _name: name,
            _objFlags: 0,
            __editorExtras__: {},
            _parent: { __id__: parent },
            _children: [],
            _active: active,
            _components: [],
            _prefab: null,
            _lpos: L.V3(pos[0], pos[1], pos[2]),
            _lrot: rot ? L.QUAT(rot.q.x, rot.q.y, rot.q.z, rot.q.w) : L.QUAT(),
            _lscale: L.V3(scale, scale, scale),
            _mobility: 0,
            _layer: layer,
            _euler: rot ? L.V3(rot.e[0], rot.e[1], rot.e[2]) : L.V3(),
            _id: nextId('n'),
        });
        d[parent]._children.push({ __id__: id });
        return id;
    }

    function comp(nodeId, type, props) {
        const id = d.length;
        d.push(Object.assign(
            {
                __type__: type, _name: '', _objFlags: 0, __editorExtras__: {},
                node: { __id__: nodeId }, _enabled: true, __prefab: null,
            },
            props,
            { _id: nextId('c') },
        ));
        d[nodeId]._components.push({ __id__: id });
        return id;
    }

    /** Phần tử rời (StatsProfile, RunStage, RoomSelectCard...) — không node, không component. */
    function value(obj) {
        d.push(obj);
        return d.length - 1;
    }

    /** Dời node sang cha khác, giữ nguyên mọi thứ bên trong. */
    function reparent(id, parent) {
        L.detach(d, id);
        d[id]._parent = { __id__: parent };
        d[parent]._children.push({ __id__: id });
        return id;
    }

    const uiTransform = (nodeId, w, h) => comp(nodeId, 'cc.UITransform', {
        _contentSize: size(w, h),
        _anchorPoint: vec2(0.5, 0.5),
    });

    const sprite = (nodeId, frame, col = color(255, 255, 255)) => comp(nodeId, 'cc.Sprite', {
        _customMaterial: null,
        _srcBlendFactor: 2,
        _dstBlendFactor: 4,
        _color: col,
        _spriteFrame: frame ? uuid(frame) : null,
        _type: 0,
        _fillType: 0,
        _sizeMode: 0,
        _fillCenter: vec2(0, 0),
        _fillStart: 0,
        _fillRange: 0,
        _isTrimmedMode: true,
        _useGrayscale: false,
        _atlas: null,
    });

    const label = (nodeId, text, fontSize, col, { outline = true } = {}) => comp(nodeId, 'cc.Label', {
        _customMaterial: null,
        _srcBlendFactor: 2,
        _dstBlendFactor: 4,
        _color: col,
        _string: text,
        _horizontalAlign: 1,
        _verticalAlign: 1,
        _actualFontSize: fontSize,
        _fontSize: fontSize,
        _fontFamily: 'Arial',
        _lineHeight: Math.round(fontSize * 1.15),
        // SHRINK: canvas để fitHeight nên xoay ngang là chữ teo còn một nửa — cỡ
        // khai báo phải là *tối đa*, dòng dài tự co lại vừa khung.
        _overflow: 2,
        _enableWrapText: false,
        _font: uuid(FONT, 'cc.TTFFont'),
        _isSystemFontUsed: false,
        _spacingX: 0,
        _isItalic: false,
        _isBold: true,
        _isUnderline: false,
        _underlineHeight: 2,
        _cacheMode: 0,
        _enableOutline: outline,
        _outlineColor: color(0, 0, 0),
        _outlineWidth: 4,
        _enableShadow: false,
        _shadowColor: color(0, 0, 0),
        _shadowOffset: vec2(2, 2),
        _shadowBlur: 2,
    });

    const button = (nodeId, target) => comp(nodeId, 'cc.Button', {
        clickEvents: [],
        _interactable: true,
        _transition: 3,
        _normalColor: color(255, 255, 255),
        _hoverColor: color(255, 255, 255),
        _pressedColor: color(200, 200, 200),
        _disabledColor: color(120, 120, 120, 200),
        _normalSprite: null,
        _hoverSprite: null,
        _pressedSprite: null,
        _disabledSprite: null,
        _duration: 0.1,
        _zoomScale: 1.06,
        _target: ref(target),
    });

    const widgetFull = (nodeId) => comp(nodeId, 'cc.Widget', {
        _alignFlags: 45, _target: null, _left: 0, _right: 0, _top: 0, _bottom: 0,
        _horizontalCenter: 0, _verticalCenter: 0, _isAbsLeft: true, _isAbsRight: true,
        _isAbsTop: true, _isAbsBottom: true, _isAbsHorizontalCenter: true, _isAbsVerticalCenter: true,
        _originalWidth: 0, _originalHeight: 0, _alignMode: 2, _lockFlags: 0,
    });

    const boxCollider = (nodeId, sx, sy, sz) => comp(nodeId, 'cc.BoxCollider', {
        _material: null,
        _isTrigger: false,
        _center: L.V3(),
        _size: L.V3(sx, sy, sz),
    });

    return {
        d, nextId, node, comp, value, reparent,
        uiTransform, sprite, label, button, widgetFull, boxCollider,
    };
}

module.exports = {
    makeBuilder, euler, ref, uuid, color, size, vec2,
    LAYER_3D, LAYER_UI, LAYER_PREVIEW, FONT,
};
