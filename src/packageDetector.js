const PACKAGE_RULES = [
  {
    name: 'Stay 24hr',
    keywords: ['1990', '24 ชม', '24ชม', '24 ชั่วโมง', '24ชั่วโมง', 'stay 24', '24hr', '24 hr'],
  },
  {
    name: 'Executive Corner',
    keywords: ['2880', 'executive', 'executive corner', 'exec corner'],
  },
  {
    name: 'Long Stay',
    keywords: ['long stay', 'longstay', '7 คืน', '7คืน', '12900', 'long-stay', 'รายเดือน', 'monthly'],
  },
];

function detectPackage(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const rule of PACKAGE_RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return rule.name;
      }
    }
  }
  return null;
}

module.exports = { detectPackage };
