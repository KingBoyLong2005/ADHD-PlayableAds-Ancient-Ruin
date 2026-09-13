import { _decorator, Button, Component, EventTouch, Input, Node, Size, UITransform, view } from 'cc';
import { GlobalEvent } from '../../Utility/Event/GlobalEvent';
import EventManager from '../../Utility/EventManager';
import { GameplayLog } from '../Debug/GameplayLog';
import { GameplayEvents } from '../Events/GameplayEvents';

const { ccclass, property } = _decorator;

@ccclass('RevivePopupUI')
export class RevivePopupUI extends Component {
    @property({ type: Node })
    public panel: Node = null;

    @property({ type: Button })
    public yesButton: Button = null;

    @property({ type: Button })
    public noButton: Button = null;

    @property
    public openStoreOnAnswer: boolean = true;

    /** Popup hiện lên là phủ lớp trong suốt: chạm đâu trên màn hình cũng ra store. */
    @property
    public tapAnywhereOpensStore: boolean = true;

    /** Trễ trước khi lớp phủ ăn chạm, tránh cú chạm đang dở lọt thẳng vào store. */
    @property
    public tapArmDelay: number = 0.3;

    public onAnswered: (yes: boolean) => void = null;

    private _open: boolean = false;
    private _answered: boolean = false;
    private _blocker: Node = null;
    private _tapArmed: boolean = false;

    public get isOpen(): boolean {
        return this._open;
    }

    onLoad() {
        if (!this.panel) this.panel = this.node;
        this.hide();
    }

    onEnable() {
        this.yesButton?.node.on(Button.EventType.CLICK, this.onYes, this);
        this.noButton?.node.on(Button.EventType.CLICK, this.onNo, this);
    }

    onDisable() {
        this.yesButton?.node.off(Button.EventType.CLICK, this.onYes, this);
        this.noButton?.node.off(Button.EventType.CLICK, this.onNo, this);
    }

    public show() {
        if (this._open) return;
        this._open = true;
        this._answered = false;
        if (this.panel) this.panel.active = true;
        this.node.active = true;
        this.armTapAnywhere();
        GameplayLog.log('game', 'hero gục ở room cuối -> hỏi revive');
    }

    public hide() {
        this._open = false;
        this._tapArmed = false;
        this.unscheduleAllCallbacks();
        if (this._blocker?.isValid) this._blocker.active = false;
        if (this.panel) this.panel.active = false;
    }

    private armTapAnywhere() {
        if (!this.tapAnywhereOpensStore) return;

        const host = this.panel && this.panel.isValid ? this.panel : this.node;
        if (!this._blocker || !this._blocker.isValid) {
            const blocker = new Node('TapToStoreBlocker');
            blocker.layer = host.layer;
            blocker.addComponent(UITransform);
            blocker.parent = host;
            blocker.setPosition(0, 0, 0);
            blocker.on(Input.EventType.TOUCH_END, this.onTapAnywhere, this);
            this._blocker = blocker;
        }

        // phủ dư ra so với màn hình để popup có lệch vị trí thì vẫn kín
        const vs = view.getVisibleSize();
        const ui = this._blocker.getComponent(UITransform);
        ui.setAnchorPoint(0.5, 0.5);
        ui.setContentSize(new Size(vs.width * 3, vs.height * 3));

        this._blocker.active = true;
        this._blocker.setSiblingIndex(host.children.length - 1);

        this._tapArmed = false;
        this.scheduleOnce(() => { this._tapArmed = true; }, Math.max(0, this.tapArmDelay));
    }

    private onTapAnywhere(event: EventTouch) {
        event.propagationStopped = true;
        if (!this._open || !this._tapArmed) return;
        GameplayLog.log('game', 'chạm vào khung revive -> mở store');
        this.answer(true);
    }

    private onYes() {
        this.answer(true);
    }

    private onNo() {
        this.answer(false);
    }

    public onClickAnswer(_event: unknown, customEventData: string) {
        this.answer((customEventData || '').toLowerCase() === 'yes');
    }

    private answer(yes: boolean) {
        if (!this._open) return;

        if (this._answered) {
            this.openStore();
            return;
        }
        this._answered = true;
        GameplayLog.log('game', `revive: người chơi chọn ${yes ? 'YES' : 'NO'}`);
        EventManager.instance.emit(GameplayEvents.ReviveAnswered, yes);
        if (this.onAnswered) this.onAnswered(yes);
        this.openStore();
    }

    private openStore() {
        if (!this.openStoreOnAnswer) return;
        GlobalEvent.instance().dispatchEvent(GlobalEvent.OPEN_STORE);
    }
}
