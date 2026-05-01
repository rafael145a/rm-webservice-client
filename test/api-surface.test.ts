/**
 * Lock da API pública 1.0+. Importa todo símbolo público da entry
 * principal e da subpath `/catalog`. Se algum export sumir ou mudar
 * shape, o `tsc --noEmit` (parte do `npm run typecheck`) quebra. Isso
 * dá um portão duro contra breaking changes acidentais.
 *
 * Política de SemVer: a partir da 1.0.0 a forma desses símbolos é
 * congelada — só muda em major (2.0+). Pra adicionar um símbolo novo
 * (não-breaking), basta importá-lo aqui.
 */
import { describe, it, expect } from "vitest";

// === entry principal ===
import {
  VERSION,
  // factory
  createRmClient,
  // wsdl
  defaultCacheDir,
  loadWsdl,
  resolveWsdlService,
  // logging
  NOOP_LOGGER,
  createConsoleLogger,
  redactHeaders,
  redactString,
  // errors (classes)
  RmError,
  RmConfigError,
  RmHttpError,
  RmSoapFaultError,
  RmParseError,
  RmResultError,
  RmTimeoutError,
  RmValidationError,
  // rm helpers
  assertRmResultOk,
  detectRmResultError,
  // schema helpers (0.5+)
  parseXsdSchema,
  generateTypes,
  // builder helpers (0.6+)
  buildRecord,
  validateRecord,
} from "../src/index.js";

import type {
  // client surface
  AuthenticateOptions,
  CheckConsultaSqlOptions,
  CheckDataServerOptions,
  ConsultaSqlClient,
  ConsultaSqlOptions,
  ConsultaSqlWithContextOptions,
  DataServerClient,
  DataServerNameInput,
  DeleteRecordByKeyOptions,
  DeleteRecordOptions,
  DiagnosticReport,
  DiagnosticStep,
  DiagnosticsClient,
  GetSchemaOptions,
  IsValidDataServerOptions,
  KnownDataServerName,
  ParseModeArray,
  ParseModeRecord,
  ParseModeSaveRecord,
  ReadLookupViewOptions,
  ReadRecordOptions,
  ReadViewOptions,
  RmClient,
  RmClientOptions,
  RmSoapServiceOptions,
  SaveRecordOptions,
  // auth
  RmAuth,
  // rm primitives
  RmContext,
  RmParameters,
  RmPrimitive,
  Separator,
  // wsdl resolve types
  ResolvedSoapOperation,
  ResolvedSoapService,
  WsdlCacheOptions,
  // logging types
  ConsoleLoggerOptions,
  LogLevel,
  LogPayload,
  RmLogger,
  // errors / extras
  RmValidationIssue,
  RmValidationIssueKind,
  DetectResultErrorMatch,
  // schema (0.5+)
  GenerateTypesOptions,
  RmDataServerSchema,
  RmFieldSchema,
  RmFieldTsType,
  RmRowSchema,
  // builder (0.6+)
  BuildRecordOptions,
  RmFieldValue,
  RmRecordFields,
  RmRecordsInput,
  ValidateRecordOptions,
} from "../src/index.js";

// === subpath /catalog ===
import {
  CATALOG_META,
  KNOWN_DATASERVERS,
  KNOWN_MODULES,
  findDataServer,
  searchDataServers,
} from "../src/catalog/index.js";

import type {
  CatalogMeta,
  KnownDataServer,
  SearchDataServersOptions,
} from "../src/catalog/index.js";

