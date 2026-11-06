# Auditoria de autorização e invariantes — 29/10/2026

**Status:** registro técnico da auditoria realizada nesta data e atualizado em 30/10/2026 após a correção dos riscos residuais. Não altera nem substitui as [regras de negócio](regras-de-negocio.md); os achados descrevem o código atual e as decisões pendentes ficam identificadas como tal.

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
| `changeDefaultRole` | sessão | `roles.manage` + `canGrantRole` do novo cargo | organização informada |
| `updateOrganization` | sessão | `organization.update` | organização informada |
| `activateOrganization` | sessão | `organization.activate` | organização informada |
| `closeOrganization`, `reopenOrganization` | sessão | `organization.close` | organização informada |
| `deactivateMembership`, `updateMembershipRole` | sessão | `members.manage` + `canGrantRole` do cargo atual e do novo | organização derivada do vínculo |
| `requestPreRegistration`, `resendPreRegistration` | sessão | `members.manage` + `canGrantRole` | organização derivada do pré-cadastro |
| `uploadOrganizationDocument` | sessão | `organization.update` | organização informada |
| `createOrganization`, `approveOrganizationRequest`, `rejectOrganizationRequest` | sessão | administrador da plataforma | plataforma |
| `requestOrganization` | sessão | declaração de presidência + limite de solicitações | plataforma |

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
| Ninguém concede autoridade que não possui | `canGrantRole` em cargos, convites, atribuição e desativação de vínculo, troca do cargo padrão e pré-cadastro | "prevents granting authority beyond the actor", "changes membership roles with guards" |
| Concessão temporária termina na ativação, não vale em organização ativa e não vira vínculo | `getOrganizationAccess` exige `provisioning`; ativação revoga a concessão e os convites para o CPF do detentor; criação, reenvio e aceitação recusam o próprio CPF | "ends temporary provisioning access when the organization activates", "revokes invites for provisioning grantees on activation", "blocks a provisioning grantee from inviting or accepting itself" |
| Cargo padrão pode ser trocado atomicamente, sem diretoria e sem acesso completo, por quem pode conceder o novo cargo | `changeDefaultRole` com lock na organização e auditoria `role.default_changed` | "changes the default role atomically with authorization" |
| Solicitação de organização limitada por conta | `requestOrganization` com até 2 pendentes e 5 em 24 h, sob lock por solicitante | "limits pending requests and requests per day" |
| Upload de documento não vence o encerramento | `uploadOrganizationDocument` bloqueia a organização na transação e remove o arquivo se estiver encerrada | "refuses document uploads that race with the organization closure" |
| Convite compartilhado não concede diretoria nem acesso completo; revalidação na conclusão | `createInvite`, `resendInvite`, `validateInviteToken`, `acceptInvite`, `completeRegistration` | invite domain |
| Revogação de convite é única e auditada uma vez | `revokeInvite` com atualização condicional | "revoked and expired invites are rejected" |
| Administração da plataforma não recebe autoridade de organização | `isPlatformAdmin` isolado de `getOrganizationAccess` | "does not grant platform admins organization authority" |

## Correções aplicadas

### Rodada de 29/10/2026

1. **Ativação aceitava cargo padrão privilegiado** quando os dados chegavam fora do fluxo da aplicação: a checagem contava apenas um cargo padrão ativo e um cargo de acesso completo, sem exigir que fossem cargos distintos e não privilegiados. A ativação agora exige que o único cargo padrão ativo não seja de diretoria e não tenha acesso completo.
2. **Invariantes de cargo não eram serializadas com mudanças de vínculo.** `updateRole` verificava "último membro com acesso completo" sem bloquear a organização, enquanto `deactivateMembership` e `updateMembershipRole` já bloqueavam. Duas transações concorrentes podiam remover o último acesso completo. `updateRole` passou a bloquear a linha da organização antes das verificações.
3. **Organização encerrada podia ser alterada em corrida com o encerramento.** A autorização era calculada antes da transação; `updateOrganization`, `updateRole`, `createRole`, `deactivateMembership`, `updateMembershipRole`, `createInvite`, `resendInvite` e `createPreRegistrationLink` agora releem o estado da organização sob lock e recusam a operação se ela estiver encerrada.
4. **Revogação de convite não era idempotente sob concorrência.** `revokeInvite` atualizava o convite sem condição, podendo duplicar o evento de auditoria. A atualização agora é condicional a `revoked_at is null` e retorna `already-revoked` quando outra transação venceu.

### Rodada de 30/10/2026

