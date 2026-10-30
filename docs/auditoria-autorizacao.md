# Auditoria de autorização e invariantes — 29/10/2026

**Status:** registro técnico da auditoria realizada nesta data. Não altera nem substitui as [regras de negócio](regras-de-negocio.md); os achados descrevem o código atual e as decisões pendentes ficam identificadas como tal.

## Objetivo

Verificar se toda Server Action, Route Handler e carregamento de dados da aplicação aplica autorização no servidor antes de ler ou alterar dados, e revisar as invariantes de negócio que dependem de mais de uma tabela.

## Método

- Leitura de todas as 11 unidades com `'use server'` (33 actions), dos 3 Route Handlers e das páginas que carregam dados de organização.
- Confronto entre a action, o serviço de módulo que ela chama e a consulta de acesso (`getOrganizationAccess`, `hasPermission`, `isPlatformAdmin`).
- Revisão das invariantes que envolvem organização, cargo, vínculo, convite e documento, incluindo concorrência entre transações.
- Ampliação dos testes de integração em PostgreSQL local (`RUN_DATABASE_TESTS=1`).

## Cobertura das Server Actions

Toda mutação com escopo de organização delega a um serviço que consulta o vínculo ou a concessão de provisionamento e exige a permissão correspondente. A action nunca decide autorização.

| Action | Identidade | Autoridade exigida | Escopo do objeto |
|---|---|---|---|
| `requestRegistration`, `login`, `requestPasswordReset`, `resetPassword`, `completeRegistration` | fluxo público | token e/ou limite de tentativas | token/CPF |
| `logout`, `renewSession`, `endOtherSessions` | cookie de sessão | sessão corrente | conta da sessão |
| `updateProfile`, `requestEmailChange`, `confirmEmailChange`, `changePassword`, `revokeSession` | sessão | titular | `session.userId` |
| `createInvite`, `resendInvite`, `revokeInvite` | sessão | `invites.manage` + `canGrantRole` | organização do convite |
| `acceptInvite` | sessão verificada | token + CPF do convite | organização do convite |
| `createRole`, `updateRole` | sessão | `roles.manage` + `canGrantRole` | organização informada |
| `updateOrganization` | sessão | `organization.update` | organização informada |
| `activateOrganization` | sessão | `organization.activate` | organização informada |
| `closeOrganization`, `reopenOrganization` | sessão | `organization.close` | organização informada |
| `deactivateMembership`, `updateMembershipRole` | sessão | `members.manage` + `canGrantRole` | organização derivada do vínculo |
| `requestPreRegistration`, `resendPreRegistration` | sessão | `members.manage` + `canGrantRole` | organização derivada do pré-cadastro |
| `uploadOrganizationDocument` | sessão | `organization.update` | organização informada |
| `createOrganization`, `approveOrganizationRequest`, `rejectOrganizationRequest` | sessão | administrador da plataforma | plataforma |
| `requestOrganization` | sessão | — (solicitação sujeita à análise) | plataforma |

Route Handlers:

- `documentos/[documentId]` exige sessão e `organization.read`, e confirma que o documento pertence à organização da rota.
- `admin/solicitacoes/[requestId]/documento` exige administrador da plataforma.
- `api/cron/cleanup` exige `CRON_SECRET` comparado com `timingSafeEqual`.

Leituras privilegiadas conferem permissão no serviço (`roles.read`, `members.read`, `audit.read`, `invites.manage`, `organization.read`) e páginas restritas usam `isPlatformAdmin` antes de listar dados da plataforma.

## Invariantes revisadas

| Invariante | Onde é aplicada | Teste de integração |
|---|---|---|
| Organização encerrada é somente leitura e mantém leitura + `organization.close` | `getOrganizationAccess` filtra o catálogo; mutações revalidam o estado sob lock | "keeps a closed organization read-only for every management path" |
| Único estado adicional é `closed`; reabertura usa a mesma permissão e não restaura convites | `closeOrganization` / `reopenOrganization` | "closes and reopens an organization with audited read-only access" |
| Isolamento entre organizações | `getOrganizationAccess` por organização; serviços derivam a organização do alvo | "isolates authority between organizations" |
| Exatamente um cargo padrão ativo, sem diretoria e sem acesso completo, para ativar | `activateOrganization` agora valida as três condições | "requires a non-privileged active default role to activate" |
| Organização ativa não fica sem membro ativo com acesso completo | `deactivateMembership`, `updateMembershipRole`, `updateRole`; `updateRole` serializa com lock na organização | "blocks removing the last full-access member", role management |
| Cargo só é desativado sem vínculo ativo nem convite válido | `updateRole` | "blocks deactivation of roles with memberships or pending invites" |
| Ninguém concede autoridade que não possui | `canGrantRole` em cargos, convites, atribuição de cargo e pré-cadastro | "prevents granting authority beyond the actor" |
| Concessão temporária termina na ativação e não vale em organização ativa | `getOrganizationAccess` exige `provisioning`; ativação revoga a concessão | "ends temporary provisioning access when the organization activates" |
| Convite compartilhado não concede diretoria nem acesso completo; revalidação na conclusão | `createInvite`, `resendInvite`, `validateInviteToken`, `acceptInvite`, `completeRegistration` | invite domain |
| Revogação de convite é única e auditada uma vez | `revokeInvite` com atualização condicional | "revoked and expired invites are rejected" |
| Administração da plataforma não recebe autoridade de organização | `isPlatformAdmin` isolado de `getOrganizationAccess` | "does not grant platform admins organization authority" |

