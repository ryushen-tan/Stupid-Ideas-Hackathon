import { createClient } from '@supabase/supabase-js';
import type { AccessReceipt } from '@/lib/access';

export async function GET(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return Response.json({ error: 'Sign in to continue.' }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return Response.json({ error: 'Authentication is not configured.' }, { status: 503 });
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const token = authorization.slice(7);
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data) return Response.json({ error: 'Your session expired. Sign in again.' }, { status: 401 });
  if (data.claims.aal !== 'aal2') {
    return Response.json({ error: 'Verify your authenticator code to enter.' }, { status: 403 });
  }
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user.email) return Response.json({ error: 'Your account could not be verified.' }, { status: 401 });
  const receipt: AccessReceipt = { email: userData.user.email, assurance: 'aal2', verifiedAt: new Date().toISOString() };
  return Response.json(receipt, { headers: { 'Cache-Control': 'no-store' } });
}
