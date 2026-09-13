import {
    _decorator,
    Camera,
    CCFloat,
    CCInteger,
    Color,
    Component,
    Enum,
    Font,
    instantiate,
    Label,
    Layers,
    Material,
    Node,
    Prefab,
    Sprite,
    SpriteFrame,
    UIOpacity,
    UITransform,
    Vec3,
    warn,
} from 'cc';
import EventManager from '../../Utility/EventManager';
import { findWorldCamera } from '../../Utility/SceneCamera';
import { formatCompact } from '../../Utility/NumberFormat';
import { CharacterStats } from '../Combat/CharacterStats';
import { GameplayEvents } from '../Events/GameplayEvents';
import { DamageTextKind } from './DamageTextKind';
import { FloatingDamageText } from './FloatingDamageText';

const { ccclass, property } = _decorator;

@ccclass('DamageTextStyle')
export class DamageTextStyle {
    @property({ type: Enum(DamageTextKind) })
    public kind: DamageTextKind = DamageTextKind.Normal;

    @property
    public color: Color = new Color(255, 255, 255, 255);

    @property({ type: CCFloat })
    public sizeScale: number = 1;

    @property({ type: SpriteFrame })
    public icon: SpriteFrame = null;

    @property
    public prefix: string = '';

    @property({ type: Material })
    public material: Material = null;
}

@ccclass('DamageTextManager')
export class DamageTextManager extends Component {
    public static instance: DamageTextManager = null;

    @property(Prefab)
    public textPrefab: Prefab = null;

    @property(CCInteger)
    public fallbackFontSize: number = 36;

    @property(Font)
    public fallbackFont: Font = null;

    @property(CCFloat)
    public fallbackOutlineWidth: number = 4;

    @property(Camera)
    public worldCamera: Camera = null;

    @property(Node)
    public container: Node = null;

    @property(CCFloat)
    public hitLerpMin: number = 0.55;

    @property(CCFloat)
    public hitLerpMax: number = 0.9;

    @property(CCFloat)
    public hitHeightMin: number = 0.8;

    @property(CCFloat)
    public hitHeightMax: number = 1.6;

    @property(CCFloat)
    public hitSpread: number = 0.35;

    @property(CCFloat)
    public driftRange: number = 40;

    @property(CCInteger)
    public maxActive: number = 24;

    @property(Color)
    public enemyHitColor: Color = new Color(255, 240, 150, 255);

    @property(Color)
    public heroHitColor: Color = new Color(255, 90, 80, 255);

    @property({ type: [DamageTextStyle] })
    public styles: DamageTextStyle[] = [];

    @property(CCFloat)
    public iconSize: number = 90;

    @property
    public fullHpText: string = 'Full HP';

    private _pool: FloatingDamageText[] = [];
    private _activeCount: number = 0;
    private _containerTransform: UITransform = null;
    private _warnedNoTransform: boolean = false;
    private _worldPos: Vec3 = new Vec3();
    private _uiPos: Vec3 = new Vec3();
    private _toPoint: Vec3 = new Vec3();

    private _recycleCb = (text: FloatingDamageText) => this.recycle(text);

    onLoad() {
        DamageTextManager.instance = this;
        if (!this.container) this.container = this.node;
        if (!this.worldCamera) this.worldCamera = findWorldCamera();
    }

    onDestroy() {
        if (DamageTextManager.instance === this) DamageTextManager.instance = null;
    }

    onEnable() {
        EventManager.instance.on(GameplayEvents.DamageDealt, this.onDamageDealt, this);
        EventManager.instance.on(GameplayEvents.Healed, this.onHealed, this);
    }

    onDisable() {
        EventManager.instance.off(GameplayEvents.DamageDealt, this.onDamageDealt, this);
        EventManager.instance.off(GameplayEvents.Healed, this.onHealed, this);
    }

    private onDamageDealt(
        target: CharacterStats,
        damage: number,
        attacker: CharacterStats,
        _killed: boolean,
        isCrit: boolean = false,
    ) {
        if (!target || !target.node || damage <= 0) return;
        const kind = isCrit ? DamageTextKind.Crit : target.isPlayer ? DamageTextKind.HeroHit : DamageTextKind.Normal;
        this.show(kind, target.node, damage, attacker?.node || null);
    }

    private onHealed(target: CharacterStats, amount: number, fromLifesteal: boolean = false) {
        if (!target || !target.node) return;

        if (amount <= 0) {
            if (this.fullHpText) this.showText(DamageTextKind.Heal, target.node, this.fullHpText);
            return;
        }
        this.show(fromLifesteal ? DamageTextKind.Lifesteal : DamageTextKind.Heal, target.node, amount);
    }

    public show(kind: DamageTextKind, victimNode: Node, amount: number, attackerNode: Node = null) {
        const style = this.styleOf(kind);
        this.spawn(attackerNode, victimNode, formatCompact(amount), style);
    }

    public showText(kind: DamageTextKind, victimNode: Node, text: string, attackerNode: Node = null) {
        const style = this.styleOf(kind);
        this.spawn(attackerNode, victimNode, text, style, false);
    }

