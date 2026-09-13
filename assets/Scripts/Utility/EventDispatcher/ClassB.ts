import { _decorator, Component, Node } from 'cc';
import { eventManager } from './EventManager';
const { ccclass, property } = _decorator;

@ccclass('ClassB')
export class ClassB extends Component {
    protected onEnable(): void {
        eventManager.on('Tên Event', this.Function, this);
    }
    Function() {}
}

