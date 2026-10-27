# Regras de negócio — Minha Associação

Decisões confirmadas pelo responsável pelo produto em 15/10/2026, consolidadas a partir da conversa sobre a reconstrução do aplicativo. Complementadas em 27/10/2026 com as decisões técnicas de sessão, tokens, senhas e limites de tentativas. Este documento registra comportamento desejado; não comprova que ele já esteja implementado ou validado.

## Escopo e autoridade

- O produto será um aplicativo fullstack Next.js, reunindo landing page, aplicação web, API e painel administrativo neste repositório.
- O repositório antigo, https://github.com/Freitas-Software/minha-associacao-old, é uma referência histórica. Suas regras e estruturas não devem ser importadas automaticamente.
- Remoções e diferenças escolhidas para a nova versão são decisões de negócio; não restaurar funcionalidades ou campos antigos por suposição.
- Os campos atuais de users e accounts foram escolhidos pelo usuário e devem ser preservados. Uma proposta de mudança exige explicação e decisão explícita, não alteração automática.
- A autenticação e a autorização serão implementadas pelo projeto, sem biblioteca externa de autenticação. Isso não significa reimplementar primitivas criptográficas; o mecanismo técnico de sessão está definido nas decisões técnicas confirmadas.
- Não há dados antigos a migrar. Após a versão web, serão desenvolvidos aplicativos nativos, primeiro Android e depois iOS.

## Identidade, perfil e conta

- users representa a pessoa; accounts representa suas credenciais de acesso. Uma pessoa pode existir antes de ter conta.
- A identidade é global e reaproveitada entre organizações: o mesmo CPF não deve gerar outra pessoa ao ingressar em uma nova associação.
- Uma conta pode existir sem vínculos com organizações e pode ter vínculos com várias organizações.
- O login usa CPF. CPF é um documento de identificação, não a chave primária técnica.
- O cadastro público coleta os dados completos definidos pelos schemas atuais. Não reintroduzir a regra antiga de email e telefone opcionais.
- No cadastro de uma pessoa nova, criar users e accounts vinculados após a confirmação de email e definição da senha.
- Se já existir uma pessoa pré-cadastrada sem conta, criar somente accounts e atualizar o registro correto de users para vinculá-lo. Não duplicar a pessoa nem atualizar outros usuários.
- Quando existir uma conta vinculada, apenas o próprio titular poderá editar suas informações pessoais. Não presumir uma exceção para administradores sem nova decisão.

## Pré-cadastro e confirmação de email

- Cada organização define, pelas permissões dos cargos, quem pode cadastrar novos associados e pré-cadastrar pessoas sem conta.
- O operador autorizado pode informar um email de contato, considerado confiável para ativação da conta.
- O operador autorizado pode corrigir esse contato enquanto não houver conta vinculada. Depois disso, vale a edição exclusiva pelo titular.
- Cadastros existentes devem ser reaproveitados. Um operador de outra organização não recebe, só por informar um CPF, autorização para sobrescrever o perfil global.
- Para ativar uma pessoa pré-cadastrada, enviar um link de uso único ao email já registrado em users. O visitante não pode trocar esse endereço durante a tentativa de cadastro.
- Pelo link validado, a pessoa define sua senha e conclui a criação da conta vinculada ao perfil existente.
- A confirmação de email antes da criação da conta e a definição da senha pelo link também valem para cadastro público e ingresso por convite compartilhado.
- Uma pessoa que já possui conta faz login para aceitar convites; não cria outra conta.

## Organizações e configuração inicial

