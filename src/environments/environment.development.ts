/**
 * Development (`npm start`).
 * `supabase` talks to the hosted project below.
 * `local` runs against an in-browser store seeded with demo data (any email and
 * password signs in) for working on screens without a backend.
 */
export const environment = {
  dataMode: 'supabase' as 'supabase' | 'local',
  supabaseUrl: 'https://vnvrevrqogxhrcgnwdsk.supabase.co',
  supabaseAnonKey: 'sb_publishable_GOVbk5dZsqmXurrcbMEbnQ_X8vE28-b',
};
