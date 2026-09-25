# Cadastro e liberação de acesso

Quem tem e-mail de domínio autorizado entra sozinho assim que confirma o
endereço. Todo mundo mais descreve a intenção de uso e espera a decisão de um
operador.

Este documento existe porque a funcionalidade **depende de passos manuais fora
do código**. Um deles é a única defesa contra criação de conta pelo navegador, e
não está escrito em nenhum outro lugar.

## O caminho

```
formulário → /api/signup valida o domínio NO SERVIDOR → cria a conta
           → grava o pedido → e-mail de confirmação
           → a pessoa clica → /api/signup/confirm relê emailVerified no Firebase
              ├── domínio autorizado → libera na hora
              └── qualquer outro     → fica pendente + e-mail à equipe
                                     → tela de aprovação → libera
```

## Onde mora a permissão

Em dois lugares, com papéis diferentes, e **um não substitui o outro**:

- **Custom claim na conta do Firebase** (`sap.access`) — é quem **autoriza**. Viaja
  dentro do cookie de sessão e é lido a cada entrada sem consultar banco nenhum.
- **Coleção no Firestore** (`access-requests`) — é quem **audita**: quem pediu, o
  que escreveu, quem decidiu e quando.

Não inverta os dois. Se a autorização passar a depender de ler o Firestore, a
plataforma paga uma consulta em todo request — e o cache de sessão verificada
existe justamente para evitar esse tipo de custo.

O bloqueio acontece num ponto só: `createFirebaseSessionCookie`. Sem a marca não
nasce cookie, e sem cookie não há plataforma. O guard do layout e o
`requireAuthenticatedRequest` são redes de segurança para cookies emitidos antes
de o bloqueio ser ligado.

## Passos manuais no Firebase Console

Sem estes, ou a funcionalidade não é segura, ou não funciona.

| #   | Onde                                           | O quê                                       | Por quê                                                                                                                                                                                                                                                                                    |
| --- | ---------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Authentication → Settings → User actions       | **Desmarcar "Enable create (sign-up)"**     | A `NEXT_PUBLIC_FIREBASE_API_KEY` é pública. Com o cadastro pelo cliente ligado, qualquer pessoa cria conta de qualquer domínio direto na API do Google, sem passar pelo nosso formulário — e a regra de domínio deixa de valer. **Nosso cadastro usa o Admin SDK, que ignora essa trava.** |
| 2   | Authentication → Settings → Password policy    | Ligar em **Require enforcement**, mínimo 8  | Em "Notify" o Firebase só avisa e aceita a senha mesmo assim.                                                                                                                                                                                                                              |
| 3   | Authentication → Settings → Authorized domains | `localhost` e o domínio de produção         | É para onde o link de confirmação devolve a pessoa. Sem isso o cadastro trava.                                                                                                                                                                                                             |
| 4   | Firestore → Rules                              | Publicar o `firestore.rules` do repositório | O estado original era o modo de teste (`if request.time < timestamp.date(...)`): aberto até uma data e fechado depois **por expiração, não por decisão**. Quem "renovasse a data" abriria o banco inteiro, incluindo as intenções de uso.                                                  |
| 5   | Firestore → Indexes                            | Publicar o `firestore.indexes.json`         | A tela de aprovação filtra por um campo e ordena por outro; sem o índice composto a consulta falha. Gratuito no plano Spark.                                                                                                                                                               |

Os arquivos 4 e 5 estão versionados na raiz do repositório e podem ir por
`firebase deploy --only firestore:rules,firestore:indexes`.

## Ordem de implantação

**Esta ordem não pode ser invertida.**

1. **Subir com `PLATFORM_ACCESS_GUARD_ENABLED` desligada.** Nada muda: a
   plataforma se comporta como antes, e o link de cadastro **não aparece** no
   login.
2. **Rodar o backfill.** `node scripts/backfill-access-claims.mjs` (simulação) e
   depois `--apply`. Ele marca como liberadas as contas que já existem.
3. **Ligar a flag.**

Fora dessa ordem, todos os usuários atuais perdem o acesso.

O link de cadastro está amarrado à mesma flag de propósito: com ela desligada, a
sessão nasce sem conferir a marca nem o e-mail confirmado, então oferecer o
cadastro nesse estado deixaria a plataforma **mais aberta do que era antes de o
cadastro existir**.

## A conta de envio

Os três e-mails (confirmação, aviso à equipe, decisão) saem pelo SMTP do Google
autenticado com uma **senha de aplicativo** — não a senha da conta. Gerá-la exige
verificação em duas etapas ligada, e alguns domínios institucionais bloqueiam
senhas de aplicativo por política: vale confirmar isso antes.

**Restrição que não é óbvia:** o Gmail só aceita como remetente a própria conta
autenticada ou um alias verificado nela. Preencher `SMTP_FROM` com outro endereço
faz o envio falhar ou perder o alinhamento de DKIM — e aí a reputação do domínio,
que é o motivo de termos escolhido este caminho em vez de um serviço externo,
deixa de valer.

Antes de confiar na configuração:

```bash
node scripts/send-test-email.mjs seu.email@ufcg.edu.br
```

**Limites:** conta Gmail comum manda ~500 destinatários por dia; Workspace, ~2000.
Cada cadastro gera até 3 e-mails, então o teto prático fica em algumas centenas de
cadastros diários — bem antes de qualquer limite do Firebase.

**Sem credencial configurada o envio não acontece e o log registra.** Em produção
esse registro sai como `error`; em desenvolvimento, como `info`.
`MAIL_LOG_BODY=true` imprime o corpo no terminal para depuração local — e é a
forma de testar o fluxo inteiro sem SMTP, copiando o link do terminal. **Deixe
desligado fora do seu computador: o link de confirmação é uma credencial.**

## Variáveis de ambiente

| Variável                                  | Para quê                                                                                                                          |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `SIGNUP_ALLOWED_DOMAINS`                  | Domínios que entram sem aprovação manual. Vazia nega todos. **Nunca com prefixo `NEXT_PUBLIC_`** — a lista iria para o navegador. |
| `PLATFORM_ACCESS_GUARD_ENABLED`           | O interruptor da ordem de implantação acima.                                                                                      |
| `OCA_NOTIFICATION_EMAIL`                  | Caixa **da equipe** que recebe os pedidos. Não deve ser o e-mail de uma pessoa.                                                   |
| `FIREBASE_ACCESS_REQUESTS_COLLECTION`     | Separa a coleção de desenvolvimento da de produção.                                                                               |
| `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | A conta de envio.                                                                                                                 |
| `SIGNUP_SEND_REJECTION_EMAIL`             | Se quem é recusado recebe aviso. Desligado até a equipe decidir.                                                                  |
| `MAIL_LOG_BODY`                           | Só desenvolvimento. Imprime o corpo dos e-mails no terminal.                                                                      |

## Decisões em aberto

- **Ocupação de endereço institucional.** A conta nasce antes de alguém provar
  que a caixa é sua, então é possível cadastrar o e-mail de um terceiro com uma
  senha própria e ganhar o acesso quando essa pessoa clicar no link legítimo.
  É defeito de desenho, não de código, e o conserto muda a arquitetura.
- **Captcha.** O plano pede captcha **e** limite de tentativas. O limite existe;
  o captcha não. Um programa automático troca de endereço de rede e passa por
  qualquer limite por IP.
- **"Esqueci minha senha" não existe.** Com o cadastro pelo cliente desligado, a
  única saída de quem esquecer a senha é intervenção manual.
- **Não existe caminho no produto para remover o acesso de alguém.** Só pelo
  painel do Firebase.
