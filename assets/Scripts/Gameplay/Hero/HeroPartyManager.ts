import { _decorator, Component, Node, Vec3 } from 'cc';
import EventManager from '../../Utility/EventManager';
import { GameplayEvents } from '../Events/GameplayEvents';
import { GameManager } from '../Managers/GameManager';
import { GameMode } from '../Managers/GameMode';
import { NavGrid } from '../Map/NavGrid';
import { HeroController } from './HeroController';

const { ccclass, property } = _decorator;

@ccclass('HeroPartyManager')
export class HeroPartyManager extends Component {
    public static instance: HeroPartyManager;

    @property([HeroController])
    public heroes: HeroController[] = [];

    @property(Node)
    public cameraAnchor: Node = null;

    @property
    public followCentroid: boolean = true;

    public priorityHero: HeroController = null;

    public priorityRange: number = 12;

    onLoad() {
        HeroPartyManager.instance = this;
        if ((!this.heroes || this.heroes.length === 0) && this.node) {
            this.heroes = this.getComponentsInChildren(HeroController);
        }
    }

    onEnable() {
        EventManager.instance.on(GameplayEvents.HeroDied, this.onHeroDied, this);
    }

    onDisable() {
        EventManager.instance.off(GameplayEvents.HeroDied, this.onHeroDied, this);
    }

    start() {
        const gm = GameManager.instance;
        const multi = gm?.gameMode === GameMode.MultiHero;
        for (let i = 0; i < this.heroes.length; i++) {
            const h = this.heroes[i];
            if (h) h.autoCombat = !!multi;
        }
    }

    lateUpdate() {
        this.updateCameraAnchor();
    }

    public get aliveHeroes(): HeroController[] {
        return (this.heroes || []).filter((h) => h && h.isAlive);
    }

    public get mainHero(): HeroController {
        const alive = this.aliveHeroes;
        if (alive.length > 0) return alive[0];
        return this.heroes && this.heroes.length > 0 ? this.heroes[0] : null;
    }

    public getNearestAliveHero(from: Vec3, preferVisible: boolean = false): HeroController {

        const pri = this.priorityHero;
        if (pri && pri.isAlive && pri.node?.isValid) {
            const p = pri.node.worldPosition;
            const dx = p.x - from.x;
            const dz = p.z - from.z;
            const inRange = this.priorityRange <= 0
                || dx * dx + dz * dz <= this.priorityRange * this.priorityRange;
            if (inRange && (!preferVisible || NavGrid.canShoot(from, p))) return pri;
        }

        const alive = this.aliveHeroes;
        let best: HeroController = null;
        let bestDist = Number.MAX_VALUE;
        let seen: HeroController = null;
        let seenDist = Number.MAX_VALUE;
        for (let i = 0; i < alive.length; i++) {
            const h = alive[i];
            const p = h.node.worldPosition;
            const dx = p.x - from.x;
            const dz = p.z - from.z;
            const d = dx * dx + dz * dz;
            if (d < bestDist) {
                bestDist = d;
                best = h;
            }
            if (!preferVisible || d >= seenDist) continue;
            if (!NavGrid.canShoot(from, p)) continue;
            seenDist = d;
            seen = h;
        }
        return seen || best;
    }

    public getWeakestAliveHero(): HeroController {
        const alive = this.aliveHeroes;
        let best: HeroController = null;
        let bestHp = Number.MAX_VALUE;
        for (let i = 0; i < alive.length; i++) {
            const h = alive[i];
            const hp = h.stats ? h.stats.hp : Number.MAX_VALUE;
            if (hp < bestHp) {
                bestHp = hp;
                best = h;
            }
        }
        return best;
    }

    private onHeroDied() {
        if (this.aliveHeroes.length === 0) {
            EventManager.instance.emit(GameplayEvents.AllHeroesDied);
        }
    }

    private updateCameraAnchor() {
        if (!this.cameraAnchor) return;
        const alive = this.aliveHeroes;
        if (alive.length === 0) return;

        if (!this.followCentroid || alive.length === 1) {
            this.cameraAnchor.setWorldPosition(alive[0].node.worldPosition);
            return;
        }

        let x = 0;
        let y = 0;
        let z = 0;
        for (let i = 0; i < alive.length; i++) {
            const p = alive[i].node.worldPosition;
            x += p.x;
            y += p.y;
            z += p.z;
        }
        const n = alive.length;
        this.cameraAnchor.setWorldPosition(x / n, y / n, z / n);
    }
}
