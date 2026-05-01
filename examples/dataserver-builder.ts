/**
 * EXEMPLO 0.6.0 — saveRecord({ fields }) com builder.
 *
 * O builder busca o schema do DataServer (com cache em memória), valida
 * os campos client-side e monta o <NewDataSet>...</NewDataSet> automaticamente.
 *
 * AVISO: operação destrutiva. Sempre teste em homologação antes de prod.
 */
import {
  createRmClient,
  RmResultError,
  RmValidationError,
} from "../src/index.js";

const rm = createRmClient({
  services: { dataServer: { wsdlUrl: process.env.RM_DATASERVER_WSDL! } },
  auth: {
    type: "basic",
    username: process.env.RM_USER!,
    password: process.env.RM_PASSWORD!,
  },
  defaults: {
    context: { CODCOLIGADA: 1, CODSISTEMA: "G", CODUSUARIO: "mestre" },
  },
});

try {
  const pk = await rm.dataServer.saveRecord({
    dataServerName: "RhuPessoaData",
    fields: {
      CODIGO: -1, // -1 = autoincrement
      NOME: "Fulano de Tal",
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
    console.error("Validação client-side:");
    for (const i of err.issues) {
      console.error(
        `  - ${i.field}: ${i.kind} (esperado ${i.expected ?? "?"}, recebido ${i.got ?? "?"})`,
      );
    }
    process.exit(7);
  }
  if (err instanceof RmResultError) {
    console.error("RM rejeitou:", err.summary);
    process.exit(6);
  }
  throw err;
}
