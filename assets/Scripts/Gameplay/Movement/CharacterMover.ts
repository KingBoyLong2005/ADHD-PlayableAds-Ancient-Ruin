import { CharacterController, Node, Vec3 } from 'cc';

const _step = new Vec3();

export class CharacterMover {

    public blockedRatio: number = 0.7;

    public stuckRatio: number = 0.25;

    public cornerAssist: boolean = false;

    public assistAngleDeg: number = 40;

    public assistScale: number = 0.75;

    private _from: Vec3 = new Vec3();

    private _assistSign: number = 1;

    public move(cct: CharacterController, node: Node, dx: number, dz: number): number {
        const want = Math.sqrt(dx * dx + dz * dz);
        if (want < 1e-6) {

            if (cct && cct.enabledInHierarchy) this.step(cct, dx, dz);
            return 0;
        }

        if (!cct || !cct.enabledInHierarchy) {
            const p = node.worldPosition;
            node.setWorldPosition(p.x + dx, p.y, p.z + dz);
            return want;
        }

        Vec3.copy(this._from, node.worldPosition);
        this.step(cct, dx, dz);
        let gained = this.travelled(node);
        if (gained >= want * this.blockedRatio) return gained;

        const p = node.worldPosition;
        const restX = dx - (p.x - this._from.x);
        const restZ = dz - (p.z - this._from.z);
        if (Math.abs(restX) > 1e-6) this.step(cct, restX, 0);
        if (Math.abs(restZ) > 1e-6) this.step(cct, 0, restZ);
        gained = this.travelled(node);
        if (gained >= want * this.stuckRatio || !this.cornerAssist) return gained;

        const rad = (this.assistAngleDeg * Math.PI) / 180;
        for (let i = 0; i < 2; i++) {
            const sign = i === 0 ? this._assistSign : -this._assistSign;
            const c = Math.cos(rad * sign) * this.assistScale;
            const s = Math.sin(rad * sign) * this.assistScale;
            this.step(cct, dx * c - dz * s, dx * s + dz * c);
            gained = this.travelled(node);
            if (gained >= want * this.stuckRatio) {
                this._assistSign = sign;
                return gained;
            }
        }
        return gained;
    }

    private step(cct: CharacterController, x: number, z: number) {
        _step.set(x, 0, z);
        cct.move(_step);
    }

    private travelled(node: Node): number {
        const p = node.worldPosition;
        const dx = p.x - this._from.x;
        const dz = p.z - this._from.z;
        return Math.sqrt(dx * dx + dz * dz);
    }
}
