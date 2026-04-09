import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  const payload = {
    name: 'Test Customer',
    shop_name: 'Test Shop',
    email: 'test@example.com',
    address: '123 Test St',
    profile_image_url: '',
    phone_numbers: ['1234567890'],
    personnel: [
      { name: 'John', position: 'Manager', phone_numbers: ['0987654321'] }
    ]
  };

  const { data, error } = await supabase.from('customers').insert([payload]).select();
  
  if (error) {
    console.error("SUPABASE ERROR:");
    console.error(JSON.stringify(error, null, 2));
  } else {
    console.log("INSERT SUCCESSFUL");
    console.log(data);
    // clean it up
    await supabase.from('customers').delete().eq('id', data[0].id);
  }
}

testInsert();
