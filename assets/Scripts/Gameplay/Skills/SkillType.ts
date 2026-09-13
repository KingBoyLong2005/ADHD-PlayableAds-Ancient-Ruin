export enum SkillType {
    StatBuff = 0,
    AttackSkill = 1,
    Instant = 2,
    Passive = 3,
}

export enum StatBuffKind {
    MaxHp = 0,
    MoveSpeed = 1,
    Damage = 2,
    MeleeRange = 3,
    RangedRange = 4,
    AttackCooldownReduce = 5,
}

export enum AttackSkillKind {
    MultiShot = 0,
    Pierce = 1,
    Explosion = 2,
    Homing = 3,
}

export enum SkillEffectKind {
    None = 0,
    StatPctDamage = 1,
    StatPctMaxHp = 2,
    InstantHealPct = 3,
    DamageReflect = 4,
    Adrenaline = 5,
    StunBonusDamage = 6,
    StunDuration = 7,
    Parry = 8,
    TargetWeakest = 9,
    ActiveIceBolt = 10,
    ActiveFireBolt = 11,
    ActiveFireball = 12,
    ActiveLightningBolt = 13,
    ActiveChainLightning = 14,

    StatPctMoveSpeed = 15,
    StatPctAttackSpeed = 16,
    StatCritChance = 17,
    StatCritDamage = 18,
    StatLifesteal = 19,
    StatPctAttackRange = 20,

    LegacyStatBuff = 100,
    LegacyAttackSkill = 101,
}

export function getSkillEffectCategory(kind: SkillEffectKind): string {
    switch (kind) {
        case SkillEffectKind.InstantHealPct:
            return 'HEAL';
        case SkillEffectKind.ActiveIceBolt:
        case SkillEffectKind.ActiveFireBolt:
        case SkillEffectKind.ActiveFireball:
        case SkillEffectKind.ActiveLightningBolt:
        case SkillEffectKind.ActiveChainLightning:
            return 'ATTACK';
        case SkillEffectKind.DamageReflect:
        case SkillEffectKind.Adrenaline:
        case SkillEffectKind.StunBonusDamage:
        case SkillEffectKind.StunDuration:
        case SkillEffectKind.Parry:
        case SkillEffectKind.TargetWeakest:
            return 'PASSIVE';
        case SkillEffectKind.StatPctDamage:
        case SkillEffectKind.StatPctMaxHp:
        case SkillEffectKind.StatPctMoveSpeed:
        case SkillEffectKind.StatPctAttackSpeed:
        case SkillEffectKind.StatCritChance:
        case SkillEffectKind.StatCritDamage:
        case SkillEffectKind.StatLifesteal:
        case SkillEffectKind.StatPctAttackRange:
        case SkillEffectKind.LegacyStatBuff:
            return 'BUFF';
        default:
            return 'SKILL';
    }
}

export function describeStatEffect(kind: SkillEffectKind, value: number): string {
    const pct = Math.round(value * 100);
    switch (kind) {
        case SkillEffectKind.StatPctDamage:
            return `+${pct}% Damage`;
        case SkillEffectKind.StatPctMaxHp:
            return `+${pct}% Max HP`;
        case SkillEffectKind.StatPctMoveSpeed:
            return `+${pct}% Move speed`;
        case SkillEffectKind.StatPctAttackSpeed:
            return `+${pct}% Attack speed`;
        case SkillEffectKind.StatCritChance:
            return `+${pct}% Crit chance`;
        case SkillEffectKind.StatCritDamage:
            return `+${pct}% Crit damage`;
        case SkillEffectKind.StatLifesteal:
            return `+${pct}% Lifesteal`;
        case SkillEffectKind.StatPctAttackRange:
            return `+${pct}% Attack range`;
        case SkillEffectKind.InstantHealPct:
            return `Restore ${pct}% Max HP`;
        default:
            return '';
    }
}

export function getSkillStatKey(
    effectKind: SkillEffectKind,
    statBuffKind: StatBuffKind,
    skillType: SkillType = SkillType.StatBuff,
): string {
    switch (effectKind) {
        case SkillEffectKind.StatPctDamage:
            return 'damage';
        case SkillEffectKind.StatPctMaxHp:
            return 'maxHp';
        case SkillEffectKind.StatPctMoveSpeed:
            return 'moveSpeed';
        case SkillEffectKind.StatPctAttackSpeed:
            return 'attackSpeed';
        case SkillEffectKind.StatCritChance:
            return 'critChance';
        case SkillEffectKind.StatCritDamage:
            return 'critDamage';
        case SkillEffectKind.StatLifesteal:
            return 'lifesteal';
        case SkillEffectKind.StatPctAttackRange:
            return 'attackRange';
        case SkillEffectKind.None:

            if (skillType !== SkillType.StatBuff) return '';
            break;
        case SkillEffectKind.LegacyStatBuff:
            break;
        default:
            return '';
    }

    switch (statBuffKind) {
        case StatBuffKind.MaxHp:
            return 'maxHp';
        case StatBuffKind.MoveSpeed:
            return 'moveSpeed';
        case StatBuffKind.Damage:
            return 'damage';
        case StatBuffKind.MeleeRange:
        case StatBuffKind.RangedRange:
            return 'attackRange';
        case StatBuffKind.AttackCooldownReduce:
            return 'attackSpeed';
        default:
            return '';
    }
}
