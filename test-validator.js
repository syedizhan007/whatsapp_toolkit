const { parsePhoneNumber, isValidPhoneNumber } = require('libphonenumber-js');

// Test the auto-detection logic
function validateFormat(phoneNumber) {
  try {
    if (!phoneNumber) return null;

    let numberStr = phoneNumber.toString().trim().replace(/[\s\-\(\)]/g, '');

    // Case 1: Number already has country code
    if (numberStr.startsWith('+')) {
      if (isValidPhoneNumber(numberStr)) {
        const parsed = parsePhoneNumber(numberStr);
        return parsed.number;
      }
    }

    // Case 2: Number starts with 0 - try to auto-detect country
    if (numberStr.startsWith('0')) {
      const detectedNumber = detectCountryForZeroPrefix(numberStr);
      if (detectedNumber) return detectedNumber;
    }

    // Case 3: Try with + prefix first
    const withPlus = '+' + numberStr;
    if (isValidPhoneNumber(withPlus)) {
      const parsed = parsePhoneNumber(withPlus);
      return parsed.number;
    }

    // Case 4: Try all major countries to find a match
    const detectedNumber = tryMultipleCountries(numberStr);
    if (detectedNumber) return detectedNumber;

    return null;
  } catch (error) {
    return null;
  }
}

function detectCountryForZeroPrefix(numberStr) {
  const countryPatterns = [
    { country: 'PK', code: '92', pattern: /^03\d{9}$/, stripZero: true },
    { country: 'GB', code: '44', pattern: /^07\d{9}$/, stripZero: true },
    { country: 'GB', code: '44', pattern: /^0[12]\d{9}$/, stripZero: true },
    { country: 'IN', code: '91', pattern: /^0[6-9]\d{9}$/, stripZero: true },
    { country: 'AE', code: '971', pattern: /^05[024568]\d{7}$/, stripZero: true },
    { country: 'SA', code: '966', pattern: /^05\d{8}$/, stripZero: true },
    { country: 'AU', code: '61', pattern: /^04\d{8}$/, stripZero: true },
    { country: 'FR', code: '33', pattern: /^0[1-79]\d{8}$/, stripZero: true },
    { country: 'DE', code: '49', pattern: /^0[1-9]\d{8,11}$/, stripZero: true },
  ];

  for (const { country, code, pattern, stripZero } of countryPatterns) {
    if (pattern.test(numberStr)) {
      const testNumber = stripZero ? numberStr.substring(1) : numberStr;
      const fullNumber = '+' + code + testNumber;

      try {
        if (isValidPhoneNumber(fullNumber, country)) {
          const parsed = parsePhoneNumber(fullNumber, country);
          return parsed.number;
        }
      } catch (e) {
        continue;
      }
    }
  }

  const withoutZero = numberStr.substring(1);
  return tryMultipleCountries(withoutZero);
}

function tryMultipleCountries(numberStr) {
  const countries = [
    'PK', 'IN', 'US', 'GB', 'CN', 'ID', 'BR', 'NG', 'BD', 'RU',
    'MX', 'JP', 'ET', 'PH', 'EG', 'VN', 'TR', 'IR', 'DE', 'TH',
    'FR', 'IT', 'ZA', 'ES', 'KE', 'AR', 'UA', 'CA', 'PL', 'MA',
    'SA', 'AE', 'MY', 'PE', 'GH', 'NP', 'AU', 'TW', 'KR', 'CL',
    'NL', 'SY', 'RO', 'KZ', 'LK', 'BE', 'GR', 'PT', 'CZ', 'SE',
    'JO', 'AZ', 'HU', 'TN', 'IL', 'AT', 'CH', 'BG', 'RS', 'DK',
    'FI', 'NO', 'IE', 'NZ', 'SG', 'HK', 'LB', 'LY', 'OM', 'KW',
    'QA', 'BH', 'AF', 'IQ', 'YE', 'MM', 'UZ', 'VE', 'CO', 'EC'
  ];

  for (const country of countries) {
    try {
      if (isValidPhoneNumber(numberStr, country)) {
        const parsed = parsePhoneNumber(numberStr, country);
        return parsed.number;
      }

      const withPlus = '+' + numberStr;
      if (isValidPhoneNumber(withPlus, country)) {
        const parsed = parsePhoneNumber(withPlus, country);
        return parsed.number;
      }
    } catch (e) {
      continue;
    }
  }

  return null;
}

// Test cases
const testNumbers = [
  '03332314676',      // Pakistan
  '07911123456',      // UK
  '0501234567',       // UAE
  '923332314676',     // Pakistan with code
  '+447911123456',    // UK with +
  '14155552671',      // US
  '+14155552671',     // US with +
  '0612345678',       // France
  '0491234567',       // Australia
];

console.log('Testing Auto-Detection:\n');
testNumbers.forEach(number => {
  const result = validateFormat(number);
  console.log(`${number.padEnd(20)} → ${result || 'INVALID'}`);
});
