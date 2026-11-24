import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const config=JSON.parse(await readFile(new URL('../calendar-config.json',import.meta.url),'utf8'));
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const mapOf=o=>new Map(Object.entries(o||{}).map(([k,v])=>[norm(k),v]));
function val(o,names){const m=mapOf(o);for(const n of names){const v=m.get(norm(n));if(v!==undefined&&v!==null&&v!=='')return v;}return null;}
function txt(v){if(v==null)return '';if(typeof v==='string'||typeof v==='number')return String(v);if(Array.isArray(v))return v.map(txt).filter(Boolean).join(' ');if(typeof v==='object')return txt(val(v,['name','teamName','clubName','shortName','label','value','text','description','displayName']));return '';}
function objects(x,out=[],d=0){if(d>10||x==null)return out;if(Array.isArray(x))for(const y of x)objects(y,out,d+1);else if(typeof x==='object'){out.push(x);for(const y of Object.values(x))objects(y,out,d+1);}return out;}
function localDateTime(ds,ts){const iso=String(ds||'').match(/(\d{4})-(\d{2})-(\d{2})/);const de=String(ds||'').match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);let y,m,d;if(iso){y=+iso[1];m=+iso[2];d=+iso[3];}else if(de){d=+de[1];m=+de[2];y=+de[3];if(y<100)y+=2000;}else return null;const t=String(ts||((String(ds||'').match(/[T ](\d{1,2})[:.](\d{2})/)||[]).slice(1).join(':'))).match(/(\d{1,2})[:.](\d{2})/);const h=t?+t[1]:null,min=t?+t[2]:null;if(h!=null&&(h>23||min>59))return null;return {y,m,d,h,min};}
const pad=n=>String(n).padStart(2,'0'),stamp=d=>String(d.y).padStart(4,'0')+pad(d.m)+pad(d.d)+'T'+pad(d.h??0)+pad(d.min??0)+'00';
const plusMinutes=(d,n)=>{const x=new Date(Date.UTC(d.y,d.m-1,d.d,d.h??0,d.min??0)+n*60000);return {y:x.getUTCFullYear(),m:x.getUTCMonth()+1,d:x.getUTCDate(),h:x.getUTCHours(),min:x.getUTCMinutes()};};
const esc=s=>String(s??'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
function fold(line){let out='',part='';for(const ch of line){if(Buffer.byteLength(part+ch)>70){out+=part+'\r\n';part=' '+ch;}else part+=ch;}return out+part;}
const keys={home:['ghometeam','ghometeamname','hometeamname','heimteam','heimverein','heim','home','team1','club1','homeclub','heimname','mannschaftheim','home_team'],away:['gguestteam','gguestteamname','gawayteam','guestteamname','awayteamname','guestteam','awayteam','gastteam','gastverein','gast','guest','away','team2','club2','awayclub','gastname','mannschaftgast'],date:['gdate','matchdate','gamedate','date','datum','spieltermin','spieltagdatum','begin','startdate','match_date'],time:['gtime','time','uhrzeit','spielzeit','starttime','beginzeit'],score:['result','resultstring','ergebnis','score','endresult','finalscore','resultat'],hg:['ghomegoals','homegoals','homescored','heimtore','toreheim','goals_home','home_score','tore1'],ag:['gguestgoals','gawaygoals','guestgoals','awaygoals','gasttore','toregast','goals_away','away_score','tore2'],id:['matchid','gameid','spielid','id','spielnummer','matchnumber','gamedid','gno'],hall:['ghallname','hallname','hall','halle','gplace','place','location','venue','sporthalle','spielort','hallenname','ggymnasiumname','ggym']};
const now=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
for(const team of config.teams){
 const url=new URL(config.api);url.search=new URLSearchParams({ca:'1',cl:String(team.leagueId),cmd:'ps',og:String(config.orgId)}).toString();
 const response=await fetch(url,{headers:{Accept:'application/json,text/plain,*/*','User-Agent':'KuGiS-Active-Team-Calendar/1.0'},signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error(team.label+': Handball4all HTTP '+response.status);
 let payload=await response.text();try{payload=JSON.parse(payload);}catch{throw new Error(team.label+': Handball4all lieferte kein gültiges JSON.');}
 if(payload&&typeof payload==='object'&&payload.contents){try{payload=JSON.parse(payload.contents);}catch{payload=payload.contents;}}
 if(typeof payload==='string'){try{payload=JSON.parse(payload);}catch{throw new Error(team.label+': JSON-Inhalt nicht lesbar.');}}
 const isTeam=name=>team.aliases.some(alias=>norm(alias)===norm(name)), gamesById=new Map();
 for(const object of objects(payload)){
  const home=txt(val(object,keys.home)),away=txt(val(object,keys.away));if(!home||!away||(!isTeam(home)&&!isTeam(away)))continue;
  const date=localDateTime(txt(val(object,keys.date)),txt(val(object,keys.time)));if(!date)continue;
  let score=txt(val(object,keys.score));const hg=val(object,keys.hg),ag=val(object,keys.ag);if((!score||!/\d+\s*[:\-]\s*\d+/.test(score))&&hg!=null&&ag!=null)score=hg+':'+ag;
  const hall=txt(val(object,keys.hall));const id=txt(val(object,keys.id))||createHash('sha256').update(norm(home)+'|'+norm(away)+'|'+stamp(date)).digest('hex').slice(0,24);
  if(!gamesById.has(id))gamesById.set(id,{id,home,away,date,score,hall,homeTeam:isTeam(home)});
 }
 const games=[...gamesById.values()].sort((a,b)=>Date.UTC(a.date.y,a.date.m-1,a.date.d,a.date.h??0,a.date.min??0)-Date.UTC(b.date.y,b.date.m-1,b.date.d,b.date.h??0,b.date.min??0));
 if(!games.length)throw new Error(team.label+': Keine Spiele erkannt; vorhandener Kalender wird nicht überschrieben.');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//KuGiS//Active Team Calendar//DE','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:KuGiS '+team.label,'X-WR-TIMEZONE:Europe/Berlin','REFRESH-INTERVAL;VALUE=DURATION:PT1H','X-PUBLISHED-TTL:PT1H','BEGIN:VTIMEZONE','TZID:Europe/Berlin','X-LIC-LOCATION:Europe/Berlin','BEGIN:DAYLIGHT','TZOFFSETFROM:+0100','TZOFFSETTO:+0200','TZNAME:CEST','DTSTART:19700329T020000','RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU','END:DAYLIGHT','BEGIN:STANDARD','TZOFFSETFROM:+0200','TZOFFSETTO:+0100','TZNAME:CET','DTSTART:19701025T030000','RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU','END:STANDARD','END:VTIMEZONE'];
 for(const game of games){
  const summary=game.homeTeam?'KuGiS '+team.label+' – '+game.away:game.home+' – KuGiS '+team.label;
  const description=[game.homeTeam?'Heimspiel KuGiS '+team.label:'Auswärtsspiel KuGiS '+team.label,game.score?'Ergebnis: '+game.score:'','Spielplan: '+team.portalUrl].filter(Boolean).join('\n');
  lines.push('BEGIN:VEVENT','UID:'+esc(game.id+'@kugis-'+team.uidSuffix),'DTSTAMP:'+now,'SUMMARY:'+esc(summary),'DTSTART;TZID=Europe/Berlin:'+stamp(game.date),'DTEND;TZID=Europe/Berlin:'+stamp(plusMinutes(game.date,config.eventDurationMinutes)),game.hall?'LOCATION:'+esc(game.hall):'','DESCRIPTION:'+esc(description),'URL:'+team.portalUrl,'STATUS:CONFIRMED','TRANSP:OPAQUE','END:VEVENT');
 }
 lines.push('END:VCALENDAR');
 await writeFile(new URL('../'+team.calendarFile,import.meta.url),lines.filter(Boolean).map(fold).join('\r\n')+'\r\n','utf8');
 console.log(team.label+': '+games.length+' Spiele in '+team.calendarFile);
}