5. **Autoridade sobre o cargo atual do vínculo.** `updateMembershipRole` validava apenas o cargo novo com `canGrantRole`; a interface escondia a troca quando o cargo atual não era concedível, mas o servidor aceitava a chamada direta. `deactivateMembership` exigia apenas `members.manage` e protegia somente o último acesso completo. Ambos passaram a exigir `canGrantRole` para o cargo atual do alvo, antes de qualquer efeito, e a interface esconde a desativação nas mesmas condições.
6. **Corrida entre encerramento e upload de documento.** O upload gravava no Blob e inseria o registro sem bloquear a organização. A transação agora seleciona a organização com `for('update')`, recusa o estado `closed` e remove o arquivo recém-gravado quando o encerramento venceu a corrida.
7. **Solicitação de organização sem limite por conta.** `requestOrganization` passou a aceitar no máximo 2 solicitações pendentes e 5 solicitações em 24 horas por solicitante, contadas sob advisory lock por conta. O formulário exige declaração de que o solicitante é presidente.
8. **Cargo padrão imutável em organização ativa.** A invariante de exatamente um cargo padrão impedia a troca enquanto a organização estava ativa. `changeDefaultRole` desmarca o padrão atual e marca o novo na mesma transação, com lock na organização, exigindo `roles.manage` e `canGrantRole` do novo cargo, recusando diretoria, acesso completo, cargo inativo e organização encerrada, e registrando `role.default_changed` com `fromRoleId`/`toRoleId`.
9. **Concessão de provisionamento podia virar vínculo permanente.** O detentor da concessão agora não pode convidar, reenviar convite nem pré-cadastrar o próprio CPF enquanto a concessão estiver ativa, nem aceitar convite para ingressar na organização. Como defesa em profundidade, a ativação revoga os convites pendentes para o CPF de detentores com concessão ativa e registra a contagem em `organization.activated`.

## Riscos residuais e decisões pendentes

- **Vínculo CPF/CNPJ não comprovado por fonte confiável.** As regras restringem o início do cadastro ao presidente ou à administração da plataforma, mas a BrasilAPI não comprova a relação entre o CPF autenticado e o CNPJ. A solicitação continua sujeita à análise da ata pelo administrador da plataforma e o formulário passou a exigir declaração explícita de presidência.
- **Limites de solicitação são operacionais.** Os limites de 2 pendentes e 5 por 24 horas reduzem abuso, mas não impedem que uma conta use CPFs ou CNPJs de terceiros enquanto o vínculo não for verificável. Os limites são parâmetros de produto e podem ser revistos.
- **Autoingresso do detentor da concessão por outros caminhos.** O bloqueio cobre convite individual, reenvio, pré-cadastro e aceitação. Um convite compartilhado da mesma organização, criado por outra pessoa, ainda poderia ser aceito pelo detentor depois da ativação, quando a concessão já terminou; nesse momento o ingresso é um vínculo comum, não uma extensão da concessão.

## Testes de integração ampliados

Novos cenários executados com PostgreSQL local (`RUN_DATABASE_TESTS=1 pnpm test`):

- "keeps a closed organization read-only for every management path": cobre cargos, membros, convites, pré-cadastro, documentos, ativação e reabertura, além das leituras permitidas e do evento de auditoria.
- "isolates authority between organizations": tenta todas as operações de gestão de outra organização e confirma que nenhum dado ou evento de auditoria foi alterado.
- "requires a non-privileged active default role to activate": cobre cargo padrão com acesso completo e cargo padrão de diretoria.
- "ends temporary provisioning access when the organization activates" e "revokes invites for provisioning grantees on activation": cobrem concessão não revogada em organização ativa e a revogação dos convites do detentor ao ativar.
- "blocks a provisioning grantee from inviting or accepting itself" e "blocks a provisioning grantee from pre-registering itself": cobrem convite individual, reenvio, aceitação e pré-cadastro do próprio CPF.
- "changes membership roles with guards": cobre a recusa de alteração e de desativação de vínculo cujo cargo atual excede a autoridade do ator, sem efeito colateral em vínculo ou auditoria.
- "changes the default role atomically with authorization": cobre a troca atômica, cargo já padrão, diretoria, acesso completo, cargo inativo, cargo fora do alcance do ator, organização encerrada e evento `role.default_changed`.
- "refuses document uploads that race with the organization closure": simula o encerramento entre a autorização e a transação, confirma `forbidden`, ausência de registro, ausência de auditoria e remoção do arquivo.
- "limits pending requests and requests per day": cobre 2 pendentes, 5 solicitações em 24 h e a janela expirada.
- "ignores full-access members whose role is inactive": cobre a contagem de membros com acesso completo.
- "rejects invites for a closed organization": ampliado para criação, reenvio, revogação e listagem de convites.
- Testes do domínio de convites e de administração da plataforma ganharam verificações de reabertura e encerramento negados.
