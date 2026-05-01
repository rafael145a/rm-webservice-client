# Changelog

Todas as mudanças notáveis neste projeto serão documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/) e a partir
da `1.0.0` o projeto adota [SemVer](https://semver.org/lang/pt-BR/) — quebras
de API só em major.

## [1.0.0] — 2026-05-01

### Promoted

- `saveRecord`, `deleteRecord`, `deleteRecordByKey`, `readLookupView` e o
  builder (`buildRecord`, `validateRecord`, `RmValidationError`) saíram do
  status **experimental**. A API é estável a partir desta versão e segue
  SemVer estrito.

### Added

- `test/api-surface.test.ts` — lock compile-time da API pública (entry
  principal + subpath `/catalog`). Catch automático de breaking changes
  acidentais em PRs futuros.
- `CHANGELOG.md` (este arquivo).
- Seção **Versionamento** no README declarando política de SemVer.

### Test plan executado

- 408 testes (todos verdes, 100% cobertura preservada).
- Smoke real cumulativo confirmando o ciclo SaveRecord → DeleteRecordByKey
  via builder funciona contra TOTVS RM Cloud.
- `tsc --noEmit --strict` em todos os 9 examples.

## [0.6.0] — 2026-05-01

### Added — Builder de XML

- `buildRecord(schema, fields)` puro (`src/schema/build-record.ts`):
  monta `<NewDataSet><Row>...</Row></NewDataSet>` com validação default-strict
  e coerção de tipos (Date → ISO 8601, boolean → `"1"`/`"0"`, `null` → `<Campo/>`,
  `undefined` omitido).
- `rm.dataServer.buildRecord(name, fields)` runtime — busca + cacheia schema
  por DataServerName e delega ao builder puro.
- `saveRecord({ fields })` — atalho que monta XML automaticamente; mutex
  com `xml`. Validação **antes** da chamada ao RM.
- `validateRecord(row, fields)` público para feedback sem exception.
- `RmValidationError` com `issues[]` completo (não para no 1º problema):
  `unknown` / `required` / `type` / `maxLength`.
- CLI `rmws build-record` com `--fields-json` / `--fields-file` / `--row` /
  `--out` / `--bypass-validation` / `--allow-unknown`.
- Exit code `7` = `RmValidationError` na CLI.

## [0.5.0] — 2026-05-01

### Added — Tipagem experimental

- `parseXsdSchema(xsd)` — parser do XSD inline retornado por `GetSchema`,
  produzindo `RmDataServerSchema { datasetName, rows: [{ name, fields[] }] }`.
- `generateTypes(schema, opts?)` — gera código TS determinístico com
  `interface` por row + interface agregadora, JSDoc com `Caption` (PT-BR),
  `@xsdType`, `@maxLength`, `@default`.
- `rm.dataServer.getSchemaParsed(opts)` — `getSchema` + `parseXsdSchema`.
- CLI `rmws generate-types <name> --out <path> [--context]`.
- Smoke real: 1020 linhas geradas a partir de `RhuPessoaData` reais,
  `tsc --strict` compila o output.

## [0.4.0] — 2026-05-01

### Added — DeleteRecord, DeleteRecordByKey, ReadLookupView

- `rm.dataServer.deleteRecord(opts)` e `deleteRecordByKey(opts)` —
  destrutivos, com mesmo contrato de `saveRecord`.
- `rm.dataServer.readLookupView<T>(opts)` — leitura tipo `readView` com
  parâmetro extra `ownerData`.
- `parseMode: "result-strict"` em `saveRecord`/`deleteRecord*`: detecta
  erros embutidos no Result e lança `RmResultError`.
- `detectRmResultError()` / `assertRmResultOk()` — helpers públicos.
- `RmResultError` com `summary` + `sql?` + `stack?` + `raw`.
- CLI: `rmws delete-record`, `rmws delete-record-by-key`, `rmws read-lookup-view`.
- Exit code `6` = `RmResultError`.
- Smoke real fechando o ciclo: `saveRecord` cria PK 26620, `deleteRecordByKey` apaga.

## [0.3.1] — 2026-05-01

### Added — Catálogo TOTVS embutido

- `src/catalog/dataservers.json` (290KB, opt-in via subpath) com 2.537
  DataServers do índice oficial TOTVS, em 33 módulos.
- Subpath export `rm-webservice-client/catalog`: `KNOWN_DATASERVERS`,
  `KNOWN_MODULES`, `findDataServer`, `searchDataServers`, `CATALOG_META`.
- `DataServerNameInput = KnownDataServerName | (string & {})` —
  autocomplete dos 2.537 nomes mantendo aceitação de strings custom.
  Custo runtime zero (só tipos).
- CLI `rmws catalog --module/--search/--released/--limit/--modules/--json`.
- `npm run build:catalog` regenera `dataservers.json` + `known-names.ts`.

## [0.3.0] — 2026-04-30

### Added — SaveRecord experimental

- `rm.dataServer.saveRecord({ dataServerName, xml, context, parseMode? })` —
  envio de XML cru pra `SaveRecord` do TOTVS RM. Marcado **experimental**
  (promovido a stable na 1.0).
- Tipos `SaveRecordOptions` + `ParseModeSaveRecord`.
- CLI `rmws save-record <name> --xml/--xml-file/--context`.
- Aviso forte no README: erros embutidos no Result com HTTP 200 (não SOAP Fault).

## [0.2.1] — 2026-04-30

### Added

- Cache de WSDL em disco (opt-in via lib, ligado por padrão na CLI).
- `WsdlCacheOptions { enabled, ttlMs?, dir? }`.
- Flags CLI: `--no-wsdl-cache`, `--wsdl-cache-ttl`, `--wsdl-cache-dir`.
- Env: `RM_WSDL_CACHE`, `RM_WSDL_CACHE_TTL_MS`, `RM_WSDL_CACHE_DIR`.

### Changed

- 100% de cobertura de testes alcançado e mantido.

## [0.2.0] — 2026-04-29

### Added — Diagnóstico e DX

- `rm.diagnostics.{ checkDataServer, checkConsultaSql, authenticate }`.
- CLI `rmws diagnose [target]` (`dataserver`, `sql`, `auth`, `all`).
- Logger opcional com `redactString` / `redactHeaders` automáticos
  (Authorization, cookies, padrões `password=`/`senha=`/`token=`).
- `LogLevel`, `RmLogger`, `createConsoleLogger`, `NOOP_LOGGER`.

## [0.1.0] — 2026-04-28

### Added — Primeira release pública

- `rm.dataServer.{ readView, readRecord, getSchema, isValidDataServer }`.
- `rm.consultaSql.{ query, queryWithContext }`.
- `parseMode: "raw" | "dataset" | "records" | "record"`.
- WSDL-aware: descobre endpoint, SOAPAction e operações automaticamente.
- Basic Auth e Bearer (estático/dinâmico).
- Hierarquia de erros: `RmError` → `RmConfigError`, `RmHttpError`,
  `RmSoapFaultError`, `RmParseError`, `RmTimeoutError`.
- CLI `rmws inspect/read-view/sql`.

[1.0.0]: https://github.com/rafael145a/rm-webservice-client/releases/tag/v1.0.0
[0.6.0]: https://github.com/rafael145a/rm-webservice-client/releases/tag/v0.6.0
[0.5.0]: https://github.com/rafael145a/rm-webservice-client/releases/tag/v0.5.0
[0.4.0]: https://github.com/rafael145a/rm-webservice-client/releases/tag/v0.4.0
[0.3.1]: https://github.com/rafael145a/rm-webservice-client/releases/tag/v0.3.1
[0.3.0]: https://github.com/rafael145a/rm-webservice-client/releases/tag/v0.3.0
[0.2.1]: https://github.com/rafael145a/rm-webservice-client/releases/tag/v0.2.1
[0.2.0]: https://github.com/rafael145a/rm-webservice-client/releases/tag/v0.2.0
[0.1.0]: https://github.com/rafael145a/rm-webservice-client/releases/tag/v0.1.0
