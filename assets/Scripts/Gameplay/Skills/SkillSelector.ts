import { HeroClass, isClassAllowed } from '../Hero/HeroClass';
import { SkillDefinition } from './SkillDefinition';
import { SkillCatalog } from './SkillCatalog';
import { getSkillStatKey } from './SkillType';

export class SkillSelector {
    public static pickRandom(
        catalog: SkillCatalog,
        count: number = 3,
        excludeIds: string[] = null,
        heroClass: HeroClass = HeroClass.None,
    ): SkillDefinition[] {
        const all = (catalog?.getAll() || []);
        if (all.length === 0) return [];

        let source = heroClass
            ? all.filter((s) => isClassAllowed(s.allowedClasses, heroClass))
            : all.slice();
        if (source.length === 0) source = all.slice();

        const exclude = excludeIds && excludeIds.length > 0 ? excludeIds : null;
        let pool = exclude
            ? source.filter((s) => exclude.indexOf(s.id) < 0)
            : source.slice();

        if (pool.length < count) {
            pool = source.slice();
        }

        const usedStats = new Set<string>();
        const result: SkillDefinition[] = [];
        const n = Math.min(count, pool.length);
        for (let i = 0; i < n; i++) {
            const fresh = pool.filter((s) => {
                const key = getSkillStatKey(s.effectKind, s.statBuffKind, s.skillType);
                return !key || !usedStats.has(key);
            });
            const from = fresh.length > 0 ? fresh : pool;
            const pick = from[Math.floor(Math.random() * from.length)];
            result.push(pick);
            pool.splice(pool.indexOf(pick), 1);
            const key = getSkillStatKey(pick.effectKind, pick.statBuffKind, pick.skillType);
            if (key) usedStats.add(key);
        }
        return result;
    }
}
