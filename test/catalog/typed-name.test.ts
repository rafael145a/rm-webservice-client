/**
 * Compile-only test: garante que DataServerNameInput dá autocomplete
 * dos nomes do catálogo mas não bloqueia strings arbitrárias.
 *
 * Este arquivo é incluído no `tsc --noEmit` (typecheck) — se algo
 * quebrar, o build falha. Não roda no Vitest.
 */
import { describe, it, expect } from "vitest";

import type {
  DataServerNameInput,
  KnownDataServerName,
  ReadViewOptions,
  SaveRecordOptions,
} from "../../src/client/types.js";

describe("DataServerNameInput (compile-only)", () => {
  it("aceita nomes do catálogo (autocomplete-friendly)", () => {
    const a: DataServerNameInput = "RhuPessoaData";
    const b: DataServerNameInput = "GlbUsuarioData";
    const c: DataServerNameInput = "EduPessoaData";
    expect([a, b, c]).toHaveLength(3);
  });

  it("aceita strings arbitrárias (DataServers customizados da instância)", () => {
    const custom: DataServerNameInput = "MeuDataServerCustomDaEmpresa";
    expect(custom).toBeTypeOf("string");
  });

  it("ReadViewOptions.dataServerName é DataServerNameInput", () => {
    const opts: ReadViewOptions = {
      dataServerName: "RhuPessoaData",
      filter: "PPESSOA.CODIGO=1",
    };
    expect(opts.dataServerName).toBe("RhuPessoaData");

    const optsCustom: ReadViewOptions = {
      dataServerName: "AlgumDataServerInternoData",
    };
    expect(optsCustom.dataServerName).toBe("AlgumDataServerInternoData");
  });

  it("SaveRecordOptions.dataServerName é DataServerNameInput", () => {
    const opts: SaveRecordOptions = {
      dataServerName: "RhuPessoaData",
      xml: "<NewDataSet/>",
    };
    expect(opts.dataServerName).toBe("RhuPessoaData");
  });

  it("KnownDataServerName é re-exportado pra uso explícito", () => {
    const known: KnownDataServerName = "RhuPessoaData";
    expect(known).toBe("RhuPessoaData");
  });
});
