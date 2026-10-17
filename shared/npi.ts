/**
 * National Provider Identifier check: 10 digits whose last digit is the Luhn
 * check digit computed over "80840" followed by the first nine digits.
 */
export function npiValid(npi: string): boolean {
  if (!/^\d{10}$/.test(npi)) return false;
  const digits = `80840${npi.slice(0, 9)}`;
  let total = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    total += d;
  }
  return (10 - (total % 10)) % 10 === Number(npi[9]);
}
