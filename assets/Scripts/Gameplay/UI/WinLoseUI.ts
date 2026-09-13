import { _decorator, Component, Node } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('WinLoseUI')
export class WinLoseUI extends Component {
    @property(Node)
    public winPanel: Node = null;

    @property(Node)
    public losePanel: Node = null;

    onLoad() {
        this.hideAll();
    }

    public showWin() {
        if (this.losePanel) this.losePanel.active = false;
        if (this.winPanel) this.winPanel.active = true;
        this.node.active = true;
    }

    public showLose() {
        if (this.winPanel) this.winPanel.active = false;
        if (this.losePanel) this.losePanel.active = true;
        this.node.active = true;
    }

    public hideAll() {
        if (this.winPanel) this.winPanel.active = false;
        if (this.losePanel) this.losePanel.active = false;
    }
}
