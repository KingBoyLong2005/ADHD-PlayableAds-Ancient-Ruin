import { _decorator, CCFloat, Component, Vec3 } from 'cc';
import { GameplayLog } from '../Debug/GameplayLog';
import { NavGrid } from './NavGrid';

const { ccclass, property } = _decorator;

const _dir = new Vec3();
const _escape = new Vec3();

@ccclass('NavPathFollower')
export class NavPathFollower extends Component {
    @property({ type: CCFloat })
    public repathInterval: number = 0.4;

    @property({ type: CCFloat })
    public waypointRadius: number = 0.5;

    @property({ type: CCFloat })
    public goalTolerance: number = 1.2;

    @property({ type: CCFloat })
    public stuckSpeed: number = 0.6;

    @property({ type: CCFloat })
    public stuckTime: number = 0.45;

    private _path: Vec3[] = [];
    private _index: number = 0;
    private _timer: number = 0;
    private _goal: Vec3 = new Vec3();
    private _hasGoal: boolean = false;

    private _fails: number = 0;
    private _reportedStuck: boolean = false;

    private _lastPos: Vec3 = new Vec3();
    private _hasLastPos: boolean = false;

    private _stuck: number = 0;

    public get pending(): number {
        return Math.max(0, this._path.length - this._index);
    }

    public clear() {
        this._path.length = 0;
        this._index = 0;
        this._hasGoal = false;
        this._fails = 0;
        this._reportedStuck = false;
        this._hasLastPos = false;
        this._stuck = 0;
    }

    public steer(goal: Vec3, dt: number): Vec3 | null {
        const grid = NavGrid.instance;
        if (!grid || !grid.baked) return null;

        const pos = this.node.worldPosition;
        this._timer -= dt;
        this.trackProgress(pos, dt);

        if (this._stuck >= this.stuckTime && grid.escapeTo(pos, _escape)) {

            this._path.length = 0;
            this._index = 0;
            this._timer = 0;
            _dir.set(_escape.x - pos.x, 0, _escape.z - pos.z);
            if (_dir.lengthSqr() > 1e-6) return _dir.normalize();
        }

        if (grid.hasLineOfSight(pos, goal)) {
            this.clear();
            return null;
        }

        const goalMoved = !this._hasGoal
            || (this._goal.x - goal.x) * (this._goal.x - goal.x)
                + (this._goal.z - goal.z) * (this._goal.z - goal.z) > this.goalTolerance * this.goalTolerance;

        if (this._index >= this._path.length || goalMoved || this._timer <= 0) {
            this._timer = this.repathInterval;
            this._goal.set(goal);
            this._hasGoal = true;
            this._index = 0;
            if (!grid.findPath(pos, goal, this._path)) {
                this._path.length = 0;
                this._fails += 1;

                if (this._fails >= 5 && !this._reportedStuck) {
                    this._reportedStuck = true;
                    GameplayLog.log(
                        'nav',
                        `${this.node.name} ${GameplayLog.pos(pos.x, pos.z)}: không tìm được đường tới `
                            + `${GameplayLog.pos(goal.x, goal.z)} sau ${this._fails} lần — đang lao thẳng`,
                    );
                }
                return null;
            }
            if (this._reportedStuck) {
                GameplayLog.log('nav', `${this.node.name}: tìm lại được đường`);
            }
            this._fails = 0;
            this._reportedStuck = false;
        }

        while (this._index < this._path.length && this.reached(pos, this._path[this._index])) this._index++;
        if (this._index >= this._path.length) return null;

        const wp = this._path[this._index];
        _dir.set(wp.x - pos.x, 0, wp.z - pos.z);
        if (_dir.lengthSqr() < 1e-6) return null;
        return _dir.normalize();
    }

    private trackProgress(pos: Vec3, dt: number) {
        if (!this._hasLastPos) {
            this._lastPos.set(pos);
            this._hasLastPos = true;
            return;
        }
        const dx = pos.x - this._lastPos.x;
        const dz = pos.z - this._lastPos.z;
        this._lastPos.set(pos);
        if (dt <= 0) return;
        if (Math.sqrt(dx * dx + dz * dz) / dt > this.stuckSpeed) {
            this._stuck = 0;
            return;
        }
        this._stuck += dt;
    }

    private reached(pos: Vec3, wp: Vec3): boolean {
        const dx = pos.x - wp.x;
        const dz = pos.z - wp.z;
        return dx * dx + dz * dz <= this.waypointRadius * this.waypointRadius;
    }
}
