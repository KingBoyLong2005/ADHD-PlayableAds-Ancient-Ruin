import { _decorator, CCFloat, CCInteger, Component, Enum, Node, Vec3 } from 'cc';
import EventManager from '../../Utility/EventManager';
import { CameraFollow } from '../Camera/CameraFollow';
import { CameraIntro } from '../Camera/CameraIntro';
import { GameplayLog } from '../Debug/GameplayLog';
import { EnemyController } from '../Enemy/EnemyController';
import { GameplayEvents } from '../Events/GameplayEvents';
import { AllyRescue } from '../Hero/AllyRescue';
import { HeroClass } from '../Hero/HeroClass';
import { HeroController } from '../Hero/HeroController';
import { HeroPartyManager } from '../Hero/HeroPartyManager';
import { RoomSelectManager } from '../Map/RoomSelectManager';
import { ObjectiveUI } from '../UI/ObjectiveUI';
import { RevivePopupUI } from '../UI/RevivePopupUI';
import { EnemySpawnPoint, SpawnTrigger } from './EnemySpawnPoint';
import { ExperienceManager } from './ExperienceManager';
import { GameManager, GameState } from './GameManager';
import { LevelUpManager } from './LevelUpManager';
import { RunFlowHook } from './RunFlow';

const { ccclass, property } = _decorator;

@ccclass('RunStage')
export class RunStage {
    @property
    public name: string = 'Wave';

    @property
    public zoneId: string = '';

    @property
    public selectRoom: boolean = true;

    @property({ type: Node })
    public layout: Node = null;

    @property
    public introOnStart: boolean = false;

    @property({ type: AllyRescue })
    public ally: AllyRescue = null;

    @property
    public objective: string = '';

    @property
    public skillPickOnEnter: boolean = false;

    @property
    public skillPickAfterIntro: boolean = false;

    @property
    public skillPickAfterClear: boolean = true;

    @property
    public endsWithRevive: boolean = false;

    @property({ type: AllyRescue })
    public victim: AllyRescue = null;

    /** Lớp hero bắt buộc phải gục ở chặng này (mặc định Mage). None = không ép. */
    @property({ type: Enum(HeroClass) })
    public victimClass: HeroClass = HeroClass.Mage;

    @property({ type: CCFloat })
    public forceDeathAfter: number = 0;
}

enum Phase {

    Idle = 0,

    Intro = 1,

    Fighting = 2,

    Between = 3,

    Regroup = 4,

    Picking = 5,

    Ending = 6,

    RoomPick = 7,

    Travel = 8,

    Exit = 9,
}

enum AfterPick {

    NextStage = 0,

    EnterStage = 1,

    Fight = 2,
}

@ccclass('RunDirector')
export class RunDirector extends Component implements RunFlowHook {
    public static instance: RunDirector = null;

    @property({ type: [RunStage] })
    public stages: RunStage[] = [];

    @property({ type: CameraIntro })
    public intro: CameraIntro = null;

    @property({ type: RoomSelectManager })
    public roomSelect: RoomSelectManager = null;

    @property({ type: RevivePopupUI })
    public revivePopup: RevivePopupUI = null;

    @property({ type: ObjectiveUI })
    public objectiveUI: ObjectiveUI = null;

    @property({ type: CCFloat })
    public clearedDelay: number = 0.8;

    @property({ type: CCFloat })
    public allyJoinTimeout: number = 10;

    @property({ type: CCFloat })
    public nextStageDelay: number = 0.4;

    @property({ type: CCFloat })
    public travelTimeout: number = 5;

    @property({ type: CCFloat })
    public revivePopupDelay: number = 0.8;

    @property
    public combatOnFirstMove: boolean = true;

    @property({ type: CCFloat })
    public firstMoveDistance: number = 1;

    @property({ type: CCFloat })
    public firstMoveFallback: number = 6;

    @property({ type: CCFloat, range: [0, 1], slide: true })
    public regroupAt: number = 0.4;

