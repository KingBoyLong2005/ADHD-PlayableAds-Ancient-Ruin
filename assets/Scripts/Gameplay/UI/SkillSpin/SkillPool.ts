import { _decorator, Component, SpriteFrame } from 'cc';
import { HeroClass } from '../../Hero/HeroClass';
import { SkillDefinition } from '../../Skills/SkillDefinition';

const { ccclass, property } = _decorator;

@ccclass('SkillPoolEntry')
export class SkillPoolEntry extends SkillDefinition {
    @property({ type: SpriteFrame })
    public icon: SpriteFrame = null;
}

@ccclass('SkillPool')
export class SkillPool extends Component {
    @property({ type: [SkillPoolEntry] })
    public mageSkills: SkillPoolEntry[] = [];

    @property({ type: [SkillPoolEntry] })
    public rangerSkills: SkillPoolEntry[] = [];

    @property({ type: [SkillPoolEntry] })
    public warriorSkills: SkillPoolEntry[] = [];

    @property({ type: SpriteFrame })
    public fallbackIcon: SpriteFrame = null;

    private _byId: Map<string, SkillPoolEntry> = null;
    private _warnedIcons: Set<string> = null;

    onLoad() {
        this.rebuild();
    }

    public rebuild() {
        this._byId = new Map<string, SkillPoolEntry>();
        const groups: [SkillPoolEntry[], HeroClass][] = [
            [this.mageSkills, HeroClass.Mage],
            [this.rangerSkills, HeroClass.Ranger],
            [this.warriorSkills, HeroClass.Warrior],
        ];

        const classes = new Map<string, HeroClass>();
        for (const [list, heroClass] of groups) {
            for (const e of list) {
                if (!e || !e.id) continue;
                const canonical = this._byId.get(e.id);
                if (!canonical) {
                    this._byId.set(e.id, e);
                } else if (canonical !== e) {
                    console.warn(
                        `[SkillPool] id "${e.id}" khai báo bằng 2 entry khác nhau — chỉ entry đầu tiên ` +
                            `được dùng. Muốn skill dùng chung nhiều class thì để *cùng một* entry ở các mảng.`,
                    );
                }
                classes.set(e.id, (classes.get(e.id) || HeroClass.None) | heroClass);
            }
        }

        for (const [id, cls] of classes) {
            const e = this._byId.get(id);
            if (e) e.allowedClasses = cls;
        }
    }

    private ensure() {
        if (!this._byId) this.rebuild();
    }

    public getClassSkills(heroClass: HeroClass): SkillPoolEntry[] {
        this.ensure();
        const out: SkillPoolEntry[] = [];
        const seen = new Set<string>();

        const push = (list: SkillPoolEntry[]) => {
            for (const raw of list) {
                if (!raw || !raw.id || seen.has(raw.id)) continue;
                seen.add(raw.id);
                const e = this._byId.get(raw.id) || raw;
                if (!e.icon) {
                    this.warnMissingIcon(e.id);
                    continue;
                }
                out.push(e);
            }
        };
        if (!heroClass || heroClass & HeroClass.Mage) push(this.mageSkills);
        if (!heroClass || heroClass & HeroClass.Ranger) push(this.rangerSkills);
        if (!heroClass || heroClass & HeroClass.Warrior) push(this.warriorSkills);
        return out;
    }

    public getEntry(skillId: string): SkillPoolEntry {
        this.ensure();
        return this._byId.get(skillId) || null;
    }

    public getIcon(skillId: string): SpriteFrame {
        const e = this.getEntry(skillId);
        return (e && e.icon) || this.fallbackIcon;
    }

    private warnMissingIcon(id: string) {
        if (!this._warnedIcons) this._warnedIcons = new Set<string>();
        if (this._warnedIcons.has(id)) return;
        this._warnedIcons.add(id);
        console.warn(`[SkillPool] "${id}" chưa gán icon nên bị loại khỏi vòng quay.`);
    }
}
