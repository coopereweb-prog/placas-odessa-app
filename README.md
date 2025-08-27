# Placas Nova Odessa - Sistema de Gestão de Placas de Rua

Sistema web interativo para gerenciamento e comercialização de espaços publicitários em placas de identificação de logradouros na cidade de Nova Odessa, SP.

## 🎯 Sobre o Projeto

Este é um projeto de prova de conceito desenvolvido para o bairro São Jorge, demonstrando como seria possível modernizar e monetizar o sistema de placas de rua da cidade através de uma plataforma digital interativa.

## ✨ Funcionalidades

### Para Clientes
- **Mapa Interativo**: Visualização de todos os pontos disponíveis no Google Maps
- **Sistema de Reservas**: Reserva de pontos por 48 horas com formulário completo
- **Street View**: Visualização do local através do Google Street View
- **Status em Tempo Real**: Acompanhamento do status dos pontos (Disponível/Reservado/Vendido)

### Para Administradores
- **Painel Administrativo**: Gestão completa de reservas e vendas
- **Upload de Fotos**: Sistema de upload com processamento automático de imagens
- **Gestão de Status**: Confirmação de vendas e cancelamento de reservas
- **Relatórios**: Visualização de estatísticas em tempo real

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React 19 + Vite
- **UI Components**: Tailwind CSS + shadcn/ui
- **Mapas**: Google Maps JavaScript API
- **Backend**: Supabase (PostgreSQL + Storage)
- **Deploy**: Vercel
- **Processamento de Imagens**: Canvas API (redimensionamento para 720px)

## 🚀 Como Executar Localmente

### Pré-requisitos
- Node.js 18+
- pnpm (recomendado) ou npm

### Instalação
```bash
# Clone o repositório
git clone <repository-url>
cd placas-nova-odessa

# Instale as dependências
pnpm install

# Configure as variáveis de ambiente
cp .env.example .env.local

# Edite o arquivo .env.local com suas chaves de API
```

### Configuração das APIs

#### Google Maps API
1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Ative as seguintes APIs:
   - Maps JavaScript API
   - Maps Static API
   - Street View Static API
4. Crie uma chave de API e adicione ao `.env.local`

#### Supabase
1. Crie um projeto no [Supabase](https://supabase.com/)
2. Execute o script SQL em `setup_database.sql` no SQL Editor
3. Configure o Storage bucket `placas-fotos`
4. Adicione as credenciais ao `.env.local`

### Executar o Projeto
```bash
# Modo desenvolvimento
pnpm dev

# Build para produção
pnpm build

# Preview do build
pnpm preview
```

## 📊 Estrutura do Banco de Dados

### Tabelas Principais
- **pontos**: Pontos de instalação com coordenadas e status
- **reservas**: Reservas de 48 horas com dados dos clientes
- **contratos**: Contratos confirmados (24 ou 36 meses)
- **fotos_instalacao**: Fotos das placas instaladas

### Status dos Pontos
- `disponivel`: Ponto livre para reserva
- `reservado`: Ponto reservado por 48 horas
- `vendido`: Ponto com contrato ativo

## 🎨 Design e UX

### Cores do Sistema
- **Verde**: Pontos disponíveis (#22c55e)
- **Amarelo**: Pontos reservados (#eab308)
- **Vermelho**: Pontos vendidos (#ef4444)

### Responsividade
- Design mobile-first
- Compatível com tablets e desktops
- Touch-friendly para dispositivos móveis

## 📱 Funcionalidades Avançadas

### Processamento de Imagens
- Redimensionamento automático para 720px no lado maior
- Compressão inteligente mantendo qualidade
- Geração de thumbnails (150x150px)
- Validação de formatos e tamanhos

### Sistema de Reservas
- Reserva automática por 48 horas
- Limpeza automática de reservas expiradas
- Notificações por email (planejado)
- Histórico completo de transações

## 🚀 Deploy na Vercel

### Configuração Automática
O projeto está configurado para deploy automático na Vercel:

```bash
# Instalar Vercel CLI (opcional)
npm i -g vercel

# Deploy
vercel --prod
```

### Variáveis de Ambiente na Vercel
Configure as seguintes variáveis no painel da Vercel:
- `VITE_GOOGLE_MAPS_API_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 📈 Próximos Passos

### Fase 2 - Expansão
- [ ] Integração com sistema de pagamentos
- [ ] Notificações por email automáticas
- [ ] Relatórios avançados e analytics
- [ ] Sistema de contratos digitais
- [ ] App mobile nativo

### Fase 3 - Escala
- [ ] Expansão para outros bairros
- [ ] Sistema multi-tenant para outras cidades
- [ ] API pública para integrações
- [ ] Dashboard financeiro completo

## 🤝 Contribuição

Este é um projeto de prova de conceito. Para sugestões ou melhorias, entre em contato através dos canais oficiais da prefeitura de Nova Odessa.

## 📄 Licença

Projeto desenvolvido para a Prefeitura Municipal de Nova Odessa. Todos os direitos reservados.

## 📞 Contato

- **Cidade**: Nova Odessa, SP
- **Bairro Piloto**: São Jorge
- **Referência**: Praça José Gazzetta (Centro)

---

*Desenvolvido com ❤️ para modernizar Nova Odessa*