    @property
    public stopAutoLevelUp: boolean = true;

    @property
    public spawnOnRoomPick: boolean = true;

    @property
    public exitRun: boolean = true;

    @property({ type: Vec3 })
    public exitLocalPos: Vec3 = new Vec3(0.2, 0, 21.8);

    @property({ type: CCFloat })
    public exitArrive: number = 0.8;

    @property({ type: CCInteger })
    public prewarmPerFrame: number = 2;

    @property({ type: CCInteger })
    public spawnPerFrame: number = 4;

    @property({ type: CCFloat })
    public exitTimeout: number = 8;

    private _phase: Phase = Phase.Idle;
    private _index: number = -1;

    private _pendingStage: number = -1;

    private _afterPick: AfterPick = AfterPick.NextStage;

    private _pendingEnter: number = -1;

    private _travelWait: number = 0;
    private _ended: boolean = false;
    private _stageTime: number = 0;

    private _regrouped: boolean = false;

    private _awaitingFirstMove: boolean = false;
    private _moveAnchor: Vec3 = new Vec3();
    private _moveWait: number = 0;

    private _objectiveOn: boolean = false;

    private _reviveDone: boolean = false;

    private _reviveArmed: boolean = false;

    private _forcedDeath: boolean = false;

    private _joinStage: RunStage = null;
    private _joinWait: number = 0;

    private _spawnQueue: EnemySpawnPoint[] = [];

    private _exitStage: number = -1;
    private _exitWait: number = 0;
    private _exitPos: Vec3 = new Vec3();

    private _exitHero: HeroController = null;

    public get stageIndex(): number {
        return this._index;
    }

    public get currentStage(): RunStage {
        return this._index >= 0 ? this.stages[this._index] : null;
    }

    private get lastIndex(): number {
        return this.stages.length - 1;
    }

    onLoad() {
        RunDirector.instance = this;

        EnemyController.combatEnabled = true;

        EnemySpawnPoint.clearPool();
    }

    onEnable() {
        const gm = GameManager.instance;
        if (gm) gm.flow = this;
        EventManager.instance.on(GameplayEvents.HeroDied, this.onHeroDied, this);
    }

    onDisable() {
        const gm = GameManager.instance;
        if (gm && gm.flow === this) gm.flow = null;
        EventManager.instance.off(GameplayEvents.HeroDied, this.onHeroDied, this);

        this.releaseExitHero();
    }

    start() {

        const gm = GameManager.instance;
        if (gm) gm.flow = this;

        if (this.stopAutoLevelUp) {

            const exp = ExperienceManager.instance;
            if (exp) exp.enabled = false;
        }
        this.revivePopup?.hide();
        this.reserveEnemies();
    }

    private reserveEnemies() {
        if (this.prewarmPerFrame <= 0) return;
        let total = 0;
        for (const stage of this.stages) {
            const layout = stage?.layout;
            if (!layout || !layout.isValid) continue;
            const points = layout.getComponentsInChildren(EnemySpawnPoint);
            for (const p of points) {
                if (!p || !p.prefab || p.count <= 0) continue;
                EnemySpawnPoint.reserve(p.prefab, p.count);
                total += p.count;
            }
        }
        if (total > 0) GameplayLog.log('game', `đặt kho quái: ${total} con, dựng sẵn ${this.prewarmPerFrame} con/frame`);
    }

    private tickPrewarm() {
        if (this.prewarmPerFrame <= 0) return;
        if (this._phase !== Phase.Idle && this._phase !== Phase.Exit) return;
        EnemySpawnPoint.warmStep(this.prewarmPerFrame);
    }

    private tickSpawnQueue() {
        if (this._spawnQueue.length === 0) return;
        let budget = Math.max(1, this.spawnPerFrame);
        while (budget > 0 && this._spawnQueue.length > 0) {
            const p = this._spawnQueue[0];
            if (!p || !p.isValid) {
                this._spawnQueue.shift();
                continue;
            }
            const n = p.spawnStep(budget);
            budget -= n;
            if (n === 0 || p.finished) this._spawnQueue.shift();
        }
    }

