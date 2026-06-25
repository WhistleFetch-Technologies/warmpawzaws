/** Digits only — for stock and integer fields. */
export function filterIntegerInput(raw: string): string {
  return raw.replace(/\D/g, '');
}

/** Digits with at most one decimal point; optional max decimal places. */
export function filterDecimalInput(raw: string, maxDecimals = 2): string {
  let out = '';
  let seenDot = false;
  let decimalsAfterDot = 0;

  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') {
      if (seenDot) {
        if (decimalsAfterDot >= maxDecimals) continue;
        decimalsAfterDot += 1;
      }
      out += ch;
    } else if (ch === '.' && !seenDot) {
      seenDot = true;
      out += ch;
    }
  }

  return out;
}
