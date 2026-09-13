import { _decorator, CCFloat, CCInteger, Collider, Component, ITriggerEvent, Node } from 'cc';
import PoolManager, { TypeNodePool } from '../../Utility/Pool/PoolManager';
import EventManager from '../../Utility/EventManager';
import { CharacterStats } from '../Combat/CharacterStats';
import { GameplayEvents } from '../Events/GameplayEvents';
import { GameManager } from '../Managers/GameManager';

const { ccclass, property } = _decorator;

@ccclass('CoinPickup')
export class CoinPickup extends Component {
    @property(CCInteger)
    public value: number = 1;

    @property(CCFloat)
    public autoClaimRadius: number = 1.5;

    @property
    public requirePlayerTag: boolean = true;

    private _claimed: boolean = false;
    private _player: Node = null;

    onEnable() {
        this._claimed = false;
        const collider = this.getComponent(Collider);
        if (collider) {
            collider.on('onTriggerEnter', this.onTriggerEnter, this);
        }
    }

    onDisable() {
        const collider = this.getComponent(Collider);
        if (collider) {
            collider.off('onTriggerEnter', this.onTriggerEnter, this);
        }
    }

    public setup(value: number) {
        this.value = value;
        this._claimed = false;

        this._player = null;
    }

    public setPlayer(player: Node) {
        this._player = player;
    }

    update() {
        if (GameManager.instance?.isPaused) return;
        if (this._claimed || !this._player) return;
        const dx = this.node.worldPosition.x - this._player.worldPosition.x;
        const dz = this.node.worldPosition.z - this._player.worldPosition.z;
        if (dx * dx + dz * dz <= this.autoClaimRadius * this.autoClaimRadius) {
            this.claim();
        }
    }

    private onTriggerEnter(event: ITriggerEvent) {
        if (this._claimed) return;
        const other = event.otherCollider?.node;
        if (!other) return;
        const stats = other.getComponent(CharacterStats);
        if (stats?.isPlayer) {
            this.claim();
        }
    }

    public claim() {
        if (this._claimed) return;
        this._claimed = true;
        EventManager.instance.emit(GameplayEvents.CoinClaimed, this.value);
        if (PoolManager.instance) {
            PoolManager.instance.PutNodeToPool(TypeNodePool.coin, this.node);
        } else {
            this.node.active = false;
        }
    }
}