    private flushSpawnQueue(why: string) {
        if (this._spawnQueue.length === 0) return;
        let n = 0;
        for (const p of this._spawnQueue) if (p && p.isValid) n += p.spawnAllNow();
        this._spawnQueue.length = 0;
        if (n > 0) GameplayLog.log('game', `đẻ nốt ${n} con ngay (${why})`);
    }

    update(dt: number) {
        this.tickPrewarm();
        this.tickSpawnQueue();

        switch (this._phase) {
            case Phase.Idle:

                if (GameManager.instance && GameManager.instance.state !== GameState.Ready) {
                    this.beginRun();
                }
                break;

            case Phase.RoomPick:

                if (!this.roomSelect || !this.roomSelect.isOpen) {
                    this.afterRoomPick(this._pendingStage);
                }
                break;

            case Phase.Exit:
                this.tickExitRun(dt);
                break;

            case Phase.Travel:
                this.tickTravel(dt);
                break;

            case Phase.Fighting:
                this.tickFirstMove(dt);
                this.tickForcedDeath(dt);
                this.tickStragglers();
                this.tickZoneClear();
                break;

            case Phase.Regroup:
                this.tickAllyJoin(dt);
                break;

            case Phase.Picking:

                if (!LevelUpManager.instance || !LevelUpManager.instance.hasPending) {
                    this.resumeAfterPick();
                }
                break;

            default:
                break;
        }
    }

    public canWin(): boolean {
        if (this.stages.length === 0) return true;
        if (this._index < this.lastIndex) return false;

        if (this.currentStage?.endsWithRevive && !this._reviveDone) return false;
        return true;
    }

    public ownsEnding(): boolean {
        return this._ended;
    }

    private beginRun() {

        EnemyController.combatEnabled = false;
        this.hideObjective('mở ván');
        this.queueNextStage();
    }

    public beginStage(index: number) {
        if (index < 0 || index >= this.stages.length) return;
        const stage = this.stages[index];

        this._pendingStage = index;
        if (stage.selectRoom && this.roomSelect) {
            this._phase = Phase.RoomPick;
            this.hideObjective('mở panel chọn room');

            this.roomSelect.open(index);
            return;
        }
        this.afterRoomPick(index);
    }

    private afterRoomPick(index: number) {
        const stage = this.stages[index];

        const gm = GameManager.instance;
        if (gm) gm.inputLocked = true;
        EnemyController.combatEnabled = false;

        this.swapLayout(stage);
        this.setUpAlly(stage);
        if (this.spawnOnRoomPick) this.spawnZoneNow(stage);

        if (stage && stage.skillPickOnEnter && this.openEntrySkillPicks(index)) return;
        this.enterStage(index);
    }

    private spawnZoneNow(stage: RunStage) {
        if (!stage?.zoneId) return;

        this._spawnQueue.length = 0;
        const points = EnemySpawnPoint.all;
        let quota = 0;
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            if (!p?.isValid || p.zoneId !== stage.zoneId) continue;
            if (p.trigger === SpawnTrigger.Manual || !p.prefab) continue;
            this._spawnQueue.push(p);
            quota += Math.max(0, p.count);
        }
        if (quota === 0) return;

        if (this.spawnPerFrame <= 0) {
            this.flushSpawnQueue(`chốt phòng "${stage.zoneId}"`);
            return;
        }
        GameplayLog.log('game', `chốt phòng "${stage.zoneId}": ${quota} con, rải ${this.spawnPerFrame} con/frame`);

