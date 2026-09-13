import { _decorator, Button, CCFloat, Component, instantiate, Label, Node } from 'cc';
import { SoundManager } from '../../Utility/SoundManager';
import { GameplayLog } from '../Debug/GameplayLog';
import { RoomSelectManager } from '../Map/RoomSelectManager';
import { ModelPreview } from './ModelPreview';
import { SkillTutorialHand } from './SkillSpin/SkillTutorialHand';

const { ccclass, property } = _decorator;

@ccclass('RoomSelectCard')
export class RoomSelectCard {
    @property({ type: Node })
    public root: Node = null;

    @property({ type: Button })
    public button: Button = null;

    @property({ type: ModelPreview })
    public preview: ModelPreview = null;

    @property({ type: Label })
    public nameLabel: Label = null;

    @property({ type: Node })
    public highlight: Node = null;
}

@ccclass('RoomSelectUI')
export class RoomSelectUI extends Component {
    @property({ type: RoomSelectManager })
    public manager: RoomSelectManager = null;

    @property({ type: Node })
    public panel: Node = null;

    @property({ type: Node })
    public previewShell: Node = null;

    @property({ type: [RoomSelectCard] })
    public cards: RoomSelectCard[] = [];

    @property({ type: Button })
    public confirmButton: Button = null;

    @property({ type: SkillTutorialHand })
    public tutorialHand: SkillTutorialHand = null;

    @property({ type: CCFloat })
    public tutorialDelay: number = 0.6;

    @property
    public tutorialOnce: boolean = false;

    @property
    public tapToEnter: boolean = true;

    private _built: boolean[] = [];
    private _wasOpen: boolean = false;
    private _index: number = 0;

    private _tutorialShown: boolean = false;

    onLoad() {
        if (!this.manager) this.manager = RoomSelectManager.instance;

        for (let i = 0; i < this.cards.length; i++) {
            const card = this.cards[i];
            if (!card?.button) continue;

            card.button.node.on(Button.EventType.CLICK, () => this.onCardTapped(i), this);
        }
        if (this.confirmButton) this.confirmButton.node.on(Button.EventType.CLICK, this.confirm, this);

        if (this.panel) this.panel.active = false;
        this.setPreviewsRendering(false);
    }

    start() {
        if (!this.manager) this.manager = RoomSelectManager.instance;
        this.refreshLabels();
    }

    onDestroy() {
        if (this.confirmButton) this.confirmButton.node.off(Button.EventType.CLICK, this.confirm, this);
        this.stopTutorial();
    }

    update() {
        const open = !!this.manager?.isOpen;
        if (open === this._wasOpen) {

            this.buildOnePreview();
            return;
        }

        this._wasOpen = open;
        if (this.panel) this.panel.active = open;
        this.setPreviewsRendering(open);
        if (open) this.onOpened();
        else this.stopTutorial();
    }

    private onOpened() {

        const count = this.manager?.decorNames.length || 0;
        const last = this.manager?.decorIndex ?? -1;
        this._index = count > 0 ? (last + 1) % count : 0;
        this.refreshLabels();
        this.refreshHighlight();
        this.startTutorial();
        GameplayLog.log('select', `panel chọn room mở, đang ngắm card ${this._index}`);
    }

    private onCardTapped(index: number) {
        this.stopTutorial();
        SoundManager.instance?.playButtonClick();
        this._index = index;
        this.refreshHighlight();
        if (this.tapToEnter || !this.confirmButton) this.confirm();
    }

    public confirm() {
        const manager = this.manager || RoomSelectManager.instance;
        if (!manager) {
            console.warn('[RoomSelectUI] không có RoomSelectManager để chốt');
            return;
        }
        if (!manager.isOpen) return;
        manager.select(this._index);
    }

    private buildOnePreview() {
        const manager = this.manager;
        if (!manager) return;

        for (let i = 0; i < this.cards.length; i++) {
            if (this._built[i]) continue;
            const card = this.cards[i];
            const decor = manager.decorTemplate(i);
            if (!card?.preview) {
                this._built[i] = true;
                continue;
            }
            this._built[i] = true;
            if (!decor) {
                if (card.root) card.root.active = false;
                continue;
            }

            const holder = new Node(`RoomPreview_${i}`);
            if (this.previewShell) instantiate(this.previewShell).setParent(holder);
            instantiate(decor.visual).setParent(holder);
            card.preview.attach(holder);
            GameplayLog.log('select', `dựng preview cho bộ ${i} — ${decor.displayName}`);
            return;
        }
    }

    private startTutorial() {
        if (!this.tutorialHand) return;
        if (this.tutorialOnce && this._tutorialShown) return;
        this.unschedule(this._startTutorial);
        this.scheduleOnce(this._startTutorial, Math.max(0, this.tutorialDelay));
    }

    private _startTutorial = () => {
        if (!this.tutorialHand || !this.manager?.isOpen) return;

        const targets: Node[] = [];
        for (const card of this.cards) {
            if (card?.root && card.root.activeInHierarchy) targets.push(card.root);
        }
        if (targets.length === 0) return;
        this._tutorialShown = true;
        this.tutorialHand.play(targets);
    };

    private stopTutorial() {
        this.unschedule(this._startTutorial);
        this.tutorialHand?.stop();
    }

    private refreshLabels() {
        const names = this.manager?.decorNames || [];
        for (let i = 0; i < this.cards.length; i++) {
            const card = this.cards[i];
            if (!card) continue;
            const name = names[i];
            if (card.root) card.root.active = !!name;
            if (card.nameLabel) card.nameLabel.string = name || '';
        }
    }

    private refreshHighlight() {
        for (let i = 0; i < this.cards.length; i++) {
            const h = this.cards[i]?.highlight;
            if (h) h.active = i === this._index;
        }
    }

    private setPreviewsRendering(on: boolean) {
        for (let i = 0; i < this.cards.length; i++) {
            const cam = this.cards[i]?.preview?.previewCamera;
            if (cam) cam.enabled = on;
        }
    }
}
