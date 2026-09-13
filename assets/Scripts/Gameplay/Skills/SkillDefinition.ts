import { _decorator, CCFloat, CCInteger, Enum } from 'cc';
import { HeroClass } from '../Hero/HeroClass';
import { AttackSkillKind, SkillEffectKind, SkillType, StatBuffKind } from './SkillType';

const { ccclass, property } = _decorator;

@ccclass('SkillDefinition')
export class SkillDefinition {
    @property
    public id: string = '';

    @property
    public displayName: string = '';

    @property
    public description: string = '';

    @property({ type: Enum(SkillType) })
    public skillType: SkillType = SkillType.StatBuff;

    @property({ type: Enum(SkillEffectKind) })
    public effectKind: SkillEffectKind = SkillEffectKind.None;

    @property({ type: Enum(StatBuffKind) })
    public statBuffKind: StatBuffKind = StatBuffKind.Damage;

    @property({ type: Enum(AttackSkillKind) })
    public attackSkillKind: AttackSkillKind = AttackSkillKind.MultiShot;

    @property({ type: Enum(HeroClass) })
    public allowedClasses: HeroClass = HeroClass.All;

    @property(CCFloat)
    public value: number = 1;

    @property(CCFloat)
    public value2: number = 0;

    @property(CCInteger)
    public stackLimit: number = 99;
}