- O suporte inicial é a associações privadas brasileiras com CNPJ elegível. Cooperativas ficam para uma etapa futura.
- Somente o presidente da associação ou um membro da administração da plataforma pode iniciar o cadastro de uma organização.
- CNPJ deve ser validado externamente e não pode identificar organizações duplicadas. A razão social vem da consulta; a sigla pode ser ajustada.
- A intenção é comprovar a autoridade do presidente por um vínculo entre o CPF autenticado e o CNPJ. O usuário indicou a BrasilAPI como fonte pretendida; a viabilidade dessa comprovação ainda precisa ser verificada.
- Após a validação, o sistema sugere e aplica por padrão a inclusão do criador como presidente com acesso completo, informando esse comportamento. O usuário pode alterar essa configuração.
- A administração da plataforma pode cadastrar somente dados básicos. Alguém da diretoria deverá concluir a configuração posteriormente.
- A organização começa em configuração (PROVISIONING). O fluxo inclui dados institucionais e CNPJ, estatuto, ata de eleição, configuração dos cargos e composição da diretoria.
- Antes da ativação, deve existir exatamente um cargo padrão de ingresso ativo, sem acesso completo e fora da diretoria; pelo menos um cargo ativo com acesso completo; e ocupantes ou convites individuais válidos para os cargos ativos da diretoria.
- A organização só se torna operacional quando houver pelo menos um membro ativo com cargo ativo de acesso completo. Não é necessário que todos os demais convites da diretoria tenham sido aceitos.
- O acesso temporário de configuração termina com a ativação. Não confundir esse acesso com um vínculo permanente ou com acesso completo.
- Uma organização operacional não pode ficar sem membros ativos com acesso completo. Operações que removam o último precisam aguardar um sucessor ativo.

## Cargos, permissões e isolamento

- Cada organização define seus cargos e seus nomes. Cada vínculo ativo possui exatamente um cargo atual da mesma organização.
- Nomes como Presidente, Tesoureiro ou Secretário não concedem permissões por si mesmos.
- Ser cargo de diretoria e ter acesso completo são propriedades independentes. A classificação de diretoria, isoladamente, não concede autoridade.
- A plataforma define um catálogo de permissões com códigos estáveis; cada organização distribui essas permissões entre seus cargos.
- Não atribuir permissões diretamente a usuários ou vínculos.
- Somente pessoas com acesso completo podem administrar cargos e permissões ou conceder acesso completo. Ninguém pode conceder autoridade que não possui.
- Um cargo de acesso completo possui todas as permissões configuráveis atuais e futuras, mas não ignora isolamento organizacional, propriedade de recursos, estados ou invariantes de negócio.
- A autorização consulta o estado atual dos vínculos, cargos e permissões. Uma sessão não congela permissões antigas; mudanças devem valer nas verificações subsequentes sem exigir novo login.
- Distinguir acesso básico de membro, acesso a recursos próprios, acesso privilegiado e acesso temporário de configuração. Nem toda operação exige uma permissão configurável.
- O servidor é a autoridade. Esconder controles na interface ou receber um organizationId não comprova acesso.
- Toda operação deve validar a identidade, a organização de destino, o vínculo ou acesso pertinente, a propriedade ou capacidade exigida e as invariantes aplicáveis.

## Convites e ingresso

- O ingresso inicial ocorre por convite individual ou compartilhado. Não implementar solicitação pública de ingresso ou inclusão direta como fluxo adicional sem nova decisão.
- Pré-cadastrar uma pessoa não equivale a ativar seu vínculo ou criar credenciais.
- Convite individual é vinculado ao CPF e só pode ser aceito pela identidade correspondente. Pode indicar cargo de diretoria ou de acesso completo.
- Convite compartilhado é reutilizável, pode ter limite de usos e não pode conceder cargo de diretoria nem acesso completo. Sem outro cargo elegível indicado, usa o cargo padrão de ingresso.
- Aceitar um convite válido ativa o vínculo sem aprovação adicional, respeitando os requisitos de conta e verificação de email.
- Abrir um convite ou solicitar o email de confirmação não consome um uso. O consumo ocorre na ativação efetiva do vínculo.
- Na conclusão pelo link, revalidar o convite: ele ainda deve estar válido e ter usos disponíveis.
- Se a pessoa já for membro ativo, o convite não duplica o vínculo, não altera seu cargo e não consome uso do convite compartilhado.
- Se o vínculo estiver inativo, reutilizá-lo na reativação, com o cargo indicado pelo convite ou o cargo padrão aplicável. Essa reativação consome um uso do convite compartilhado.
- Convites podem expirar e ser revogados, preservando histórico. Prazos e detalhes não confirmados nesta conversa não devem ser importados do sistema antigo por suposição.

## Desativação, inadimplência e histórico

