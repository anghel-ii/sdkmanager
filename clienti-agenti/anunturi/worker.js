// ═══════════════════════════════════════════════════════════════════════════
//  Anunţurile live ale portalului (userul, 2026-10-29: „pagina primeşte de la server că
//  s-a modificat, nu mai verifică niciodată, doar aşteaptă").
//  Fiecare pagină deschisă ţine o legătură WebSocket aici (prin portal: functions/api/live.js),
//  etichetată cu cine e: „a:<numele agentului>" sau „conducere". Când portalul schimbă ceva
//  (aprobare, respingere, conducerea, managerul) cheamă /anunta cu agenţii atinşi, iar
//  paginile lor primesc „schimbat" şi îşi reîncarcă lista. Mesajul nu are date: pagina le
//  cere cu cookie-ul ei, ca până acum.
//  Hibernare: legăturile stau deschise fără cost cât nu se întâmplă nimic; ping-ul paginii
//  primeşte „pong" automat, fără să trezească obiectul.
// ═══════════════════════════════════════════════════════════════════════════
import { DurableObject } from 'cloudflare:workers';

export class Anunturi extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request) {
    const cale = new URL(request.url).pathname;
    if (cale === '/conecteaza' && request.headers.get('Upgrade') === 'websocket') {
      const cine = request.headers.get('X-Cine');
      if (!cine) return new Response('Fără eticheta paginii.', { status: 400 });
      const [client, server] = Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(server, [cine]);
      return new Response(null, { status: 101, webSocket: client });
    }
    if (cale === '/anunta' && request.method === 'POST') {
      // { agenti: [nume…], conducere: true/false } → „schimbat" la paginile lor
      const { agenti = [], conducere = false } = await request.json().catch(() => ({}));
      const etichete = new Set([...agenti.filter(Boolean).map(a => `a:${a}`), ...(conducere ? ['conducere'] : [])]);
      let trimise = 0;
      for (const e of etichete) {
        for (const ws of this.ctx.getWebSockets(e)) { try { ws.send('schimbat'); trimise++; } catch { /* închisă între timp */ } }
      }
      return Response.json({ trimise });
    }
    if (cale === '/versiune' && request.method === 'POST') {
      // o publicare nouă a portalului: dacă versiunea paginii e alta, toate paginile deschise află („versiune")
      // şi întreabă portalul ce versiune e acum — o instanţă a unei publicări vechi nu le poate păcăli
      const { versiune } = await request.json().catch(() => ({}));
      const stiuta = await this.ctx.storage.get('versiune');
      if (!versiune || versiune === stiuta) return Response.json({ nou: false });
      await this.ctx.storage.put('versiune', versiune);
      if (stiuta) for (const ws of this.ctx.getWebSockets()) { try { ws.send('versiune'); } catch { /* închisă */ } }
      return Response.json({ nou: true });
    }
    return new Response('Necunoscut.', { status: 404 });
  }

  webSocketMessage() { /* paginile nu trimit decât ping (auto-răspuns) */ }
  webSocketClose(ws, cod) { try { ws.close(cod, 'Închis.'); } catch { /* deja închisă */ } }
}

export default { fetch: () => new Response('Nu e pentru browser.', { status: 404 }) };
