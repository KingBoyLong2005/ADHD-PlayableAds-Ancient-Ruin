import { _decorator, Component, Node } from 'cc';
import { eventManager } from './EventManager';
const { ccclass, property } = _decorator;

@ccclass('ClassA')
export class ClassA extends Component {
    EmitEvent() {
        eventManager.emit('Tên Event', { message: 'Tham số' });
    }
}

