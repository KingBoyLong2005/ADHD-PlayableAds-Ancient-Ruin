
import { EventTarget } from 'cc';

class EventManager {
    private static _instance: EventManager;
    private _eventTarget: EventTarget;

    private constructor() {
        this._eventTarget = new EventTarget();
    }

    public static get instance(): EventManager {
        if (!this._instance) {
            this._instance = new EventManager();
        }
        return this._instance;
    }

    public emit(event: string, ...args: any[]) {
        this._eventTarget.emit(event, ...args);
    }

    public on(event: string, callback: (...args: any[]) => void, target?: any) {
        this._eventTarget.on(event, callback, target);
    }

    public off(event: string, callback: (...args: any[]) => void, target?: any) {
        this._eventTarget.off(event, callback, target);
    }
}

export default EventManager;
