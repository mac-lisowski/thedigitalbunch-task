export function normalizeMoney(value: string | number) {
    if (!value) return 0;

    const str = value.toString().toLowerCase().replace(/[^0-9km]/g, '');

    if (str.includes('m')) return parseFloat(str.replace('m', '')) * 1000000;
    if (str.includes('k')) return parseFloat(str.replace('k', '')) * 1000;

    return parseFloat(str);
}