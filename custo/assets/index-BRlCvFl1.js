function rw() {
  const [r, s] = g.useState("SATURN 2");
  const [i, u] = g.useState(() => {
    const y = dd("SATURN 2"),
      S = { ...fd["SATURN 2"], ...y };
    return (
      So.forEach((C) => {
        S[C] = 0;
      }),
      S
    );
  });
  const [c, d] = g.useState(null),
    m = g.useCallback(
      (y) => {
        const { name: S, value: C } = y.target,
          R = parseFloat(C) || 0;
        u((_) => {
          const A = { ..._, [S]: R };
          return So.includes(S) || tw(r, A), A;
        });
      },
      [r]
    ),
    p = g.useCallback((y) => {
      const S = y;
      s(S);
      const C = dd(S),
        R = { ...fd[S], ...C };
      So.forEach((_) => {
        R[_] = 0;
      }),
        u(R);
    }, []);

  g.useEffect(() => {
    (() => {
      const {
        tempoImpressaoHoras: S,
        tempoImpressaoMinutos: C,
        materialUtilizado: R,
        numImpressoes: _,
        precoMaterialKg: A,
        precoKWH: w,
        potenciaW: N,
        valorMaquina: M,
        tempoDepreciacaoHoras: O,
        taxaFalhaPercent: z,
        impostoPercent: F,
        taxaLucroPercent: W,
        materialConsumoValor: G,
        precoSTL: K,
        stlPecas: re,
      } = i;
      let pe = S + C / 60,
        se = 0;
      r === "SATURN 2" ? (se = R / 1e3 * 1) : (se = R / 1e3);
      const ve = (N / 1e3) * pe * w,
        Z = O > 0 ? (M / O) * pe : 0,
        ae = se * A,
        fe = (r === "K1M" || r === "K1") && re > 0 ? K / re : 0,
        me = r === "SATURN 2" ? G : 0,
        oe = ve + Z + ae + fe + me,
        ee = oe * (1 + z / 100),
        j = ee * (1 + W / 100),
        $ = j * (1 + F / 100),
        V = j - ee,
        E = $ - ee,
        D = ve * _,
        ce = ee * _,
        ue = j * _,
        ge = $ * _,
        he = V * _,
        Q = E * _,
        ne = se * _ * (1 + z / 100);
      d({
        custoMaterialUnidadeBase: ae,
        custoMaterialUnidadeBaseFormatado: Ge(ae),
        custoLuzUnidade: ve,
        custoLuzUnidadeFormatado: Ge(ve),
        custoDepreciacaoUnidade: Z,
        custoDepreciacaoUnidadeFormatado: Ge(Z),
        custoSTLUnidade: fe,
        custoSTLUnidadeFormatado: Ge(fe),
        custoBaseUnidade: oe,
        custoBaseUnidadeFormatado: Ge(oe),
        precoProducaoUnidade: ee,
        precoProducaoUnidadeFormatado: Ge(ee),
        valorUnidadeSemImposto: j,
        valorUnidadeSemImpostoFormatado: Ge(j),
        valorUnidadeComImposto: $,
        valorUnidadeComImpostoFormatado: Ge($),
        lucroSemImpostoUnidade: V,
        lucroSemImpostoUnidadeFormatado: Ge(V),
        lucroComImpostoUnidade: E,
        lucroComImpostoUnidadeFormatado: Ge(E),
        custoLuzTotal: D,
        custoLuzTotalFormatado: Ge(D),
        precoProducaoTotal: ce,
        precoProducaoTotalFormatado: Ge(ce),
        valorTotalSemImposto: ue,
        valorTotalSemImpostoFormatado: Ge(ue),
        valorTotalComImposto: ge,
        valorTotalComImpostoFormatado: Ge(ge),
        lucroTotalSemImposto: he,
        lucroTotalSemImpostoFormatado: Ge(he),
        lucroTotalComImposto: Q,
        lucroTotalComImpostoFormatado: Ge(Q),
        materialAComprarKg: ne,
        materialAComprarKgFormatado: nw(ne, 3) + " Kg",
      });
    })();
  }, [i, r]);

  const h = (y, S, C, R = "0.01", _ = "0") =>
    P.jsxs("div", {
      className: "space-y-1",
      children: [
        P.jsxs(Rd, {
          htmlFor: y,
          children: [
            S,
            " ",
            P.jsxs("span", {
              className: "text-xs text-muted-foreground",
              children: ["(", C, ")"],
            }),
          ],
        }),
        P.jsx(Ed, {
          id: y,
          name: y,
          type: "number",
          value: i[y],
          onChange: m,
          step: R,
          min: _,
          className: "w-full",
        }),
      ],
    });

  return P.jsxs("div", {
    className: "container mx-auto p-4 md:p-8",
    children: [
      P.jsx("h1", {
        className: "text-3xl font-bold mb-6 text-center",
        children: "Calculadora de Custos de Impressão 3D",
      }),
      P.jsxs(Bl, {
        className: "mb-6",
        children: [
          P.jsx(Vl, {
            children: P.jsx(Wl, {
              children: "Selecionar Impressora",
            }),
          }),
          P.jsx(Hl, {
            children: P.jsxs(Z0, {
              onValueChange: p,
              value: r,
              children: [
                P.jsx(Qp, {
                  className: "w-full md:w-[280px]",
                  children: P.jsx(q0, {
                    placeholder: "Selecione a impressora",
                  }),
                }),
                P.jsxs(Xp, {
                  children: [
                    P.jsx(Gl, {
                      value: "SATURN 2",
                      children: "SATURN 2 (Resina)",
                    }),
                    P.jsx(Gl, {
                      value: "K1M",
                      children: "K1M (Filamento)",
                    }),
                    P.jsx(Gl, {
                      value: "K1",
                      children: "K1 (Filamento)",
                    }),
                  ],
                }),
              ],
            }),
          }),
        ],
      }),
      P.jsxs("div", {
        className: "grid grid-cols-1 md:grid-cols-3 gap-6",
        children: [
          P.jsxs(Bl, {
            children: [
              P.jsxs(Vl, {
                children: [
                  P.jsx(Wl, {
                    children: "Parâmetros de Entrada",
                  }),
                  P.jsx(ma, {
                    children:
                      "Ajuste os valores. Tempo, material e quantidade iniciam zerados.",
                  }),
                ],
              }),
              P.jsxs(Hl, {
                className: "space-y-4",
                children: [
                  P.jsxs("div", {
                    className: "grid grid-cols-1 sm:grid-cols-2 gap-4",
                    children: [
                      h("tempoImpressaoHoras", "Tempo de Impressão", "Horas", "0.1"),
                      h("tempoImpressaoMinutos", "Tempo de Impressão", "Minutos", "1", "0"),
                      h(
                        "materialUtilizado",
                        "Material Utilizado",
                        r === "SATURN 2" ? "ML" : "Gramas",
                        "1"
                      ),
                      h("numImpressoes", "Número de Impressões", "Unidades", "1", "0"),
                    ],
                  }),
                  P.jsx("hr", {}),
                  P.jsxs("div", {
                    className: "grid grid-cols-1 sm:grid-cols-2 gap-4",
                    children: [
                      h("precoMaterialKg", "Preço Material", "R$/Kg"),
                      h("precoKWH", "Preço KWH", "R$"),
                      h("potenciaW", "Potência da Máquina", "Watt", "1"),
                      h("valorMaquina", "Valor da Máquina", "R$"),
                      h(
                        "tempoDepreciacaoHoras",
                        "Tempo de Depreciação",
                        "Horas",
                        "100"
                      ),
                    ],
                  }),
                  P.jsx("hr", {}),
                  P.jsxs("div", {
                    className: "grid grid-cols-1 sm:grid-cols-2 gap-4",
                    children: [
                      h("taxaFalhaPercent", "Taxa de Falha", "%", "1"),
                      h("impostoPercent", "Imposto", "%", "0.1"),
                      h("taxaLucroPercent", "Taxa de Lucro", "%", "1"),
                      r === "SATURN 2" && h("materialConsumoValor", "Custo Consumíveis", "R$"),
                      (r === "K1M" || r === "K1") && h("precoSTL", "Preço do STL", "R$"),
                      (r === "K1M" || r === "K1") && h("stlPecas", "Diluir STL em Peças", "Unidades", "1", "1"),
                    ],
                  }),
                ],
              }),
            ],
          }),
          P.jsxs(Bl, {
            children: [
              P.jsxs(Vl, {
                children: [
                  P.jsx(Wl, {
                    children: "Resultados Calculados",
                  }),
                  P.jsx(ma, {
                    children: "Custos, preços e lucros baseados nos parâmetros.",
                  }),
                ],
              }),
              P.jsx(Hl, {
                className: "space-y-4",
                children: c
                  ? P.jsxs(P.Fragment, {
                      children: [
                        P.jsx("h3", {
                          className: "font-semibold text-lg mb-2",
                          children: "Por Unidade:",
                        }),
                        P.jsxs("div", {
                          className: "grid grid-cols-2 gap-x-4 gap-y-2 text-sm",
                          children: [
                            P.jsx("span", {
                              children: "Custo Material Base:",
                            }),
                            " ",
                            P.jsx("span", {
                              className: "text-right font-medium",
                              children: c.custoMaterialUnidadeBaseFormatado,
                            }),
                            P.jsx("span", {
                              children: "Custo Luz:",
                            }),
                            " ",
                            P.jsx("span", {
                              className: "text-right font-medium",
                              children: c.custoLuzUnidadeFormatado,
                            }),
                            P.jsx("span", {
                              children: "Custo Depreciação:",
                            }),
                            " ",
                            P.jsx("span", {
                              className: "text-right font-medium",
                              children: c.custoDepreciacaoUnidadeFormatado,
                            }),
                            (r === "K1M" || r === "K1") &&
                              P.jsxs(P.Fragment, {
                                children: [
                                  P.jsx("span", {
                                    children: "Custo STL:",
                                  }),
                                  " ",
                                  P.jsx("span", {
                                    className: "text-right font-medium",
                                    children: c.custoSTLUnidadeFormatado,
                                  }),
                                ],
                              }),
                            r === "SATURN 2" &&
                              P.jsxs(P.Fragment, {
                                children: [
                                  P.jsx("span", {
                                    children: "Custo Consumíveis:",
                                  }),
                                  " ",
                                  P.jsx("span", {
                                    className: "text-right font-medium",
                                    children: Ge(i.materialConsumoValor),
                                  }),
                                ],
                              }),
                            P.jsx("span", {
                              className: "font-bold",
                              children: "Custo Base Total:",
                            }),
                            " ",
                            P.jsx("span", {
                              className: "text-right font-bold",
                              children: c.custoBaseUnidadeFormatado,
                            }),
                            P.jsx("span", {
                              className: "font-bold text-blue-600",
                              children: "Preço Produção (c/ Falha):",
                            }),
                            " ",
                            P.jsx("span", {
                              className: "text-right font-bold text-blue-600",
                              children: c.precoProducaoUnidadeFormatado,
                            }),
                            P.jsx("span", {
                              className: "font-bold text-green-600",
                              children: "Valor Venda (s/ Imposto):",
                            }),
                            " ",
                            P.jsx("span", {
                              className: "text-right font-bold text-green-600",
                              children: c.valorUnidadeSemImpostoFormatado,
                            }),
                            P.jsx("span", {
                              className: "font-bold text-green-700",
                              children: "Valor Venda (c/ Imposto):",
                            }),
                            " ",
                            P.jsx("span", {
                              className: "text-right font-bold text-green-700",
                              children: c.valorUnidadeComImpostoFormatado,
                            }),
                            P.jsx("span", {
                              children: "Lucro (s/ Imposto):",
                            }),
                            " ",
                            P.jsx("span", {
                              className: "text-right font-medium",
                              children: c.lucroSemImpostoUnidadeFormatado,
                            }),
                            P.jsx("span", {
                              children: "Lucro Bruto (c/ Imposto):",
                            }),
                            " ",
                            P.jsx("span", {
                              className: "text-right font-medium",
                              children: c.lucroComImpostoUnidadeFormatado,
                            }),
                          ],
                        }),
                        P.jsx("hr", {
                          className: "my-4",
                        }),
                        P.jsxs("h3", {
                          className: "font-semibold text-lg mb-2",
                          children: [
                            "Para o Lote (",
                            i.numImpressoes,
                            " unidades):",
                          ],
                        }),
                        P.jsxs("div", {
                          className: "grid grid-cols-2 gap-x-4 gap-y-2 text-sm",
                          children: [
                            P.jsx("span", {
                              children: "Custo Luz Total:",
                            }),
                            " ",
                            P.jsx("span", {
                              className: "text-right font-medium",
                              children: c.custoLuzTotalFormatado,
                            }),
                            P.jsx("span", {
                              className: "font-bold text-blue-600",
                              children: "Preço Produção Total:",
                            }),
                            " ",
                            P.jsx("span", {
                              className: "text-right font-bold text-blue-600",
                              children: c.precoProducaoTotalFormatado,
                            }),
                            P.jsx("span", {
                              className: "font-bold text-green-600",
                              children: "Valor Total (s/ Imposto):",
                            }),
                            " ",
                            P.jsx("span", {
                              className: "text-right font-bold text-green-600",
                              children: c.valorTotalSemImpostoFormatado,
                            }),
                            P.jsx("span", {
                              className: "font-bold text-green-700",
                              children: "Valor Total (c/ Imposto):",
                            }),
                            " ",
                            P.jsx("span", {
                              className: "text-right font-bold text-green-700",
                              children: c.valorTotalComImpostoFormatado,
                            }),
                            P.jsx("span", {
                              children: "Lucro Total (s/ Imposto):",
                            }),
                            " ",
                            P.jsx("span", {
                              className: "text-right font-medium",
                              children: c.lucroTotalSemImpostoFormatado,
                            }),
                            P.jsx("span", {
                              children: "Lucro Bruto Total (c/ Imposto):",
                            }),
                            " ",
                            P.jsx("span", {
                              className: "text-right font-medium",
                              children: c.lucroTotalComImpostoFormatado,
                            }),
                          ],
                        }),
                        P.jsx("hr", {
                          className: "my-4",
                        }),
                        P.jsx("h3", {
                          className: "font-semibold text-lg mb-2",
                          children: "Outros:",
                        }),
                        P.jsxs("div", {
                          className: "grid grid-cols-2 gap-x-4 gap-y-2 text-sm",
                          children: [
                            P.jsx("span", {
                              children: "Material a Comprar:",
                            }),
                            " ",
                            P.jsx("span", {
                              className: "text-right font-medium",
                              children: c.materialAComprarKgFormatado,
                            }),
                          ],
                        }),
                      ],
                    })
                  : P.jsx("p", {
                      children: "Calculando...",
                    }),
              }),
            ],
          }),
          
          {/* Novo bloco: Orçamento para o cliente */}
          P.jsxs(Bl, {
            children: [
              P.jsx(Vl, {
                children: P.jsx(Wl, {
                  className: "text-red-600",
                  children: "Orçamento para o cliente",
                }),
              }),
              P.jsx(Hl, {
                className: "space-y-4",
                children: c
                  ? P.jsxs("div", {
                      className: "grid grid-cols-2 gap-x-4 gap-y-2 text-lg",
                      children: [
                        P.jsx("span", {
                          className: "font-bold text-red-600",
                          children: "Valor Total:",
                        }),
                        " ",
                        P.jsx("span", {
                          className: "text-right font-bold text-red-600",
                          children: c.valorTotalComImpostoFormatado,
                        }),
                      ],
                    })
                  : P.jsx("p", {
                      children: "Calculando...",
                    }),
              }),
            ],
          }),
        ],
      }),
    ],
  });
}
