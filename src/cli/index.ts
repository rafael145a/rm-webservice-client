import { cac } from "cac";

import { VERSION } from "../index.js";

import { buildRecordCommand, type BuildRecordFlags } from "./commands/build-record.js";
import { catalogCommand, type CatalogFlags } from "./commands/catalog.js";
import {
  deleteRecordByKeyCommand,
  type DeleteRecordByKeyFlags,
} from "./commands/delete-record-by-key.js";
import {
  deleteRecordCommand,
  type DeleteRecordFlags,
} from "./commands/delete-record.js";
import { diagnoseCommand, type DiagnoseFlags } from "./commands/diagnose.js";
import {
  generateTypesCommand,
  type GenerateTypesFlags,
} from "./commands/generate-types.js";
import { inspectCommand } from "./commands/inspect.js";
import {
  readLookupViewCommand,
  type ReadLookupViewFlags,
} from "./commands/read-lookup-view.js";
import { readViewCommand, type ReadViewFlags } from "./commands/read-view.js";
import { saveRecordCommand, type SaveRecordFlags } from "./commands/save-record.js";
import { sqlCommand, type SqlFlags } from "./commands/sql.js";
import { exitCodeFor } from "./exit-codes.js";

import type { CliGlobalFlags } from "./load-config.js";

const cli = cac("rmws");

cli.option("--wsdl <url>", "URL ou path do WSDL (override env)");
cli.option("--user <username>", "Username (Basic auth)");
cli.option("--password <password>", "Password (Basic auth)");
cli.option("--bearer <token>", "Bearer token");
cli.option("--timeout <ms>", "Timeout em milissegundos");
cli.option("--raw", "Retorna XML cru em vez de JSON");
cli.option("--quiet", "Suprime mensagens diagnósticas em stderr");
cli.option("--log-level <level>", "Nível de log em stderr (debug | info | warn | error)");
cli.option("--log-body", "Inclui body SOAP redigido nos logs (requer --log-level debug)");
cli.option("--no-wsdl-cache", "Desliga o cache em disco do WSDL (default: ligado na CLI)");
cli.option("--wsdl-cache-ttl <ms>", "TTL do cache de WSDL em ms (default: 24h)");
cli.option("--wsdl-cache-dir <path>", "Diretório do cache de WSDL (default: ~/.cache/rm-webservice-client)");

cli
  .command("inspect <service>", "Inspeciona WSDL (service: dataserver | sql)")
  .action(async (service: string, flags: CliGlobalFlags) => {
    const out = await inspectCommand(service, flags);
    process.stdout.write(out + "\n");
  });

cli
  .command("read-view <dataServerName>", "DataServer ReadView")
  .option("--filter <expr>", "Filtro RM")
  .option("--context <ctx>", "Contexto (string ou K=V;K=V)")
  .action(async (dataServerName: string, flags: ReadViewFlags) => {
    const out = await readViewCommand(dataServerName, flags);
    process.stdout.write(out + "\n");
  });

cli
  .command("catalog", "Lista DataServers do catálogo oficial TOTVS (offline, embutido)")
  .option("--module <name>", "Filtra por módulo (ex.: 'Recursos Humanos')")
  .option("--search <q>", "Busca em nome ou descrição")
  .option("--released", "Apenas DataServers marcados como liberados pela TOTVS")
  .option("--limit <n>", "Limita o número de resultados")
  .option("--modules", "Lista apenas os nomes dos módulos")
  .option("--json", "Saída em JSON")
  .action((flags: CatalogFlags) => {
    process.stdout.write(catalogCommand(flags) + "\n");
  });

cli
  .command(
    "build-record <dataServerName>",
    "Constrói XML de SaveRecord/DeleteRecord usando o schema do DataServer",
  )
  .option("--fields-json <json>", "Campos como JSON inline")
  .option("--fields-file <path>", "Caminho para arquivo JSON com os campos")
  .option("--row <name>", "Nome da row do schema (default: master)")
  .option("--context <ctx>", "Contexto para buscar o schema (string ou K=V;K=V)")
  .option("--out <path>", "Caminho do arquivo XML de destino (default: stdout)")
  .option("--bypass-validation", "Pula validação de tipos / required / maxLength")
  .option("--allow-unknown", "Aceita campos não declarados no schema sem lançar")
  .action(async (dataServerName: string, flags: BuildRecordFlags) => {
    const out = await buildRecordCommand(dataServerName, flags);
    process.stdout.write(out + "\n");
  });

cli
  .command("save-record <dataServerName>", "DataServer SaveRecord (escrita)")
  .option("--xml <content>", "XML do dataset (NewDataSet/Row) inline")
  .option("--xml-file <path>", "Caminho para arquivo com XML do dataset")
  .option("--context <ctx>", "Contexto (string ou K=V;K=V)")
  .action(async (dataServerName: string, flags: SaveRecordFlags) => {
    const out = await saveRecordCommand(dataServerName, flags);
    process.stdout.write(out + "\n");
  });