- Desativar um vínculo não desativa a pessoa ou sua conta global nem afeta seus outros vínculos.
- O associado não encerra seu vínculo por conta própria; a desativação exige pessoa autorizada, motivo e auditoria.
- Vínculos são preservados para histórico e reutilizados em reativações.
- Ex-associados podem consultar e regularizar suas próprias obrigações financeiras históricas. Isso não restaura o acesso comum à organização ou a dados de terceiros.
- Inadimplência é independente do estado do vínculo e das permissões administrativas. Pode restringir benefícios e carteirinha, mas não remove autoridade do cargo nem bloqueia a regularização das próprias dívidas.
- Preservar histórico institucional, financeiro e de mudanças relevantes; não tratar desativação como exclusão física.

## Administração da plataforma e sessões

- Haverá painel administrativo neste mesmo repositório; inicialmente, o único administrador da plataforma será o responsável pelo aplicativo.
- Administração da plataforma é uma autoridade distinta de cargos de associações. Intervenções devem ser identificadas e auditadas.
- O poder confirmado do painel inclui iniciar organizações com dados básicos. Outros poderes não devem ser presumidos.
- O navegador deve manter login entre visitas, permitir sessões em vários dispositivos e oferecer encerramento das demais sessões.
- A futura API deverá ser adequada aos clientes nativos, sem presumir agora um formato específico de tokens.

## Decisões técnicas confirmadas

Confirmadas pelo responsável pelo produto em 27/10/2026. Registram o mecanismo técnico escolhido; não substituem as regras de negócio acima.

- Sessão: token opaco de 256 bits, armazenado apenas como hash SHA-256. Validade absoluta de 30 dias e inatividade de 7 dias, com renovação da janela de inatividade durante o uso sem estender a validade absoluta. Logout e encerramento das demais sessões revogam os registros correspondentes.
- Tokens de cadastro e recuperação de senha: 256 bits, armazenados apenas como hash SHA-256, com validade de 30 minutos, uso único, reenvio permitido após 60 segundos e invalidação dos tokens anteriores.
- Recuperação de senha: somente pelo email já vinculado à conta; a conclusão revoga todas as sessões da conta.
- Senhas: de 15 a 128 caracteres, com espaços permitidos. Hash Argon2id com 19 MiB de memória, 2 iterações, paralelismo 1 e 32 bytes de saída.
- Limites de tentativas: 30 por IP e 5 por CPF combinado com IP, em janelas fixas de 15 minutos.
- Vínculo entre pessoa e conta: `users.accountId` é único, impedindo que uma conta seja vinculada a mais de uma pessoa.
- Confirmação de email: registrada em `users.email_verified_at` na conclusão do cadastro.
- Limpeza operacional: sessões, tokens e contadores expirados são removidos após 30 dias por rotina diária.

## Decisões técnicas e detalhes pendentes

Estes pontos não são regras já resolvidas nem autorização para implementar por suposição:

- Verificar se a BrasilAPI fornece dados suficientes e confiáveis para comprovar o vínculo CPF/CNPJ pretendido. Não considerar o mecanismo comprovado apenas porque a regra foi desejada.
- Definir recuperação de acesso quando o titular não controla mais o email cadastrado, já que o fluxo confirmado usa somente o email vinculado.
- Avaliar proteção adicional contra abuso e concorrência além dos limites, do uso único e da renovação confirmados.
- Definir como alguém da diretoria recebe o acesso de configuração quando a organização é iniciada pelo administrador da plataforma.
- Definir os limites dos poderes administrativos além do cadastro básico de organizações.
- Esclarecer conflitos de contato em perfis globais sem conta, inclusive quando mais de uma organização pré-cadastra a mesma pessoa.
- Não importar todas as regras financeiras detalhadas, prazos de convites ou outras funcionalidades antigas sem confirmação específica.

## Como manter este documento

- Diante de conflito entre código e comportamento desejado, apontar a diferença antes de propor alteração. O código pode estar incompleto; o documento não é evidência de implementação.
- Uma instrução explícita mais recente do usuário pode alterar estas decisões. Registrar a mudança quando autorizado, preservando a distinção entre decisão e sugestão.
- Não promover recomendações do agente ou hipóteses técnicas a regras confirmadas.
