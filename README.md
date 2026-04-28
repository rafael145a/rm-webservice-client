# rm-webservice-client

Cliente TypeScript não oficial para consumir WebServices SOAP do TOTVS RM
(`wsDataServer` e `wsConsultaSQL`), abstraindo WSDL, SOAPAction, envelopes
XML, contexto, parâmetros, CDATA e parsing de DataSets.

> Este projeto não é oficial da TOTVS. TOTVS RM é marca de seus respectivos
> proprietários. Use em ambiente de homologação antes de produção.

## Recursos

- WSDL-aware: lê o WSDL para descobrir endpoint, SOAPAction e operações
- API tipada para `ReadView`, `ReadRecord`, `GetSchema`, `IsValidDataServer`,
  `RealizarConsultaSQL`, `RealizarConsultaSQLContexto`
- Basic Auth e Bearer Auth manual
- `parseMode: "raw"` em todos os métodos para inspeção/escape hatch
- Hierarquia de erros tipados (HTTP, SOAP Fault, parse, config, timeout)
- CLI `rmws` para diagnóstico e queries ad-hoc
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

### `readRecord<T>(opts): Promise<T | null>`

```ts
const u = await rm.dataServer.readRecord<Usuario>({
  dataServerName: "GlbUsuarioData",
  primaryKey: "mestre",            // ou ["1", "abc"] para chave composta
});
```

Retorna `null` quando o RM devolve `<NewDataSet/>` vazio.

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

Todos os métodos que retornam dados aceitam:

| Mode      | Retorno                                                         |
|-----------|-----------------------------------------------------------------|
| `records` | `T[]` (default em `readView`/`query`/`queryWithContext`)        |
| `record`  | `T \| null` (default em `readRecord`)                           |
| `dataset` | XML interno (string do `NewDataSet`) — para parsing customizado |
| `raw`     | XML SOAP cru, antes de extrair `Result`                         |

`raw` é o escape hatch para quando o RM devolver algo inesperado.

## Erros

```ts
import {
  RmError,           // base
  RmConfigError,     // WSDL ausente, port inválido, etc.
  RmHttpError,       // status: number, responseText: string
  RmSoapFaultError,  // faultCode, faultString, status?
  RmParseError,      // operationName, resultElement
  RmTimeoutError,    // timeoutMs
} from "rm-webservice-client";
```

Todas as classes têm `code` para discriminar via `error.code === "RM_HTTP_ERROR"`.

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
```

Flags globais:

| Flag                     | Descrição                                          |
|--------------------------|----------------------------------------------------|
| `--wsdl <url\|path>`     | URL ou caminho do WSDL (override env)              |
| `--user`, `--password`   | Basic Auth                                         |
| `--bearer <token>`       | Bearer Auth                                        |
| `--timeout <ms>`         | Timeout (default 30s)                              |
| `--raw`                  | Retorna XML cru                                    |
| `--quiet`                | Suprime mensagens em stderr                        |

Códigos de saída:

| Código | Significado          |
|--------|----------------------|
| 0      | Sucesso              |
| 1      | Erro de configuração |
| 2      | HTTP                 |
| 3      | SOAP Fault           |
| 4      | Erro de parse        |
| 5      | Timeout              |
| 99     | Erro desconhecido    |

## Variáveis de ambiente (CLI)

```env
RM_DATASERVER_WSDL=https://rm.example.com:1251/wsDataServer/MEX?wsdl
RM_CONSULTASQL_WSDL=https://rm.example.com:1251/wsConsultaSQL/MEX?wsdl
RM_USER=mestre
RM_PASSWORD=...
RM_BEARER_TOKEN=...
RM_TIMEOUT_MS=30000
```

> **WSDL em WCF (TOTVS RM Cloud)**: o WSDL é servido no endpoint MEX
> (`/<service>/MEX?wsdl`), **não** no path do contrato SOAP
> (`/<service>/Iws<service>`). Se receber `HTTP 400` do
> `Microsoft-HTTPAPI/2.0`, troque o path por `/MEX?wsdl`.

## Segurança

- Não logue `Authorization`, senha, ou XML completo de produção
- WSDLs e XMLs commitados em testes devem ser sanitizados
  (substitua hostnames reais por `rm.example.com`)
- Bearer tokens estáticos vencem — prefira `getToken: async () => ...`
  para sistemas de produção

## Operações fora desta release

- `SaveRecord`, `DeleteRecord`, `DeleteRecordByKey`, `ReadLookupView`
- `AutenticaAcesso` automático com cache de token
- `rmws generate-types` a partir de `GetSchema`

## Licença

MIT
