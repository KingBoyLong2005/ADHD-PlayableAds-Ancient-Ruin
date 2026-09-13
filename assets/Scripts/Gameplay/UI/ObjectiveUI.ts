import { _decorator, Component, Label, Node } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('ObjectiveUI')
export class ObjectiveUI extends Component {
    @property({ type: Node })
    public body: Node = null;

    @property({ type: Label })
    public label: Label = null;

    private _text: string = '';

    public get visible(): boolean {
        return !!this.body?.active;
    }

    onLoad() {
        if (!this.body) this.body = this.node;
        if (!this.label) this.label = this.getComponentInChildren(Label);
        this.hide();
    }

    public show(text: string) {
        if (!text) {
            this.hide();
            return;
        }
        if (this.body) this.body.active = true;

        if (this._text === text) return;
        this._text = text;
        if (this.label) this.label.string = text;
    }

    public hide() {
        if (this.body) this.body.active = false;
    }
}
