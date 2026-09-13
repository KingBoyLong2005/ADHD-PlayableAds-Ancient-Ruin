import {
    _decorator,
    BoxCollider,
    CapsuleCollider,
    CCFloat,
    CCString,
    Collider,
    Component,
    Enum,
    Mat4,
    MeshCollider,
    MeshRenderer,
    Node,
    SphereCollider,
    Vec3,
} from 'cc';
import { DEBUG } from 'cc/env';

const { ccclass, property } = _decorator;

const _corner = new Vec3();
const _lo = new Vec3();
const _hi = new Vec3();

const _inv = new Mat4();
const _p0 = new Vec3();
const _p1 = new Vec3();

const _shotA = new Vec3();
const _shotB = new Vec3();

interface NavBlocker {
    node: Node;
    lo: Vec3;
    hi: Vec3;
}

export enum NavBlockerSource {

    MeshBounds = 0,

    Colliders = 1,

    Both = 2,
}

@ccclass('NavGrid')
export class NavGrid extends Component {
    public static instance: NavGrid = null;

    @property({ type: [Node] })
    public floorRoots: Node[] = [];

    @property({ type: [Node] })
    public blockerRoots: Node[] = [];

    @property({ type: Enum(NavBlockerSource) })
    public blockerSource: NavBlockerSource = NavBlockerSource.Colliders;

    @property({ type: CCFloat })
    public cellSize: number = 0.4;

    @property({ type: CCFloat })
    public agentRadius: number = 0.45;

    @property({ type: CCFloat })
    public blockerMinHeight: number = 0.3;

    @property({ type: [CCString] })
    public ignoreNames: string[] = ['arch'];

    @property({ type: CCFloat })
    public sampleRadius: number = 4;

    @property
    public bakeOnLoad: boolean = true;

    private _blockers: NavBlocker[] = [];

    private _dirPath: Vec3[] = [];

    private _walk: Uint8Array = null;
    private _w: number = 0;
    private _h: number = 0;
    private _minX: number = 0;
    private _minZ: number = 0;

    private _g: Float32Array = null;
    private _f: Float32Array = null;
    private _parent: Int32Array = null;
    private _state: Uint8Array = null;
    private _open: Int32Array = null;
    private _openLen: number = 0;

    public get baked(): boolean {
        return !!this._walk;
    }

    onLoad() {
        NavGrid.instance = this;

        if (DEBUG) (globalThis as any).NavGridDebug = this;
    }

    start() {

        if (this.bakeOnLoad) this.bake();
    }

    onDestroy() {
        if (NavGrid.instance === this) NavGrid.instance = null;
        if (DEBUG && (globalThis as any).NavGridDebug === this) (globalThis as any).NavGridDebug = null;
    }

    public bake() {
        const floors: number[] = [];
        const blockers: number[] = [];
        this._blockers.length = 0;
        for (const root of this.floorRoots) this.collectBounds(root, floors, 0);
        for (const root of this.blockerRoots) this.collectBlockers(root, blockers);

        if (floors.length === 0) {
            console.warn('[NavGrid] không tìm thấy mesh sàn nào — bỏ qua bake.');
            this._walk = null;
            return;
        }
        if (blockers.length === 0) {

            console.warn(
                `[NavGrid] không tìm thấy hình chặn nào (blockerSource = ${NavBlockerSource[this.blockerSource]}) — cả map sẽ được coi là đi được.`,
            );
        }

        let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
        for (let i = 0; i < floors.length; i += 4) {
            if (floors[i] < minX) minX = floors[i];
            if (floors[i + 1] < minZ) minZ = floors[i + 1];
            if (floors[i + 2] > maxX) maxX = floors[i + 2];
            if (floors[i + 3] > maxZ) maxZ = floors[i + 3];
        }

        const cell = Math.max(0.1, this.cellSize);
        this._minX = minX;
        this._minZ = minZ;
        this._w = Math.max(1, Math.ceil((maxX - minX) / cell));
        this._h = Math.max(1, Math.ceil((maxZ - minZ) / cell));
        this._walk = new Uint8Array(this._w * this._h);

        this.rasterize(floors, 0, 1);

        this.rasterize(blockers, this.agentRadius, 0);

        const total = this._w * this._h;
        this._g = new Float32Array(total);
        this._f = new Float32Array(total);
        this._parent = new Int32Array(total);
        this._state = new Uint8Array(total);
        this._open = new Int32Array(total);

        if (DEBUG) {
            let walkable = 0;
            for (let i = 0; i < total; i++) if (this._walk[i]) walkable++;
            console.log(`[NavGrid] lưới ${this._w}x${this._h} ô (${cell}), đi được ${walkable}/${total}.`);
        }
    }

