const org = 216;
const dates = [
  "2026-11-23","2026-11-30","2026-12-07","2026-12-14","2027-01-04",
  "2027-01-11","2027-01-18","2027-01-25","2027-02-01","2027-02-08",
  "2027-02-15","2027-02-22","2027-03-01","2027-03-08","2027-03-15",
  "2027-03-22","2027-03-29","2027-04-05","2027-04-12","2027-04-19"
];
const found = new Map();
let cursor = 0;
async function worker() {
  while (cursor < dates.length) {
    const date = dates[cursor++];
    const url = new URL("https://spo.handball4all.de/service/if_g_json.php");
    url.search = new URLSearchParams({cmd:"po",do:date,og:String(org)}).toString();
    try {
      const res = await fetch(url,{headers:{Accept:"application/json,text/plain,*/*"},signal:AbortSignal.timeout(20000)});
      if (!res.ok) continue;
      const data = await res.json();
      const root = Array.isArray(data) ? data[0] : data;
      const classes = root?.content?.classes || [];
      for (const cls of classes) {
        const games = (cls.games || []).filter(g => /kugis|kuchen-gingen-sussen/i.test([g.gHomeTeam,g.gGuestTeam].join(" ")));
        if (!games.length) continue;
        const record = {
          leagueId: String(cls.gClassID || ""),
          league: cls.gClassLname || "",
          short: cls.gClassSname || "",
          gender: cls.gClassGender || "",
          level: cls.gClassLevelName || "",
          games: games.map(g => ({
            date:g.gDate,time:g.gTime,home:g.gHomeTeam,away:g.gGuestTeam,
            id:g.gID
          }))
        };
        if(record.leagueId) found.set(record.leagueId,record);
      }
    } catch (e) { console.log("PO_DATE_ERROR "+date+" "+String(e)); }
  }
}
await Promise.all(Array.from({length:5},()=>worker()));
const result = [...found.values()].sort((a,b)=>a.leagueId.localeCompare(b.leagueId));
console.log("ACTIVE_KUGIS_LEAGUES "+JSON.stringify(result));