cli
  .command(
    "delete-record <dataServerName>",
    "DataServer DeleteRecord (escrita destrutiva)",
  )
  .option("--xml <content>", "XML do dataset (NewDataSet/Row) inline")
  .option("--xml-file <path>", "Caminho para arquivo com XML do dataset")
  .option("--context <ctx>", "Contexto (string ou K=V;K=V)")
  .option(
    "--strict",
    "Detecta erro embutido no Result e lança RmResultError (exit 6)",
  )
  .action(async (dataServerName: string, flags: DeleteRecordFlags) => {
    const out = await deleteRecordCommand(dataServerName, flags);
    process.stdout.write(out + "\n");
  });

cli
  .command(
    "delete-record-by-key <dataServerName> <primaryKey>",
    "DataServer DeleteRecordByKey (escrita destrutiva)",
  )
  .option(
    "--context <ctx>",
    "Contexto (string ou K=V;K=V). Chave composta: vírgula (ex.: '1,abc')",
  )
  .option(
    "--strict",
    "Detecta erro embutido no Result e lança RmResultError (exit 6)",
  )
  .action(
    async (
      dataServerName: string,
      primaryKey: string,
      flags: DeleteRecordByKeyFlags,
    ) => {
      const out = await deleteRecordByKeyCommand(
        dataServerName,
        primaryKey,
        flags,
      );
      process.stdout.write(out + "\n");
    },
  );

cli
  .command(
    "generate-types <dataServerName>",
    "Gera interfaces TypeScript a partir do GetSchema do DataServer",
  )
  .option("--out <path>", "Caminho de destino do arquivo .ts (default: stdout)")
  .option("--context <ctx>", "Contexto (string ou K=V;K=V)")
  .action(async (dataServerName: string, flags: GenerateTypesFlags) => {
    const out = await generateTypesCommand(dataServerName, flags);
    process.stdout.write(out + "\n");
  });

cli
  .command(
    "read-lookup-view <dataServerName>",
    "DataServer ReadLookupView (lookup/dropdown — leitura)",
  )
  .option("--filter <expr>", "Filtro RM")
  .option("--context <ctx>", "Contexto (string ou K=V;K=V)")
  .option("--owner-data <data>", "OwnerData (string/XML específico do DataServer)")
  .action(async (dataServerName: string, flags: ReadLookupViewFlags) => {
    const out = await readLookupViewCommand(dataServerName, flags);
    process.stdout.write(out + "\n");
  });

cli
  .command("sql <codSentenca>", "ConsultaSQL")
  .option("--coligada <n>", "Código da coligada")
  .option("--sistema <s>", "Código do sistema (G, S, F, ...)")
  .option("--params <p>", "Parâmetros (string ou K=V;K=V)")
  .option("--context <ctx>", "Contexto (usa queryWithContext quando presente)")
  .action(async (codSentenca: string, flags: SqlFlags) => {
    const out = await sqlCommand(codSentenca, flags);
    process.stdout.write(out + "\n");
  });

cli
  .command("diagnose [target]", "Diagnóstico (target: dataserver | sql | auth | all)")
  .option("--wsdl-dataserver <url>", "WSDL do dataServer (override env)")
  .option("--wsdl-sql <url>", "WSDL do ConsultaSQL (override env)")
  .option("--probe-dataserver <name>", "DataServer a ser usado em IsValidDataServer")
  .option("--probe-codsentenca <name>", "Sentença para smoke do ConsultaSQL")
  .option("--probe-coligada <n>", "Coligada do probe ConsultaSQL")
  .option("--probe-sistema <s>", "Sistema do probe ConsultaSQL")
  .option("--probe-params <p>", "Parâmetros do probe ConsultaSQL")
  .option("--probe-context <ctx>", "Contexto do probe ConsultaSQL")
  .action(async (target: string | undefined, flags: DiagnoseFlags) => {
    const { stdout, exitCode } = await diagnoseCommand(target, flags);
    process.stdout.write(stdout + "\n");
    if (exitCode !== 0) process.exit(exitCode);
  });

cli.help();
cli.version(VERSION);

async function main() {
  try {
    cli.parse(process.argv, { run: false });
    if (!cli.matchedCommand && process.argv.length <= 2) {
      cli.outputHelp();
      return;
    }
    await cli.runMatchedCommand();
  } catch (err) {
    const e = err as Error & { code?: string };
    const quiet = process.argv.includes("--quiet");
    if (!quiet) {
      process.stderr.write(`[${e.code ?? "ERROR"}] ${e.message}\n`);
    }
    process.exit(exitCodeFor(err));
  }
}

void main();
