/** Tipo TypeScript a ser emitido para um campo. */
export type RmFieldTsType = "string" | "number" | "boolean";

/** Metadados extraídos para um campo do XSD do RM. */
export interface RmFieldSchema {
  /** Nome do elemento XSD (ex.: `CODUSUARIO`, `STATUS`). */
  name: string;
  /** Tipo TS a ser emitido (`string` | `number` | `boolean`). */
  tsType: RmFieldTsType;
  /** Tipo XSD original (ex.: `xs:int`, `xs:dateTime`, `xs:string`). */
  xsdType: string;
  /** True quando `minOccurs="0"`. Vira `?` no campo da interface. */
  optional: boolean;
  /** `msdata:Caption` traduzido — vai pra JSDoc do campo. */
  caption?: string;
  /** Valor default declarado no XSD. */
  default?: string;
  /** `xs:maxLength` quando o tipo tem restrição. */
  maxLength?: number;
}

/** Uma "row" dentro do dataset (ex.: `GUSUARIO`, `GPERMIS`). */
export interface RmRowSchema {
  name: string;
  fields: RmFieldSchema[];
}

/** Schema completo de um DataServer parseado. */
export interface RmDataServerSchema {
  /** Nome do dataset (atributo do `<xs:element ... msdata:IsDataSet="true">`). */
  datasetName: string;
  /** Rows declaradas em ordem (master normalmente vem primeiro). */
  rows: RmRowSchema[];
}
