# Felipe Auto Design — Site + Gestão da Oficina

Projeto Next.js/React pronto para Vercel, com site público e módulo administrativo da oficina.

## Novidades do módulo de gestão

- Login administrativo em `/admin/login`
- Cadastro de clientes
- Cadastro de veículos vinculados ao cliente
- Ordem de serviço com descrição, material e mão de obra
- Agendamento e estimativa de entrega
- Agenda mensal dos serviços
- Atualização de status da execução
- Ordens de compra com fornecedor, nota, materiais e valor total
- Indicador da última compra e total acumulado de compras
- Geração de orçamento em PDF/impressão a partir de uma ordem de serviço
- Geração de link público para o cliente acompanhar o serviço
- Página pública `/acompanhar/[token]`

## 1. Instalar

```bash
npm install
npm run dev
```

## 2. Criar Firebase

No Firebase Console:

1. Crie um projeto.
2. Ative **Authentication > Sign-in method > Email/Password**.
3. Em **Authentication > Users**, crie o usuário que terá acesso à oficina.
4. Crie o **Cloud Firestore**.
5. Em configurações do projeto, crie um app Web e copie as credenciais.

Copie `.env.example` para `.env.local` e preencha:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

## 3. Regras do Firestore

Copie o conteúdo de `firestore.rules` para **Firestore Database > Rules** e publique.

As coleções `customers`, `vehicles`, `serviceOrders` e `purchaseOrders` só podem ser acessadas por usuário autenticado. A coleção `publicTracking` permite apenas leitura direta pelo token e bloqueia listagens públicas.

## 4. Vercel

Na Vercel, adicione as mesmas variáveis em **Project Settings > Environment Variables** e faça novo deploy.

## Fluxo

1. Entre em `/admin/login`.
2. Cadastre o cliente.
3. Cadastre o veículo.
4. Crie o serviço com valores e datas.
5. Em **Compras**, cadastre notas de fornecedores e materiais para controlar a última compra e o total comprado.
6. Em **Orçamentos**, selecione uma ordem de serviço e clique em **Gerar PDF / Imprimir**; na janela de impressão escolha **Salvar como PDF**.
7. Clique em **Copiar link** na ordem de serviço e envie ao cliente no WhatsApp.
8. Ao atualizar o status no painel, o link público reflete o novo andamento.

> Observação: esta versão usa Firebase diretamente no navegador e foi pensada para uma equipe pequena de oficina. Para múltiplos níveis de permissão, auditoria avançada, anexos de fotos e assinatura digital, vale evoluir para uma API/Server Actions com regras por perfil.

## Produtos e custos de compra

A área administrativa possui uma aba **Produtos**. Os materiais são gravados na coleção `products` do Firestore. Ao lançar uma compra na aba **Compras**, selecione um produto cadastrado, informe quantidade e custo unitário e adicione quantos itens forem necessários. Ao salvar a compra, o sistema grava os itens em `purchaseOrders` e atualiza no produto o último custo, data, fornecedor e quantidade da última compra.

Lembre-se de publicar o arquivo `firestore.rules` atualizado, que contém permissão autenticada para a coleção `products`.
