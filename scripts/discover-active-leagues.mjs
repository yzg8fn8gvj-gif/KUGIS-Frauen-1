const base = 162801;
const last = 164000;
const org = 216;
const aliases = ["kugis", "sgkugis", "kuchengingensussen"];
const norm = s => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const pool = Array.from({length:last-base+1},(_,i)=>base+i);
const found = [];
let cursor = 0;
async function worker() {
  while (cursor < pool.length) {
    const id = pool[cursor++];
    const url = new URL("https://spo.handball4all.de/service/if_g_json.php");
    url.search = new URLSearchParams({ca:"1",cl:String(id),cmd:"ps",og:String(org)}).toString();
    try {
      const res = await fetch(url,{headers:{Accept:"application/json,text/plain,*/*"},signal:AbortSignal.timeout(15000)});
      if (!res.ok) continue;
      let json = await res.json();
      if (json && typeof json==="object" && json.contents) { try { json=JSON.parse(json.contents); } catch {} }
      const strings = [];
      const visit = (x,d=0) => {
        if(d>9||x==null)return;
        if(typeof x==="string"||typeof x==="number"){strings.push(String(x));return;}
        if(Array.isArray(x)){for(const y of x)visit(y,d+1);return;}
        if(typeof x==="object")for(const [k,v] of Object.entries(x)){strings.push(k);visit(v,d+1);}
      };
      visit(json);
      const matched = [...new Set(strings.filter(s=>aliases.some(a=>norm(s).includes(a))))];
      if (matched.length) {
        const leagueNames = [...new Set(strings.filter(s=>/bezirk|landesliga|bezirksklasse|bezirksoberliga|staffel|frauen|männer|maenner/i.test(s)))].slice(0,20);
        found.push({id,matched:matched.slice(0,25),leagueNames});
        console.log("FOUND_LEAGUE "+JSON.stringify(found[found.length-1]));
      }
    } catch {}
  }
}
await Promise.all(Array.from({length:8},()=>worker()));
console.log("DISCOVERY_COMPLETE "+JSON.stringify(found.sort((a,b)=>a.id-b.id)));
const poUrl = new URL("https://spo.handball4all.de/service/if_g_json.php");
poUrl.search = new URLSearchParams({cmd:"po",do:"2026-11-28",og:String(org)}).toString();
try {
  const res = await fetch(poUrl,{headers:{Accept:"application/json,text/plain,*/*"},signal:AbortSignal.timeout(20000)});
  if (res.ok) {
    const po = await res.json();
    const seen = new Set();
    const inspect = (x,d=0) => {
      if(d>9||x==null)return;
      if(Array.isArray(x)){for(const y of x)inspect(y,d+1);return;}
      if(typeof x!=="object")return;
      const direct = Object.entries(x).filter(([k,v])=>typeof v==="string" && aliases.some(a=>norm(v).includes(a)));
      if(direct.length) {
        const key=JSON.stringify(x);
        if(!seen.has(key)){seen.add(key);console.log("PO_KUGIS_OBJECT "+JSON.stringify(x).slice(0,5000));}
      }
      for(const v of Object.values(x))inspect(v,d+1);
    };
    inspect(po);
  }
} catch (error) { console.log("PO_PROBE_ERROR "+String(error)); }

