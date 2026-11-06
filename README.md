# Associae

Aplicação web fullstack para gestão de associações, com autenticação por CPF, organizações multi-tenant, cargos, convites, membros e pré-cadastro de pessoas.

**Produção:** https://www.associae.com.br

> Repositório privado, destinado exclusivamente aos integrantes autorizados da equipe. O acesso ao código não autoriza redistribuição ou uso fora do projeto.

## Stack

| Tecnologia | Uso |
|---|---|
| Next.js 16.4.3 | App Router, Server Components, Server Actions e Route Handlers |
| React 19 | Interface |
| TypeScript | Tipagem estrita |
| PostgreSQL 18 | Banco de dados |
| Drizzle ORM | Schema e migrações |
| Biome | Formatação, lint e organização de imports |
| Resend | Envio de emails de confirmação e recuperação |
| Vercel + Neon | Hospedagem e banco de produção |
| pnpm | Gerenciador de pacotes |

A autenticação é própria, com CPF, Argon2id e sessões opacas persistidas no banco.

## Requisitos

- Node.js 26
- pnpm
- PostgreSQL 18
- Git

## Configuração local

Node.js 24 é o runtime de produção, do CI e do desenvolvimento; use `nvm use` para respeitar o `.nvmrc`.

```bash
pnpm install
cp .env.example .env.local
```

Para subir um PostgreSQL local com Docker:

```bash
docker run --name associae-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=associae \
  -p 5432:5432 \
  -d postgres:18
```

Depois:

```bash
pnpm db:migrate
pnpm dev
```

A aplicação fica em `http://localhost:3000`.

## Variáveis de ambiente

| Variável | Uso |
|---|---|
| `DATABASE_URL` | Conexão PostgreSQL da aplicação |
| `TEST_DATABASE_URL` | Banco dedicado dos testes de integração e do Vitest Browser Mode |
| `E2E_DATABASE_URL` | Banco dedicado do Playwright (padrão: `TEST_DATABASE_URL`) |
| `APP_URL` | URL pública usada nos links de email |
| `RESEND_API_KEY` | Chave da API do Resend |
| `EMAIL_FROM` | Remetente verificado, ex.: `Associae <no-reply@associae.com.br>` |
| `CRON_SECRET` | Bearer token exigido pela rota de limpeza agendada |
| `BLOB_READ_WRITE_TOKEN` | Token do Vercel Blob usado nos documentos institucionais |
| `LOGIN_TRUSTED_IP_HEADER` | Header de IP confiável quando houver proxy reverso |

Nunca versionar `.env.local` ou credenciais reais. Fora do desenvolvimento local, `APP_URL` deve usar HTTPS.

## Scripts

| Comando | Função |
|---|---|
| `pnpm dev` | Servidor de desenvolvimento |
| `pnpm build` | Build de produção |
| `pnpm start` | Servidor do build |
| `pnpm typecheck` | Verificação TypeScript |
| `pnpm check` | Biome: lint, formato e imports |
| `pnpm lint` / `pnpm format` | Lint e formatação isolados |
| `pnpm test` | Testes unitários e de integração |
| `pnpm test:unit` | Somente testes unitários |
| `pnpm test:integration` | Testes de integração com PostgreSQL |
| `pnpm test:browser` | Componentes em navegador real (Vitest Browser Mode) |
| `pnpm test:e2e` | Fluxos completos com Playwright |
| `pnpm test:e2e:dev` | Playwright contra o servidor de desenvolvimento |
| `pnpm test:coverage` | Cobertura V8 em `coverage/` |
| `pnpm db:migrate` | Aplica migrações pendentes |
| `pnpm platform-admin:grant <email>` | Concede acesso de administrador da plataforma a um usuário existente |

## Testes

A suíte usa quatro camadas: unitários e integração com Vitest, componentes em navegador real com Vitest Browser Mode e fluxos completos com Playwright. O guia completo está em [docs/testes.md](docs/testes.md).

```bash
cp .env.example .env.local
pnpm exec playwright install chromium

pnpm test          # unitários + integração
pnpm test:browser  # componentes no navegador
pnpm test:e2e      # build de produção + banco real
```

Os testes usam um banco dedicado em `TEST_DATABASE_URL`. O schema é recriado a partir das migrações antes da execução e recusa bancos cujo nome não contenha `test`. O CI sobe um PostgreSQL separado e executa todos os níveis.

## Arquitetura

```text
src/
  app/                 Rotas, layouts, Server Actions e Route Handlers
  components/          Componentes compartilhados de UI e aplicação
  db/
    schema/            Tabelas e enums Drizzle
  modules/
    audit/             Eventos de auditoria
    authorization/     Permissões e verificação de acesso
    identity/          Cadastro, confirmação, sessões e senha
    invites/           Convites individuais e compartilhados
    organizations/     Organizações, cargos, membros e pré-cadastro
    maintenance/       Limpeza operacional
  lib/                 Sessão, email, erros, formatação e utilitários
docs/                  Regras de negócio, modelo de organizações e UI/UX
drizzle/               Migrações e snapshots
scripts/               Utilitários operacionais
```

### Decisões principais