describe("API surface lock (1.0+)", () => {
  it("exports do main entry estão presentes", () => {
    expect(typeof VERSION).toBe("string");
    expect(typeof createRmClient).toBe("function");
    expect(typeof loadWsdl).toBe("function");
    expect(typeof resolveWsdlService).toBe("function");
    expect(typeof defaultCacheDir).toBe("function");

    expect(typeof createConsoleLogger).toBe("function");
    expect(typeof redactHeaders).toBe("function");
    expect(typeof redactString).toBe("function");
    expect(NOOP_LOGGER).toBeTruthy();

    // erros são classes
    expect(typeof RmError).toBe("function");
    expect(typeof RmConfigError).toBe("function");
    expect(typeof RmHttpError).toBe("function");
    expect(typeof RmSoapFaultError).toBe("function");
    expect(typeof RmParseError).toBe("function");
    expect(typeof RmResultError).toBe("function");
    expect(typeof RmTimeoutError).toBe("function");
    expect(typeof RmValidationError).toBe("function");

    // result helpers
    expect(typeof assertRmResultOk).toBe("function");
    expect(typeof detectRmResultError).toBe("function");

    // schema helpers
    expect(typeof parseXsdSchema).toBe("function");
    expect(typeof generateTypes).toBe("function");
    expect(typeof buildRecord).toBe("function");
    expect(typeof validateRecord).toBe("function");
  });

  it("exports do subpath /catalog estão presentes", () => {
    expect(typeof findDataServer).toBe("function");
    expect(typeof searchDataServers).toBe("function");
    expect(Array.isArray(KNOWN_DATASERVERS)).toBe(true);
    expect(Array.isArray(KNOWN_MODULES)).toBe(true);
    expect(CATALOG_META.source).toMatch(/apitotvslegado/);
  });

  it("ParseModes literais são as esperadas", () => {
    const a: ParseModeArray = "raw";
    const b: ParseModeRecord = "record";
    const c: ParseModeSaveRecord = "result-strict";
    expect([a, b, c]).toEqual(["raw", "record", "result-strict"]);
  });

  it("RmValidationIssueKind cobre os 4 casos", () => {
    const kinds: RmValidationIssueKind[] = ["unknown", "required", "type", "maxLength"];
    expect(kinds).toHaveLength(4);
  });

  it("LogLevel cobre 4 níveis", () => {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    expect(levels).toHaveLength(4);
  });

  // O bloco abaixo é "compile-only" — se algum tipo sumir ou mudar
  // de shape, o tsc reclama sem precisar de assertion runtime.
  it("compile-only: tipos públicos são utilizáveis", () => {
    type _Surface = {
      auth: RmAuth;
      ctx: RmContext;
      params: RmParameters;
      prim: RmPrimitive;
      sep: Separator;
      clientOptions: RmClientOptions;
      soapService: RmSoapServiceOptions;
      ds: DataServerClient;
      sql: ConsultaSqlClient;
      diag: DiagnosticsClient;
      auth1: AuthenticateOptions;
      check1: CheckConsultaSqlOptions;
      check2: CheckDataServerOptions;
      cs: ConsultaSqlOptions;
      cswc: ConsultaSqlWithContextOptions;
      gs: GetSchemaOptions;
      iv: IsValidDataServerOptions;
      rl: ReadLookupViewOptions;
      rr: ReadRecordOptions;
      rv: ReadViewOptions;
      sr: SaveRecordOptions;
      dr: DeleteRecordOptions;
      drk: DeleteRecordByKeyOptions;
      rep: DiagnosticReport;
      step: DiagnosticStep;
      cache: WsdlCacheOptions;
      logOpt: ConsoleLoggerOptions;
      log: RmLogger;
      payload: LogPayload;
      schema: RmDataServerSchema;
      row: RmRowSchema;
      field: RmFieldSchema;
      tsType: RmFieldTsType;
      buildOpt: BuildRecordOptions;
      validateOpt: ValidateRecordOptions;
      genOpt: GenerateTypesOptions;
      input: RmRecordsInput;
      fields: RmRecordFields;
      val: RmFieldValue;
      issue: RmValidationIssue;
      err: DetectResultErrorMatch;
      op: ResolvedSoapOperation;
      svc: ResolvedSoapService;
      ds1: DataServerNameInput;
      ds2: KnownDataServerName;
      client: RmClient;
      catMeta: CatalogMeta;
      catItem: KnownDataServer;
      catSearch: SearchDataServersOptions;
    };
    // Valor dummy só para impedir que o compilador descarte _Surface.
    const _check: keyof _Surface = "auth";
    expect(_check).toBe("auth");
  });
});