    private collectBounds(root: Node, out: number[], minHeight: number, recurse: boolean = true) {
        if (!root || !root.isValid) return;
        if (minHeight > 0 && this.isIgnored(root.name)) return;
        const mr = root.getComponent(MeshRenderer);
        if (mr && mr.mesh) {
            const struct = mr.mesh.struct;
            const lo = struct.minPosition;
            const hi = struct.maxPosition;
            if (lo && hi && hi.y - lo.y >= minHeight) this.pushCorners(root, lo, hi, out);
        }
        if (!recurse) return;
        const kids = root.children;
        for (let i = 0; i < kids.length; i++) this.collectBounds(kids[i], out, minHeight);
    }

    private pushCorners(node: Node, lo: Vec3, hi: Vec3, out: number[]) {
        const m = node.worldMatrix;
        let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;

        for (let i = 0; i < 8; i++) {
            _corner.set(i & 1 ? hi.x : lo.x, i & 2 ? hi.y : lo.y, i & 4 ? hi.z : lo.z);
            Vec3.transformMat4(_corner, _corner, m);
            if (_corner.x < minX) minX = _corner.x;
            if (_corner.x > maxX) maxX = _corner.x;
            if (_corner.z < minZ) minZ = _corner.z;
            if (_corner.z > maxZ) maxZ = _corner.z;
        }
        out.push(minX, minZ, maxX, maxZ);
    }

    private collectBlockers(root: Node, out: number[]) {
        if (!root || !root.isValid) return;
        if (this.isIgnored(root.name)) return;

        if (this.blockerSource !== NavBlockerSource.MeshBounds) {
            const colliders = root.getComponents(Collider);
            for (const c of colliders) {

                if (!c.enabled || c.isTrigger) continue;
                this.pushColliderBounds(c, root, out);
            }
        }
        if (this.blockerSource !== NavBlockerSource.Colliders) {
            this.collectBounds(root, out, this.blockerMinHeight, false);
        }

        const kids = root.children;
        for (let i = 0; i < kids.length; i++) this.collectBlockers(kids[i], out);
    }

    private pushColliderBounds(c: Collider, node: Node, out: number[]) {
        if (c instanceof BoxCollider) {
            const h = c.size;
            this.pushLocalBox(node, c.center, h.x * 0.5, h.y * 0.5, h.z * 0.5, out);
            return;
        }
        if (c instanceof SphereCollider) {
            this.pushLocalBox(node, c.center, c.radius, c.radius, c.radius, out);
            return;
        }
        if (c instanceof CapsuleCollider) {
            const half = Math.max(c.radius, c.height * 0.5);

            const hx = c.direction === 0 ? half : c.radius;
            const hy = c.direction === 1 ? half : c.radius;
            const hz = c.direction === 2 ? half : c.radius;
            this.pushLocalBox(node, c.center, hx, hy, hz, out);
            return;
        }
        if (c instanceof MeshCollider && c.mesh) {
            const s = c.mesh.struct;
            if (s.minPosition && s.maxPosition) {
                this.pushCorners(node, s.minPosition, s.maxPosition, out);
                this.pushBlocker(node, s.minPosition, s.maxPosition);
            }
            return;
        }
        console.warn(`[NavGrid] chưa hỗ trợ ${c.constructor.name} trên "${node.name}" — bỏ qua khi bake.`);
    }

    private pushLocalBox(node: Node, center: Vec3, hx: number, hy: number, hz: number, out: number[]) {
        _lo.set(center.x - hx, center.y - hy, center.z - hz);
        _hi.set(center.x + hx, center.y + hy, center.z + hz);
        this.pushCorners(node, _lo, _hi, out);
        this.pushBlocker(node, _lo, _hi);
    }

