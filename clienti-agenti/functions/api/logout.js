import { raspuns, stergeSesiunea, stergeCookie } from '../../lib/comun.js';

export async function onRequestPost({ request, env }) {
  await stergeSesiunea(request, env);
  return raspuns(200, {}, { 'Set-Cookie': stergeCookie });
}
