/**
 * EXEMPLO — gerar tipos TS a partir do schema de um DataServer.
 *
 * O fluxo equivale ao `rmws generate-types <Name> --out <path>` mas
 * dentro de código (útil pra integrar com pipelines de build).
 */
import { writeFile } from "node:fs/promises";

import {
  createRmClient,
  generateTypes,
  parseXsdSchema,
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

const xsd = await rm.dataServer.getSchema({
  dataServerName: "RhuPessoaData",
});
const schema = parseXsdSchema(xsd);
const ts = generateTypes(schema, {
  banner: `Gerado a partir de RhuPessoaData (${schema.rows.length} rows).`,
});

await writeFile("src/rm-types/rhu-pessoa.ts", ts, "utf8");
console.log(
  `Escrito ${schema.rows.length} interfaces (${ts.split("\n").length} linhas).`,
);
