# Associae

Aplicação web fullstack para gestão de associações e organizações, desenvolvida com Next.js.

> **Repositório privado — uso interno.**
>
> Este repositório é destinado exclusivamente aos integrantes autorizados da equipe de desenvolvimento. O acesso ao código-fonte não implica autorização para redistribuição, publicação ou utilização fora do projeto.

## 1. Visão geral

A Associae é uma plataforma destinada à centralização de processos administrativos e operacionais de associações.

A aplicação web é desenvolvida com Next.js e também disponibilizada como Progressive Web App (PWA) instalável em desktops, com funcionamento dependente de conexão à internet.

O planejamento de evolução inclui aplicativos nativos para iOS e Android, que deverão compartilhar as regras de negócio e os serviços de backend da plataforma.

### Tecnologias

| Tecnologia | Finalidade |
|---|---|
| Next.js | Framework fullstack |
| React | Interface de usuário |
| TypeScript | Linguagem de desenvolvimento |
| App Router | Roteamento e renderização |
| PWA | Instalação da aplicação web no desktop |
| Vercel | Hospedagem da aplicação web |

**A confirmar no código:** gerenciador de pacotes, banco de dados, ORM, autenticação, biblioteca de componentes, ferramentas de lint e testes.

## 2. Requisitos de desenvolvimento

Antes de iniciar, instale:

- Node.js na versão definida pelo projeto.
- Gerenciador de pacotes utilizado pelo repositório.
- Git.
- Editor ou IDE com suporte a TypeScript.

Respeite as versões declaradas nos arquivos de configuração e no lockfile do repositório.

## 3. Configuração do ambiente

### Clonar o repositório

```bash
git clone <URL_PRIVADA_DO_REPOSITORIO>
cd <DIRETORIO_DO_PROJETO>
```

O desenvolvedor precisa ter acesso autorizado à organização e ao repositório.

### Instalar dependências

Utilize o gerenciador de pacotes e o lockfile existentes no projeto.

Exemplos:

```bash
# pnpm
pnpm install --frozen-lockfile

# npm
npm ci
```

Execute apenas o comando correspondente à configuração real do repositório.

### Variáveis de ambiente

Consulte o arquivo `.env.example`, quando disponível, para identificar as variáveis necessárias.

Crie o arquivo local de ambiente apropriado para a aplicação:

```bash
cp .env.example .env.local
```

Preencha os valores conforme as instruções internas da equipe.

**Regras obrigatórias:**

- Nunca versionar arquivos com credenciais reais.
- Nunca compartilhar tokens, senhas ou chaves privadas em issues, commits ou pull requests.
- Variáveis `NEXT_PUBLIC_*` são expostas ao código executado no navegador e não devem conter segredos.
- Credenciais de produção devem permanecer restritas aos responsáveis autorizados.
- Não utilizar dados pessoais reais de associados em ambientes locais sem autorização e controles adequados.

### Executar localmente

Após configurar o ambiente, utilize o script de desenvolvimento definido no `package.json`.

Para projetos com o script padrão `dev`:

```bash
npm run dev
```

Ou o equivalente do gerenciador de pacotes adotado.

A aplicação normalmente estará disponível em:

```text
http://localhost:3000
```

## 4. Arquitetura

O projeto utiliza Next.js com App Router, combinando renderização no servidor, componentes interativos e funcionalidades de backend.

### Responsabilidades

**Interface web**

Responsável pela apresentação de dados, navegação, formulários, estados de interface e interação com o usuário.

**Camada de aplicação**

Responsável pela execução dos casos de uso, coordenação das operações e aplicação das regras de negócio.

**Camada de acesso a dados**

Responsável pela persistência e recuperação de informações, respeitando as regras de isolamento e autorização definidas pela aplicação.

**API**

Os futuros aplicativos nativos deverão acessar funcionalidades do backend por meio de contratos de API autenticados e versionados quando necessário.

A implementação da API deverá reutilizar as regras de negócio existentes, evitando duplicação entre clientes.

### Diretrizes arquiteturais

- Priorizar Server Components para renderização e acesso a dados no servidor.
- Utilizar Client Components quando houver necessidade de interatividade no navegador.
- Manter validações e decisões de autorização no servidor.
- Evitar concentrar regras de negócio diretamente nos componentes React.
- Tratar Server Actions e Route Handlers como pontos de entrada, não como substitutos da camada de serviços.
- Evitar dependências desnecessárias entre interface, regras de negócio e persistência.
- Preparar contratos reutilizáveis para os futuros clientes móveis, sem antecipar abstrações que ainda não sejam necessárias.

A organização real dos diretórios e módulos deve ser documentada após validação da estrutura atual do repositório.

## 5. Progressive Web App

A aplicação web oferece suporte à instalação em desktops compatíveis.

### Características

- Instalação por navegadores compatíveis.
- Execução em janela independente.
- Identidade visual e ícones próprios.
- Dependência de conexão com a internet.
- Compartilhamento da mesma aplicação web e backend.

### Configuração

O manifesto da aplicação está localizado em:

```text
public/site.webmanifest
```

Os metadados de instalação e os ícones são integrados ao Next.js.

A instalação como PWA não implica suporte offline. Qualquer futura implementação de Service Worker, armazenamento local persistente ou cache de respostas autenticadas deverá ser avaliada quanto a segurança, consistência e atualização de dados.

## 6. Segurança

Toda funcionalidade deve considerar autenticação, autorização, integridade dos dados e proteção das informações dos usuários.

### Requisitos gerais

