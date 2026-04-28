export type RmPrimitive = string | number | boolean | null | undefined;

export type RmContext = string | Record<string, RmPrimitive>;
export type RmParameters = string | Record<string, RmPrimitive>;

export type Separator = ";" | ",";
