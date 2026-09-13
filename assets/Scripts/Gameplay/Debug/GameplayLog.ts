import { DEBUG } from 'cc/env';

export class GameplayLog {

    public static enabled: boolean = DEBUG;

    private static _muted: Set<string> = new Set<string>();

    public static isOn(tag: string): boolean {
        return GameplayLog.enabled && !GameplayLog._muted.has(tag);
    }

    public static log(tag: string, msg: string) {
        if (!GameplayLog.isOn(tag)) return;
        console.log(`[${tag}] ${msg}`);
    }

    public static pos(x: number, z: number): string {
        return `(${x.toFixed(1)}, ${z.toFixed(1)})`;
    }
}

if (DEBUG) (globalThis as any).GameplayLog = GameplayLog;
