export const normalizePhoneToE164 = (input: string, defaultCountry = '55') => {
  if (!input) return null;
  const digits = input.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) return `${defaultCountry}${digits}`;
  if (digits.length >= 11) return digits;
  return null;
};

export const maskPhone = (phone?: string) => {
  if (!phone) return null;
  const d = phone.replace(/\D/g, '');
  if (d.length <= 4) return '*'.repeat(Math.max(0, d.length - 1)) + d.slice(-1);
  return '*'.repeat(Math.max(0, d.length - 4)) + d.slice(-4);
};