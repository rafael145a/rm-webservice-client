# rm-webservice-client

Cliente TypeScript não oficial para consumir WebServices SOAP do TOTVS RM
(`wsDataServer` e `wsConsultaSQL`), abstraindo WSDL, SOAPAction, envelopes
XML, contexto, parâmetros, CDATA e parsing de DataSets.

> Este projeto não é oficial da TOTVS. TOTVS RM é marca de seus respectivos
> proprietários. Use em ambiente de homologação antes de produção.

## Recursos

- WSDL-aware: lê o WSDL para descobrir endpoint, SOAPAction e operações
- API tipada para `ReadView`, `ReadRecord`, `ReadLookupView`, `GetSchema`,
  `GetSchemaParsed`, `IsValidDataServer`, `SaveRecord`, `DeleteRecord`,
  `DeleteRecordByKey`, `RealizarConsultaSQL`, `RealizarConsultaSQLContexto`
- **Builder** de XML: `saveRecord({ fields })` /
  `dataServer.buildRecord(name, fields)` valida campos contra o schema
  do DataServer e monta o `<NewDataSet>` automaticamente. Erros
  client-side viram `RmValidationError` antes mesmo de chamar o RM
- `parseMode: "result-strict"` em `saveRecord`/`deleteRecord*` detecta
  erros embutidos no Result e lança `RmResultError`
- Basic Auth e Bearer Auth manual
- `parseMode: "raw"` em todos os métodos para inspeção/escape hatch
- Hierarquia de erros tipados (HTTP, SOAP Fault, parse, config, timeout)
- `rm.diagnostics.*` — checagens estruturadas (WSDL, auth, smoke query)
- Logger opcional com redaction automática de credenciais
- Cache de WSDL em disco (opt-in na lib, ligado por padrão na CLI)
- CLI `rmws` com subcomandos `inspect`, `read-view`, `read-lookup-view`,
  `build-record`, `save-record`, `delete-record`, `delete-record-by-key`,
  `generate-types`, `sql`, `diagnose` e `catalog`
- Geração de tipos TypeScript a partir do `GetSchema` do RM
  (`rmws generate-types` ou `generateTypes(parseXsdSchema(xsd))`)
- Catálogo embutido com 2.537 DataServers do RM (todos os módulos), opt-in via
  `import "rm-webservice-client/catalog"`
- Sem dependências SOAP pesadas — apenas `fast-xml-parser` e `cac`
- Funciona com `fetch` nativo do Node 18+

## Instalação

```bash
npm install rm-webservice-client
```

## Quick start

```ts
import { createRmClient } from "rm-webservice-client";

const rm = createRmClient({
  services: {
    dataServer: { wsdlUrl: process.env.RM_DATASERVER_WSDL! },
    consultaSql: { wsdlUrl: process.env.RM_CONSULTASQL_WSDL! },
  },
  auth: {
    type: "basic",
    username: process.env.RM_USER!,
    password: process.env.RM_PASSWORD!,
  },
  defaults: {
    context: { CODSISTEMA: "G", CODCOLIGADA: 1, CODUSUARIO: "mestre" },
  },
});

interface Usuario {
  CODUSUARIO: string;
  NOME: string;
}

const usuarios = await rm.dataServer.readView<Usuario>({
  dataServerName: "GlbUsuarioData",
  filter: "CODUSUARIO = 'mestre'",
});
```

## Autenticação

### Basic

```ts
auth: { type: "basic", username: "u", password: "p" }
```

A codificação é UTF-8 — senhas com acentos preservam os bytes corretamente.

### Bearer (token estático)

```ts
auth: { type: "bearer", token: process.env.RM_TOKEN! }
```

### Bearer (token dinâmico)

```ts
auth: {
  type: "bearer",
  getToken: async () => fetchToken(),
}
```

`getToken` é chamado **a cada request**. Se você precisa de cache/refresh,
implemente do lado de fora.

## DataServer

### `readView<T>(opts): Promise<T[]>`

```ts
const usuarios = await rm.dataServer.readView<Usuario>({
  dataServerName: "GlbUsuarioData",
  filter: "CODUSUARIO = 'mestre'",
  context: { CODCOLIGADA: 1, CODSISTEMA: "G" }, // opcional, usa defaults
  parseMode: "records", // padrão; "raw" retorna XML; "dataset" retorna XML interno
});
```

Sempre retorna array (`[]` quando vazio). Tipagem genérica é apenas hint —
o RM retorna strings, não há coerção automática.

> **Filtro costuma ser obrigatório.** Vários DataServers do RM lançam
> `RM_SOAP_FAULT: Erro ao executar readview Filtro invalido` quando `filter`
> é omitido. Em caso de dúvida, mande sempre um filtro mínimo
> (ex.: `"CODCOLIGADA = 1"`).

### `readRecord<T>(opts): Promise<T | null>`

```ts
const u = await rm.dataServer.readRecord<Usuario>({
  dataServerName: "GlbUsuarioData",
  primaryKey: "mestre",            // ou ["1", "abc"] para chave composta
});
```

Retorna `null` quando o RM devolve `<NewDataSet/>` vazio.

### `getSchemaParsed(opts): Promise<RmDataServerSchema>`

Conveniência que retorna o XSD do `getSchema` já parseado em estrutura
tipada — pronto pro `generateTypes` ou pra introspecção runtime
(builder na 0.6.0):

