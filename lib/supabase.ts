
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gvubtdymcvxdcpjedjtz.supabase.co';
const supabaseKey = 'sb_publishable_-thx20bjeDHoZX7zI9aafg_s2llBlyA';

export const supabase = createClient(supabaseUrl, supabaseKey);
