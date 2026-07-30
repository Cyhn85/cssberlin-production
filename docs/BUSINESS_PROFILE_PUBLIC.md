# Business Profile (Public Safe)

## Public business facts

- Business / trade name: CSS Berlin
- Operator / owner: Ceyhun Sabahattin Sorguc
- Address: Am Omnibushof 12, 13593 Berlin, Deutschland
- Public phone: +49 163 263 4020
- Public website: https://cssberlin.de
- Public contact inbox: info@cssberlin.de
- USt-IdNr: DE459278750
- Trade activity: Onlinehandel mit gebrauchter Bekleidung und Gebrauchsartikeln sowie Verkauf auf Flohmaerkten und mobilen Staenden
- Trade registration context: Berlin Spandau
- Trade start in records: 2025-11-01

## Where this appears on the site

- Footer: public email, phone and street-level location
- `/impressum`: operator name, address, phone, email, website, USt-IdNr and business activity
- `/datenschutz`: responsible party, address, phone, email and summary of processors/data flows
- `/dac7`: public legal contact channel for seller reporting questions

## Public trust rules

- `USt-IdNr` is public-safe and belongs on the legal surface.
- `Steuernummer` is not public-safe and must never appear on public pages.
- If the public contact email changes, update `src/config/business-profile.ts` first.
- If the legal entity, address or VAT treatment changes, update this document and the legal pages in the same workstream.

## Tax treatment note for internal decision makers

- The old `22.000 EUR` small-business threshold is outdated.
- According to Germany-wide rules in effect since 1 January 2025, `Paragraph 19 UStG` uses `25.000 EUR` previous-year revenue and `100.000 EUR` current-year revenue as key thresholds for the Kleinunternehmerregelung.
- This is not Berlin-specific.
- CSS Berlin also has VAT-related registrations on file, so no public copy should casually claim that the business is exempt from VAT without confirming the actual chosen tax treatment.

## Official reference points

- DDG provider identification: https://www.gesetze-im-internet.de/ddg/__5.html
- UStG Paragraph 19: https://www.gesetze-im-internet.de/ustg_1980/__19.html
- USt-IdNr basis: https://www.gesetze-im-internet.de/ustg_1980/__27a.html
