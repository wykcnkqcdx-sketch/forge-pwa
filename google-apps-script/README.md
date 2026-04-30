# FORGE Google Sheets Receiver

This folder contains a ready-to-paste Google Apps Script receiver for the FORGE coach export flow.

## What it does

It accepts the JSON payload sent from the FORGE Coach dashboard and writes raw tabs into Google Sheets:

- `Meta`
- `Members`
- `Groups`
- `Sessions`
- `Assignments`
- `Completions`
- `Readiness`
- `Programme Templates`

Each export replaces the raw sheet contents so the workbook stays current.

## Setup

1. Open a Google Sheet that will act as the coach reporting workbook.
2. Go to `Extensions -> Apps Script`.
3. Replace the default script with the contents of [Code.gs](./Code.gs).
4. Save the project.
5. If you want the script to write to a different spreadsheet, set `FORGE_CONFIG.spreadsheetId`.
6. Click `Deploy -> New deployment`.
7. Choose `Web app`.
8. Set:
   - `Execute as`: `Me`
   - `Who has access`: `Anyone`
9. Deploy and copy the web app URL.
10. Paste that URL into `Coach -> Google Sheets Export` in FORGE.

## Quick test

Before connecting FORGE, open the web app URL in a browser.

You should get a JSON response showing:

- `service`
- `spreadsheetId`
- `spreadsheetUrl`
- `expectedTabs`

That confirms the receiver is live.

## How the sheet is written

- `Meta` is overwritten each export with timestamps and coach email.
- Each raw tab is cleared and rewritten.
- Headers are rebuilt from the payload keys.
- Filters and frozen headers are added automatically.

## Recommended next dashboard layer

After raw tabs are flowing, build charts in separate sheets such as:

- `Dashboard`
- `Volume Trends`
- `Readiness Trends`
- `Compliance`

Those chart sheets should reference the raw tabs rather than being overwritten by Apps Script.

## Notes

- This is a Phase 1 receiver. It focuses on clean raw data, not chart creation.
- If you later want automatic dashboard tabs and charts, extend this script rather than changing the app payload.
