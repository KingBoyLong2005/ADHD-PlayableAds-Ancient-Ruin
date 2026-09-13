import { _decorator, EventTarget } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('BaseEvent')
export default class BaseEvent {
    private listeners: { [key: string]: { target: Object, callback: (...args: any[]) => void }[] } = {};
    private eventTarget: EventTarget = new EventTarget();

    constructor() {}

    public addEventListener(type: string, callback: (...args: any[]) => void, target: Object) {
        if (!this.listeners[type]) {
            this.listeners[type] = [];
        }
        this.listeners[type].push({ target, callback });
        this.eventTarget.on(type, callback, target);
    }

    public removeEventListener(type: string, callback: (...args: any[]) => void, target: Object) {
        if (!this.listeners[type]) return;

        let stack = this.listeners[type];
        for (let i = 0; i < stack.length; i++) {
            if (stack[i].target === target && stack[i].callback === callback) {
                stack.splice(i, 1);
                this.eventTarget.off(type, callback, target);
                return;
            }
        }
    }

    public dispatchEvent(type: string, data: any = null) {
        if (!this.listeners[type]) return true;

        this.eventTarget.emit(type, data);
    }
}
