import { createRmClient } from "../src/index.js";

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

interface OpcaoLookup {
  CHAVE: string;
  DESCRICAO: string;
}

const opcoes = await rm.dataServer.readLookupView<OpcaoLookup>({
  dataServerName: "AlgumLookupData",
  filter: "X=1",
});

for (const o of opcoes) {
  console.log(o.CHAVE, "—", o.DESCRICAO);
}
