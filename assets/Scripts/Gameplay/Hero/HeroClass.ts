
export enum HeroClass {

    None = 0,

    Mage = 1 << 0,
    Ranger = 1 << 1,
    Warrior = 1 << 2,

    MageRanger = HeroClass.Mage | HeroClass.Ranger,
    MageWarrior = HeroClass.Mage | HeroClass.Warrior,
    RangerWarrior = HeroClass.Ranger | HeroClass.Warrior,

    All = HeroClass.Mage | HeroClass.Ranger | HeroClass.Warrior,
}

export function isClassAllowed(allowedClasses: HeroClass, heroClass: HeroClass): boolean {
    if (!heroClass) return true;
    return (allowedClasses & heroClass) !== 0;
}
