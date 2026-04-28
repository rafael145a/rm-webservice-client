import { createRmClient } from "rm-webservice-client";

interface AlunoResumo {
  RA: string;
  NOME: string;
}

const rm = createRmClient({
  services: {
    consultaSql: { wsdlUrl: process.env.RM_CONSULTASQL_WSDL! },
  },
  auth: {
    type: "basic",
    username: process.env.RM_USER!,
    password: process.env.RM_PASSWORD!,
  },
});

const alunos = await rm.consultaSql.queryWithContext<AlunoResumo>({
  codSentenca: "EDU.ALUNOS.ATIVOS",
  codColigada: 1,
  codSistema: "S",
  parameters: {
    RA: "12345",
  },
  context: {
    CODCOLIGADA: 1,
    CODFILIAL: 1,
    CODTIPOCURSO: 1,
    CODSISTEMA: "S",
  },
});

console.log(JSON.stringify(alunos, null, 2));
