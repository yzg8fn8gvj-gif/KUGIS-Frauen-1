import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const config = JSON.parse(await readFile(new URL('../bulls/config.json', import.meta.url), 'utf8'));
const sourceUrl = new URL(config.sourceUrl || 'https://dvos.de/liga.php');
sourceUrl.searchParams.set('a_liga', String(config.leagueId));
const response = await fetch(sourceUrl, {
  headers: { 'User-Agent': 'TB-Gingen-Bulls-I-Kalender/1.0', Accept: 'text/html,application/xhtml+xml' },
  signal: AbortSignal.timeout(30000)
});
if (!response.ok) throw new Error('DVOS HTTP ' + response.status);
const html = await response.text();
if (!html || !/TB\s+Gingen\s+Bulls\s+I/i.test(html)) throw new Error('DVOS-Seite enthält nicht die erwartete Mannschaft.');

function decode(value) {
  return String(value ?? '')
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}
function clean(value) {
  return decode(String(value ?? '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|span|a|td|th)>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ').trim();
}
function rowsFrom(fragment) {
  const tableRows = [];
  for (const match of fragment.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const rowHtml = match[1];
    const cells = [];
    for (const cell of rowHtml.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)) cells.push(clean(cell[1]));
    tableRows.push({ html: rowHtml, cells, text: clean(rowHtml) });
  }
  if (tableRows.length) return tableRows;

  // DVOS renders this league with div.row / div.cell rather than HTML tables.
  const starts = [...fragment.matchAll(/<div\b(?=[^>]*\bclass\s*=\s*["'][^"']*\brow\b[^"']*["'])[^>]*>/gi)];
  const rows = [];
  for (let i = 0; i < starts.length; i++) {
    const begin = starts[i].index + starts[i][0].length;
    const end = i + 1 < starts.length ? starts[i + 1].index : fragment.length;
    const rowHtml = fragment.slice(begin, end);
    const cells = [];
    for (const cell of rowHtml.matchAll(/<div\b(?=[^>]*\bclass\s*=\s*["'][^"']*\bcell\b[^"']*["'])[^>]*>([\s\S]*?)<\/div>/gi)) {
      cells.push(clean(cell[1]));
    }
    if (cells.length) rows.push({ html: rowHtml, cells, text: clean(rowHtml) });
  }
  return rows;
}
function fixtureRowsFrom(fragment) {
  // Matchdays use DVOS if-row1/if-row2 wrappers and ifs-feld1/ifs-feld2 cells.
  const starts = [...fragment.matchAll(/<div\b(?=[^>]*\bclass\s*=\s*["'][^"']*\bif-row[12]\b[^"']*["'])[^>]*>/gi)];
  const rows = [];
  for (let i = 0; i < starts.length; i++) {
    const begin = starts[i].index + starts[i][0].length;
    const end = i + 1 < starts.length ? starts[i + 1].index : fragment.length;
    const rowHtml = fragment.slice(begin, end);
    const cells = [];
    for (const cell of rowHtml.matchAll(/<div\b(?=[^>]*\bclass\s*=\s*["'][^"']*\bifs-feld[12]\b[^"']*["'])[^>]*>([\s\S]*?)<\/div>/gi)) {
      cells.push(clean(cell[1]));
    }
    rows.push({ html: rowHtml, cells, text: clean(rowHtml) });
  }
  return rows;
}
function parseDate(text) {
  const s = String(text ?? '');
  let m = s.match(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})\b/);
  if (m) return m[3] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
  m = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  return m ? m[1] + '-' + m[2] + '-' + m[3] : null;
}
const romanEnd = /(?:VIII|VII|VI|V|IV|III|II|I|X)$/;
function isTeamName(value) {
  const s = String(value ?? '').replace(/\s+/g, ' ').trim();
  return s.length > 5 && romanEnd.test(s) && !/^spieltag/i.test(s) && !/^e\s*\d/i.test(s) && !/^d\s*\d/i.test(s);
}
function num(value) {
  const m = String(value ?? '').match(/^\s*(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}
function parseStandings(allTables) {
  const bestByTeam = new Map();
  for (const table of allTables) {
    for (const row of table) {
      const idx = row.cells.findIndex(isTeamName);
      if (idx < 1 || row.cells.length < idx + 4) continue;
      const before = row.cells.slice(0, idx).map(num).filter(v => v !== null);
      const after = row.cells.slice(idx + 1);
      const played = num(after[0]);
      const points = num(after[1]);
      if (played === null || points === null) continue;

      // DVOS visually splits a set score (e.g. 52 : 28) across divs.
      const setMatch = row.text.match(/\b(\d+)\s*:\s*(\d+)\b/);
      const numericAfter = after.slice(2).map(num).filter(v => v !== null);
      const setsFor = setMatch ? Number(setMatch[1]) : (numericAfter[0] ?? null);
      const setsAgainst = setMatch ? Number(setMatch[2]) : (numericAfter[1] ?? null);
      const statsStart = setMatch && numericAfter[0] === Number(setMatch[1]) ? 1 : 2;
      const stats = numericAfter.slice(statsStart);
      const item = {
        rank: before.length ? before[before.length - 1] : null,
        team: row.cells[idx],
        played,
        points,
        setsFor,
        setsAgainst,
        wins: stats.length > 0 ? stats[0] : null,
        draws: stats.length > 1 ? stats[1] : null,
        losses: stats.length > 2 ? stats[2] : null
      };
      const quality = [item.setsFor, item.setsAgainst, item.wins, item.draws, item.losses].filter(v => v !== null).length;
      const previous = bestByTeam.get(item.team);
      if (!previous || quality > previous.quality) bestByTeam.set(item.team, { item, quality });
    }
  }
  const rows = [...bestByTeam.values()].map(value => value.item);
  if (rows.length < 5 || !rows.some(row => row.team === config.teamName)) return [];
  return rows.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
}
function parseFixtures(allRows) {
  const fixtures = new Map();
  let currentRound = null;
  let currentDate = null;
  for (const row of allRows) {
    const roundMatch = row.text.match(/Spieltag\s*(\d+)/i);
    if (roundMatch) currentRound = Number(roundMatch[1]);
    const rowDate = parseDate(row.text);
    if (rowDate) currentDate = rowDate;
    const teams = row.cells.filter(isTeamName);
    if (teams.length < 2 || !currentDate) continue;
    const home = teams[0];
    const away = teams[teams.length - 1];
    if (home === away) continue;
    const scoreMatch = row.text.match(/\b(\d{1,2})\s*:\s*(\d{1,2})\b/);
    const hrefMatch = row.html.match(/href\s*=\s*["']([^"']*spielbericht\.php[^"']*)["']/i);
    const reportUrl = hrefMatch ? new URL(decode(hrefMatch[1]).replace(/&amp;/g, '&'), config.baseUrl).href : null;
    const idMatch = reportUrl ? reportUrl.match(/[?&]id=(\d+)/) : null;
    const stableKey = currentRound + '|' + home + '|' + away;
    const id = idMatch ? 'dvos-' + idMatch[1] : 'dvos-' + createHash('sha256').update(config.leagueId + '|' + stableKey).digest('hex').slice(0, 24);
    const game = {
      id,
      round: currentRound,
      date: currentDate,
      home,
      away,
      homeScore: scoreMatch ? Number(scoreMatch[1]) : null,
      awayScore: scoreMatch ? Number(scoreMatch[2]) : null,
      reportUrl
    };
    fixtures.set([game.date, game.home, game.away].join('|'), game);
  }
  return [...fixtures.values()].sort((a, b) => a.date.localeCompare(b.date));
}
const tableGroups = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map(match => rowsFrom(match[1]));
const layoutRows = rowsFrom(html);
const fixtureRows = fixtureRowsFrom(html);
const tables = tableGroups.length ? tableGroups : [layoutRows];
const standings = parseStandings(tables);
const matches = parseFixtures(fixtureRows);
if (!standings.length && !matches.length) {
  console.log('DVOS parser diagnostics:', JSON.stringify({
    htmlLength: html.length,
    divRows: allRows.length,
    parsedStandings: standings.length,
    parsedMatches: matches.length,
    teamNameFound: html.includes(config.teamName)
  }));
  throw new Error('DVOS-Seite wurde geladen, aber Tabelle und Spielplan konnten nicht erkannt werden. Vorhandene Daten bleiben erhalten.');
}
if (standings.length && !standings.some(row => row.team === config.teamName)) {
  throw new Error('Die erwartete Mannschaft fehlt in der erkannten Tabelle. Vorhandene Daten bleiben erhalten.');
}

const now = new Date();
const teamMatches = matches.filter(game => game.home === config.teamName || game.away === config.teamName);
if (!teamMatches.length) throw new Error('Keine Spiele der Bulls I erkannt. Vorhandener Kalender bleibt erhalten.');

const data = {
  meta: {
    teamName: config.teamName,
    leagueName: config.leagueName,
    season: config.season,
    leagueId: config.leagueId,
    sourceUrl: sourceUrl.href,
    updatedAt: now.toISOString(),
    updateFrequencyHours: 1,
    calendarNote: 'Die DVOS-Spielplanansicht veröffentlicht kein Spielbeginn-Uhrzeitfeld. Kalendertermine werden deshalb als Ganztagstermine geführt.'
  },
  standings,
  matches
};
await writeFile(new URL('../bulls/data.json', import.meta.url), JSON.stringify(data, null, 2) + '\n', 'utf8');

const pad = n => String(n).padStart(2, '0');
const dateStamp = iso => iso.replace(/-/g, '');
const esc = value => String(value ?? '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
function fold(line) {
  let out = '';
  let part = '';
  for (const ch of line) {
    if (Buffer.byteLength(part + ch) > 70) { out += part + '\r\n'; part = ' ' + ch; }
    else part += ch;
  }
  return out + part;
}
const dtstamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const nextDay = iso => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
const lines = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//TB Gingen Bulls//Mannschaft I Match Calendar//DE',
  'CALSCALE:GREGORIAN',
  'METHOD:PUBLISH',
  'X-WR-CALNAME:TB Gingen Bulls I',
  'X-WR-TIMEZONE:Europe/Berlin',
  'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
  'X-PUBLISHED-TTL:PT1H',
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Berlin',
  'X-LIC-LOCATION:Europe/Berlin',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE'
];
for (const game of teamMatches) {
  const homeGame = game.home === config.teamName;
  const opponent = homeGame ? game.away : game.home;
  const title = homeGame ? config.teamName + ' – ' + opponent : opponent + ' – ' + config.teamName;
  const score = game.homeScore === null || game.awayScore === null ? '' : 'Ergebnis: ' + game.homeScore + ':' + game.awayScore;
  const details = [
    homeGame ? 'Heimspiel' : 'Auswärtsspiel',
    game.round ? 'Spieltag ' + game.round : '',
    score,
    'Uhrzeit: von der DVOS-Quelle nicht veröffentlicht; Termin daher ganztägig',
    'Quelle: ' + sourceUrl.href
  ].filter(Boolean).join('\n');
  const eventUrl = game.reportUrl || sourceUrl.href;
  lines.push(
    'BEGIN:VEVENT',
    'UID:' + esc(game.id + '@tbgingenbulls1'),
    'DTSTAMP:' + dtstamp,
    'SUMMARY:' + esc(title),
    'DTSTART;VALUE=DATE:' + dateStamp(game.date),
    'DTEND;VALUE=DATE:' + dateStamp(nextDay(game.date)),
    'DESCRIPTION:' + esc(details),
    'URL:' + eventUrl,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT'
  );
}
lines.push('END:VCALENDAR');
await writeFile(new URL('../bulls/calendar.ics', import.meta.url), lines.map(fold).join('\r\n') + '\r\n', 'utf8');
console.log('Bulls-I-Daten aktualisiert: ' + standings.length + ' Tabellenzeilen, ' + matches.length + ' Spiele, ' + teamMatches.length + ' Kalendertermine.');
