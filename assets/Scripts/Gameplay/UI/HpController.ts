import { _decorator, CCInteger, Component, Material, ModelRenderer, Node, Quat, Sprite } from 'cc';
import EventManager from '../../Utility/EventManager';
import { findWorldCamera } from '../../Utility/SceneCamera';
import { CharacterStats } from '../Combat/CharacterStats';
import { GameplayEvents } from '../Events/GameplayEvents';

const { ccclass, property, executionOrder } = _decorator;

const RAD_TO_DEG = 180 / Math.PI;

@ccclass('HpController')

@executionOrder(100)
export class HpController extends Component {
    @property(Sprite)
    public fillSprite: Sprite = null;

    @property(ModelRenderer)
    public fillRenderer: ModelRenderer = null;

    @property
    public fillProperty: string = 'fillRange';

    @property(CCInteger)
    public materialIndex: number = 0;

    @property(CharacterStats)
    public targetStats: CharacterStats = null;

    @property
    public listenGlobalEvents: boolean = true;

    @property
    public faceCamera: boolean = true;

    @property(Node)
    public billboardTarget: Node = null;

    @property
    public yawOnly: boolean = false;

    private _material: Material = null;
    private _lastRatio: number = -1;
    private _camNode: Node = null;
    private _rot: Quat = new Quat();

    onLoad() {
        if (!this.fillSprite) this.fillSprite = this.getComponent(Sprite);
        if (!this.fillRenderer && !this.fillSprite) {
            this.fillRenderer = this.getComponent(ModelRenderer) || this.getComponentInChildren(ModelRenderer);
        }

        if (!this.billboardTarget) {
            this.billboardTarget = this.fillRenderer ? this.fillRenderer.node : this.node;
        }

        if (!this.targetStats) {
            this.targetStats = this.findStatsInParents();
        }
        if (this.targetStats) {
            this.setFillRange(this.targetStats.hpRatio);
        }
    }

    private findStatsInParents(): CharacterStats {
        let n = this.node.parent;
        while (n) {
            const s = n.getComponent(CharacterStats);
            if (s) return s;
            n = n.parent;
        }
        return null;
    }

    onEnable() {
        if (this.listenGlobalEvents) {
            EventManager.instance.on(GameplayEvents.HpChanged, this.onHpChanged, this);
        }
    }

    onDisable() {
        if (this.listenGlobalEvents) {
            EventManager.instance.off(GameplayEvents.HpChanged, this.onHpChanged, this);
        }
    }

    update() {
        if (!this.listenGlobalEvents && this.targetStats) {
            this.setFillRange(this.targetStats.hpRatio);
        }
    }

    lateUpdate() {
        if (!this.faceCamera) return;

        const camNode = this.resolveCameraNode();
        if (!camNode) return;

        const target = this.billboardTarget || this.node;
        if (!this.yawOnly) {

            target.setWorldRotation(camNode.worldRotation);
            return;
        }

        const camPos = camNode.worldPosition;
        const pos = target.worldPosition;
        const dx = camPos.x - pos.x;
        const dz = camPos.z - pos.z;
        if (dx * dx + dz * dz < 0.000001) return;

        Quat.fromEuler(this._rot, 0, Math.atan2(dx, dz) * RAD_TO_DEG, 0);
        target.setWorldRotation(this._rot);
    }

    private resolveCameraNode(): Node {
        if (this._camNode && this._camNode.isValid) return this._camNode;
        const cam = findWorldCamera();
        this._camNode = cam ? cam.node : null;
        return this._camNode;
    }

    private onHpChanged(stats: CharacterStats, _hp: number, _hpMax: number, ratio: number) {
        if (this.targetStats && stats !== this.targetStats) return;
        this.setFillRange(ratio);
    }

    public setFillRange(ratio: number) {
        const value = Math.max(0, Math.min(1, ratio));

        if (value === this._lastRatio) return;
        this._lastRatio = value;

        if (this.fillSprite) {
            this.fillSprite.fillRange = value;
        }

        const mat = this.resolveMaterial();
        if (mat) {
            mat.setProperty(this.fillProperty, value);
        }
    }

    private resolveMaterial(): Material {
        if (this._material) return this._material;
        if (!this.fillRenderer) return null;
        this._material = this.fillRenderer.getMaterialInstance(this.materialIndex);
        return this._material;
    }

    public bind(stats: CharacterStats) {
        this.targetStats = stats;
        this._lastRatio = -1;
        if (stats) this.setFillRange(stats.hpRatio);
    }
}