    private spawn(attackerNode: Node, victimNode: Node, text: string, style: DamageTextStyle, usePrefix: boolean = true) {
        if (!victimNode) return;
        if (this._activeCount >= this.maxActive) return;

        const cam = this.worldCamera || (this.worldCamera = findWorldCamera());
        if (!cam || !cam.node) return;

        this.resolveHitPoint(attackerNode, victimNode, this._worldPos);
        if (!this.isInFrontOf(cam, this._worldPos)) return;

        if (!this._containerTransform) {
            this._containerTransform = this.container.getComponent(UITransform);
            if (!this._containerTransform) {
                if (!this._warnedNoTransform) {
                    this._warnedNoTransform = true;
                    warn('[DamageTextManager] container must be a UI node (missing UITransform).');
                }
                return;
            }
        }

        cam.convertToUINode(this._worldPos, this.container, this._uiPos);
        this._uiPos.z = 0;

        const floating = this.obtain();
        if (!floating) return;

        this.applyMaterial(floating, style);

        const drift = (Math.random() * 2 - 1) * this.driftRange;
        floating.playText(this._uiPos, (usePrefix ? style.prefix || '' : '') + text, style.color, drift, this._recycleCb, {
            icon: style.icon,
            sizeScale: style.sizeScale,
        });
    }

    private applyMaterial(floating: FloatingDamageText, style: DamageTextStyle) {
        const label = floating.label;
        if (!label) return;

        if (style.material) {
            label.customMaterial = style.material;
            label.cacheMode = Label.CacheMode.NONE;
            label.color = Color.WHITE;
        } else if (label.customMaterial) {
            label.customMaterial = null;
            label.cacheMode = Label.CacheMode.BITMAP;
        }
    }

    private styleOf(kind: DamageTextKind): DamageTextStyle {
        for (let i = 0; i < this.styles.length; i++) {
            if (this.styles[i] && this.styles[i].kind === kind) return this.styles[i];
        }

        const style = new DamageTextStyle();
        style.kind = kind;
        style.color = kind === DamageTextKind.HeroHit ? this.heroHitColor : this.enemyHitColor;
        return style;
    }

    private resolveHitPoint(attackerNode: Node, victimNode: Node, out: Vec3) {
        const to = this._toPoint.set(victimNode.worldPosition);
        if (attackerNode && attackerNode.isValid) {
            const t = this.hitLerpMin + Math.random() * Math.max(0, this.hitLerpMax - this.hitLerpMin);
            Vec3.lerp(out, attackerNode.worldPosition, to, t);
        } else {
            out.set(to);
        }

        out.y += this.hitHeightMin + Math.random() * Math.max(0, this.hitHeightMax - this.hitHeightMin);
        out.x += (Math.random() * 2 - 1) * this.hitSpread;
        out.z += (Math.random() * 2 - 1) * this.hitSpread;
    }

    private isInFrontOf(cam: Camera, worldPos: Vec3): boolean {
        const camPos = cam.node.worldPosition;
        const forward = cam.node.forward;
        const dx = worldPos.x - camPos.x;
        const dy = worldPos.y - camPos.y;
        const dz = worldPos.z - camPos.z;
        return dx * forward.x + dy * forward.y + dz * forward.z > 0.1;
    }

    private obtain(): FloatingDamageText {
        let text = this._pool.pop();
        if (!text) {
            const node = this.textPrefab ? instantiate(this.textPrefab) : this.buildFallbackNode();
            text = node.getComponent(FloatingDamageText) || node.addComponent(FloatingDamageText);
        }
        text.node.setParent(this.container);
        text.node.active = true;
        this._activeCount++;
        return text;
    }

    private recycle(text: FloatingDamageText) {
        if (!text || !text.node || !text.node.isValid) return;
        text.node.active = false;
        this._pool.push(text);
        this._activeCount = Math.max(0, this._activeCount - 1);
    }

    private buildFallbackNode(): Node {
        const node = new Node('DamageText');

        node.layer = this.container ? this.container.layer : Layers.Enum.UI_2D;
        node.addComponent(UITransform);
        node.addComponent(UIOpacity);

        const label = node.addComponent(Label);
        if (this.fallbackFont) label.font = this.fallbackFont;

        label.cacheMode = Label.CacheMode.BITMAP;
        label.fontSize = this.fallbackFontSize;
        label.lineHeight = this.fallbackFontSize * 1.2;
        label.isBold = true;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.NONE;

        label.enableOutline = true;
        label.outlineColor = new Color(0, 0, 0, 255);
        label.outlineWidth = this.fallbackOutlineWidth;

        const iconNode = new Node('Icon');
        iconNode.layer = node.layer;
        iconNode.setParent(node);
        iconNode.addComponent(UITransform).setContentSize(this.iconSize, this.iconSize);
        iconNode.setPosition(-(this.fallbackFontSize * 1.1 + this.iconSize * 0.3), this.fallbackFontSize * 0.35, 0);
        const iconSprite = iconNode.addComponent(Sprite);
        iconSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        iconNode.active = false;

        const text = node.addComponent(FloatingDamageText);
        text.label = label;
        text.icon = iconSprite;
        return node;
    }

}
