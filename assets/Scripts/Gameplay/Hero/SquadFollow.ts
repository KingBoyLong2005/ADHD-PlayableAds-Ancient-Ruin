import { _decorator, CCFloat, Component, Quat, Vec3 } from 'cc';
import { CombatGate } from '../Combat/CombatGate';
import { EnemyController } from '../Enemy/EnemyController';
import { GameManager } from '../Managers/GameManager';
import { HeroController } from './HeroController';
import { HeroPartyManager } from './HeroPartyManager';

const { ccclass, property } = _decorator;

const _slot = new Vec3();
const _rot = new Quat();

@ccclass('SquadFollow')
export class SquadFollow extends Component {
    @property({ type: HeroController })
    public hero: HeroController = null;

    @property({ type: CCFloat })
    public slotAngle: number = 180;

    @property({ type: CCFloat })
    public slotDistance: number = 2.4;

    @property({ type: CCFloat })
    public engageRange: number = 11;

    @property({ type: CCFloat })
    public arriveDistance: number = 0.7;

    @property({ type: CCFloat })
    public departRatio: number = 1.8;

    @property({ type: CCFloat })
    public slotTurnSpeed: number = 3;

    @property({ type: CCFloat })
    public maxLeash: number = 6;

    @property({ type: CCFloat })
    public engageDelay: number = 0.3;

    @property({ type: CCFloat })
    public faceLerpSpeed: number = 9;

    private _returning: boolean = false;

    private _stillTime: number = 0;
    private _lastMain: Vec3 = new Vec3();
    private _hasLastMain: boolean = false;

    private _slotDir: Vec3 = new Vec3();
    private _hasSlotDir: boolean = false;

    private _stepping: boolean = false;

    onLoad() {
        if (!this.hero) this.hero = this.getComponent(HeroController);
    }

    update(dt: number) {
        const gm = GameManager.instance;
        if (gm && gm.isPaused) return;

        const hero = this.hero;
        if (!hero || !hero.isAlive) return;

        const main = HeroPartyManager.instance?.mainHero;
        if (!main || main === hero || !main.isAlive) return;

        this._stillTime = this.mainMoved(main, dt) ? 0 : this._stillTime + dt;

        if (this.strayed(main)) this._returning = true;

        const mayFight = CombatGate.open && !this._returning && this._stillTime >= this.engageDelay;
        if (mayFight && this.enemyNear(main)) {
            hero.autoCombat = true;
            return;
        }
        hero.autoCombat = false;

        this.slotWorldPosition(main, _slot, dt);
        const p = hero.node.worldPosition;
        const dx = _slot.x - p.x;
        const dz = _slot.z - p.z;
        const d2 = dx * dx + dz * dz;

        const stop = this.arriveDistance;
        const depart = stop * Math.max(1, this.departRatio);
        if (this._stepping ? d2 > stop * stop : d2 > depart * depart) {
            this._stepping = true;
            hero.moveToward(_slot, dt);
            return;
        }

        this._stepping = false;
        this._returning = false;
        hero.stopMove();

        const from = hero.facingNode;
        const to = main.facingNode;
        if (!from || !to) return;
        Quat.slerp(_rot, from.worldRotation, to.worldRotation, Math.min(1, this.faceLerpSpeed * dt));
        from.setWorldRotation(_rot);
    }

    private mainMoved(main: HeroController, dt: number): boolean {
        const p = main.node.worldPosition;
        if (!this._hasLastMain) {
            Vec3.copy(this._lastMain, p);
            this._hasLastMain = true;
            return false;
        }
        const dx = p.x - this._lastMain.x;
        const dz = p.z - this._lastMain.z;
        Vec3.copy(this._lastMain, p);

        const min = Math.max(0.01, (main.stats?.moveSpeed || 5) * dt * 0.25);
        return dx * dx + dz * dz > min * min;
    }

    private strayed(main: HeroController): boolean {
        if (this.maxLeash <= 0) return false;
        const p = this.node.worldPosition;
        const q = main.node.worldPosition;
        const dx = p.x - q.x;
        const dz = p.z - q.z;
        return dx * dx + dz * dz > this.maxLeash * this.maxLeash;
    }

    public slotWorldPosition(main: HeroController, out: Vec3, dt: number = 0) {
        const node = main.facingNode || main.node;

        const fwd = new Vec3(0, 0, -1);
        Vec3.transformQuat(fwd, fwd, node.worldRotation);
        const a = (this.slotAngle * Math.PI) / 180;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const dx = fwd.x * cos - fwd.z * sin;
        const dz = fwd.x * sin + fwd.z * cos;
        const len = Math.hypot(dx, dz) || 1;

        const wantX = dx / len;
        const wantZ = dz / len;
        if (!this._hasSlotDir || dt <= 0 || this.slotTurnSpeed <= 0) {
            this._slotDir.set(wantX, 0, wantZ);
            this._hasSlotDir = true;
        } else {
            const t = Math.min(1, this.slotTurnSpeed * dt);
            const nx = this._slotDir.x + (wantX - this._slotDir.x) * t;
            const nz = this._slotDir.z + (wantZ - this._slotDir.z) * t;

            const l = Math.hypot(nx, nz);
            if (l > 1e-4) this._slotDir.set(nx / l, 0, nz / l);
            else this._slotDir.set(wantX, 0, wantZ);
        }

        const base = main.node.worldPosition;
        out.set(
            base.x + this._slotDir.x * this.slotDistance,
            base.y,
            base.z + this._slotDir.z * this.slotDistance,
        );
    }

    private enemyNear(main: HeroController): boolean {
        const all = EnemyController.all;
        const p = main.node.worldPosition;
        const r2 = this.engageRange * this.engageRange;
        for (let i = 0; i < all.length; i++) {
            const e = all[i];
            if (!e || !e.node.active || !e.isAlive) continue;
            const q = e.node.worldPosition;
            const dx = q.x - p.x;
            const dz = q.z - p.z;
            if (dx * dx + dz * dz <= r2) return true;
        }
        return false;
    }
}

