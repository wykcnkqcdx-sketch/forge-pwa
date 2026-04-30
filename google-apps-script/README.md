# FORGE Google Sheets Receiver

This folder contains a ready-to-paste Google Apps Script receiver for the FORGE coach export flow.

## What it does

It accepts the JSON payload sent from the FORGE Coach dashboard and writes raw tabs into Google Sheets:

- `Meta`
- `Dashboard`
- `Weekly Rollups`
- `Member Drilldown`
- `Volume Trends`
- `Readiness Trends`
- `Compliance`
- `Members`
- `Groups`
- `Sessions`
- `Assignments`
- `Completions`
- `Readiness`
- `Programme Templates`

Each export replaces the raw sheet contents so the workbook stays current, then rebuilds the dashboard tabs and charts.

## Setup

1. Open a Google Sheet that will act as the coach reporting workbook.
2. Go to `Extensions -> Apps Script`.
3. Replace the default script with the contents of [Code.gs](./Code.gs).
4. Save the project.
5. Strong recommendation: set `FORGE_CONFIG.spreadsheetId` to the exact Google Sheet you want FORGE to update.
6. If you leave `spreadsheetId` blank, the script writes to the bound spreadsheet.
7. To get the spreadsheet ID, copy the long ID from the Google Sheet URL:

```text
https://docs.google.com/spreadsheets/d/SPREADSSHEET_ID/edit
```

8. Click `Deploy -> New deployment`.
9. Choose `Web app`.
10. Set:
   - `Execute as`: `Me`
   - `Who has access`: `Anyone`
11. Deploy and copy the web app URL.
12. Paste that URL into `Coach -> Google Sheets Export` in FORGE.

## Quick test

Before connecting FORGE, open the web app URL in a browser.

You should get a JSON response showing:

- `service`
- `spreadsheetId`
- `spreadsheetUrl`
- `expectedTabs`

That confirms the receiver is live.

Also check the `Meta` tab in the target workbook. It should now show a visible status block even before the first FORGE export lands.

## How the sheet is written

- `Meta` is overwritten each export with timestamps and coach email.
- Each raw tab is cleared and rewritten.
- Headers are rebuilt from the payload keys.
- Filters and frozen headers are added automatically.

## What the dashboard tabs do

After each export, the script also rebuilds:

- `Dashboard`
  - export meta
  - member / assignment / completion / readiness counts
  - last 7 / 30 day summary blocks
  - red flag list
  - risk distribution chart
  - completions by member chart
  - volume by group chart
- `Weekly Rollups`
  - weekly completion volume and minutes
  - weekly readiness averages
- `Member Drilldown`
  - choose a member
  - inspect recent completions
  - inspect recent readiness history
- `Volume Trends`
  - total volume, minutes, and sessions by member
- `Readiness Trends`
  - average sleep, soreness, and pain by member
- `Compliance`
  - effort distribution
  - session kind distribution

## Notes

- This receiver now handles both raw tab writing and a first dashboard layer.
- If you want more polished coach reporting later, extend the dashboard tabs rather than changing the app payload.
