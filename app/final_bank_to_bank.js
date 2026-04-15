const fs = require('fs');
let content = fs.readFileSync('app/invoices/page.tsx', 'utf8');

// 1. type PaymentMethod
content = content.replace(
  "type PaymentMethod = 'cash' | 'bikash' | 'nagad' | 'rocket' | 'upay' | 'bank_transfer' | 'cheque';",
  "type PaymentMethod = 'cash' | 'bikash' | 'nagad' | 'rocket' | 'upay' | 'bank_transfer' | 'bank_to_bank_transfer' | 'cheque';"
);

// 2. update the array
content = content.replace(
  "['cash', 'bikash', 'nagad', 'rocket', 'upay', 'bank_transfer', 'cheque']",
  "['cash', 'bikash', 'nagad', 'rocket', 'upay', 'bank_transfer', 'bank_to_bank_transfer', 'cheque']"
);

fs.writeFileSync('app/invoices/page.tsx', content);
console.log('Fixed PaymentMethod types and array.');
