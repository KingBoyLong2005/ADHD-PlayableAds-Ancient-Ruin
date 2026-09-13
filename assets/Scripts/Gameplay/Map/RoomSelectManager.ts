import { _decorator, CCFloat, CCInteger, CharacterController, Component, Node, Vec3 } from 'cc';
import EventManager from '../../Utility/EventManager';
import { CameraFollow } from '../Camera/CameraFollow';
import { GameplayLog } from '../Debug/GameplayLog';
import { EnemyController } from '../Enemy/EnemyController';
import { GameplayEvents } from '../Events/GameplayEvents';
import { HeroPartyManager } from '../Hero/HeroPartyManager';
import { GameManager, GameState } from '../Managers/GameManager';
import { CharacterCollision } from '../Movement/CharacterCollision';
import { NavGrid } from './NavGrid';
import { RoomDecor } from './RoomDecor';
import { RoomSlot } from './RoomSlot';

const { ccclass, property } = _decorator;

const _spot = new Vec3();
const _dest = new Vec3();

@ccclass('RoomSelectManager')
export class RoomSelectManager extends Component {
    public static instance: RoomSelectManager = null;

    @property({ type: [RoomSlot] })
    public slots: RoomSlot[] = [];

    @property({ type: NavGrid })
    public nav: NavGrid = null;

    @property({ type: CameraFollow })
    public camera: CameraFollow = null;

    @property
    public snapCamera: boolean = false;

    @property({ type: CCFloat })
    public partySpacing: number = 1.4;

    @property({ type: Node })
    public panel: Node = null;

    @property
    public pauseWhileOpen: boolean = true;

    @property({ type: CCFloat })
    public autoPickAfter: number = 0;

    @property({ type: CCInteger })
    public startDecor: number = 0;

    @property
    public decorBlocks: boolean = false;

    private _open: boolean = false;
    private _slot: number = 0;
    private _decor: number = -1;
    private _wait: number = 0;

    public get isOpen(): boolean {
        return this._open;
    }

    public get slot(): RoomSlot {
        return this.slots[this._slot] || null;
    }

    public get slotIndex(): number {
        return this._slot;
    }

    public get decorIndex(): number {
        return this._decor;
    }

    public get decorNames(): string[] {
        const decors = this.slots[0]?.decors || [];
        return decors.map((dec, i) => dec?.displayName || `Room ${i + 1}`);
    }

    public decorTemplate(index: number): RoomDecor {
        return this.slots[0]?.decors[index] || null;
    }

    onLoad() {
        RoomSelectManager.instance = this;
        for (const slot of this.slots) slot?.activateDecor(-1);
        if (this.panel) this.panel.active = false;
    }

    start() {

        if (this.startDecor >= 0) this.enterRoom(0, this.startDecor, false);
    }

    onDestroy() {
        if (RoomSelectManager.instance === this) RoomSelectManager.instance = null;
    }

    update(dt: number) {
        if (!this._open || this.autoPickAfter <= 0) return;
        this._wait += dt;
        if (this._wait >= this.autoPickAfter) {
            GameplayLog.log('select', `không ai chọn trong ${this.autoPickAfter}s -> tự chọn bộ đầu`);
            this.select(0);
        }
    }

    public open(slotIndex: number) {
        if (this._open) return;
        this._open = true;
        this._wait = 0;
        this._slot = Math.min(Math.max(slotIndex, 0), Math.max(0, this.slots.length - 1));

        EnemyController.combatEnabled = false;
        if (this.pauseWhileOpen) GameManager.instance?.pauseGame();
        if (this.panel) this.panel.active = true;

        GameplayLog.log('select', `mở màn chọn room cho phòng ${this._slot}`);
        EventManager.instance.emit(GameplayEvents.RoomSelectOpened, this._slot);
    }

    public onClickRoom(_event: unknown, customEventData: string) {
        const index = parseInt(customEventData, 10);
        if (isNaN(index)) {
            console.warn('[RoomSelectManager] CustomEventData phải là chỉ số bộ trang trí:', customEventData);
            return;
        }
        this.select(index);
    }

    public select(decorIndex: number): RoomDecor {
        const picked = this.enterRoom(this._slot, decorIndex, true);
        this.close();
        EventManager.instance.emit(GameplayEvents.RoomSelected, picked, this._slot, decorIndex);
        return picked;
    }

    public close() {
        if (!this._open) return;
        this._open = false;
        if (this.panel) this.panel.active = false;

        if (this.pauseWhileOpen && GameManager.instance?.state === GameState.Paused) {
            GameManager.instance.resumeGame();
        }
    }

    public enterRoom(slotIndex: number, decorIndex: number, movePartyToStart: boolean): RoomDecor {
        const slot = this.slots[slotIndex];
        if (!slot) {
            console.warn('[RoomSelectManager] không có phòng ở chỉ số', slotIndex);
            return null;
        }

        this._slot = slotIndex;
        this._decor = decorIndex;

        if (this.camera && slot.cameraAnchor) {
            this.camera.usePartyAnchor = false;
            this.camera.target = slot.cameraAnchor;
        }

        const picked = slot.activateDecor(decorIndex);

        this.applyDecorBlocking(slot);

        CharacterCollision.refreshWorldColliders();
        this.rebakeNav(slot, picked);
        if (movePartyToStart) this.placeParty(slot);

        GameplayLog.log(
            'select',
            `vào phòng ${slotIndex} với bộ "${picked?.displayName || decorIndex}"`,
        );
        return picked;
    }

    private applyDecorBlocking(slot: RoomSlot) {
        const decors = slot.decors || [];
        for (let i = 0; i < decors.length; i++) {
            const obs = decors[i]?.obstacles;
            if (obs?.isValid && obs.active !== this.decorBlocks) obs.active = this.decorBlocks;
        }
    }

    private rebakeNav(slot: RoomSlot, decor: RoomDecor) {
        const nav = this.nav || NavGrid.instance;
        if (!nav) return;

        if (slot.floor) nav.floorRoots = [slot.floor];

        const blockers: Node[] = [];
        if (slot.walls) blockers.push(slot.walls);

        if (this.decorBlocks && decor?.obstacles) blockers.push(decor.obstacles);
        nav.blockerRoots = blockers;

        nav.bake();
    }

    private placeParty(slot: RoomSlot) {
        const anchor = slot.heroStart;
        if (!anchor) return;

        const party = HeroPartyManager.instance;
        const heroes = party?.aliveHeroes || [];
        const base = anchor.worldPosition;

        for (let i = 0; i < heroes.length; i++) {
            const hero = heroes[i];
            if (!hero?.node?.isValid) continue;

            const side = i === 0 ? 0 : (i % 2 === 1 ? -1 : 1) * Math.ceil(i / 2);
            _spot.set(base.x + side * this.partySpacing, base.y, base.z - (i === 0 ? 0 : this.partySpacing));
            this.teleport(hero.node, _spot);
            hero.node.setWorldRotation(anchor.worldRotation);

            hero.stopMove();
        }

        if (this.snapCamera) this.camera?.snap();
    }

    private teleport(node: Node, to: Vec3) {
        const cct = node.getComponent(CharacterController);
        if (cct && cct.enabledInHierarchy) {

            const s = node.worldScale;
            _dest.set(to.x + cct.center.x * s.x, to.y + cct.center.y * s.y, to.z + cct.center.z * s.z);
            cct.centerWorldPosition = _dest;
            return;
        }
        node.setWorldPosition(to);
    }
}
