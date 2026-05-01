/**
 * EXEMPLO — deleteRecordByKey (experimental, escrita DESTRUTIVA).
 *
 * Apaga 1 registro de RhuPessoaData pela chave. SEMPRE rode em
 * homologação antes de produção. Use `parseMode: "result-strict"` para
 * que o RM rejeitando vire `RmResultError` (em vez de string com texto
 * de erro embutido).
 */
import { createRmClient, RmResultError } from "../src/index.js";

const rm = createRmClient({
  services: {
    dataServer: { wsdlUrl: process.env.RM_DATASERVER_WSDL! },
  },
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
  const result = await rm.dataServer.deleteRecordByKey({
    dataServerName: "RhuPessoaData",
    primaryKey: 26620,
    parseMode: "result-strict",
  });
  console.log("Apagado.", JSON.stringify(result));
} catch (err) {
  if (err instanceof RmResultError) {
    console.error("RM rejeitou:", err.summary);
    if (err.sql) console.error("SQL:", err.sql);
    process.exit(6);
  }
  throw err;
}
