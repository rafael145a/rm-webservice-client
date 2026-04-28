# Contributing

Obrigado por considerar contribuir.

## Setup

```bash
npm install
npm run build
npm test
```

## Convenções

- TypeScript estrito (`strict: true`).
- Sem `any` sem justificativa.
- Funções pequenas, uma responsabilidade.
- Testes em `test/` espelhando `src/` (ex.: `src/wsdl/resolve-wsdl-service.ts` → `test/wsdl/resolve-wsdl-service.test.ts`).
- Nunca commitar WSDL/XML com hostnames reais — sanitizar para `rm.example.com` antes.
- Nunca commitar credenciais.

## Pull requests

1. Fork + branch
2. `npm run lint && npm test` precisa passar
3. Adicionar/atualizar testes para qualquer mudança comportamental
4. Atualizar `README.md` se a API pública mudou

## Reportando bugs

Ao reportar um problema com resposta SOAP, sanitize o XML antes de colar.
Substitua hostnames, usuários, e dados pessoais por valores fictícios.
