# Novenário Mariano — PWA Offline

Aplicativo web instalável (PWA) do **Novenário Mariano** da **Congregação Mariana Imaculada Conceição e São José** (*Capela S. José de Chambéry, Curitiba/PR*).

## Recursos
- **14 novenas oficiais** extraídas fielmente do livreto impresso (2026) + **Novena de Nossa Senhora da Salette** (devoção complementar).
- **100% offline** após o primeiro acesso (Service Worker com pré-cache de todos os textos, pinturas sacras e ícones).
- **Detecção automática da data**: destaca a novena em andamento hoje (inclusive o **Setenário de Nossa Senhora das Dores**, com cálculo automático da Páscoa para qualquer ano) ou a próxima do calendário.
- **Acompanhamento de dias (1–9 / 1–7)** salvo localmente no dispositivo.
- **Modo Latim / Português / Lado a lado** nas orações bilíngues.
- **Exportação para Agenda (`.ics`)** por novena ou do calendário anual completo.
- **Modo Claro e Modo Noturno**, ajuste de tamanho da fonte (`A-` / `A+`) e ampliação das imagens sacras.

## Como publicar (GitHub Pages)
1. Crie um repositório no GitHub (ex.: `novenario-mariano`).
2. Envie todo o conteúdo desta pasta (`index.html`, `styles.css`, `app.js`, `manifest.json`, `sw.js`, `data/`, `assets/`) para a raiz da branch `main`.
3. Em **Settings → Pages**, escolha **Deploy from a branch** → `main` → `/ (root)` e salve.
4. Acesse a URL gerada (ex.: `https://SEU-USUARIO.github.io/novenario-mariano/`) no celular e toque em **Instalar Aplicativo** (Android) ou **Compartilhar → Adicionar à Tela de Início** (iPhone).

## Como testar localmente
Por segurança dos navegadores (Service Worker e `fetch`), abra por um servidor HTTP local — não dê duplo clique direto no `index.html`:

```bash
python -m http.server 8000
```
Depois acesse `http://localhost:8000`.
