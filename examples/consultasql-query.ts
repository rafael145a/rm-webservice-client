import { createRmClient } from "rm-webservice-client";

interface AlunoResumo {
  RA: string;
  NOME: string;
  CODCOLIGADA: string;
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

const alunos = await rm.consultaSql.query<AlunoResumo>({
  codSentenca: "EDU.ALUNOS.ATIVOS",
  codColigada: 1,
  codSistema: "S",
  parameters: {
    CODCOLIGADA: 1,
    CODFILIAL: 1,
  },
});

console.log(`Encontrados ${alunos.length} alunos.`);
console.log(JSON.stringify(alunos.slice(0, 5), null, 2));
