/*
==================================================
ARQUIVO: financas/liquid-fill-gauge.js
MODULO: Liquid Fill Gauge - Graficos de progresso animados
SISTEMA: ImaginaTech - Dashboard Financeiro
VERSAO: 1.0 - Adaptado para tema dark neon
BASEADO EM: D3 Liquid Fill Gauge by Curtis Bratton
==================================================
*/

/**
 * Configuracoes padrao do Liquid Fill Gauge
 * Adaptadas para tema dark com cores neon
 */
function liquidFillGaugeDefaultSettings() {
    return {
        minValue: 0,
        maxValue: 100,
        circleThickness: 0.05,      // Espessura do circulo externo
        circleFillGap: 0.05,        // Gap entre circulo e liquido
        circleColor: "#00D4FF",     // Cor do circulo (neon-blue)
        waveHeight: 0.08,           // Altura da onda
        waveCount: 2,               // Numero de ondas
        waveRiseTime: 1500,         // Tempo de subida (ms)
        waveAnimateTime: 2500,      // Velocidade da animacao (ms)
        waveRise: true,             // Animar subida
        waveHeightScaling: true,    // Escalar altura da onda
        waveAnimate: true,          // Animar ondas
        waveColor: "#00D4FF",       // Cor da onda
        waveOffset: 0,              // Offset inicial da onda
        textVertPosition: 0.5,      // Posicao vertical do texto (0-1)
        textSize: 0.8,              // Tamanho do texto relativo
        valueCountUp: true,         // Animar contagem
        displayPercent: true,       // Mostrar simbolo %
        textColor: "#ffffff",       // Cor do texto acima da onda
        waveTextColor: "#0a0e1a"    // Cor do texto dentro da onda
    };
}

/**
 * Carrega o Liquid Fill Gauge em um elemento
 * @param {string} elementId - ID do elemento SVG container
 * @param {number} value - Valor inicial (0-100)
 * @param {object} config - Configuracoes customizadas
 * @returns {object} - Objeto com metodo update()
 */
