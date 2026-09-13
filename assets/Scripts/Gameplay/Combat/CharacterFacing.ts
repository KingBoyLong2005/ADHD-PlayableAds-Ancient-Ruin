import { _decorator, Component, Node, Quat, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

const _face = new Vec3();
const _look = new Vec3();
const _targetRot = new Quat();
const _out = new Quat();

@ccclass('CharacterFacing')
export class CharacterFacing extends Component {
    @property({ type: Node })
    public modelRoot: Node = null;

    @property
    public rotateModelOnly: boolean = true;

    private _cached: Node = null;

    public get target(): Node {
        if (!this.rotateModelOnly) return this.node;
        if (this.modelRoot && this.modelRoot.isValid) return this.modelRoot;
        return this.resolveActiveChild() || this.node;
    }

    private resolveActiveChild(): Node {
        const cached = this._cached;

        if (cached && cached.isValid && cached.active && cached.parent === this.node) return cached;
        const kids = this.node.children;
        for (let i = 0; i < kids.length; i++) {
            if (kids[i].active) {
                this._cached = kids[i];
                return kids[i];
            }
        }
        this._cached = null;
        return null;
    }

    public faceDirection(dir: Vec3, dt: number, speed: number) {
        CharacterFacing.rotateToward(this.target, dir, dt, speed);
    }

    public static minTurnDegPerSec: number = 720;

    public static rotateToward(
        node: Node,
        dir: Vec3,
        dt: number,
        speed: number,
        minDegPerSec: number = CharacterFacing.minTurnDegPerSec,
    ) {
        if (!node || !node.isValid) return;
        _face.set(dir.x, 0, dir.z);
        if (_face.lengthSqr() < 0.0001) return;
        _face.normalize();
        Quat.fromViewUp(_targetRot, _face, Vec3.UP);

        const from = node.worldRotation;
        let t = 1 - Math.exp(-speed * dt);
        if (minDegPerSec > 0) {

            const dot = Math.min(1, Math.abs(Quat.dot(from, _targetRot)));
            const remainDeg = 2 * Math.acos(dot) * 180 / Math.PI;
            if (remainDeg > 0.01) {
                const floor = (minDegPerSec * dt) / remainDeg;
                if (floor > t) t = Math.min(1, floor);
            }
        }
        Quat.slerp(_out, from, _targetRot, t);
        node.setWorldRotation(_out);
    }

    public static lookAtXZ(node: Node, worldPos: Vec3) {
        if (!node || !node.isValid) return;
        const p = node.worldPosition;
        _look.set(worldPos.x - p.x, 0, worldPos.z - p.z);
        if (_look.lengthSqr() < 0.0001) return;
        _look.normalize();
        Quat.fromViewUp(_targetRot, _look, Vec3.UP);
        node.setWorldRotation(_targetRot);
    }
}