    private pushBlocker(node: Node, lo: Vec3, hi: Vec3) {
        this._blockers.push({ node, lo: new Vec3(lo), hi: new Vec3(hi) });
    }

    private isIgnored(name: string): boolean {
        if (this.ignoreNames.length === 0) return false;
        const lower = name.toLowerCase();
        for (const key of this.ignoreNames) {
            if (key && lower.indexOf(key.toLowerCase()) >= 0) return true;
        }
        return false;
    }

    private rasterize(boxes: number[], grow: number, value: number) {
        const cell = this.cellSize;
        for (let b = 0; b < boxes.length; b += 4) {
            const x0 = Math.floor((boxes[b] - grow - this._minX) / cell);
            const z0 = Math.floor((boxes[b + 1] - grow - this._minZ) / cell);
            const x1 = Math.ceil((boxes[b + 2] + grow - this._minX) / cell);
            const z1 = Math.ceil((boxes[b + 3] + grow - this._minZ) / cell);
            for (let z = Math.max(0, z0); z < Math.min(this._h, z1); z++) {
                const row = z * this._w;
                for (let x = Math.max(0, x0); x < Math.min(this._w, x1); x++) {
                    this._walk[row + x] = value;
                }
            }
        }
    }

    public isWalkableAt(x: number, z: number): boolean {
        if (!this._walk) return true;
        const cx = Math.floor((x - this._minX) / this.cellSize);
        const cz = Math.floor((z - this._minZ) / this.cellSize);
        if (cx < 0 || cz < 0 || cx >= this._w || cz >= this._h) return false;
        return this._walk[cz * this._w + cx] !== 0;
    }

    public hasLineOfSight(a: Vec3, b: Vec3): boolean {
        return this.trace(a, b, 0);
    }

    public hasSightLine(a: Vec3, b: Vec3, skip: number = 0.75): boolean {
        return this.trace(a, b, skip);
    }

    public static hitWall(from: Vec3, to: Vec3, out: Vec3 = null): boolean {
        const grid = NavGrid.instance;
        if (!grid) return false;
        const list = grid._blockers;
        let bestT = Number.MAX_VALUE;
        for (let i = 0; i < list.length; i++) {
            const b = list[i];
            if (!b.node.isValid || !b.node.activeInHierarchy) continue;

            Mat4.invert(_inv, b.node.worldMatrix);
            Vec3.transformMat4(_p0, from, _inv);
            Vec3.transformMat4(_p1, to, _inv);
            const t = NavGrid.segmentBoxT(_p0, _p1, b.lo, b.hi);
            if (t >= 0 && t < bestT) bestT = t;
        }
        if (bestT > 1) return false;
        if (out) Vec3.lerp(out, from, to, bestT);
        return true;
    }

    private static segmentBoxT(p0: Vec3, p1: Vec3, lo: Vec3, hi: Vec3): number {
        let tMin = 0;
        let tMax = 1;
        for (let axis = 0; axis < 3; axis++) {
            const o = axis === 0 ? p0.x : axis === 1 ? p0.y : p0.z;
            const e = axis === 0 ? p1.x : axis === 1 ? p1.y : p1.z;
            const l = axis === 0 ? lo.x : axis === 1 ? lo.y : lo.z;
            const h = axis === 0 ? hi.x : axis === 1 ? hi.y : hi.z;
            const d = e - o;
            if (Math.abs(d) < 1e-9) {

                if (o < l || o > h) return -1;
                continue;
            }
            let t0 = (l - o) / d;
            let t1 = (h - o) / d;
            if (t0 > t1) {
                const swap = t0;
                t0 = t1;
                t1 = swap;
            }
            if (t0 > tMin) tMin = t0;
            if (t1 < tMax) tMax = t1;
            if (tMin > tMax) return -1;
        }
        return tMin;
    }

    public static canSee(a: Vec3, b: Vec3): boolean {
        const grid = NavGrid.instance;
        if (!grid || !grid.baked) return true;
        return grid.hasSightLine(a, b);
    }

