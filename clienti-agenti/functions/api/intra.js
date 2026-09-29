import { folosesteBilet, creeazaSesiune } from '../../lib/comun.js';

// GET ?t=<bilet> — linkul deschis din /admin-ul managerului: biletul (o
// folosinţă, 60 s) devine o sesiune de admin în contul agentului, 8 ore.
export async function onRequestGet({ request, env }) {
  const agentId = await folosesteBilet(env, new URL(request.url).searchParams.get('t'));
  if (!agentId) {
    return new Response('Linkul a expirat sau a fost deja folosit — apasă din nou „Intră ca agent" în manager.',
      { status: 410, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
  return new Response(null, { status: 303, headers: {
    Location: '/', 'Set-Cookie': await creeazaSesiune(env, agentId, true), 'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer' } });
}
