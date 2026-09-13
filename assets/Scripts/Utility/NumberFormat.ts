const COMPACT_UNITS = ['', 'k', 'm', 'b', 't'];

export function formatCompact(value: number, decimals: number = 2): string {
    if (!isFinite(value)) return '0';

    const abs = Math.abs(value);
    if (abs < 1000) return `${Math.round(value)}`;

    let tier = Math.floor(Math.log10(abs) / 3);
    if (tier >= COMPACT_UNITS.length) tier = COMPACT_UNITS.length - 1;

    const scaled = value / Math.pow(1000, tier);
    const factor = Math.pow(10, Math.max(0, decimals));
    const truncated = Math.trunc(scaled * factor) / factor;

    let text = truncated.toFixed(Math.max(0, decimals));
    if (text.indexOf('.') >= 0) {
        text = text.replace(/0+$/, '').replace(/\.$/, '');
    }
    return `${text}${COMPACT_UNITS[tier]}`;
}
