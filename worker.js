// Optional Cloudflare Worker: CORS bridge to the fixed public Handball4all league.
export default {
  async fetch(request) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'public, max-age=45'
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: cors });
    const incoming = new URL(request.url);
    const orgId = Number(incoming.searchParams.get('og')) || 216;
    const leagueId = Number(incoming.searchParams.get('cl')) || 162286;
    const allowedLeagues = [162286,162301,161176,162231,162261];
    if (orgId !== 216 || !allowedLeagues.includes(leagueId)) return new Response('Unknown league', {status:400,headers:cors});
    const params = new URLSearchParams({cmd:'ps',og:String(orgId),cl:String(leagueId),ca:'1'});
    const upstream = 'https://spo.handball4all.de/service/if_g_json.php?' + params.toString();
    try {
      const res = await fetch(upstream, { headers: { Accept: 'application/json,text/plain,*/*' } });
      const body = await res.text();
      return new Response(body, { status: res.status, headers: { ...cors, 'Content-Type': res.headers.get('Content-Type') || 'application/json; charset=utf-8' } });
    } catch (error) {
      return new Response(JSON.stringify({error:'Upstream Handball4all request failed',detail:String(error)}), {status:502,headers:{...cors,'Content-Type':'application/json; charset=utf-8'}});
    }
  }
};