    public static canShoot(a: Vec3, b: Vec3, height: number = 1): boolean {
        if (NavGrid.canSee(a, b)) return true;
        const grid = NavGrid.instance;
        if (!grid || grid._blockers.length === 0) return true;
        _shotA.set(a.x, a.y + height, a.z);
        _shotB.set(b.x, b.y + height, b.z);
        return !NavGrid.hitWall(_shotA, _shotB);
    }

    private trace(a: Vec3, b: Vec3, skip: number): boolean {
        if (!this._walk) return true;
        const cell = this.cellSize;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 1e-4) return true;

        const steps = Math.ceil(dist / (cell * 0.5));
        const lo = skip / dist;
        const hi = 1 - lo;
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            if (t < lo || t > hi) continue;
            if (!this.isWalkableAt(a.x + dx * t, a.z + dz * t)) return false;
        }
        return true;
    }

    public samplePosition(x: number, z: number, out: Vec3): boolean {
        if (!this._walk) {
            out.set(x, 0, z);
            return true;
        }
        const i = this.nearestWalkable(x, z);
        if (i < 0) return false;
        out.set(
            this._minX + (i % this._w + 0.5) * this.cellSize,
            0,
            this._minZ + ((i / this._w) | 0) * this.cellSize + this.cellSize * 0.5,
        );
        return true;
    }

    public escapeTo(pos: Vec3, out: Vec3): boolean {
        if (!this._walk) return false;
        if (this.isWalkableAt(pos.x, pos.z)) return false;
        const i = this.nearestWalkable(pos.x, pos.z);
        if (i < 0) return false;
        out.set(
            this._minX + ((i % this._w) + 0.5) * this.cellSize,
            pos.y,
            this._minZ + (((i / this._w) | 0) + 0.5) * this.cellSize,
        );
        return true;
    }

    public travelDirection(from: Vec3, to: Vec3, out: Vec3): boolean {
        const dx = to.x - from.x;
        const dz = to.z - from.z;
        if (dx * dx + dz * dz < 1e-6) return false;

        if (this._walk && !this.hasLineOfSight(from, to) && this.findPath(from, to, this._dirPath)) {
            const wp = this._dirPath[0];
            out.set(wp.x - from.x, 0, wp.z - from.z);
            if (out.lengthSqr() > 1e-6) {
                out.normalize();
                return true;
            }
        }

        out.set(dx, 0, dz).normalize();
        return true;
    }

    public findPath(from: Vec3, to: Vec3, out: Vec3[]): boolean {
        out.length = 0;
        if (!this._walk) return false;

        const start = this.nearestWalkable(from.x, from.z);
        const goal = this.nearestWalkable(to.x, to.z);
        if (start < 0 || goal < 0) return false;
        if (start === goal) return false;

        if (!this.search(start, goal)) return false;

        const raw: number[] = [];
        let cur = goal;
        while (cur !== -1) {
            raw.push(cur);
            cur = this._parent[cur];
        }
        raw.reverse();

        this.smooth(raw, from, to, out);
        return out.length > 0;
    }

    private search(start: number, goal: number): boolean {
        const w = this._w;
        this._state.fill(0);
        this._openLen = 0;

        this._g[start] = 0;
        this._f[start] = this.heuristic(start, goal);
        this._parent[start] = -1;
        this.push(start);
        this._state[start] = 1;

        const gx = goal % w;
        const gz = (goal / w) | 0;

        while (this._openLen > 0) {
            const cur = this.pop();
            if (cur === goal) return true;
            this._state[cur] = 2;

            const cx = cur % w;
            const cz = (cur / w) | 0;
            for (let dz = -1; dz <= 1; dz++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dz === 0) continue;
                    const nx = cx + dx;
                    const nz = cz + dz;
                    if (nx < 0 || nz < 0 || nx >= w || nz >= this._h) continue;
                    const ni = nz * w + nx;
                    if (!this._walk[ni] || this._state[ni] === 2) continue;

                    if (dx !== 0 && dz !== 0) {
                        if (!this._walk[cz * w + nx] || !this._walk[nz * w + cx]) continue;
                    }

                    const step = dx !== 0 && dz !== 0 ? 1.41421356 : 1;
                    const ng = this._g[cur] + step;
                    if (this._state[ni] === 1 && ng >= this._g[ni]) continue;

                    this._g[ni] = ng;
                    this._f[ni] = ng + this.octile(nx, nz, gx, gz);
                    this._parent[ni] = cur;

                    if (this._state[ni] !== 1) {
                        this._state[ni] = 1;
                        this.push(ni);
                    }
                }
            }
        }
        return false;
    }

    private heuristic(i: number, goal: number): number {
        return this.octile(i % this._w, (i / this._w) | 0, goal % this._w, (goal / this._w) | 0);
    }

    private octile(ax: number, az: number, bx: number, bz: number): number {
        const dx = Math.abs(ax - bx);
        const dz = Math.abs(az - bz);
        return dx > dz ? dx + 0.41421356 * dz : dz + 0.41421356 * dx;
    }

    private push(i: number) {
        this._open[this._openLen++] = i;
    }

    private pop(): number {
        let best = 0;
        let bestF = this._f[this._open[0]];
        for (let i = 1; i < this._openLen; i++) {
            const f = this._f[this._open[i]];
            if (f < bestF) {
                bestF = f;
                best = i;
            }
        }
        const node = this._open[best];
        this._open[best] = this._open[--this._openLen];
        return node;
    }

    private nearestWalkable(x: number, z: number): number {
        const cx = Math.floor((x - this._minX) / this.cellSize);
        const cz = Math.floor((z - this._minZ) / this.cellSize);
        if (cx >= 0 && cz >= 0 && cx < this._w && cz < this._h && this._walk[cz * this._w + cx]) {
            return cz * this._w + cx;
        }
        const maxR = Math.max(1, Math.ceil(this.sampleRadius / this.cellSize));
        let anyBest = -1;
        let anyD = Infinity;
        for (let r = 1; r <= maxR; r++) {

            let best = -1;
            let bestD = Infinity;
            for (let dz = -r; dz <= r; dz++) {
                for (let dx = -r; dx <= r; dx++) {

                    if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
                    const nx = cx + dx;
                    const nz = cz + dz;
                    if (nx < 0 || nz < 0 || nx >= this._w || nz >= this._h) continue;
                    const ni = nz * this._w + nx;
                    if (!this._walk[ni]) continue;
                    const d = dx * dx + dz * dz;
                    if (d < anyD) {
                        anyD = d;
                        anyBest = ni;
                    }
                    if (d >= bestD || !this.reachesWithoutCrossing(x, z, ni)) continue;
                    bestD = d;
                    best = ni;
                }
            }
            if (best >= 0) return best;
        }
        return anyBest;
    }

    private reachesWithoutCrossing(x: number, z: number, i: number): boolean {
        const cell = this.cellSize;
        const tx = this._minX + ((i % this._w) + 0.5) * cell;
        const tz = this._minZ + (((i / this._w) | 0) + 0.5) * cell;
        const dx = tx - x;
        const dz = tz - z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 1e-4) return true;
        const steps = Math.ceil(dist / (cell * 0.5));
        let left = false;
        for (let s = 1; s <= steps; s++) {
            const t = s / steps;
            if (this.isWalkableAt(x + dx * t, z + dz * t)) left = true;
            else if (left) return false;
        }
        return true;
    }

    private smooth(cells: number[], from: Vec3, to: Vec3, out: Vec3[]) {
        const pts: Vec3[] = [];
        for (let i = 0; i < cells.length; i++) pts.push(this.cellCenter(cells[i]));
        pts.push(new Vec3(to.x, from.y, to.z));

        let anchor = new Vec3(from.x, from.y, from.z);
        let i = 0;
        while (i < pts.length) {
            let j = pts.length - 1;

            while (j > i && !this.hasLineOfSight(anchor, pts[j])) j--;
            if (j <= i) j = i;
            out.push(pts[j]);
            anchor = pts[j];
            if (j >= pts.length - 1) break;
            i = j + 1;
        }
    }

    private cellCenter(i: number): Vec3 {
        const cx = i % this._w;
        const cz = (i / this._w) | 0;
        return new Vec3(
            this._minX + (cx + 0.5) * this.cellSize,
            0,
            this._minZ + (cz + 0.5) * this.cellSize,
        );
    }
}