## Correções aplicadas nesta rodada

1. **Ativação aceitava cargo padrão privilegiado** quando os dados chegavam fora do fluxo da aplicação: a checagem contava apenas um cargo padrão ativo e um cargo de acesso completo, sem exigir que fossem cargos distintos e não privilegiados. A ativação agora exige que o único cargo padrão ativo não seja de diretoria e não tenha acesso completo.
2. **Invariantes de cargo não eram serializadas com mudanças de vínculo.** `updateRole` verificava "último membro com acesso completo" sem bloquear a organização, enquanto `deactivateMembership` e `updateMembershipRole` já bloqueavam. Duas transações concorrentes podiam remover o último acesso completo. `updateRole` passou a bloquear a linha da organização antes das verificações.
3. **Organização encerrada podia ser alterada em corrida com o encerramento.** A autorização era calculada antes da transação; `updateOrganization`, `updateRole`, `createRole`, `deactivateMembership`, `updateMembershipRole`, `createInvite`, `resendInvite` e `createPreRegistrationLink` agora releem o estado da organização sob lock e recusam a operação se ela estiver encerrada.
4. **Revogação de convite não era idempotente sob concorrência.** `revokeInvite` atualizava o convite sem condição, podendo duplicar o evento de auditoria. A atualização agora é condicional a `revoked_at is null` e retorna `already-revoked` quando outra transação venceu.

## Riscos residuais e decisões pendentes

- **Autoridade sobre o cargo atual do vínculo (recomendação).** `deactivateMembership` e `updateMembershipRole` exigem `members.manage`, mas não verificam se o ator consegue administrar o cargo que o alvo ocupa hoje. Um gestor sem `roles.manage` pode desativar ou rebaixar alguém com mais permissões que ele, desde que exista outro membro com acesso completo. `updateRole` já aplica a restrição simétrica. Igualar o comportamento é uma decisão de produto; não foi alterado nesta rodada.
- **Solicitação de organização por qualquer conta.** As regras restringem o início do cadastro ao presidente ou à administração da plataforma, mas o vínculo CPF/CNPJ ainda não é comprovado por fonte confiável. A solicitação permanece sujeita à análise da ata pelo administrador da plataforma.
- **Corrida entre encerramento e upload de documento.** O upload grava o arquivo no Blob antes de inserir o registro no banco e não bloqueia a organização. O encerramento pode vencer a corrida por milissegundos; não há ganho de autoridade, e o estado somente leitura continua valendo para as leituras.
- **Troca do cargo padrão em organização ativa.** A invariante de exatamente um cargo padrão somada à regra de que o cargo padrão não pode ser desativado nem deixar de ser padrão impede a troca atômica enquanto a organização está ativa. Hoje é possível apenas renomear ou editar o cargo padrão existente.
- **Concessão de provisionamento pode virar vínculo permanente.** Quem recebe a concessão temporária tem todas as permissões de configuração e pode criar um convite para o próprio CPF. A decisão sobre permitir ou bloquear isso não está nas regras de negócio.

## Testes de integração ampliados

Novos cenários executados com PostgreSQL local (`RUN_DATABASE_TESTS=1 pnpm test`):

- "keeps a closed organization read-only for every management path": cobre cargos, membros, convites, pré-cadastro, documentos, ativação e reabertura, além das leituras permitidas e do evento de auditoria.
- "isolates authority between organizations": tenta todas as operações de gestão de outra organização e confirma que nenhum dado ou evento de auditoria foi alterado.
- "requires a non-privileged active default role to activate": cobre cargo padrão com acesso completo e cargo padrão de diretoria.
- "ends temporary provisioning access when the organization activates": cobre concessão não revogada em organização ativa.
- "ignores full-access members whose role is inactive": cobre a contagem de membros com acesso completo.
- "rejects invites for a closed organization": ampliado para criação, reenvio, revogação e listagem de convites.
- Testes do domínio de convites e de administração da plataforma ganharam verificações de reabertura e encerramento negados.