function loadLiquidFillGauge(elementId, value, config) {
    if (config == null) config = liquidFillGaugeDefaultSettings();

    const gauge = d3.select("#" + elementId);
    const container = gauge.node();
    if (!container) return null;

    // Limpar conteudo anterior
    gauge.selectAll("*").remove();

    const rect = container.getBoundingClientRect();
    const width = rect.width || 100;
    const height = rect.height || 100;
    const radius = Math.min(width, height) / 2;

    const locationX = width / 2 - radius;
    const locationY = height / 2 - radius;
    const fillPercent = Math.max(config.minValue, Math.min(config.maxValue, value)) / config.maxValue;

    let waveHeightScale;
    if (config.waveHeightScaling) {
        waveHeightScale = d3.scaleLinear()
            .range([0, config.waveHeight, 0])
            .domain([0, 50, 100]);
    } else {
        waveHeightScale = d3.scaleLinear()
            .range([config.waveHeight, config.waveHeight])
            .domain([0, 100]);
    }

    const textPixels = (config.textSize * radius / 2);
    const textFinalValue = parseFloat(value).toFixed(0);
    const textStartValue = config.valueCountUp ? config.minValue : textFinalValue;
    const percentText = config.displayPercent ? "%" : "";
    const circleThickness = config.circleThickness * radius;
    const circleFillGap = config.circleFillGap * radius;
    const fillCircleMargin = circleThickness + circleFillGap;
    const fillCircleRadius = radius - fillCircleMargin;
    const waveHeight = fillCircleRadius * waveHeightScale(fillPercent * 100);
    const waveLength = fillCircleRadius * 2 / config.waveCount;
    const waveClipCount = 1 + config.waveCount;
    const waveClipWidth = waveLength * waveClipCount;

    // Dados para o texto
    let textRounder = function(value) { return Math.round(value); };
    if (parseFloat(textFinalValue) !== parseFloat(textRounder(textFinalValue))) {
        textRounder = function(value) { return parseFloat(value).toFixed(1); };
    }

    // Escalas
    const textRiseScaleY = d3.scaleLinear()
        .range([fillCircleMargin + fillCircleRadius * 2, fillCircleMargin + textPixels * 0.7])
        .domain([0, 1]);
    const textRiseScaleX = d3.scaleLinear()
        .range([fillCircleMargin + fillCircleRadius * 0.5, fillCircleMargin + fillCircleRadius * 1.3])
        .domain([0, 1]);
    const waveRiseScale = d3.scaleLinear()
        .range([fillCircleMargin + fillCircleRadius * 2 + waveHeight, fillCircleMargin - waveHeight])
        .domain([0, 1]);
    const waveAnimateScale = d3.scaleLinear()
        .range([0, waveClipWidth - fillCircleRadius * 2])
        .domain([0, 1]);

    // Escala do texto
    const textScale = d3.scaleLinear()
        .range([textStartValue, textFinalValue])
        .domain([0, 1]);

    // Criar SVG
    const gaugeGroup = gauge.append("g")
        .attr("transform", "translate(" + locationX + "," + locationY + ")");

    // Definicoes (gradientes e clips)
    const defs = gaugeGroup.append("defs");

    // Gradiente para o circulo externo
    const circleGradient = defs.append("linearGradient")
        .attr("id", "circleGradient_" + elementId)
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", "100%").attr("y2", "100%");
    circleGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", config.circleColor)
        .attr("stop-opacity", 0.3);
    circleGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", config.circleColor)
        .attr("stop-opacity", 0.1);

    // Gradiente para a onda
    const waveGradient = defs.append("linearGradient")
        .attr("id", "waveGradient_" + elementId)
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", "0%").attr("y2", "100%");
    waveGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", config.waveColor)
        .attr("stop-opacity", 0.9);
    waveGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", config.waveColor)
        .attr("stop-opacity", 0.6);

    // Glow filter
    const filter = defs.append("filter")
        .attr("id", "glow_" + elementId)
        .attr("x", "-50%").attr("y", "-50%")
        .attr("width", "200%").attr("height", "200%");
    filter.append("feGaussianBlur")
        .attr("stdDeviation", "3")
        .attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Circulo externo (contorno)
    gaugeGroup.append("circle")
        .attr("cx", radius)
        .attr("cy", radius)
        .attr("r", radius - circleThickness / 2)
        .style("fill", "none")
        .style("stroke", config.circleColor)
        .style("stroke-width", circleThickness + "px")
        .style("opacity", 0.3)
        .style("filter", "url(#glow_" + elementId + ")");

    // Circulo de fundo interno
    gaugeGroup.append("circle")
        .attr("cx", radius)
        .attr("cy", radius)
        .attr("r", fillCircleRadius)
        .style("fill", "rgba(10, 14, 26, 0.8)");

    // Texto acima da onda (apenas se textSize > 0)
    let text1 = null;
    if (config.textSize > 0) {
        text1 = gaugeGroup.append("text")
            .text(textRounder(textStartValue) + percentText)
            .attr("class", "liquidFillGaugeText")
            .attr("text-anchor", "middle")
            .attr("font-size", textPixels + "px")
            .attr("font-weight", "700")
            .attr("font-family", "'Orbitron', monospace")
            .style("fill", config.textColor)
            .attr("transform", "translate(" + radius + "," + textRiseScaleY(config.textVertPosition) + ")");
    }

    // Clip path para a onda
    const waveGroup = gaugeGroup.append("defs")
        .append("clipPath")
        .attr("id", "clipWave_" + elementId);

    // Gerando dados da onda
    const data = [];
    for (let i = 0; i <= 40 * waveClipCount; i++) {
        data.push({ x: i / (40 * waveClipCount), y: i / 40 });
    }

    const waveScaleX = d3.scaleLinear().range([0, waveClipWidth]).domain([0, 1]);
    const waveScaleY = d3.scaleLinear().range([0, waveHeight]).domain([0, 1]);

    const clipArea = d3.area()
        .x(function(d) { return waveScaleX(d.x); })
        .y0(function(d) { return waveScaleY(Math.sin(Math.PI * 2 * config.waveOffset * -1 + Math.PI * 2 * (1 - config.waveCount) + d.y * 2 * Math.PI)); })
        .y1(function(d) { return fillCircleRadius * 2 + waveHeight; });

    const waveGroupXPosition = fillCircleMargin + fillCircleRadius * 2 - waveClipWidth;

    const wave = waveGroup.append("path")
        .datum(data)
        .attr("d", clipArea)
        .attr("T", 0);

    // Grupo do liquido (onda)
    const fillCircleGroup = gaugeGroup.append("g")
        .attr("clip-path", "url(#clipWave_" + elementId + ")");

    fillCircleGroup.append("circle")
        .attr("cx", radius)
        .attr("cy", radius)
        .attr("r", fillCircleRadius)
        .style("fill", "url(#waveGradient_" + elementId + ")");

    // Texto dentro da onda (apenas se textSize > 0)
    let text2 = null;
    if (config.textSize > 0) {
        text2 = fillCircleGroup.append("text")
            .text(textRounder(textStartValue) + percentText)
            .attr("class", "liquidFillGaugeText")
            .attr("text-anchor", "middle")
            .attr("font-size", textPixels + "px")
            .attr("font-weight", "700")
            .attr("font-family", "'Orbitron', monospace")
            .style("fill", config.waveTextColor)
            .attr("transform", "translate(" + radius + "," + textRiseScaleY(config.textVertPosition) + ")");
    }

    // Posicao inicial da onda
    if (config.waveRise) {
        waveGroup.attr("transform", "translate(" + waveGroupXPosition + "," + waveRiseScale(0) + ")")
            .transition()
            .duration(config.waveRiseTime)
            .attr("transform", "translate(" + waveGroupXPosition + "," + waveRiseScale(fillPercent) + ")")
            .on("start", function() { wave.attr("transform", "translate(1,0)"); });
    } else {
        waveGroup.attr("transform", "translate(" + waveGroupXPosition + "," + waveRiseScale(fillPercent) + ")");
    }

    // Animacao da contagem (apenas se texto existe)
    if (config.valueCountUp && text1 && text2) {
        const textTween = function() {
            const i = d3.interpolate(this.textContent, textFinalValue);
            return function(t) { this.textContent = textRounder(i(t)) + percentText; };
        };
        text1.transition()
            .duration(config.waveRiseTime)
            .tween("text", textTween);
        text2.transition()
            .duration(config.waveRiseTime)
            .tween("text", textTween);
    }

    // Animacao das ondas
    if (config.waveAnimate) animateWave();

    function animateWave() {
        wave.attr("transform", "translate(" + waveAnimateScale(wave.attr("T")) + ",0)");
        wave.transition()
            .duration(config.waveAnimateTime * (1 - wave.attr("T")))
            .ease(d3.easeLinear)
            .attr("transform", "translate(" + waveAnimateScale(1) + ",0)")
            .attr("T", 1)
            .on("end", function() {
                wave.attr("T", 0);
                animateWave(config.waveAnimateTime);
            });
    }

    // Retorna objeto com metodo de atualizacao
    return {
        update: function(newValue) {
            const newFillPercent = Math.max(config.minValue, Math.min(config.maxValue, newValue)) / config.maxValue;
            const newWaveHeight = fillCircleRadius * waveHeightScale(newFillPercent * 100);
            const newWaveRiseScale = d3.scaleLinear()
                .range([fillCircleMargin + fillCircleRadius * 2 + newWaveHeight, fillCircleMargin - newWaveHeight])
                .domain([0, 1]);

            // Animar texto apenas se existir
            if (text1 && text2) {
                const newTextRounder = function(value) { return Math.round(value); };
                const textTween = function() {
                    const i = d3.interpolate(this.textContent, parseFloat(newValue).toFixed(0));
                    return function(t) { this.textContent = newTextRounder(i(t)) + percentText; };
                };

                text1.transition()
                    .duration(config.waveRiseTime)
                    .tween("text", textTween);
                text2.transition()
                    .duration(config.waveRiseTime)
                    .tween("text", textTween);
            }

            waveGroup.transition()
                .duration(config.waveRiseTime)
                .attr("transform", "translate(" + waveGroupXPosition + "," + newWaveRiseScale(newFillPercent) + ")");
        }
    };
}

// Exportar para uso global
window.liquidFillGaugeDefaultSettings = liquidFillGaugeDefaultSettings;
window.loadLiquidFillGauge = loadLiquidFillGauge;
