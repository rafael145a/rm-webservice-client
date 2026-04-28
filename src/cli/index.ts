import { cac } from "cac";

import { VERSION } from "../index.js";

import { inspectCommand } from "./commands/inspect.js";
import { readViewCommand, type ReadViewFlags } from "./commands/read-view.js";
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
  .command("sql <codSentenca>", "ConsultaSQL")
  .option("--coligada <n>", "Código da coligada")
  .option("--sistema <s>", "Código do sistema (G, S, F, ...)")
  .option("--params <p>", "Parâmetros (string ou K=V;K=V)")
  .option("--context <ctx>", "Contexto (usa queryWithContext quando presente)")
  .action(async (codSentenca: string, flags: SqlFlags) => {
    const out = await sqlCommand(codSentenca, flags);
    process.stdout.write(out + "\n");
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
