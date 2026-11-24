# KuGiS Handball – Web-App

iPhone-freundliche Web-App für die fünf aktiven Mannschaften der KuGiS: Frauen 1, Frauen 2, Männer 1, Männer 2 und Männer 3. Jugendmannschaften sind nicht enthalten.

## Mannschaftswechsel
Die Auswahl oben in der App lädt für jedes Team die eigene Handball4all-Liga. Die Zuordnungen und Liga-IDs liegen zentral in `calendar-config.json`.

Für einen Saisonwechsel werden dort die `leagueId`-Werte der fünf Mannschaften aktualisiert. Die App und die Kalender-Abonnement-Adressen bleiben bestehen.

## Kalender-Abos
Jede aktive Mannschaft hat einen eigenen, dauerhaft gleichbleibenden iCalendar-Feed:
- Frauen 1: `calendar.ics`
- Frauen 2: `calendar-frauen2.ics`
- Männer 1: `calendar-maenner1.ics`
- Männer 2: `calendar-maenner2.ics`
- Männer 3: `calendar-maenner3.ics`

GitHub Actions aktualisiert die Feeds stündlich aus Handball4all. Der Spielplan wird zusätzlich beim Öffnen der App aktualisiert.

## Veröffentlichung
Die Website wird über GitHub Pages und den Workflow unter `.github/workflows/deploy.yml` veröffentlicht:
https://yzg8fn8gvj-gif.github.io/KUGIS-Frauen-1/

## Datenquelle
Verband (ogId): 216  
API: https://spo.handball4all.de/service/if_g_json.php

Die Handball4all-Schnittstelle ist nicht offiziell dokumentiert und kann sich ändern. Die App zeigt nur tatsächlich gelieferte Daten.