```ts
const schema = await rm.dataServer.getSchemaParsed({
  dataServerName: "RhuPessoaData",
  context: { CODCOLIGADA: 1, CODSISTEMA: "G", CODUSUARIO: "mestre" },
});

// schema.datasetName: "RhuPessoa"
// schema.rows: [{ name: "PPessoa", fields: [...] }, ...]

for (const row of schema.rows) {
  for (const field of row.fields) {
    console.log(field.name, field.tsType, field.optional ? "?" : "!");
  }
}
```

> ⚠️ **O XSD mente em alguns casos.** Validações custom no `.NET`
> (ex.: `RhuPessoaData` exige `CEP`/`DTNASCIMENTO`/`ESTADONATAL` mesmo
> com `minOccurs="0"`) **não** aparecem no schema. Use o resultado
> como guia de DX, não como contrato — a verdade definitiva é o
> próprio `saveRecord` em `parseMode: "result-strict"`.

### `getSchema(opts): Promise<string>`

```ts
const xsd = await rm.dataServer.getSchema({ dataServerName: "GlbUsuarioData" });
```

### `isValidDataServer(opts): Promise<boolean>`

```ts
const ok = await rm.dataServer.isValidDataServer({
  dataServerName: "GlbUsuarioData",
});
```

### Builder de XML (0.6.0)

A 0.6.0 adicionou um caminho de alto nível pra `SaveRecord` /
`DeleteRecord` em cima do schema parseado: você passa `fields` tipados,
a lib busca o schema (cacheado por DataServerName), valida campos
contra ele e monta o `<NewDataSet>` automaticamente.

```ts
import { RmValidationError, RmResultError } from "rm-webservice-client";

try {
  const pk = await rm.dataServer.saveRecord({
    dataServerName: "RhuPessoaData",
    fields: {
      CODIGO: -1, // -1 = autoincrement
      NOME: "Fulano",
      CEP: "00000-000",
      DTNASCIMENTO: new Date("2000-01-01"),
      ESTADO: "SP",
      ESTADONATAL: "SP",
      NATURALIDADE: "São Paulo",
    },
    parseMode: "result-strict",
  });
  console.log("PK gerado:", pk);
} catch (err) {
  if (err instanceof RmValidationError) {
    // Erro CLIENT-SIDE: ainda nem chamou o RM
    for (const issue of err.issues) {
      console.error(`${issue.field}: ${issue.kind} (${issue.expected ?? ""} got ${issue.got ?? ""})`);
    }
  } else if (err instanceof RmResultError) {
    // RM rejeitou por regra de negócio (FK, validador custom .NET)
    console.error("RM rejeitou:", err.summary);
  }
  throw err;
}
```

Coerção automática de tipos:

| Valor passado | Comportamento |
|---------------|---------------|
| `Date` | Convertido pra ISO 8601 (`toISOString()`) |
| `boolean` | `true → "1"`, `false → "0"` (convenção TOTVS) |
| `number` | `String(n)` |
| `null` | Emite `<Campo/>` (vazio explícito — usar pra resetar) |
| `undefined` | Omite o elemento (campo não enviado) |

Validação default-strict cobre 4 casos:

- **`unknown`** — campo presente em `fields` mas não no schema
- **`required`** — campo `minOccurs!="0"` ausente
- **`type`** — valor não bate com `xsdType` (ex.: string num campo `xs:int`)
- **`maxLength`** — string excedeu `xs:maxLength`

> ⚠️ **O XSD mente em alguns casos.** Validações custom no `.NET`
> (ex.: `RhuPessoaData` exige `CEP`/`ESTADONATAL` mesmo com
> `minOccurs="0"`) **não** aparecem no schema. O builder passa esses
> campos opcionais sem reclamar — se faltarem, o RM volta com
> `RmResultError` quando você usa `parseMode: "result-strict"`.

#### Standalone — só montar XML

Pra inspecionar / colar em outra ferramenta, sem efeito de SaveRecord:

```ts
const xml = await rm.dataServer.buildRecord("RhuPessoaData", {
  CODIGO: -1,
  NOME: "X",
});
// xml === "<NewDataSet><PPessoa><CODIGO>-1</CODIGO><NOME>X</NOME></PPessoa></NewDataSet>"
```

Versão pura (sem fetch de schema, útil em build-time):

```ts
import { buildRecord, parseXsdSchema } from "rm-webservice-client";

const schema = parseXsdSchema(await readFile("rhu-pessoa.xsd", "utf8"));
const xml = buildRecord(schema, { CODIGO: -1, NOME: "X" });
```

#### Múltiplas rows de uma vez

```ts
await rm.dataServer.saveRecord({
  dataServerName: "GlbUsuarioData",
  fields: [
    { CODUSUARIO: "u1", DATAINICIO: "2026-01-01T00:00:00", CODACESSO: "x", IGNORARAUTENTICACAOLDAP: "T" },
    { CODUSUARIO: "u2", DATAINICIO: "2026-01-01T00:00:00", CODACESSO: "y", IGNORARAUTENTICACAOLDAP: "T" },
  ],
  parseMode: "result-strict",
});
```

#### `validateRecord` standalone

Pra validar fields antes de gravar (ex.: feedback em formulário):

```ts
import { validateRecord } from "rm-webservice-client";

const issues = validateRecord(schema.rows[0]!, formValues);
if (issues.length > 0) {
  // mostra erros sem lançar
}
```

### `saveRecord(opts): Promise<string>`

> ⚠️ **Operação destrutiva.** Grava dados no RM. Sempre teste em
> homologação antes de produção.

