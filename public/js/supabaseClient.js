// Safe to expose client-side: the "publishable" key (like the old "anon" key) is designed
// to be public. Real access control happens server-side via Row Level Security / the
// secret key, never by hiding this value.
const SUPABASE_URL = 'https://ypufernbsvfodrqelymc.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_YMYaFM2T0oa_vRP25UtEZA_xoGjBLfx';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
