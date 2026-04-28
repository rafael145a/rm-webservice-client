export type RmAuth =
  | { type: "basic"; username: string; password: string }
  | { type: "bearer"; token: string }
  | { type: "bearer"; getToken: () => string | Promise<string> };
