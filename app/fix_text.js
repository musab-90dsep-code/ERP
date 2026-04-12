const fs = require('fs');
let content = fs.readFileSync('app/invoices/page.tsx', 'utf8');

// Replace line logic
const t1 = "      if (form.payment_method === 'bank_transfer') {\r\n         const savedBanks";
const r1 = "      if (form.payment_method === 'bank_transfer' || form.payment_method === 'bank_to_bank_transfer') {\r\n         const savedBanks";
content = content.replace(t1, r1);

// Handle unix line endings just in case
const t2 = "      if (form.payment_method === 'bank_transfer') {\n         const savedBanks";
const r2 = "      if (form.payment_method === 'bank_transfer' || form.payment_method === 'bank_to_bank_transfer') {\n         const savedBanks";
content = content.replace(t2, r2);

// Replace replace('_', ' ') with replaceAll('_', ' ')
// Only replacing the specific line inside the payment engine type map
content = content.replace(
  "{m.replace('_', ' ')}",
  "{m.replaceAll('_', ' ')}"
);

fs.writeFileSync('app/invoices/page.tsx', content);
console.log('Fixed remaining 2 issues.');
