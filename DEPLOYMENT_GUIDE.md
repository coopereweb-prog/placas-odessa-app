# Guia de Deploy - Placas Nova Odessa

## 🚀 Deploy na Vercel (Recomendado)

### Pré-requisitos
- Conta no GitHub
- Conta na Vercel
- Projeto Supabase configurado
- Google Maps API Key

### Passo 1: Preparar o Repositório
```bash
# Fazer fork ou clone do projeto
git clone <repository-url>
cd placas-nova-odessa

# Instalar dependências
pnpm install

# Testar localmente
pnpm dev
```

### Passo 2: Configurar Supabase

#### 2.1 Criar Projeto Supabase
1. Acesse [supabase.com](https://supabase.com)
2. Crie um novo projeto
3. Anote a URL e Anon Key do projeto

#### 2.2 Configurar Banco de Dados
1. Vá para SQL Editor no painel do Supabase
2. Execute o script `setup_database.sql`
3. Verifique se as tabelas foram criadas:
   - `points`
   - `reservas`
   - `contratos`
   - `fotos_instalacao`

#### 2.3 Configurar Storage
1. Vá para Storage no painel do Supabase
2. Crie um bucket chamado `placas-fotos`
3. Configure como público:
   ```sql
   -- Permitir acesso público ao bucket
   INSERT INTO storage.buckets (id, name, public) VALUES ('placas-fotos', 'placas-fotos', true);
   
   -- Política para upload de imagens
   CREATE POLICY "Permitir upload de imagens" ON storage.objects
   FOR INSERT WITH CHECK (bucket_id = 'placas-fotos');
   
   -- Política para visualização pública
   CREATE POLICY "Permitir visualização pública" ON storage.objects
   FOR SELECT USING (bucket_id = 'placas-fotos');
   ```

#### 2.4 Inserir Dados dos Pontos
Execute o seguinte SQL para inserir os pontos do bairro São Jorge:
```sql
-- Usar o arquivo pontos_instalacao.json para inserir dados
-- Exemplo de inserção:
INSERT INTO points (rua_principal, rua_cruzamento, latitude, longitude, tipo, status) 
VALUES 
('Rua das Acácias', 'Rua das Imbuias', -22.7556217, -47.3418358, 'padrao', 'disponivel'),
-- ... adicionar todos os pontos do arquivo JSON
```

### Passo 3: Configurar Google Maps API

#### 3.1 Criar Projeto no Google Cloud
1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um novo projeto ou selecione existente
3. Ative as seguintes APIs:
   - Maps JavaScript API
   - Maps Static API
   - Street View Static API

#### 3.2 Criar Chave de API
1. Vá para "APIs e serviços" > "Credenciais"
2. Clique em "Criar credenciais" > "Chave de API"
3. **IMPORTANTE**: Configure restrições:
   - Restrições de aplicativo: Referenciadores HTTP
   - Adicione seus domínios (localhost para dev, domínio da Vercel para prod)
   - Restrições de API: Selecione apenas as APIs necessárias

### Passo 4: Deploy na Vercel

#### 4.1 Conectar Repositório
1. Acesse [vercel.com](https://vercel.com)
2. Clique em "New Project"
3. Conecte seu repositório GitHub
4. Selecione o projeto `placas-nova-odessa`

#### 4.2 Configurar Variáveis de Ambiente
Na página de configuração do projeto na Vercel, adicione:

```env
VITE_GOOGLE_MAPS_API_KEY=sua_google_maps_api_key
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_supabase_anon_key
NODE_ENV=production
```

#### 4.3 Configurações de Build
A Vercel detectará automaticamente as configurações do `vercel.json`:
- Framework: Vite
- Build Command: `pnpm build`
- Output Directory: `dist`
- Install Command: `pnpm install`

#### 4.4 Deploy
1. Clique em "Deploy"
2. Aguarde o build completar
3. Teste a aplicação no domínio fornecido

### Passo 5: Configurações Pós-Deploy

#### 5.1 Atualizar Restrições da API
1. Volte ao Google Cloud Console
2. Atualize as restrições da API Key
3. Adicione o domínio da Vercel (ex: `placas-nova-odessa.vercel.app`)

#### 5.2 Configurar Domínio Personalizado (Opcional)
1. No painel da Vercel, vá para "Domains"
2. Adicione seu domínio personalizado
3. Configure os DNS conforme instruções

#### 5.3 Testar Funcionalidades
- [ ] Carregamento do mapa
- [ ] Clique nos marcadores
- [ ] Sistema de reservas
- [ ] Street View
- [ ] Upload de imagens (se configurado)

## 🔧 Deploy Alternativo (Netlify)

### Passo 1: Configurar o Projeto no Netlify
1. Conecte seu repositório Git.
2. As configurações de build (`pnpm build`) e o diretório de publicação (`dist`) devem ser detectados automaticamente.

### Passo 2: Configurar Variáveis de Ambiente
Esta é a etapa mais crítica. No painel do seu site no Netlify, vá para **Site settings > Build & deploy > Environment** e adicione as mesmas variáveis de ambiente usadas na Vercel:
- `VITE_GOOGLE_MAPS_API_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Passo 3: Configurar Redirecionamentos para SPA
Para que o roteamento do React (React Router) funcione corretamente, crie um arquivo `netlify.toml` na raiz do seu projeto com o seguinte conteúdo. Isso garante que todas as rotas sejam direcionadas para o `index.html`.

```toml
# netlify.toml
[build]
  command = "pnpm build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## 🐳 Deploy com Docker (Opcional)

### Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY pnpm-lock.yaml ./

RUN npm install -g pnpm
RUN pnpm install

COPY . .

RUN pnpm build

EXPOSE 4173

CMD ["pnpm", "preview", "--host", "0.0.0.0"]
```

### Docker Compose
```yaml
version: '3.8'
services:
  placas-nova-odessa:
    build: .
    ports:
      - "4173:4173"
    environment:
      - VITE_GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY}
      - VITE_SUPABASE_URL=${SUPABASE_URL}
      - VITE_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
```

## 🔍 Troubleshooting

### Problemas Comuns

#### Mapa não carrega
- Verifique se a Google Maps API Key está correta
- Confirme se as APIs estão ativadas no Google Cloud
- Verifique as restrições de domínio

#### Erro de CORS no Supabase
- Verifique se a URL do Supabase está correta
- Confirme se as políticas RLS estão configuradas
- Teste a conexão com o banco

#### Build falha na Vercel
- Verifique se todas as dependências estão no package.json
- Confirme se as variáveis de ambiente estão configuradas
- Verifique os logs de build para erros específicos

#### Imagens não fazem upload
- Verifique se o bucket do Supabase Storage existe
- Confirme se as políticas de acesso estão configuradas
- Teste o upload localmente primeiro

### Logs e Monitoramento
- Use o painel da Vercel para ver logs de build e runtime
- Configure alertas no Supabase para monitorar uso
- Use Google Cloud Monitoring para APIs

## 📞 Suporte

Para problemas específicos:
1. Verifique os logs de erro
2. Consulte a documentação oficial:
   - [Vercel Docs](https://vercel.com/docs)
   - [Supabase Docs](https://supabase.com/docs)
   - [Google Maps Docs](https://developers.google.com/maps)
3. Teste localmente primeiro
4. Verifique as configurações de ambiente

---

**Desenvolvido para Nova Odessa, SP** 🏙️
