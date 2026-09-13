import { _decorator, CCFloat, Component, Node, Quat, Vec3 } from 'cc';
import { HeroPartyManager } from '../Hero/HeroPartyManager';

const { ccclass, property } = _decorator;

const _back = new Vec3();
const _rot = new Quat();

@ccclass('CameraFollow')
export class CameraFollow extends Component {
    @property(Node)
    public target: Node = null;

    @property
    public offset: Vec3 = new Vec3(0, 12, 12);

    @property(CCFloat)
    public followLerp: number = 8;

    @property
    public useAuthoredFraming: boolean = true;

    @property
    public lookAtTarget: boolean = true;

    @property
    public usePartyAnchor: boolean = true;

    @property({ type: CCFloat })
    public arriveDistance: number = 0.4;

    private _pos: Vec3 = new Vec3();

    private _offset: Vec3 = new Vec3();
    private _offsetReady: boolean = false;

    public snap() {
        const follow = this.resolveFollow();
        if (!follow) return;
        this.ensureOffset(follow);
        this.node.setWorldPosition(
            follow.worldPosition.x + this._offset.x,
            follow.worldPosition.y + this._offset.y,
            follow.worldPosition.z + this._offset.z,
        );
    }

    public get atTarget(): boolean {
        const follow = this.resolveFollow();
        if (!follow) return true;
        this.ensureOffset(follow);
        const p = this.node.worldPosition;
        const t = follow.worldPosition;
        const dx = p.x - (t.x + this._offset.x);
        const dy = p.y - (t.y + this._offset.y);
        const dz = p.z - (t.z + this._offset.z);
        return dx * dx + dy * dy + dz * dz <= this.arriveDistance * this.arriveDistance;
    }

    private resolveFollow(): Node {
        let follow = this.target;
        if (this.usePartyAnchor) {
            const party = HeroPartyManager.instance;
            if (party?.cameraAnchor) {
                follow = party.cameraAnchor;
            } else if (party?.mainHero) {
                follow = party.mainHero.node;
            }
        }
        return follow;
    }

    private ensureOffset(follow: Node) {
        if (this._offsetReady) return;
        this._offsetReady = true;
        if (this.useAuthoredFraming) {

            Vec3.subtract(this._offset, this.node.worldPosition, follow.worldPosition);
        } else {
            this._offset.set(this.offset);
        }
    }

    lateUpdate(dt: number) {
        const follow = this.resolveFollow();
        if (!follow) return;

        this.ensureOffset(follow);

        const desired = new Vec3(
            follow.worldPosition.x + this._offset.x,
            follow.worldPosition.y + this._offset.y,
            follow.worldPosition.z + this._offset.z,
        );

        const t = 1 - Math.exp(-this.followLerp * dt);
        Vec3.lerp(this._pos, this.node.worldPosition, desired, t);
        this.node.setWorldPosition(this._pos);

        if (this.useAuthoredFraming) return;

        if (this.lookAtTarget) {

            _back.set(this._offset);
            if (_back.lengthSqr() > 1e-6) {
                _back.normalize();

                Quat.fromViewUp(_rot, _back, Vec3.UP);
                this.node.setWorldRotation(_rot);
            }
        }
    }
}
