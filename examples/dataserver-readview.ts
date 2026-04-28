import { createRmClient } from "rm-webservice-client";

interface UsuarioRm {
  CODUSUARIO: string;
  NOME: string;
  STATUS?: string;
  EMAIL?: string;
}

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
    context: {
      CODSISTEMA: "G",
      CODCOLIGADA: 1,
      CODUSUARIO: "mestre",
    },
  },
});

const usuarios = await rm.dataServer.readView<UsuarioRm>({
  dataServerName: "GlbUsuarioData",
  filter: "CODUSUARIO = 'mestre'",
});

console.log(JSON.stringify(usuarios, null, 2));
