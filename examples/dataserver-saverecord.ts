/**
 * EXEMPLO — saveRecord (experimental, escrita).
 *
 * AVISO: operação destrutiva. Rode SEMPRE contra homologação antes de
 * produção. Este arquivo é apenas referência — não execute em prod sem
 * revisar o XML.
 *
 * A lib não monta o XML pra você: a 0.3.0 entrega só a chamada SOAP.
 * Builders sobre GetSchema chegam na 0.6.0.
 */
import { createRmClient } from "../src/index.js";

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
});

console.log("Chave gerada:", primaryKey);
