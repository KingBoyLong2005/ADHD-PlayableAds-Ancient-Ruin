import { _decorator, CCFloat, Component, instantiate, Node, Prefab, SpriteFrame, Vec3 } from 'cc';
import EventManager from '../../Utility/EventManager';
import { CharacterStats } from '../Combat/CharacterStats';
import { GameplayEvents } from '../Events/GameplayEvents';
import { HpController } from './HpController';

const { ccclass, property } = _decorator;

@ccclass('HpBarAttacher')
export class HpBarAttacher extends Component {
    @property({ type: Prefab })
    public hpBarPrefab: Prefab = null;

    @property
    public localOffset: Vec3 = new Vec3(0, 2.4, 0);

    @property({ type: CCFloat })
    public barScale: number = 0.01;

    @property({ type: SpriteFrame })
    public fillFrame: SpriteFrame = null;

    @property({ type: CharacterStats })
    public stats: CharacterStats = null;

    @property
    public hideOnDeath: boolean = true;

    private _bar: Node = null;
    private _ctrl: HpController = null;

    start() {
        if (this._bar || !this.hpBarPrefab) return;

        this._bar = instantiate(this.hpBarPrefab);
        this._bar.setParent(this.node, false);
        this._bar.setPosition(this.localOffset);
        this._bar.setScale(this.barScale, this.barScale, this.barScale);

        this._ctrl = this._bar.getComponent(HpController);

        if (this.fillFrame && this._ctrl?.fillSprite) {
            this._ctrl.fillSprite.spriteFrame = this.fillFrame;
        }
        this._ctrl?.bind(this.resolveStats());
        this.applyDeathState();
        this.syncBarTransform();
    }

    update() {
        this.syncBarTransform();
    }

    onEnable() {

        this._ctrl?.bind(this.resolveStats());
        EventManager.instance.on(GameplayEvents.HpChanged, this.onHpChanged, this);
        this.applyDeathState();
    }

    onDisable() {
        EventManager.instance.off(GameplayEvents.HpChanged, this.onHpChanged, this);
    }

    private onHpChanged(stats: CharacterStats) {
        if (stats !== this.resolveStats()) return;
        this.applyDeathState();
    }

    private syncBarTransform() {
        if (!this._bar || !this._bar.isValid || !this.node || !this.node.isValid) return;

        const pos = this.node.worldPosition;
        this._bar.setWorldPosition(
            pos.x + this.localOffset.x,
            pos.y + this.localOffset.y,
            pos.z + this.localOffset.z,
        );
    }

    private applyDeathState() {
        if (!this.hideOnDeath || !this._bar || !this._bar.isValid) return;
        const stats = this.resolveStats();
        const show = !!stats && !stats.isDead;
        if (this._bar.active === show) return;
        this._bar.active = show;

        if (show) this._ctrl?.bind(stats);
    }

    private resolveStats(): CharacterStats {
        return this.stats || this.getComponent(CharacterStats);
    }
}
