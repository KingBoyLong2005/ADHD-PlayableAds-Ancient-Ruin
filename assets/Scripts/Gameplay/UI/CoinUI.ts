import { _decorator, Component, Label } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('CoinUI')
export class CoinUI extends Component {
    @property(Label)
    public amountLabel: Label = null;

    @property
    public prefix: string = '';

    public setAmount(amount: number) {
        if (!this.amountLabel) this.amountLabel = this.getComponent(Label);
        if (this.amountLabel) {
            this.amountLabel.string = `${this.prefix}${Math.max(0, Math.floor(amount))}`;
        }
    }
}