A partir da 0.6.0 você pode passar `fields` em vez de `xml` cru — a lib
busca o schema, valida e monta o `<NewDataSet>` automaticamente (veja
seção [Builder de XML](#builder-de-xml-060) acima). O modo cru continua
suportado pra usos avançados / debug.

```ts
const xml = `<NewDataSet>
  <GUsuario>
    <CODUSUARIO>novo</CODUSUARIO>
    <NOME>Fulano de Tal</NOME>
    <ATIVO>1</ATIVO>
  </GUsuario>
</NewDataSet>`;

const primaryKey = await rm.dataServer.saveRecord({
  dataServerName: "GlbUsuarioData",
  xml,
  context: { CODCOLIGADA: 1, CODSISTEMA: "G", CODUSUARIO: "mestre" },
});
// primaryKey: "1;novo"  (formato depende do DataServer)
```

Retorno: o conteúdo de `<SaveRecordResult>` como string. Para
DataServers com chave única costuma ser `"1;CHAVE"`; para chaves
compostas, separadas por `;`. Use `parseMode: "raw"` se precisar do
SOAP Envelope completo.

> ⚠️ **Erros do RM voltam embutidos no Result, não como SOAP Fault.**
> Quando o `DataServer` rejeita por regra de negócio (FK violation,
> validação custom em `.NET`, campo obrigatório), o RM responde com
> **HTTP 200 + SOAP válido** e coloca a mensagem de erro como **texto
> livre** dentro de `<SaveRecordResult>`.
>
> Use `parseMode: "result-strict"` para que essa string vire um
> `RmResultError` automaticamente — recomendado em produção:
>
> ```ts
> import { RmResultError } from "rm-webservice-client";
>
> try {
>   const pk = await rm.dataServer.saveRecord({
>     dataServerName: "GlbUsuarioData",
>     xml,
>     parseMode: "result-strict",
>   });
>   // pk é a chave gerada (string curta), garantido
> } catch (err) {
>   if (err instanceof RmResultError) {
>     console.error(err.summary, err.sql);
>   }
>   throw err;
> }
> ```
>
> Para inspeção/debug, `parseMode: "result"` (default) devolve a
> string crua sem detecção; `parseMode: "raw"` devolve o SOAP envelope
> completo. Ou use o helper público `detectRmResultError(s)` se quiser
> a heurística sem a exception.

> **Logging**: o XML do payload **nunca** é logado por padrão (mesmo
> com `logger` configurado). Para depurar, é necessário ligar
> explicitamente `logBody: true` — e mesmo aí senhas/tokens passam
> pelo `redactString`. Não logue `saveRecord` em produção.

### `deleteRecord(opts): Promise<string>` — **escrita destrutiva**

> ⚠️ **Apaga registros do RM.** Use `parseMode: "result-strict"` para
> que erros embutidos no Result virem `RmResultError` automaticamente.

```ts
const xml = `<NewDataSet><PPessoa><CODIGO>26620</CODIGO></PPessoa></NewDataSet>`;

await rm.dataServer.deleteRecord({
  dataServerName: "RhuPessoaData",
  xml,
  context: { CODCOLIGADA: 1, CODSISTEMA: "G", CODUSUARIO: "mestre" },
  parseMode: "result-strict", // recomendado: lança RmResultError se RM rejeita
});
```

Em sucesso, o `<DeleteRecordResult>` costuma vir vazio. Em FK violation
ou regra de negócio, o RM volta com `HTTP 200 + texto de erro embutido`
— exatamente o mesmo padrão de `saveRecord`. Por isso o
`result-strict`.

### `deleteRecordByKey(opts): Promise<string>` — **escrita destrutiva**

> ⚠️ Mesma destrutividade do `deleteRecord`, sem precisar montar XML.

```ts
await rm.dataServer.deleteRecordByKey({
  dataServerName: "RhuPessoaData",
  primaryKey: 26620, // ou ["1", "abc"] para chave composta
  parseMode: "result-strict",
});
```

Chaves compostas em array são serializadas com `;` (igual `readRecord`).

### `readLookupView<T>(opts): Promise<T[]>`

```ts
const opcoes = await rm.dataServer.readLookupView<{
  CHAVE: string;
  DESCRICAO: string;
}>({
  dataServerName: "AlgumLookupData",
  filter: "...",
  ownerData: "<X>1</X>", // opcional, depende do DataServer
});
```

`ownerData` é uma string/XML específico de alguns DataServers que
derivam o lookup de outro contexto. A maioria não precisa desse campo.
`parseMode: "raw" | "dataset" | "records"` (default `records`), igual
a `readView`.

## Geração de tipos TypeScript

A partir de 0.5.0 a lib pode gerar interfaces TS a partir do schema do
DataServer — útil pra autocompletar campos no consumo de `readView`,
`readRecord`, `saveRecord`:

```ts
import {
  parseXsdSchema,
  generateTypes,
} from "rm-webservice-client";

const xsd = await rm.dataServer.getSchema({ dataServerName: "RhuPessoaData" });
const schema = parseXsdSchema(xsd);
const ts = generateTypes(schema, { banner: "Gerado em 2026-05-01" });
// ts é um string com `export interface PPessoa { ... }` etc.
```

Equivalente na CLI:

```bash
npx rmws generate-types RhuPessoaData \
  --context "CODCOLIGADA=1;CODSISTEMA=G;CODUSUARIO=mestre" \
  --out src/rm-types/rhu-pessoa.ts
```

A saída inclui:

- Uma `interface` por row (`PPessoa`, `VRECRUTAMENTO`, etc.)
- Uma interface agregadora com nome do dataset (`RhuPessoa`) — rows
  como propriedades opcionais arrayificadas
- JSDoc com `Caption` (legível em PT-BR), `@xsdType`, `@maxLength`,
  `@default` quando declarados
- `?` em campos `minOccurs="0"`

> ⚠️ Tipos gerados são **auxiliares**, não fonte de verdade. Veja
> `getSchemaParsed` acima — XSD não captura validações custom do RM.

## ConsultaSQL

### `query<T>(opts): Promise<T[]>`

```ts
const alunos = await rm.consultaSql.query<Aluno>({
  codSentenca: "EDU.ALUNOS.ATIVOS",
  codColigada: 1,
  codSistema: "S",
  parameters: { CODFILIAL: 1 }, // ou string crua "CODFILIAL=1;..."
});
```

### `queryWithContext<T>(opts): Promise<T[]>`

```ts
const alunos = await rm.consultaSql.queryWithContext<Aluno>({
  codSentenca: "EDU.ALUNOS.ATIVOS",
  codColigada: 1,
  codSistema: "S",
  parameters: { RA: "12345" },
  context: { CODCOLIGADA: 1, CODFILIAL: 1, CODSISTEMA: "S" },
});
```

## Diagnóstico

`rm.diagnostics` faz checagens estruturadas — não lançam erro, devolvem um
relatório com `ok`, `steps[].durationMs` e `error.code` quando algo falha.

```ts
const report = await rm.diagnostics.checkDataServer({
  probeDataServerName: "GlbUsuarioData", // opcional, default "RmWsClient.DiagnosticProbe"
});
// {
//   service: "dataServer",
//   ok: true,
//   steps: [
//     { name: "resolve-wsdl", ok: true, durationMs: 120, details: { ... } },
//     { name: "is-valid-data-server", ok: true, durationMs: 80, details: { isValid: true } }
//   ]
// }
```

```ts
// Sem probe: valida só o WSDL.
await rm.diagnostics.checkConsultaSql();

// Com probe: roda uma sentença real.
await rm.diagnostics.checkConsultaSql({
  probe: { codSentenca: "EDU.ALUNOS", codColigada: 1, codSistema: "S" },
});
```

```ts
// authenticate: distingue falha de credencial (HTTP 401/403) de falha de
// negócio (HTTP 500, SOAP Fault). Auth é considerado OK em qualquer
// cenário onde a request passou pela camada de autenticação.
const auth = await rm.diagnostics.authenticate();
if (!auth.ok) console.error(auth.steps[0]?.error);
```

## Contexto e parâmetros

Aceitam string crua ou objeto. Objeto vira `K=V;K=V` por padrão.

```ts
context: { CODCOLIGADA: 1, CODSISTEMA: "G" }
// vira
context: "CODCOLIGADA=1;CODSISTEMA=G"
```

Regras:

- `undefined` é ignorado (não vai pra string)
- `null` vira string vazia (`A=1;B=`)
- separador padrão `;`, configurável via `defaults.contextSeparator`/`parameterSeparator` (`;` ou `,`)

## `parseMode`

Modos disponíveis nos métodos de **leitura**:

| Mode      | Retorno                                                         |
|-----------|-----------------------------------------------------------------|
| `records` | `T[]` (default em `readView`/`readLookupView`/`query`/`queryWithContext`) |
| `record`  | `T \| null` (default em `readRecord`)                           |
| `dataset` | XML interno (string do `NewDataSet`) — para parsing customizado |
| `raw`     | XML SOAP cru, antes de extrair `Result`                         |

Modos disponíveis nos métodos de **escrita** (`saveRecord`,
`deleteRecord`, `deleteRecordByKey`):

| Mode             | Retorno                                                  |
|------------------|----------------------------------------------------------|
| `result`         | conteúdo cru do `<...Result>` (default — string)         |
| `result-strict`  | igual `result`, mas erros embutidos pelo RM viram `RmResultError` |
| `raw`            | XML SOAP cru, antes de extrair `Result`                  |

`raw` é o escape hatch para quando o RM devolver algo inesperado.
`result-strict` é o recomendado em produção pra escritas — o RM
retorna `HTTP 200` mesmo quando rejeita por regra de negócio, e essa
flag detecta isso automaticamente. Veja a seção `saveRecord` acima
para o padrão de uso.

## Comportamentos do TOTVS RM observados em produção

Pontos práticos que você vai encontrar ao plugar contra um ambiente RM real
(testado contra um RM CloudTOTVS 12.x):

- **Filtro obrigatório em ReadView.** Vários DataServers (ex.: `GlbUsuarioData`)
  recusam chamadas sem `filter` com `Erro ao executar readview Filtro invalido`.
  Mande pelo menos algo como `"CODCOLIGADA = 1"`.
- **`NewDataSet` pode trazer múltiplas Views irmãs.** Um único `ReadView` pode
  devolver mais de um tipo de Row dentro do mesmo `NewDataSet` (ex.:
  `<GUSUARIO/>` + `<GAVATAR/>`). `parseRmDataset` retorna apenas a **primeira**
  View encontrada — quando você precisa das outras, use
  `parseMode: "dataset"` para receber o XML interno e parsear manualmente.
- **Whitespace vira campo `#text` no Row.** O RM costuma intercalar `&#xD;`
  entre os elementos de cada Row. O `fast-xml-parser` preserva isso como
  `"#text": "\r\r\r..."`. É inofensivo — filtre no consumidor com
  `delete row["#text"]` se atrapalhar.
- **`IsValidDataServer` em probe inexistente vira SOAP Fault, não `false`.**
  Quando você passa um nome desconhecido, o RM responde HTTP 200 + Fault
  `Classe não encontrada: <Nome>`. O `diagnose authenticate` se aproveita
  disso: receber um SOAP Fault depois de autenticar é evidência de que a
  credencial passou e só o probe sintético é que falhou.
- **SOAP Fault de ConsultaSQL inclui a chave completa.** Ao errar `codSentenca`
  o RM retorna `A consulta SQL utilizando a chave <coligada>|<sistema>|<codSentenca> não existe ou não pôde ser executada por restrição de filtro por perfil/usuário`.
  Útil pra debugar permissões.
- **Cache de WSDL vale a pena.** Em ambientes Cloud TOTVS, baixar e parsear o
  `?wsdl` do DataServer fica em ~250 ms; com o cache em disco a 2ª chamada
  cai pra ~45 ms (≈ 5–6× mais rápido). A CLI já liga o cache por padrão.
- **Authorization é redigido nos logs.** Mesmo com `--log-level debug`, o
  header `Authorization` sai como `"[REDACTED]"` — é seguro colar log em
  ticket de bug.

## Erros

```ts
import {
  RmError,            // base
  RmConfigError,      // WSDL ausente, port inválido, etc.
  RmHttpError,        // status: number, responseText: string
  RmSoapFaultError,   // faultCode, faultString, status?
  RmParseError,       // operationName, resultElement
  RmResultError,      // erro embutido em <...Result> (ver result-strict)
  RmTimeoutError,     // timeoutMs
  RmValidationError,  // builder client-side rejeitou os fields (issues[])
} from "rm-webservice-client";
```

Todas as classes têm `code` para discriminar via `error.code === "RM_HTTP_ERROR"`.

`RmResultError` é específico das ops de escrita (`saveRecord`,
`deleteRecord`, `deleteRecordByKey`) e só é disparado com
`parseMode: "result-strict"`. Expõe:

```ts
err.code           // "RM_RESULT_ERROR"
err.operationName  // "SaveRecord" | "DeleteRecord" | "DeleteRecordByKey"
err.summary        // primeira linha do Result (ex.: "Violação de chave estrangeira")
err.sql?           // trecho INSERT/UPDATE/DELETE quando há erro de DB
err.stack?         // stack trace .NET embutido
err.raw            // string completa do <...Result>
```

Detecção sem exception via helper público:

```ts
import { detectRmResultError } from "rm-webservice-client";

const result = await rm.dataServer.saveRecord({ ... }); // parseMode "result"
const errorMatch = detectRmResultError(result);
if (errorMatch) {
  console.error(errorMatch.summary, errorMatch.sql);
} else {
  // result é o PK gerado
}
```

`RmValidationError` (0.6.0) é client-side, antes de chamar o RM.
Disparado pelo `buildRecord` / `saveRecord({ fields })` /
`rmws build-record`. Expõe:

```ts
err.code      // "RM_VALIDATION_ERROR"
err.target    // "DatasetName/RowName"
err.issues    // ReadonlyArray<RmValidationIssue>
              //   { field, kind: "unknown"|"required"|"type"|"maxLength",
              //     expected?, got? }
```

A lista `issues` é **completa** (não para no primeiro problema), útil
pra UIs que mostram tudo de uma vez.

## Logging

Por padrão a lib não loga nada. Passe um `logger` para ter eventos
estruturados de cada request SOAP e download de WSDL.

```ts
import { createRmClient, createConsoleLogger } from "rm-webservice-client";

const rm = createRmClient({
  services: { dataServer: { wsdlUrl: process.env.RM_DATASERVER_WSDL! } },
  auth: { type: "basic", username: "u", password: "p" },
  logger: createConsoleLogger({ level: "debug" }), // escreve JSON em stderr
  logBody: true, // opcional — inclui o envelope SOAP redigido
});
```

Eventos emitidos:

| Evento          | Nível   | Quando                          |
|-----------------|---------|----------------------------------|
| `wsdl.request`  | `debug` | Antes do `fetch` do WSDL         |
| `wsdl.response` | `debug` | Após receber o WSDL              |
| `wsdl.error`    | `error` | Falha ao baixar WSDL             |
| `soap.request`  | `debug` | Antes de enviar o envelope SOAP  |
| `soap.response` | `debug` | Após receber a resposta          |
| `soap.error`    | `error` | HTTP, SOAP Fault ou timeout      |

`Authorization`, `Cookie` e similares são automaticamente substituídos por
`[REDACTED]` nos headers logados. Quando `logBody: true`, o body passa por
um redactor que converte `password=...`, `senha=...`, `token=...`,
`access_token=...`, `bearer=...`, `api_key=...` em `[REDACTED]`.

Logger custom — qualquer objeto que satisfaça `RmLogger`:

```ts
import type { RmLogger } from "rm-webservice-client";

const logger: RmLogger = {
  debug: (event, data) => myObservability.track(event, data),
  info:  (event, data) => myObservability.track(event, data),
  warn:  (event, data) => myObservability.track(event, data),
  error: (event, data) => myObservability.track(event, data),
};
```

## Cache de WSDL em disco

O WSDL muda raramente, mas é baixado a cada `createRmClient` (ou a cada
invocação da CLI). O cache em disco evita esse custo: a primeira chamada
grava o XML em `~/.cache/rm-webservice-client/<hash>.wsdl`, as próximas
leem do disco até o TTL expirar.

```ts
const rm = createRmClient({
  services: { dataServer: { wsdlUrl: process.env.RM_DATASERVER_WSDL! } },
  auth: { type: "basic", username: "u", password: "p" },
  wsdlCache: {
    enabled: true,
    ttlMs: 24 * 60 * 60 * 1000, // 24h (default)
    dir: "/var/cache/rmws",      // opcional — default ~/.cache/rm-webservice-client
  },
});
```

Defaults: TTL 24h, diretório `$XDG_CACHE_HOME/rm-webservice-client/`
(fallback para `~/.cache/rm-webservice-client/`). Hash da URL (SHA-256
truncado) é o nome do arquivo, então URLs diferentes não colidem.

Erros de IO no cache (sem permissão de escrita, disco cheio, etc.) **não
quebram** o cliente — eles são logados como `wsdl.cache.write-error` /
`wsdl.cache.read-error` e a operação segue como se o cache estivesse
desligado.

Na CLI, o cache vem **ligado por padrão**:

```bash
rmws inspect dataserver --wsdl "$RM_DATASERVER_WSDL"   # já usa cache
rmws inspect dataserver --no-wsdl-cache                 # desliga
RM_WSDL_CACHE=0 rmws inspect dataserver                 # desliga via env
rmws inspect dataserver --wsdl-cache-ttl 3600000        # TTL 1h
rmws inspect dataserver --wsdl-cache-dir /tmp/c         # dir custom
```

## Override manual (sem WSDL)

Em ambientes onde o `?wsdl` está bloqueado mas o endpoint funciona:

```ts
const rm = createRmClient({
  services: {
    dataServer: {
      endpointUrl: "https://rm.example.com:1251/wsDataServer/IwsDataServer",
      targetNamespace: "http://www.totvs.com/",
      soapActions: {
        ReadView: "http://www.totvs.com/IwsDataServer/ReadView",
        ReadRecord: "http://www.totvs.com/IwsDataServer/ReadRecord",
        GetSchema: "http://www.totvs.com/IwsDataServer/GetSchema",
        IsValidDataServer:
          "http://www.totvs.com/IwsDataServer/IsValidDataServer",
      },
    },
  },
  auth: { type: "basic", username: "u", password: "p" },
});
```

## Autocomplete de `dataServerName`

Os 2.537 nomes do catálogo TOTVS aparecem no autocomplete da sua IDE
direto nas chamadas (`readView`, `readRecord`, `getSchema`,
`isValidDataServer`, `saveRecord`):

```ts
const ok = await rm.dataServer.isValidDataServer({
  dataServerName: "Rhu",  // IDE sugere RhuPessoaData, RhuFuncionarioData, ...
});
```

Quando o DataServer da sua instância **não está no catálogo** (custom
do produto, builder externo, etc.) — sem problema, qualquer string
continua aceita:

```ts
const records = await rm.dataServer.readView({
  dataServerName: "MeuDataServerCustomData",
});
```

O tipo `DataServerNameInput = KnownDataServerName | (string & Record<never, never>)`
faz isso: union literal pra autocomplete + `& Record<never, never>` pra
não bloquear strings arbitrárias. Custo runtime: zero (são só tipos).

## Catálogo de DataServers

A lib embute o índice oficial da TOTVS
(`https://apitotvslegado.z15.web.core.windows.net/`) — 2.537 DataServers em
33 módulos, com nome, descrição, módulo e flag de "Liberado". É um subpath
import: quem não usar não paga pelo bundle.

```ts
import {
  KNOWN_DATASERVERS,
  KNOWN_MODULES,
  findDataServer,
  searchDataServers,
  CATALOG_META,
} from "rm-webservice-client/catalog";

// Achei pelo nome
findDataServer("RhuPessoaData");
// → { name: "RhuPessoaData", module: "Recursos Humanos",
//     description: "Pessoas", released: true }

// Busca livre
searchDataServers({ query: "pessoa", releasedOnly: true });
// → [{ name: "RhuPessoaData", ... }, { name: "EduPessoaData", ... }, ...]

// Filtra por módulo
searchDataServers({ module: "Recursos Humanos", limit: 10 });
```

> ⚠️ O catálogo lista o que existe **no produto RM oficial**. Cada
> instância (cloud/on-prem, módulos contratados) expõe um subconjunto
> diferente. A verdade definitiva continua sendo
> `rm.dataServer.isValidDataServer({ dataServerName })` na sua instância.

Regenerar a partir do índice TOTVS (após atualizações da fonte):

```bash
npm run build:catalog
```

Equivalente na CLI:

```bash
npx rmws catalog --search pessoa --released
npx rmws catalog --module "Recursos Humanos" --limit 20
npx rmws catalog --modules                    # lista módulos
npx rmws catalog --search funcionario --json  # estruturado
```

## CLI `rmws`

```bash
npx rmws inspect dataserver --wsdl "$RM_DATASERVER_WSDL"
npx rmws inspect sql --wsdl "$RM_CONSULTASQL_WSDL"

npx rmws read-view GlbUsuarioData \
  --filter "CODUSUARIO='mestre'" \
  --context "CODCOLIGADA=1;CODSISTEMA=G;CODUSUARIO=mestre"

npx rmws sql EDU.ALUNOS.ATIVOS \
  --coligada 1 --sistema S \
  --params "CODFILIAL=1"

# Escrita
npx rmws save-record GlbUsuarioData \
  --xml-file ./novo-usuario.xml \
  --context "CODCOLIGADA=1;CODSISTEMA=G;CODUSUARIO=mestre"

# Geração de tipos
npx rmws generate-types RhuPessoaData \
  --context "CODCOLIGADA=1;CODSISTEMA=G;CODUSUARIO=mestre" \
  --out src/rm-types/rhu-pessoa.ts

# Builder de XML (0.6.0) — valida campos contra schema
npx rmws build-record RhuPessoaData \
  --fields-json '{"CODIGO": -1, "NOME": "X"}' \
  --context "CODCOLIGADA=1;CODSISTEMA=G;CODUSUARIO=mestre" \
  --out /tmp/payload.xml
npx rmws save-record RhuPessoaData --xml-file /tmp/payload.xml --strict

# Escrita destrutiva
npx rmws delete-record-by-key RhuPessoaData 26620 \
  --context "CODCOLIGADA=1;CODSISTEMA=G;CODUSUARIO=mestre" \
  --strict   # lança RmResultError se RM rejeitar (exit 6)

npx rmws delete-record RhuPessoaData \
  --xml-file ./remover.xml --strict

npx rmws read-lookup-view AlgumLookupData \
  --filter "X=1" --owner-data "<X>1</X>"

npx rmws diagnose                          # roda dataServer + ConsultaSQL + auth
npx rmws diagnose dataserver               # só dataServer
npx rmws diagnose auth                     # só verificação de auth
npx rmws diagnose sql \
  --probe-codsentenca EDU.ALUNOS \
  --probe-coligada 1 --probe-sistema S \
  --probe-params "CODFILIAL=1"             # smoke real do ConsultaSQL
```

Flags globais:

| Flag                     | Descrição                                                      |
|--------------------------|----------------------------------------------------------------|
| `--wsdl <url\|path>`     | URL ou caminho do WSDL (override env)                          |
| `--user`, `--password`   | Basic Auth                                                     |
| `--bearer <token>`       | Bearer Auth                                                    |
| `--timeout <ms>`         | Timeout (default 30s)                                          |
| `--raw`                  | Retorna XML cru                                                |
| `--quiet`                | Suprime mensagens em stderr                                    |
| `--log-level <level>`    | Liga logs estruturados em stderr (`debug \| info \| warn \| error`) |
| `--log-body`             | Inclui body SOAP redigido nos logs (use com `--log-level debug`) |
| `--no-wsdl-cache`        | Desliga o cache em disco do WSDL (default: ligado na CLI)      |
| `--wsdl-cache-ttl <ms>`  | TTL do cache de WSDL (default: 24h)                            |
| `--wsdl-cache-dir <dir>` | Diretório do cache de WSDL (default: `~/.cache/rm-webservice-client`) |

Flags do `read-view`:

| Flag                | Descrição                              |
|---------------------|----------------------------------------|
| `--filter <expr>`   | Filtro RM (ex.: `"PPESSOA.CODIGO=1"`)  |
| `--context <ctx>`   | Contexto (string ou `K=V;K=V`)         |

Flags do `sql`:

| Flag                | Descrição                                                       |
|---------------------|-----------------------------------------------------------------|
| `--coligada <n>`    | Código da coligada                                              |
| `--sistema <s>`     | Código do sistema (`G`, `S`, `F`, …)                            |
| `--params <p>`      | Parâmetros (string ou `K=V;K=V`)                                |
| `--context <ctx>`   | Contexto (usa `queryWithContext` quando presente)               |

Flags do `save-record` (**escrita**):

| Flag                | Descrição                                                       |
|---------------------|-----------------------------------------------------------------|
| `--xml <content>`   | XML do dataset inline (`<NewDataSet>...`)                       |
| `--xml-file <path>` | Caminho para arquivo com o XML do dataset                       |
| `--context <ctx>`   | Contexto (string ou `K=V;K=V`)                                  |

`--xml` e `--xml-file` são mutuamente exclusivos; pelo menos um é
obrigatório.

Flags do `delete-record` (**escrita destrutiva**):

| Flag                | Descrição                                                       |
|---------------------|-----------------------------------------------------------------|
| `--xml <content>`   | XML do dataset inline com as linhas a deletar                   |
| `--xml-file <path>` | Caminho para arquivo com o XML                                  |
| `--context <ctx>`   | Contexto (string ou `K=V;K=V`)                                  |
| `--strict`          | Lança `RmResultError` se RM rejeitar (exit code 6)              |

Flags do `delete-record-by-key` (**escrita destrutiva**):

A chave primária é argumento posicional (`<primaryKey>`). Para chave
composta, use vírgula: `delete-record-by-key X 1,abc,42`.

| Flag                | Descrição                                                       |
|---------------------|-----------------------------------------------------------------|
| `--context <ctx>`   | Contexto (string ou `K=V;K=V`)                                  |
| `--strict`          | Lança `RmResultError` se RM rejeitar (exit code 6)              |

Flags do `build-record`:

| Flag                      | Descrição                                                       |
|---------------------------|-----------------------------------------------------------------|
| `--fields-json <json>`    | Campos como JSON inline (`'{"CODIGO": -1, ...}'`)               |
| `--fields-file <path>`    | Caminho para arquivo JSON com os campos                         |
| `--row <name>`            | Nome da row do schema (default: master/primeira)                |
| `--context <ctx>`         | Contexto (necessário pra alguns DataServers retornarem schema)  |
| `--out <path>`            | Caminho do arquivo XML de destino (default: stdout)             |
| `--bypass-validation`     | Pula validação (use com cuidado)                                |
| `--allow-unknown`         | Aceita campos não declarados no schema                          |

`--fields-json` e `--fields-file` são mutuamente exclusivos.

Flags do `generate-types`:

| Flag                | Descrição                                                       |
|---------------------|-----------------------------------------------------------------|
| `--out <path>`      | Caminho do arquivo `.ts` de destino (default: stdout)           |
| `--context <ctx>`   | Contexto (string ou `K=V;K=V`)                                  |

Flags do `read-lookup-view`:

| Flag                | Descrição                                                       |
|---------------------|-----------------------------------------------------------------|
| `--filter <expr>`   | Filtro RM                                                       |
| `--context <ctx>`   | Contexto (string ou `K=V;K=V`)                                  |
| `--owner-data <s>`  | OwnerData (string/XML específico do DataServer)                 |

Flags do `catalog`:

| Flag                | Descrição                                                       |
|---------------------|-----------------------------------------------------------------|
| `--module <name>`   | Filtra por módulo (ex.: `"Recursos Humanos"`)                   |
| `--search <q>`      | Busca em nome ou descrição (case-insensitive)                   |
| `--released`        | Apenas DataServers marcados como liberados pela TOTVS           |
| `--limit <n>`       | Limita o número de resultados                                   |
| `--modules`         | Lista apenas os nomes dos módulos                               |
| `--json`            | Saída em JSON (com `meta` + `items`)                            |

Flags do `diagnose`:

| Flag                          | Descrição                                                   |
|-------------------------------|-------------------------------------------------------------|
| `--wsdl-dataserver <url>`     | WSDL do dataServer (override env)                           |
| `--wsdl-sql <url>`            | WSDL do ConsultaSQL (override env)                          |
| `--probe-dataserver <name>`   | DataServer usado em `IsValidDataServer`                     |
| `--probe-codsentenca <name>`  | Sentença para smoke do ConsultaSQL                          |
| `--probe-coligada <n>`        | Coligada do probe ConsultaSQL                               |
| `--probe-sistema <s>`         | Sistema do probe ConsultaSQL                                |
| `--probe-params <p>`          | Parâmetros do probe ConsultaSQL                             |
| `--probe-context <ctx>`       | Contexto (usa `queryWithContext` quando presente)           |

Códigos de saída:

| Código | Significado                                              |
|--------|----------------------------------------------------------|
| 0      | Sucesso                                                  |
| 1      | Erro de configuração                                     |
| 2      | HTTP                                                     |
| 3      | SOAP Fault                                               |
| 4      | Erro de parse                                            |
| 5      | Timeout                                                  |
| 6      | `RmResultError` (RM rejeitou via `--strict`/result-strict) |
| 7      | `RmValidationError` (builder client-side rejeitou fields)  |
| 99     | Erro desconhecido                                        |

## Variáveis de ambiente (CLI)

```env
RM_DATASERVER_WSDL=https://rm.example.com:1251/wsDataServer/MEX?wsdl
RM_CONSULTASQL_WSDL=https://rm.example.com:1251/wsConsultaSQL/MEX?wsdl
RM_USER=mestre
RM_PASSWORD=...
RM_BEARER_TOKEN=...
RM_TIMEOUT_MS=30000
RM_LOG_LEVEL=debug
RM_WSDL_CACHE=0                  # opcional, desliga cache de WSDL na CLI
RM_WSDL_CACHE_TTL_MS=3600000     # opcional, TTL custom (ms)
RM_WSDL_CACHE_DIR=/tmp/rmws      # opcional, diretório custom
```

> **WSDL em WCF (TOTVS RM Cloud)**: o WSDL é servido no endpoint MEX
> (`/<service>/MEX?wsdl`), **não** no path do contrato SOAP
> (`/<service>/Iws<service>`). Se receber `HTTP 400` do
> `Microsoft-HTTPAPI/2.0`, troque o path por `/MEX?wsdl`.

## Segurança

- Use o `logger` da lib em vez de `console.log` no envelope SOAP — ele
  redige `Authorization`, cookies e padrões `password=`/`senha=`/`token=`
  automaticamente
- WSDLs e XMLs commitados em testes devem ser sanitizados
  (substitua hostnames reais por `rm.example.com`)
- Bearer tokens estáticos vencem — prefira `getToken: async () => ...`
  para sistemas de produção

## Versionamento

A partir da `1.0.0` esta lib segue [SemVer estrito](https://semver.org/lang/pt-BR/):

- **`MAJOR` (X.0.0)** — quebra de API pública. Migration guide acompanha.
- **`MINOR` (1.X.0)** — features novas, backward-compatible.
- **`PATCH` (1.0.X)** — bugfixes, sem mudança de API.

A "API pública" inclui:

- Tudo exportado pela entry principal `rm-webservice-client`
- Tudo exportado pelo subpath `rm-webservice-client/catalog`
- Comandos / flags da CLI `rmws`
- Códigos de saída da CLI
- Variáveis de ambiente `RM_*`

O arquivo `test/api-surface.test.ts` trava esses símbolos em compile-time:
PRs que removerem ou mudarem shape de algum export quebram o
`npm run typecheck`. Adições não-breaking entram pelo mesmo arquivo.

Detalhes internos (módulos `src/soap/`, `src/wsdl/internals/`, layout
do WSDL cache) **não** são públicos e podem mudar em minor.

Histórico completo em [`CHANGELOG.md`](./CHANGELOG.md).

## Roadmap pós-1.0

- `AutenticaAcesso` automático com cache de token (renovação) — `1.1.x`
- Validação contra constraints do XSD além de tipos primitivos
  (`xs:enumeration`, `xs:pattern`) — `1.x.x`
- Builder com tipos cruzados com `generate-types` — TS infere os
  fields aceitos pelo nome do DataServer — `1.x.x`

## Licença

MIT
