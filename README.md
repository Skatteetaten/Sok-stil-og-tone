# Søk i Stil og Tone

Dette prosjektet er en dedikert søkeside for Skatteetatens "Stil og tone" og designsystem. Den indekserer innhold fra `stilogtone.no` og Storybook-komponenter for å gi en samlet søkeopplevelse.

## Teknologier

*   [Docusaurus](https://docusaurus.io/) - Statisk sidegenerator
*   [React](https://reactjs.org/) - Frontend-bibliotek
*   [Skatteetaten Designsystem](https://www.skatteetaten.no/stilogtone/designsystemet/) - Styling og komponenter

## Komme i gang

### 1. Installer avhengigheter

```bash
npm install
```

### 2. Bygg søkeindeksen

Før du starter serveren, må du generere søkeindeksen. Dette skriptet crawler `stilogtone.no` og henter komponentnavn fra Storybook.

```bash
npm run build:search-index
```

### 3. Start lokal utviklingsserver

```bash
npm start
```

Dette starter serveren på `http://localhost:3000`.

## Bygg for produksjon

For å bygge en statisk versjon av siden:

```bash
npm run build
```

Filene genereres i `build`-mappen.

## Prosjektstruktur

*   `src/pages/index.tsx`: Hovedsiden med søkefunksjonalitet og UI.
*   `scripts/build-search-index.js`: Skript som genererer `static/search-index.json`.
*   `src/css/custom.css`: Tilpasset CSS og import av Skatteetatens designsystem.
*   `docusaurus.config.ts`: Konfigurasjon for Docusaurus.