- `users` representa a pessoa; `accounts` representa as credenciais. Uma pessoa pode existir antes da conta.
- O CPF é identidade global e não deve gerar duplicatas entre organizações.
- O CNPJ precisa ter CNAE fiscal no grupo 94 (atividades de associação).
- A concessão de provisionamento não é vínculo nem cargo e expira na ativação da organização.
- Toda autorização é verificada no servidor por permissões de cargo e vínculo ativo.
- Server Actions validam entrada, aplicam regras de negócio e registram auditoria.
- Cada organização é um limite de isolamento; IDs enviados pelo cliente não são autorização.
- O cargo padrão de ingresso não pode ser de diretoria nem de acesso completo.
- A organização não pode ficar sem cargo padrão ativo, sem membro ativo com acesso completo ou com cargo em uso desativado.

## Fluxos implementados

- Cadastro público com confirmação de email e definição de senha.
- Login por CPF, sessões opacas com hash, recuperação e redefinição de senha.
- Solicitação de organização pelo presidente com CNPJ e ata de eleição.
- Revisão da ata e aprovação/rejeição por administrador da plataforma.
- Criação da organização em provisionamento, cargos iniciais e presidente ativo.
- Ativação com invariantes de cargos e vínculos.
- Criação, edição, desativação e reativação de cargos.
- Listagem de membros com busca e paginação, alteração de cargo e desativação com motivo e auditoria.
- Perfil do titular com edição de nome/telefone, alteração de email confirmada no novo endereço e troca de senha com revogação das outras sessões.
- Gestão de sessões ativas, com identificação da sessão atual e encerramento individual.
- Convites individuais e compartilhados, com expiração, limite de usos, reenvio com invalidação do link anterior, filtros, paginação e reativação de vínculo inativo.
- Pré-cadastro por operador, com escolha de cargo, link de ativação, lista de pendentes, reenvio de link e resolução de contato divergente pelo titular.
- Painel de solicitações de organização para administradores da plataforma, com pendentes, aprovadas e rejeitadas, busca e paginação.
- Criação de organização pelo administrador da plataforma com concessão temporária de configuração ao CPF indicado.
- Listagem das organizações da plataforma, com filtro por status e paginação.
- Envio obrigatório de estatuto e ata de eleição para ativação, com armazenamento privado no Vercel Blob e download autorizado.
- Auditoria por organização, com permissão `audit.read`, filtro por evento, paginação e detalhes.
- Encerramento e reabertura auditada da organização, com motivo, revogação dos convites válidos e acesso somente leitura enquanto encerrada.

## Banco de dados e migrações

O schema fica em `src/db/schema` e as migrações em `drizzle/`.

```bash
pnpm db:migrate
```

Antes de publicar uma alteração de schema:

1. Gere e revise a migração.
2. Aplique no banco local.
3. Aplique no Neon de produção antes de publicar o código que depende dela.
4. Nunca edite uma migração já aplicada em produção.

## Deploy

- Aplicação: Vercel (projeto `minha-associacao`), runtime Node.js 24.
- Banco: Neon PostgreSQL.
- Domínio: `https://www.associae.com.br` (o apex redireciona para `www`).
- Cron: `/api/cron/cleanup`, diariamente às 03:00, protegido por `CRON_SECRET`.
- Blob: store privado `associae-documents` em `gru1`, conectado ao projeto; `BLOB_READ_WRITE_TOKEN` é gerenciado pela Vercel.
- Emails: domínio verificado no Resend e remetente em `EMAIL_FROM`.
- O primeiro administrador da plataforma precisa ser concedido manualmente com `pnpm platform-admin:grant <email>`; essa conta deve existir antes.

### Ambientes

Cada ambiente usa credenciais próprias; `preview` e `development` nunca apontam para o banco nem para o Blob de produção.

| Variável | `production` | `preview` | `development` |
|---|---|---|---|
| `DATABASE_URL` | Neon de produção | banco isolado do ambiente | banco isolado do ambiente |
| `BLOB_READ_WRITE_TOKEN` | store `associae-documents` | store `associae-documents-dev` | store `associae-documents-dev` |
| `APP_URL` | `https://www.associae.com.br` | URL do deployment | `http://localhost:3000` |
| `RESEND_API_KEY` | chave de produção | chave de produção | chave restrita ao domínio |
| `EMAIL_FROM` | remetente verificado | remetente verificado | remetente verificado |
| `CRON_SECRET` | segredo de produção | segredo próprio | segredo próprio |

O ambiente `development` da Vercel é o que `vercel dev` e `vercel env pull` consomem. `TEST_DATABASE_URL` e `E2E_DATABASE_URL` existem apenas na máquina de desenvolvimento e não devem ser cadastradas na Vercel.

Após mudanças de variáveis de ambiente, faça um novo deploy para as funções usarem os valores atualizados.

## Documentação

- [Regras de negócio](docs/regras-de-negocio.md)
- [Modelo de organizações](docs/organizacoes-modelo.md)
- [Auditoria de autorização e invariantes](docs/auditoria-autorizacao.md)
- [Diretrizes de UI/UX e acessibilidade](docs/ui-ux-guidelines.md)
- [Testes](docs/testes.md)
- [Instruções para agentes](AGENTS.md)

## Git

- Desenvolva em branches `feat/`, `fix/`, `refactor/`, `docs/` ou `chore/`.
- Use Conventional Commits.
- Abra pull request com objetivo, resumo, validação e impacto em banco/infraestrutura.
- Não faça commit de segredos, `.env.local`, artefatos de build ou dados pessoais reais.

---

**Associae — documentação interna de desenvolvimento.**
