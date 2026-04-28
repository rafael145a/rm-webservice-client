import { createRmClient } from "rm-webservice-client";

interface UsuarioRm {
  CODUSUARIO: string;
  NOME: string;
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

const usuario = await rm.dataServer.readRecord<UsuarioRm>({
  dataServerName: "GlbUsuarioData",
  primaryKey: "mestre",
});

if (usuario) {
  console.log(`Encontrado: ${usuario.NOME}`);
} else {
  console.log("Usuário não encontrado");
}
