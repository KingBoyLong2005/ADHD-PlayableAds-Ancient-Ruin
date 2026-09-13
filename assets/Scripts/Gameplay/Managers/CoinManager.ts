import { _decorator, Component } from 'cc';
import EventManager from '../../Utility/EventManager';
import { GameplayEvents } from '../Events/GameplayEvents';
import { CoinUI } from '../UI/CoinUI';

const { ccclass, property } = _decorator;

@ccclass('CoinManager')
export class CoinManager extends Component {
    public static instance: CoinManager;

    @property(CoinUI)
    public coinUI: CoinUI = null;

    public totalCoins: number = 0;

    onLoad() {
        CoinManager.instance = this;
    }

    onEnable() {
        EventManager.instance.on(GameplayEvents.CoinClaimed, this.onCoinClaimed, this);
    }

    onDisable() {
        EventManager.instance.off(GameplayEvents.CoinClaimed, this.onCoinClaimed, this);
    }

    private onCoinClaimed(value: number) {
        this.totalCoins += Math.max(0, value || 0);
        this.coinUI?.setAmount(this.totalCoins);
        EventManager.instance.emit(GameplayEvents.CoinChanged, this.totalCoins);
    }

}
