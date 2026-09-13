import { _decorator, CCFloat, Component, Vec3 } from 'cc';
import { GameplayLog } from '../Debug/GameplayLog';
import { NavGrid } from '../Map/NavGrid';

const { ccclass, property } = _decorator;

export enum AggroState {

    Idle = 0,

    Chasing = 1,

    Returning = 2,
}

@ccclass('EnemyAggro')
export class EnemyAggro extends Component {

    private static _all: EnemyAggro[] = [];

    private static _queue: EnemyAggro[] = [];
    private static _spreading: boolean = false;

    @property({ type: CCFloat })
    public aggroRadius: number = 12;

    @property({ type: CCFloat })
    public leashRadius: number = 0;

    @property({ type: CCFloat })
    public giveUpDistance: number = 4;

    @property
    public requireLineOfSight: boolean = true;

    @property
    public wakeOnDamage: boolean = true;

    @property({ type: CCFloat })
    public homeTolerance: number = 0.6;

    @property
    public alertGroup: boolean = true;

    @property({ type: CCFloat })
    public alertRadius: number = 0;

    @property
    public groupId: string = '';

    public zoneId: string = '';

    private _state: AggroState = AggroState.Idle;
    private _home: Vec3 = new Vec3();
    private _homeSet: boolean = false;

    private _everEngaged: boolean = false;

    public get state(): AggroState {
        return this._state;
    }

    public get isChasing(): boolean {
        return this._state === AggroState.Chasing;
    }

    public get home(): Vec3 {
        return this._home;
    }

    onEnable() {

        this._state = AggroState.Idle;
        this._homeSet = false;
        this._everEngaged = false;
        EnemyAggro._all.push(this);
    }

    onDisable() {
        const i = EnemyAggro._all.indexOf(this);
        if (i >= 0) EnemyAggro._all.splice(i, 1);
    }

    public captureHome() {
        this._home.set(this.node.worldPosition);
        this._homeSet = true;
    }

    public setHome(pos: Vec3) {
        this._home.set(pos);
        this._homeSet = true;
        this._state = AggroState.Idle;
        this.joinGroupIfEngaged();
    }

    public evaluate(heroPos: Vec3): AggroState {
        if (!this._homeSet) this.captureHome();
        const pos = this.node.worldPosition;

        if (this._state === AggroState.Returning) {
            if (this.planarDist(pos, this._home) <= this.homeTolerance) {
                this.setState(AggroState.Idle, 'về tới chỗ canh');
            }
            return this._state;
        }

        if (this._state === AggroState.Chasing) {
            const fromHome = this.planarDist(pos, this._home);

            if (this.leashRadius > 0 && fromHome > this.leashRadius
                && this.planarDist(pos, heroPos) > this.giveUpDistance) {
                this.setState(AggroState.Returning, `xa chỗ canh ${fromHome.toFixed(1)}m > leash ${this.leashRadius}`);
            }
            return this._state;
        }

        if (!this._everEngaged && this.joinGroupIfEngaged()) return this._state;

        const d = this.planarDist(pos, heroPos);
        if (d <= this.aggroRadius && this.canSee(heroPos)) {
            this.setState(AggroState.Chasing, `thấy hero cách ${d.toFixed(1)}m (tầm ${this.aggroRadius})`);
        }
        return this._state;
    }

    public forceEngage(why: string = 'bị gọi vào trận') {
        if (this._state === AggroState.Chasing) return;

        this.leashRadius = 0;
        this.setState(AggroState.Chasing, why);
    }

    public wake() {
        if (!this.wakeOnDamage) return;
        this.setState(AggroState.Chasing, 'ăn đòn');
    }

    public joinGroupIfEngaged(): boolean {
        if (!this.alertGroup || !this.groupId) return false;
        const all = EnemyAggro._all;
        for (let i = 0; i < all.length; i++) {
            const o = all[i];
            if (o === this || !o.isValid) continue;
            if (o._state !== AggroState.Chasing || o.groupId !== this.groupId) continue;
            this.setState(AggroState.Chasing, 'tổ đã vào trận từ trước');
            return true;
        }
        return false;
    }

    private static spread(origin: EnemyAggro) {
        EnemyAggro._queue.push(origin);
        if (EnemyAggro._spreading) return;
        EnemyAggro._spreading = true;
        const q = EnemyAggro._queue;
        const all = EnemyAggro._all;

        try {
            while (q.length > 0) {
                const src = q.shift();
                if (!src || !src.isValid) continue;
                const byGroup = src.alertGroup && !!src.groupId;
                const r = src.alertRadius;
                if (!byGroup && r <= 0) continue;
                const sp = src.node.worldPosition;
                for (let i = 0; i < all.length; i++) {
                    const o = all[i];
                    if (o === src || !o.isValid || o._state === AggroState.Chasing) continue;

                    if (o.zoneId !== src.zoneId) continue;
                    const heard = (byGroup && o.groupId === src.groupId)
                        || (r > 0 && src.planarDist(sp, o.node.worldPosition) <= r);
                    if (!heard) continue;
                    o.setState(AggroState.Chasing, `đồng bọn ${src.node.name} báo`);
                }
            }
        } finally {
            q.length = 0;
            EnemyAggro._spreading = false;
        }
    }

    private setState(next: AggroState, why: string) {
        if (this._state === next) return;
        const from = AggroState[this._state];
        this._state = next;
        if (next === AggroState.Chasing) this._everEngaged = true;
        const p = this.node.worldPosition;
        GameplayLog.log(
            'aggro',
            `${this.node.name} ${GameplayLog.pos(p.x, p.z)}: ${from} -> ${AggroState[next]} (${why})`,
        );

        if (next === AggroState.Chasing) EnemyAggro.spread(this);
    }

    private canSee(heroPos: Vec3): boolean {
        if (!this.requireLineOfSight) return true;
        return NavGrid.canShoot(this.node.worldPosition, heroPos);
    }

    private planarDist(a: Vec3, b: Vec3): number {
        const dx = a.x - b.x;
        const dz = a.z - b.z;
        return Math.sqrt(dx * dx + dz * dz);
    }
}
