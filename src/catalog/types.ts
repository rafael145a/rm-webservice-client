export interface KnownDataServer {
  /** Nome canônico do DataServer (ex.: "RhuPessoaData", "GlbUsuarioData"). */
  name: string;
  /** Descrição do catálogo TOTVS (português). */
  description: string;
  /** Nome do módulo TOTVS (ex.: "Recursos Humanos", "Educacional", "Globais"). */
  module: string;
  /**
   * Se a TOTVS lista o DataServer como "Liberado: Sim" no catálogo público.
   * `false` significa que pode requerer solicitação de liberação à TOTVS — não
   * é garantia de que esteja indisponível na sua instância.
   */
  released: boolean;
}

export interface CatalogMeta {
  /** URL do catálogo oficial da TOTVS de onde os dados foram extraídos. */
  source: string;
  /** Data (YYYY-MM-DD) do último scraping. */
  fetchedAt: string;
  /** Total de DataServers no catálogo. */
  count: number;
  /** Lista ordenada de nomes de módulos. */
  modules: readonly string[];
}

export interface SearchDataServersOptions {
  /** Texto a buscar em `name` ou `description` (case-insensitive). */
  query?: string;
  /** Filtra por módulo exato (ex.: "Recursos Humanos"). */
  module?: string;
  /** Quando true, retorna apenas DataServers com `released === true`. */
  releasedOnly?: boolean;
  /** Limita o número de resultados. */
  limit?: number;
}
