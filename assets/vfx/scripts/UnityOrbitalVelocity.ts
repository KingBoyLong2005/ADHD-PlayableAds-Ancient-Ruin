import { _decorator, Component, Enum, ParticleSystem, Vec3 } from 'cc';

const { ccclass, property, executeInEditMode, executionOrder, requireComponent, menu } = _decorator;

enum OrbitalSpace {
    World = 0,
    Local = 1,
}

@ccclass('VfxCurveKey')
export class VfxCurveKey {
    @property
    time = 0;

    @property
    value = 0;
}

@ccclass('VfxMappedCurve')
export class VfxMappedCurve {

    @property
    mode = 0;

    @property
    constant = 0;

    @property
    constantMin = 0;

    @property
    constantMax = 0;

    @property
    multiplier = 1;

    @property({ type: [VfxCurveKey] })
    keys: VfxCurveKey[] = [];

    @property({ type: [VfxCurveKey] })
    keysMin: VfxCurveKey[] = [];

    evaluate(t: number, rand: number): number {
        if (this.mode === 3) {
            return this.constantMin + (this.constantMax - this.constantMin) * rand;
        }
        if (this.mode === 2) {
            const a = sampleKeys(this.keysMin.length ? this.keysMin : this.keys, t);
            const b = sampleKeys(this.keys.length ? this.keys : this.keysMin, t);
            return (a + (b - a) * rand) * (this.multiplier || 1);
        }
        if (this.mode === 1 && this.keys && this.keys.length) {
            return sampleKeys(this.keys, t) * (this.multiplier || 1);
        }
        return this.constant || 0;
    }
}

function sampleKeys(keys: VfxCurveKey[], t: number): number {
    if (!keys || !keys.length) return 0;
    if (t <= keys[0].time) return keys[0].value;
    const last = keys[keys.length - 1];
    if (t >= last.time) return last.value;
    for (let i = 1; i < keys.length; i++) {
        const b = keys[i];
        if (t <= b.time) {
            const a = keys[i - 1];
            const u = (t - a.time) / Math.max(1e-8, b.time - a.time);
            return a.value + (b.value - a.value) * u;
        }
    }
    return last.value;
}

function rand01(seed: number, salt: number): number {
    let x = (seed ^ salt) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
    x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
    x = (x ^ (x >>> 16)) >>> 0;
    return (x & 0xfffffff) / 0xfffffff;
}

function isTwoValues(curve: VfxMappedCurve): boolean {
    return !!curve && (curve.mode === 2 || curve.mode === 3);
}

const _vel = new Vec3();
const _r = new Vec3();

@ccclass('UnityOrbitalVelocity')
@menu('VFX/Unity Orbital Velocity')
@requireComponent(ParticleSystem)
@executeInEditMode
@executionOrder(98)
export class UnityOrbitalVelocity extends Component {
    @property({ type: VfxMappedCurve })
    orbitalX = new VfxMappedCurve();

    @property({ type: VfxMappedCurve })
    orbitalY = new VfxMappedCurve();

    @property({ type: VfxMappedCurve })
    orbitalZ = new VfxMappedCurve();

    @property({ type: VfxMappedCurve })
    offsetX = new VfxMappedCurve();

    @property({ type: VfxMappedCurve })
    offsetY = new VfxMappedCurve();

    @property({ type: VfxMappedCurve })
    offsetZ = new VfxMappedCurve();

    @property({ type: VfxMappedCurve })
    radial = new VfxMappedCurve();

    @property({ type: Enum(OrbitalSpace) })
    space: OrbitalSpace = OrbitalSpace.Local;

    private _ps: ParticleSystem | null = null;
    private _mod: { name: string; needUpdate: boolean; needAnimate: boolean; animate: (p: any, dt: number) => void } | null = null;

    onLoad(): void {
        this._ps = this.getComponent(ParticleSystem);
        this._mod = {
            name: 'unityOrbital',
            needUpdate: false,
            needAnimate: true,
            animate: (p: any, dt: number) => this.animateParticle(p, dt),
        };
    }

    update(): void {
        try {
            this.injectModule();
        } catch (e) {

        }
    }

    private injectModule(): void {
        const ps = this._ps || this.getComponent(ParticleSystem);
        if (!ps || !this._mod) return;
        const proc = (ps as any).processor;
        if (!proc || !Array.isArray(proc._runAnimateList)) return;
        const list = proc._runAnimateList as any[];
        if (list.indexOf(this._mod) < 0) {
            list.push(this._mod);
        }
    }

    private animateParticle(p: any, _dt: number): void {
        const life = p.startLifetime > 1e-8 ? (1 - p.remainingLifetime / p.startLifetime) : 0;
        const seed = p.randomSeed || 0;
        const ox = this.orbitalX.evaluate(life, isTwoValues(this.orbitalX) ? rand01(seed, 0x11) : 0);
        const oy = this.orbitalY.evaluate(life, isTwoValues(this.orbitalY) ? rand01(seed, 0x22) : 0);
        const oz = this.orbitalZ.evaluate(life, isTwoValues(this.orbitalZ) ? rand01(seed, 0x33) : 0);
        const cx = this.offsetX.evaluate(life, isTwoValues(this.offsetX) ? rand01(seed, 0x44) : 0);
        const cy = this.offsetY.evaluate(life, isTwoValues(this.offsetY) ? rand01(seed, 0x55) : 0);
        const cz = this.offsetZ.evaluate(life, isTwoValues(this.offsetZ) ? rand01(seed, 0x66) : 0);
        const rad = this.radial.evaluate(life, isTwoValues(this.radial) ? rand01(seed, 0x77) : 0);

        _r.set(p.position.x - cx, p.position.y - cy, p.position.z - cz);

        _vel.set(
            oy * _r.z - oz * _r.y,
            oz * _r.x - ox * _r.z,
            ox * _r.y - oy * _r.x,
        );
        const lenSq = _r.x * _r.x + _r.y * _r.y + _r.z * _r.z;
        if (rad !== 0 && lenSq > 1e-12) {
            const inv = rad / Math.sqrt(lenSq);
            _vel.x += _r.x * inv;
            _vel.y += _r.y * inv;
            _vel.z += _r.z * inv;
        }

        if (p.animatedVelocity) {
            p.animatedVelocity.x += _vel.x;
            p.animatedVelocity.y += _vel.y;
            p.animatedVelocity.z += _vel.z;
        }
        if (p.ultimateVelocity) {
            p.ultimateVelocity.x += _vel.x;
            p.ultimateVelocity.y += _vel.y;
            p.ultimateVelocity.z += _vel.z;
        }
    }
}
