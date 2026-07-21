## Summary

- Replaced the embedded PDF-style report preview with an integrated HTML-first report view.
- Added a view toggle with `HTML` as the default option and `Modified format` as the alternate layout.
- Kept the PDF download action available as a separate button.
- Removed PDF viewer controls from the embedded report experience, including zoom, pagination, and percentage display.
- Added responsive styling so the report content adapts better across screen sizes.
- Added test coverage for the default HTML view, the modified-format toggle, and the absence of PDF viewer controls.

## Validation

- `npm run test:unit -- --run __tests__/MunicipalReportPreview.test.tsx`
- `npm run test:unit -- --run __tests__/ReportMapPreview.test.tsx __tests__/MunicipalReportPreview.test.tsx`
- `npm run lint -- src/components/MunicipalReport/MunicipalReportPreview.tsx __tests__/MunicipalReportPreview.test.tsx src/app/globals.css src/translations/pt/MunicipalReport.json src/translations/en/MunicipalReport.json src/translations/es/MunicipalReport.json`

## Notes

- Lint passes with existing warnings for ignored non-JS files and the current `<img>` usage in report chart rendering.
