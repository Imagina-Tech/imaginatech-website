# Versão de Desenvolvimento (dev)

Esta pasta contém a versão de desenvolvimento do site ImaginaTech.

## Estrutura

```
dev/
├── assets/
│   └── images/
│       ├── cube-face-1.png         # Face do cubo 3D
│       ├── cube-face-2.png         # Face do cubo 3D
│       ├── cube-face-3.png         # Face do cubo 3D
│       └── projetos/               # Imagens do carrossel de projetos
│           ├── projeto-1.jpg       # Placeholder SVG
│           ├── projeto-2.jpg       # Placeholder SVG
│           ├── projeto-3.jpg       # Placeholder SVG
│           ├── projeto-4.jpg       # Placeholder SVG
│           ├── projeto-5.jpg       # Placeholder SVG
│           ├── projeto-6.jpg       # Placeholder SVG
│           ├── projeto-7.jpg       # Placeholder SVG
│           └── projeto-8.jpg       # Placeholder SVG
├── index.html       # Página principal (anteriormente index_dev.html)
├── style.css        # Estilos CSS
├── script.js        # JavaScript
└── README.md        # Este arquivo
```

## Diferenças do index.html principal

- **1031 linhas de CSS inline** com efeitos glassmorphism refinados
- Cubo 3D com sistema de distribuição inteligente de imagens
- **Carrossel de Projetos Realizados** com scroll automático e efeito fade nas bordas
- Animações e micro-interações avançadas
- Design futurista com efeitos de brilho

## Como acessar

### Desenvolvimento local:
```
http://localhost:8000/dev/
```

### Produção:
```
https://imaginatech.com.br/dev/
```

## Assets

### Locais (dentro de dev/)
- `assets/images/cube-face-*.png` - Imagens do cubo 3D (3 faces, ~70KB total)
- `assets/images/projetos/projeto-*.jpg` - Placeholders SVG do carrossel (8 imagens, ~4.5KB total)
  - **Nota:** Substituir por fotos reais dos projetos realizados

### Externos (referenciados da raiz com `../`)
- `../favicon.ico`
- `../sitemap.xml`
- `../orcamento.html`
- `../acompanhar-pedido`
- `../imaginatech_logo.jpeg` (Open Graph / Twitter Cards)

## Tracking

- Google Analytics: AW-17037169805
- Meta Pixel: 1886778688526501
