const url = 'https://lulcvphsoprtmgubkurv.supabase.co/rest/v1/customers';
const key = 'sb_publishable_ZdWdFz_xBNqUJOKUsJfWYw_dRDi5-sp';

async function test() {
  const payload = {
    name: 'Test Customer',
    personnel: [{ name: 'A', position: 'Manager', phone_numbers: ['123'] }]
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  console.log(res.status);
  console.log(data);
}
test();
