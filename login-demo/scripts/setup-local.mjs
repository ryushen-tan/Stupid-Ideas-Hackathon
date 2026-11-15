import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

execFileSync('supabase', ['start', '-x', 'studio,imgproxy,inbucket,realtime,storage-api,edge-runtime,logflare,vector,supavisor'], { stdio: ['ignore', 'pipe', 'inherit'] });
const configuration = JSON.parse(execFileSync('supabase', ['status', '--output', 'json'], { encoding: 'utf8' }));
if (!configuration.API_URL || !configuration.ANON_KEY) throw new Error('Local Supabase did not return its API URL and anonymous key.');
writeFileSync('.env.local', `NEXT_PUBLIC_SUPABASE_URL=${configuration.API_URL}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${configuration.ANON_KEY}\n`, { mode: 0o600 });
console.log('Local authentication is ready. Run npm run dev and open http://localhost:3020.');
