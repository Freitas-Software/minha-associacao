# Testes — Associae

A suíte é dividida em quatro camadas. Cada uma responde a uma pergunta diferente e usa a ferramenta mais adequada.

| Camada | Ferramenta | Pasta | Pergunta respondida |
|---|---|---|---|
| Unitário | Vitest (`node`) | `src/**/*.test.ts`, `tests/unit` | Uma regra ou função calcula corretamente? |
| Integração | Vitest (`node`) + PostgreSQL real | `src/**/*.db.test.ts`, `tests/integration` | O módulo funciona com o schema e as constraints reais? |
| Navegador | Vitest Browser Mode + Playwright | `tests/browser` | O componente reage corretamente no navegador (foco, teclado, estado)? |
| E2E | Playwright | `tests/e2e` | O fluxo completo funciona em um build de produção com banco real? |

Testes de páginas e Server Components assíncronos pertencem à camada E2E: o Vitest não renderiza `async` Server Components.

## Comandos

```bash
pnpm test              # unitários + integração
pnpm test:unit         # somente unitários
pnpm test:integration  # somente integração (exige TEST_DATABASE_URL)
pnpm test:browser      # componentes em navegador real (Chromium)
pnpm test:coverage     # unitários + integração com cobertura V8
pnpm test:e2e          # Playwright contra build de produção
pnpm test:e2e:dev      # Playwright contra next dev
pnpm test:e2e:ui       # modo interativo do Playwright
pnpm test:all          # unitários + integração + navegador + E2E
pnpm test:watch        # Vitest em watch mode
```

Na primeira execução em uma máquina nova:

```bash
cp .env.example .env.local
pnpm exec playwright install chromium
```

## Banco de dados de teste

Os testes destrutivos usam exclusivamente `TEST_DATABASE_URL` (ou `E2E_DATABASE_URL` no Playwright), nunca `DATABASE_URL` do desenvolvimento.

- O banco precisa ter `test` no nome. Sem isso, o setup recusa recriar o schema. Use `TEST_DATABASE_ALLOW_UNSAFE=1` somente para um banco descartável com outro nome.
- O setup global de integração roda uma vez por execução: recria o schema `public`, aplica todas as migrações de `drizzle/` e preserva a tabela `permissions` entre testes.
- Antes de cada teste de integração, as tabelas públicas são truncadas. Os testes antigos de domínio continuam usando tabelas temporárias (`pg_temp`), que isolam cada arquivo por sessão.
- O Playwright executa `tests/e2e/prepare-database.ts` antes do build: recria o schema, aplica migrações e insere as fixtures determinísticas de `tests/support/seed.ts`.

O servidor E2E roda em modo de produção com `LOGIN_TRUSTED_IP_HEADER=x-forwarded-for` e o navegador envia esse header. Isso exercita o caminho real de resolução de IP atrás de proxy, sem enfraquecer a regra de produção.
- Os arquivos de integração rodam em sequência (`fileParallelism: false`). Unitários e navegador mantêm paralelismo.

Para criar o banco localmente:

```bash
psql "postgresql://postgres:postgres@localhost:5432/postgres" \
  -c 'CREATE DATABASE associae_test;'
```

O setup também cria o banco automaticamente quando o usuário tem permissão.

## Fixtures de E2E

`tests/support/fixtures.ts` concentra os dados compartilhados:

- Presidente: CPF `52998224725`, senha `Associae@Teste2026`.
- Administrador da plataforma: CPF `11144477735`, mesma senha.
- Organização ativa `Associação Teste E2E`, com cargos Presidente e Associado.

Use essas constantes nos specs em vez de repetir literais. Novas fixtures devem ser inseridas por `seedTestData` e continuar determinísticas.

## Como escrever novos testes

- Unitário: coloque `*.test.ts` próximo ao código e importe `{ test } from 'vitest'`.
- Integração: use o sufixo `*.db.test.ts` em `src` ou `*.test.ts` em `tests/integration`, envolva o suíte com `describeDatabase` de `@tests/support/database-suite` e injete o banco de teste (as funções de domínio aceitam `database` como parâmetro). Prefira o schema real; use tabelas temporárias apenas quando o objetivo for testar uma consulta isolada.
- Navegador: use `*.browser.test.tsx` em `tests/browser`, `render` de `vitest-browser-react` e locators acessíveis (`getByRole`, `getByLabelText`).
- E2E: use `*.spec.ts` em `tests/e2e`, `getByRole`/`getByLabel` e evite seletores CSS frágeis. Fluxos de escrita devem criar seus próprios dados ou restaurar o estado.
- Não use `waitForTimeout`; aguarde um efeito observável (`toHaveURL`, `toBeVisible`, `expect.poll`).
- Testes que dependem de email, Blob ou provedores externos devem mockar a borda (`fetch`, storage) em vez de chamar a rede real.

## Cobertura

`pnpm test:coverage` gera relatórios texto, HTML e LCOV em `coverage/`. A configuração exclui testes, layouts, páginas, `error.tsx` e `not-found.tsx`, que são cobertos pela camada E2E.

O teste de acessibilidade ignora temporariamente `color-contrast`: os tokens visuais atuais têm violações detectadas no landing page e precisam de uma revisão de design separada. As demais regras WCAG A/AA continuam bloqueantes.

## CI

O workflow `.github/workflows/ci.yml` possui dois jobs:

- `checks`: typecheck, Biome, testes unitários + integração e build.
- `e2e`: testes de navegador (Vitest Browser Mode) e Playwright contra build de produção.

O banco de integração é criado no início do job e o schema é recriado pelo setup. Nenhum teste depende de dados de desenvolvimento.
