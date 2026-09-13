import { _decorator, CharacterController, Component, Vec3 } from 'cc';
import { GameManager } from '../Managers/GameManager';
import { CharacterStats } from './CharacterStats';

const { ccclass, property } = _decorator;

const _push = new Vec3();

@ccclass('EntitySeparation')
export class EntitySeparation extends Component {
    private static _instances: EntitySeparation[] = [];

    @property
    public pushStrength: number = 8;

    @property
    public playerImmovableWhenIdle: boolean = true;

    @property
    public heroImmovableVsEnemy: boolean = true;

    private _stats: CharacterStats = null;
    private _isIdle: boolean = true;
    private _offset: Vec3 = new Vec3();
    private _cct: CharacterController = null;

    onEnable() {
        EntitySeparation._instances.push(this);
        this._stats = this.getComponent(CharacterStats);
        this._cct = this.getComponent(CharacterController);
    }

    onDisable() {
        const idx = EntitySeparation._instances.indexOf(this);
        if (idx >= 0) EntitySeparation._instances.splice(idx, 1);
    }

    public setIdle(idle: boolean) {
        this._isIdle = idle;
    }

    lateUpdate(dt: number) {
        const gm = GameManager.instance;
        if (gm && gm.isPaused) return;
        if (!this._stats || this._stats.isDead) return;

        const selfPos = this.node.worldPosition;
        const selfRadius = this._stats.separationRadius;
        const selfIsHero = this._stats.isPlayer;
        this._offset.set(0, 0, 0);

        for (let i = 0; i < EntitySeparation._instances.length; i++) {
            const other = EntitySeparation._instances[i];
            if (other === this || !other.node.active || !other._stats || other._stats.isDead) continue;

            const otherIsHero = other._stats.isPlayer;
            let share = 1;
            if (this.heroImmovableVsEnemy && selfIsHero !== otherIsHero) {
                if (selfIsHero) continue;
                share = 2;
            }

            const otherPos = other.node.worldPosition;
            const dx = selfPos.x - otherPos.x;
            const dz = selfPos.z - otherPos.z;
            const distSq = dx * dx + dz * dz;
            const minDist = selfRadius + other._stats.separationRadius;
            if (distSq <= 0.0001 || distSq >= minDist * minDist) continue;

            const dist = Math.sqrt(distSq);
            const push = ((minDist - dist) / minDist) * share;
            this._offset.x += (dx / dist) * push;
            this._offset.z += (dz / dist) * push;
        }

        if (this._offset.lengthSqr() < 0.0001) return;

        const selfIsPlayerIdle =
            this.playerImmovableWhenIdle &&
            selfIsHero &&
            this._isIdle;

        if (selfIsPlayerIdle) return;

        const move = this.pushStrength * dt;

        if (this._cct && this._cct.enabledInHierarchy) {
            _push.set(this._offset.x * move, 0, this._offset.z * move);
            this._cct.move(_push);
            return;
        }
        this.node.setWorldPosition(
            selfPos.x + this._offset.x * move,
            selfPos.y,
            selfPos.z + this._offset.z * move,
        );
    }
}
