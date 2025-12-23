# Versão de Desenvolvimento (dev)

Esta pasta contém a versão de desenvolvimento do site ImaginaTech.

## Estrutura

```
dev/
├── assets/
│   └── images/
│       ├── cube-face-1.png   # Face do cubo 3D
│       ├── cube-face-2.png   # Face do cubo 3D
│       └── cube-face-3.png   # Face do cubo 3D
├── index.html       # Página principal (anteriormente index_dev.html)
├── style.css        # Estilos CSS
├── script.js        # JavaScript
└── README.md        # Este arquivo
```

## Diferenças do index.html principal

- **1031 linhas de CSS inline** com efeitos glassmorphism refinados
- Cubo 3D com sistema de distribuição inteligente de imagens
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

### Externos (referenciados da raiz com `../`)
- `../favicon.ico`
- `../sitemap.xml`
- `../orcamento.html`
- `../acompanhar-pedido`
- `../imaginatech_logo.jpeg` (Open Graph / Twitter Cards)

## Tracking

- Google Analytics: AW-17037169805
- Meta Pixel: 1886778688526501