- Verificar autorização no servidor para cada operação protegida.
- Nunca confiar exclusivamente em validações executadas no navegador.
- Validar entradas nos limites da aplicação.
- Não registrar senhas, tokens ou dados sensíveis em logs.
- Não expor detalhes internos de erros ao usuário final.
- Utilizar conexões seguras em produção.
- Aplicar o princípio do menor privilégio.
- Avaliar impacto de segurança em alterações de autenticação, sessões e permissões.

### Isolamento de dados

Caso a aplicação opere com múltiplas associações, todas as consultas e operações deverão respeitar os limites de acesso da organização correspondente.

A identificação da associação ativa no cliente não constitui, isoladamente, uma verificação de autorização.

O isolamento deve ser garantido e testado no servidor.

## 7. Padrões de desenvolvimento

### Código

- Utilizar TypeScript e respeitar as configurações de tipagem do projeto.
- Preferir código legível e responsabilidades bem definidas.
- Evitar duplicação desnecessária.
- Manter convenções de nomes consistentes.
- Evitar introduzir dependências sem justificativa técnica.
- Seguir as ferramentas de formatação e análise estática configuradas no repositório.

### Componentes

- Preferir componentes reutilizáveis quando houver reutilização real.
- Preservar os padrões de interface e acessibilidade existentes.
- Tratar estados de carregamento, erro e ausência de dados.
- Manter consistência entre os temas claro e escuro.
- Evitar acoplamento direto entre componentes visuais e infraestrutura de persistência.

### Banco de dados

Alterações no modelo de dados devem ser revisadas considerando:

- Compatibilidade com dados existentes.
- Necessidade de migrações.
- Integridade referencial.
- Possibilidade de reversão.
- Impacto em consultas e funcionalidades existentes.

## 8. Fluxo de trabalho Git

O desenvolvimento deve ocorrer por meio de branches e pull requests.

### Branches

Convenção sugerida:

```text
feat/nome-da-funcionalidade
fix/descritivo-da-correcao
refactor/escopo-da-alteracao
docs/assunto
chore/tarefa-tecnica
```

Exemplos:

```text
feat/member-registration
fix/session-expiration
refactor/association-service
```

### Commits

Adotar mensagens claras e, preferencialmente, a convenção Conventional Commits.

```text
feat: add member registration
fix: correct session validation
refactor: extract association service
docs: update setup instructions
chore: update dependencies
```

### Pull requests

Toda alteração destinada à branch principal deve passar por revisão.

O pull request deve informar:

- Objetivo e contexto da alteração.
- Resumo da implementação.
- Como a alteração foi validada.
- Impactos em banco de dados, autenticação ou infraestrutura, quando houver.
- Capturas de tela para mudanças visuais relevantes.

Evitar alterações diretas na branch principal, exceto pelos procedimentos de emergência aprovados pela equipe.

## 9. Qualidade e testes

Antes de abrir um pull request:

1. Verifique a tipagem e a análise estática do projeto.
2. Execute os testes disponíveis.
3. Confira os fluxos impactados pela alteração.
4. Verifique possíveis regressões.
5. Confirme que nenhum segredo ou arquivo local foi incluído no commit.

Scripts específicos de lint, typecheck, testes e build devem ser consultados no `package.json`.

Funcionalidades críticas, especialmente autenticação, autorização, isolamento entre associações e operações de persistência, devem receber cobertura de testes adequada.

## 10. Deploy e ambientes

A aplicação web utiliza a Vercel como plataforma de hospedagem.

**Produção:**

https://minha-associacao.vercel.app

A configuração de ambientes, domínios e permissões administrativas deve ser mantida pelos responsáveis técnicos.

### Cuidados com deploy

- Validar as alterações antes da publicação.
- Não modificar variáveis de produção sem verificar o impacto.
- Avaliar migrações antes de publicar versões incompatíveis.
- Não utilizar o ambiente de produção para testes destrutivos.
- Definir procedimento de rollback para alterações de alto risco.

O fluxo de CI/CD, as regras de promoção entre ambientes e as estratégias de rollback deverão ser documentados conforme a configuração efetiva do projeto.

## 11. Organização e acesso

Este repositório pertence à organização responsável pelo desenvolvimento da Associae e possui acesso restrito.

### Política de colaboração

- O acesso deve ser concedido individualmente aos integrantes autorizados.
- Permissões devem corresponder às responsabilidades de cada integrante.
- Alterações relevantes devem ser rastreáveis por commits e pull requests.
- Questões técnicas devem ser registradas nas ferramentas de acompanhamento adotadas pelo time.
- O desligamento de um integrante deve resultar na revisão e revogação dos acessos correspondentes.

Não publicar código-fonte, documentação interna, dados ou credenciais sem autorização.

## 12. Evolução do produto

As frentes previstas incluem:

**Web**

Evolução contínua da aplicação Next.js, com foco em funcionalidades administrativas, experiência do usuário, segurança e desempenho.

**Desktop**

Distribuição da aplicação web como PWA, sem necessidade inicial de um aplicativo desktop nativo.

**Mobile**

Desenvolvimento futuro de aplicativos nativos para iOS e Android, reutilizando serviços e contratos de backend.

Decisões arquiteturais de impacto significativo deverão ser discutidas e registradas pelo time antes da implementação.

---

**Associae — Documentação interna de desenvolvimento.**

Este documento deve ser atualizado sempre que mudanças na configuração, arquitetura ou processo de desenvolvimento afetarem o onboarding e o trabalho da equipe.