        this.tickSpawnQueue();
    }

    private openEntrySkillPicks(index: number): boolean {
        this._pendingEnter = index;
        if (this.enqueueSkillPicks(AfterPick.EnterStage, `chốt phòng ${index + 1}`)) return true;
        this._pendingEnter = -1;
        return false;
    }

    private enterStage(index: number) {
        if (index < 0 || index >= this.stages.length) return;
        const stage = this.stages[index];

        this._index = index;
        this._stageTime = 0;
        this._regrouped = false;
        this._awaitingFirstMove = false;
        this._pendingEnter = -1;
        this._afterPick = AfterPick.NextStage;

        this.showObjective(stage);
        this.releaseWave(stage);
        this.aimAtVictim(stage);

        GameplayLog.log('game', `bắt đầu chặng ${index + 1}/${this.stages.length} — ${stage.name} (zone "${stage.zoneId}")`);
        EventManager.instance.emit(GameplayEvents.StageStarted, stage, index);

        const gm = GameManager.instance;
        if (gm) gm.inputLocked = true;
        EnemyController.combatEnabled = false;
        this._phase = Phase.Travel;
        this._travelWait = 0;
    }

    private get follow(): CameraFollow {
        return this.roomSelect?.camera || this.intro?.follow || null;
    }

    private tickTravel(dt: number) {
        this._travelWait += dt;

        const cam = this.follow;
        const arrived = !cam || cam.atTarget;
        const timedOut = this.travelTimeout > 0 && this._travelWait >= this.travelTimeout;
        if (!arrived && !timedOut) return;

        if (timedOut && !arrived) GameplayLog.log('game', `camera chưa tới sau ${this.travelTimeout}s -> vào trận luôn`);

        this.flushSpawnQueue('camera đã tới phòng');
        const stage = this.currentStage;
        if (!this.playStageIntro(stage)) this.afterIntro(stage, false);
    }

    private afterIntro(stage: RunStage, introPlayed: boolean) {

        if (introPlayed) this.hideObjective('xong đoạn lướt camera');
        if (stage?.skillPickAfterIntro && this.enqueueSkillPicks(AfterPick.Fight, 'xong intro')) return;
        this.beginFighting(stage);
    }

    private beginFighting(stage: RunStage) {

        this.flushSpawnQueue('vào trận');
        const gm = GameManager.instance;
        if (gm) gm.inputLocked = false;
        this._phase = Phase.Fighting;

        const holdForMove = this.combatOnFirstMove;
        this._awaitingFirstMove = holdForMove;
        this._moveWait = 0;

        if (!holdForMove) this.hideObjective('vào trận ngay');
        const main = HeroPartyManager.instance?.mainHero;
        if (holdForMove && main) Vec3.copy(this._moveAnchor, main.node.worldPosition);
        EnemyController.combatEnabled = !holdForMove;
        GameplayLog.log('game', `vào trận ở ${stage?.name || 'chặng ' + (this._index + 1)}`
            + (holdForMove ? ' (chờ người chơi đẩy hero đi rồi mới thả quái)' : ''));
    }

    private swapLayout(stage: RunStage) {
        for (let i = 0; i < this.stages.length; i++) {
            const layout = this.stages[i]?.layout;
            if (!layout?.isValid) continue;
            const on = this.stages[i] === stage;
            if (layout.active !== on) layout.active = on;
        }
    }

    private setUpAlly(stage: RunStage) {
        const ally = stage?.ally;
        if (!ally) return;
        if (ally.node && !ally.node.active) ally.node.active = true;
        ally.setCaptive();
    }

    private playStageIntro(stage: RunStage): boolean {
        const home = this.roomSelect?.slot?.cameraAnchor || HeroPartyManager.instance?.mainHero?.node;
        const captive = stage?.ally?.hero?.node;
        if (!stage?.introOnStart || !this.intro || !home || !captive) return false;

        this._phase = Phase.Intro;
        GameplayLog.log('game', `intro: lướt qua ${stage.ally.heroName} bị trói`);
        this.intro.play([captive], home, () => this.afterIntro(stage, true));
        return true;
    }

    private releaseWave(stage: RunStage) {
        if (!stage?.zoneId) return;
        const points = EnemySpawnPoint.all;
        let n = 0;
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            if (!p?.isValid || p.zoneId !== stage.zoneId) continue;
            if (p.trigger !== SpawnTrigger.Manual || !p.prefab) continue;
            p.beginSpawning();
            n += 1;
        }
        if (n > 0) GameplayLog.log('game', `mở ${n} tổ chờ lệnh của "${stage.zoneId}"`);
    }

    private aimAtVictim(stage: RunStage) {
        const party = HeroPartyManager.instance;
        if (!party) return;
        if (!stage?.endsWithRevive) {
            party.priorityHero = null;
            return;
        }
        const victim = this.pickVictim(stage);
        party.priorityHero = victim;
        if (victim) GameplayLog.log('game', `quái ưu tiên nhắm ${victim.heroName} ở chặng này`);
    }

    private zoneCleared(zoneId: string): boolean {
        if (!zoneId) return false;

        let hasPoint = false;
        const points = EnemySpawnPoint.all;
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            if (!p || !p.isValid || p.zoneId !== zoneId || !p.prefab) continue;
            hasPoint = true;
            if (!p.finished) return false;
        }
        if (!hasPoint) return false;

        const enemies = EnemyController.all;
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (e && e.isAlive && e.zoneId === zoneId) return false;
        }
        return true;
    }

    private showObjective(stage: RunStage) {
        const ui = this.objectiveUI;
        if (!ui) return;
        if (!stage?.objective) {
            this._objectiveOn = false;
            ui.hide();
            return;
        }
        const heroName = stage.ally?.hero?.heroName || stage.ally?.heroName || '';
        ui.show(stage.objective.split('{hero}').join(heroName));
        this._objectiveOn = true;
    }

    private hideObjective(why: string) {
        const wasOn = this._objectiveOn;
        this._objectiveOn = false;
        this.objectiveUI?.hide();
        if (wasOn) GameplayLog.log('game', `tắt dòng nhắc việc (${why})`);
    }

    private tickFirstMove(dt: number) {
        if (!this._awaitingFirstMove) return;

        const main = HeroPartyManager.instance?.mainHero;
        if (!main) {
            this.releaseCombat('không tìm thấy hero chính');
            return;
        }

        const p = main.node.worldPosition;
        const dx = p.x - this._moveAnchor.x;
        const dz = p.z - this._moveAnchor.z;
        if (dx * dx + dz * dz >= this.firstMoveDistance * this.firstMoveDistance) {
            this.releaseCombat('người chơi đã đẩy hero đi');
            return;
        }

        if (this.firstMoveFallback <= 0) return;
        this._moveWait += dt;
        if (this._moveWait >= this.firstMoveFallback) {
            this.releaseCombat(`chờ quá ${this.firstMoveFallback}s`);
        }
    }

    private releaseCombat(why: string) {
        this._awaitingFirstMove = false;

        this.hideObjective(why);
        EnemyController.combatEnabled = true;
        GameplayLog.log('game', `thả quái vào trận (${why})`);
    }

    private tickStragglers() {
        if (this._regrouped || this.regroupAt <= 0) return;
        const stage = this.currentStage;
        if (!stage?.zoneId) return;

        let quota = 0;
        const points = EnemySpawnPoint.all;
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            if (!p?.isValid || p.zoneId !== stage.zoneId || !p.prefab) continue;
            if (!p.finished) return;
            quota += Math.max(0, p.count);
        }
        if (quota <= 0) return;

        const enemies = EnemyController.all;
        const alive: EnemyController[] = [];
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (e && e.isAlive && e.zoneId === stage.zoneId) alive.push(e);
        }
        if (alive.length > quota * this.regroupAt) return;

        this._regrouped = true;
        GameplayLog.log('game', `còn ${alive.length}/${quota} quái ở "${stage.zoneId}" -> gọi hết vào trận`);
        for (let i = 0; i < alive.length; i++) {
            alive[i].aggro?.forceEngage('dọn nốt khu vực');
        }
    }

    private tickZoneClear() {
        const stage = this.currentStage;
        if (!stage || !this.zoneCleared(stage.zoneId)) return;

        GameplayLog.log('game', `dọn sạch chặng ${this._index + 1} — ${stage.name}`);
        EventManager.instance.emit(GameplayEvents.StageCleared, stage, this._index);

        this.hideObjective('dọn sạch chặng');

        if (this._index >= this.lastIndex) {
            const freed = stage.ally ? stage.ally.release() : false;
            if (freed && this.startAllyJoin(stage)) {
                this._phase = Phase.Regroup;
                return;
            }
            this._phase = Phase.Between;
            this.scheduleOnce(() => this.finishStage(stage), Math.min(this.clearedDelay, 0.4));
            return;
        }

        this._phase = Phase.Between;
        const rescued = stage.ally ? stage.ally.release() : false;

        if (rescued && this.startAllyJoin(stage)) {
            this._phase = Phase.Regroup;
            return;
        }

        this.scheduleOnce(() => this.openSkillPicks(stage), Math.min(this.clearedDelay, 0.4));
    }

    private startAllyJoin(stage: RunStage): boolean {
        if (!stage?.ally?.joining) return false;

        this._joinStage = stage;
        this._joinWait = 0;

        const gm = GameManager.instance;
        if (gm) gm.inputLocked = true;
        return true;
    }

    private tickAllyJoin(dt: number) {
        const stage = this._joinStage;
        if (!stage) {
            this._phase = Phase.Between;
            return;
        }

        const gm = GameManager.instance;

        if (gm && (gm.state === GameState.Win || gm.state === GameState.Lose)) {
            this.endAllyJoin('ván đã ngã ngũ giữa lúc chờ');
            this._phase = Phase.Ending;
            return;
        }

        if (gm && gm.isPaused) return;

        this._joinWait += dt;
        const timedOut = this.allyJoinTimeout > 0 && this._joinWait >= this.allyJoinTimeout;
        if (stage.ally?.joining && !timedOut) return;

        this.endAllyJoin(timedOut ? `chờ quá ${this.allyJoinTimeout}s` : 'đồng đội đã nhập đội');
        this.scheduleOnce(() => this.finishStage(stage), this.clearedDelay);
    }

    private finishStage(stage: RunStage) {
        if (stage?.endsWithRevive) {
            this.strikeDownVictim(stage);
            return;
        }
        this.openSkillPicks(stage);
    }

    private strikeDownVictim(stage: RunStage) {
        this._phase = Phase.Ending;

        this._reviveArmed = true;

        const forced = this.forcedVictim(stage);
        if (forced) {
            if (!forced.isAlive || !forced.stats) {

                GameplayLog.log('game', `${forced.heroName} đã gục từ trước -> bày khung revive luôn`);
                this.offerRevive(forced);
                return;
            }
            GameplayLog.log('game', `chặng cuối -> cho ${forced.heroName} gục để bày khung revive`);
            this.killHero(forced);
            return;
        }

        const victim = this.pickVictim(stage);
        if (victim?.stats && victim.isAlive) {
            GameplayLog.log('game', `cứu xong đồng đội -> cho ${victim.heroName} gục để bày khung revive`);
            this.killHero(victim);
            return;
        }

        GameplayLog.log('game', 'không tìm được hero nào để gục -> vẫn bày khung revive');
        this.offerRevive(victim || HeroPartyManager.instance?.mainHero);
    }

    /** Ép chết chắc: trừ đúng máu hiện tại, nếu hero vẫn sống thì gọi thẳng die. */
    private killHero(hero: HeroController) {
        if (!hero?.isValid) return;
        const stats = hero.stats;
        if (stats && !stats.isDead) stats.applyDamage(Math.max(1, stats.hp));
        if (hero.isAlive) hero.playDie();
    }

    /**
     * Hero bắt buộc phải gục ở chặng này: ưu tiên ô `victim`, sau đó tới hero
     * đúng `victimClass` (mặc định Mage). Không loại trừ main hero — kịch bản
     * cần đúng con mage đó gục, dù nó đang là hero dẫn đội.
     */
    private forcedVictim(stage: RunStage): HeroController {
        const named = stage?.victim?.hero;
        if (named?.isValid) return named;

        const wanted = stage ? stage.victimClass : HeroClass.None;
        if (!wanted) return null;

        const heroes = HeroPartyManager.instance?.heroes || [];
        let fallback: HeroController = null;
        for (let i = 0; i < heroes.length; i++) {
            const h = heroes[i];
            if (!h?.isValid || !(h.heroClass & wanted)) continue;
            if (h.isAlive) return h;
            if (!fallback) fallback = h;
        }
        return fallback;
    }

    private endAllyJoin(why: string) {
        this._joinStage?.ally?.cancelJoin();
        this._joinStage = null;
        this._phase = Phase.Between;

        const gm = GameManager.instance;
        if (gm) gm.inputLocked = false;

        GameplayLog.log('game', `thôi chờ đồng đội (${why})`);
    }

    private openSkillPicks(stage: RunStage) {
        if (!stage.skillPickAfterClear || !this.enqueueSkillPicks(AfterPick.NextStage, 'dọn sạch')) {
            this.queueNextStage();
        }
    }

    private enqueueSkillPicks(after: AfterPick, why: string): boolean {
        const mgr = LevelUpManager.instance;
        const heroes = HeroPartyManager.instance?.aliveHeroes || [];
        if (!mgr || heroes.length === 0) return false;

        this.flushSpawnQueue('mở màn chọn skill');
        this._afterPick = after;
        this._phase = Phase.Picking;

        this.hideObjective('mở màn chọn skill');

        for (let i = 0; i < heroes.length; i++) mgr.enqueue(heroes[i]);
        GameplayLog.log('game', `mở màn level-up cho ${heroes.length} hero (${why})`);
        return true;
    }

    private resumeAfterPick() {
        const after = this._afterPick;
        this._afterPick = AfterPick.NextStage;

        if (after === AfterPick.EnterStage) {
            const enter = this._pendingEnter;
            this._pendingEnter = -1;
            this.enterStage(enter);
            return;
        }
        if (after === AfterPick.Fight) {
            this.beginFighting(this.currentStage);
            return;
        }
        this.queueNextStage();
    }

    private queueNextStage() {
        this._phase = Phase.Between;
        const next = this._index + 1;
        this.scheduleOnce(() => {
            if (!this.startExitRun(next)) this.beginStage(next);
        }, this.nextStageDelay);
    }

    private startExitRun(next: number): boolean {
        if (!this.exitRun || next >= this.stages.length) return false;

        if (this._index < 0) return false;

        const slot = this.roomSelect?.slot;
        const hero = HeroPartyManager.instance?.mainHero;
        if (!slot?.node?.isValid || !hero?.isAlive) return false;

        Vec3.transformMat4(this._exitPos, this.exitLocalPos, slot.node.worldMatrix);

        this._exitStage = next;
        this._exitWait = 0;
        this._exitHero = hero;
        hero.autoDrive = true;

        const gm = GameManager.instance;
        if (gm) gm.inputLocked = true;

        this._phase = Phase.Exit;
        GameplayLog.log('game', `dọn xong: cả đội chạy tới cửa ${GameplayLog.pos(this._exitPos.x, this._exitPos.z)}`);
        return true;
    }

    private tickExitRun(dt: number) {

        const gm = GameManager.instance;
        if (gm && gm.isPaused) return;

        if (gm && (gm.state === GameState.Win || gm.state === GameState.Lose)) {
            this.releaseExitHero();
            this._exitStage = -1;
            this._phase = Phase.Ending;
            return;
        }

        const hero = this._exitHero;
        if (!hero?.isValid || !hero.isAlive) {
            this.endExitRun('mất hero chính giữa đường');
            return;
        }

        this._exitWait += dt;
        const p = hero.node.worldPosition;
        const dx = p.x - this._exitPos.x;
        const dz = p.z - this._exitPos.z;
        const arrived = dx * dx + dz * dz <= this.exitArrive * this.exitArrive;
        const timedOut = this.exitTimeout > 0 && this._exitWait >= this.exitTimeout;

        if (!arrived && !timedOut) {
            hero.moveToward(this._exitPos, dt);
            return;
        }
        this.endExitRun(arrived ? 'đã tới cửa' : `chạy quá ${this.exitTimeout}s`);
    }

    private releaseExitHero() {
        const hero = this._exitHero;
        this._exitHero = null;
        if (!hero?.isValid) return;
        hero.autoDrive = false;

        hero.stopMove();
    }

    private endExitRun(why: string) {
        this.releaseExitHero();
        GameplayLog.log('game', `thôi chạy tới cửa (${why})`);

        const next = this._exitStage;
        this._exitStage = -1;
        this._phase = Phase.Between;
        this.beginStage(next);
    }

    private onHeroDied(hero: HeroController) {
        if (this._ended) return;
        const stage = this.currentStage;
        if (!stage || !stage.endsWithRevive) return;
        if (this._phase !== Phase.Fighting && this._phase !== Phase.Ending) return;

        if (!this._reviveArmed && hero !== HeroPartyManager.instance?.mainHero) return;

        this.offerRevive(hero);
    }

    private offerRevive(hero: HeroController) {
        if (this._ended) return;

        const gm = GameManager.instance;

        if (gm?.state === GameState.Win) return;

        this._ended = true;
        this._reviveDone = true;
        this._reviveArmed = true;
        this._phase = Phase.Ending;

        if (gm?.state === GameState.Playing) gm.pauseGame();

        GameplayLog.log('game', `${hero?.heroName || 'hero'} gục ở chặng cuối -> bày khung revive`);
        EventManager.instance.emit(GameplayEvents.ReviveOffered, hero);

        if (!this.revivePopup) return;

        if (this.revivePopupDelay > 0) {
            this.scheduleOnce(() => this.revivePopup?.show(), this.revivePopupDelay);
        } else {
            this.revivePopup.show();
        }
    }

    private pickVictim(stage: RunStage): HeroController {
        const party = HeroPartyManager.instance;
        const alive = party?.aliveHeroes || [];
        const main = party?.mainHero;

        const forced = this.forcedVictim(stage);
        if (forced?.isAlive) return forced;

        const named = stage?.victim?.hero;
        if (named?.isValid && named.isAlive && named !== main) return named;

        let best: HeroController = null;
        let bestHp = Number.MAX_VALUE;
        for (let i = 0; i < alive.length; i++) {
            const h = alive[i];
            if (!h || h === main) continue;
            const hp = h.stats ? h.stats.hp : Number.MAX_VALUE;
            if (hp < bestHp) {
                bestHp = hp;
                best = h;
            }
        }

        return best || party?.getWeakestAliveHero() || null;
    }

    private tickForcedDeath(dt: number) {
        if (this._forcedDeath) return;
        const stage = this.currentStage;
        if (!stage?.endsWithRevive || stage.forceDeathAfter <= 0) return;

        const gm = GameManager.instance;
        if (gm && gm.isPaused) return;

        this._stageTime += dt;
        if (this._stageTime < stage.forceDeathAfter) return;

        const victim = this.pickVictim(stage);
        if (!victim?.stats) return;

        this._forcedDeath = true;
        GameplayLog.log('game', `quá ${stage.forceDeathAfter}s ở chặng cuối -> cho ${victim.heroName} gục theo kịch bản`);
        this.killHero(victim);
    }
}
