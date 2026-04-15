const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'app/contacts/[type]/page.tsx');
let content = fs.readFileSync(targetFile, 'utf-8');

const replacements = [
  // Hardcoded light mode backgrounds
  { regex: /\bbg-white\b/g, to: 'bg-[#131929]' },
  
  // Specific border colors that might have survived
  { regex: /\bborder-gray-300\b/g, to: 'border-[rgba(201,168,76,0.18)]' },
  { regex: /\bborder-pink-200\b/g, to: 'border-[rgba(233,30,140,0.18)]' },
  { regex: /\bborder-orange-200\b/g, to: 'border-[rgba(234,88,12,0.18)]' },
  { regex: /\bborder-purple-200\b/g, to: 'border-[rgba(147,51,234,0.18)]' },
  { regex: /\bborder-blue-200\b/g, to: 'border-[rgba(37,99,235,0.18)]' },
  { regex: /\bborder-emerald-100\b/g, to: 'border-[rgba(16,185,129,0.18)]' },
  
  // Extra hover colors
  { regex: /\bhover:bg-gray-100\b/g, to: 'hover:bg-white/10' },
  { regex: /\bhover:bg-emerald-50\b/g, to: 'hover:bg-[rgba(16,185,129,0.1)]' },
];

for (const rep of replacements) {
  content = content.replace(rep.regex, rep.to);
}

fs.writeFileSync(targetFile, content, 'utf-8');
console.log('Contacts Page Final UI Polish Complete');
