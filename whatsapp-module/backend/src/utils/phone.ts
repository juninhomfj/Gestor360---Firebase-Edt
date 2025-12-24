
export const normalizePhone = (phone: string): string => {
    let clean = phone.replace(/\D/g, '');
    if (clean.length === 11) return '55' + clean;
    if (clean.length === 10) return '55' + clean.slice(0, 2) + '9' + clean.slice(2);
    if (clean.length === 13 && clean.startsWith('55')) return clean;
    return clean;
};
