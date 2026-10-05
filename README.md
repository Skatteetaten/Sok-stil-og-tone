# Søk i Skattekartet

Dette prosjektet er en dedikert søkeside for Skatteetatens Skattekartet og designsystem. Den indekserer innhold fra Skattekartet (skatteetaten.no/skattekartet), dokumentasjonen for designsystemet og Storybook for å gi en samlet søkeopplevelse.

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

Før du starter serveren, må du generere søkeindeksen. Dette skriptet crawler Skattekartet, leser dokumentasjonen for designsystemet fra GitHub og henter dokumentasjonssidene fra Storybook. Bruk `npm run build:search-index -- --force` for å bygge på nytt selv om indeksen er under 7 dager gammel.

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
