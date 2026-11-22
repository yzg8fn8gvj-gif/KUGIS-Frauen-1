# KuGiS Frauen 1 – Web-App

Eigene iPhone-freundliche Web-App für Tabelle, Ergebnisse, Spielplan und Live-Center.

## Offizielle Liga
- Verband (ogId): 216
- Liga (lId): 162286
- Quelle: Handball4all
- JSON-Endpunkt: https://spo.handball4all.de/service/if_g_json.php
- Abfrageparameter: cmd=ps, og=216, cl=162286, ca=0, do=YYYY-MM-DD

## Veröffentlichung
Der Workflow unter .github/workflows/deploy.yml veröffentlicht den Repository-Inhalt mit GitHub Pages. In **Settings → Pages** muss als Build-Quelle **GitHub Actions** ausgewählt sein, falls GitHub Pages nicht bereits so eingerichtet wurde.
Nach erfolgreichem Lauf lautet die Adresse normalerweise:
https://yzg8fn8gvj-gif.github.io/KUGIS-Frauen-1/

## Datenverbindung
Die App versucht den direkten Handball4all-Abruf und danach einen öffentlichen Fallback. Falls der Browser den Abruf wegen CORS blockiert, kann der optionale worker.js als Cloudflare Worker bereitgestellt werden. Seine URL kann anschließend in den App-Einstellungen eingetragen werden.

## Grenzen
Die Handball4all-Schnittstelle ist inoffiziell dokumentiert und kann sich ändern. Es werden nur echte gelieferte Daten angezeigt. Torschützinnen und Live-Ticker erscheinen nur, wenn die Quelle die entsprechenden Informationen für diese Liga bzw. Partie veröffentlicht. Die Liga-ID stammt aus dem vom Nutzer bereitgestellten offiziellen Ligalink.
