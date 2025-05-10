function Gh(r, s) {
    for (var i = 0; i < s.length; i++) {
        const u = s[i];
        if (typeof u != "string" && !Array.isArray(u)) {
            for (const c in u)
                if (c !== "default" && !(c in r)) {
                    const d = Object.getOwnPropertyDescriptor(u, c);
                    d && Object.defineProperty(r, c, d.get ? d : {
                        enumerable: !0,
                        get: () => u[c]
                    })
                }
        }
    }
    return Object.freeze(Object.defineProperty(r, Symbol.toStringTag, {
        value: "Module"
    }))
}(function() {
    const s = document.createElement("link").relList;
    if (s && s.supports && s.supports("modulepreload")) return;
    for (const c of document.querySelectorAll('link[rel="modulepreload"]')) u(c);
    new MutationObserver(c => {
        for (const d of c)
            if (d.type === "childList")
                for (const m of d.addedNodes) m.tagName === "LINK" && m.rel === "modulepreload" && u(m)
    }).observe(document, {
        childList: !0,
        subtree: !0
    });

    function i(c) {
        const d = {};
        return c.integrity && (d.integrity = c.integrity), c.referrerPolicy && (d.referrerPolicy = c.referrerPolicy), c.crossOrigin === "use-credentials" ? d.credentials = "include" : c.crossOrigin === "anonymous" ? d.credentials = "omit" : d.credentials = "same-origin", d
    }

    function u(c) {
        if (c.ep) return;
        c.ep = !0;
        const d = i(c);
        fetch(c.href, d)
    }
})();

function pd(r) {
    return r && r.__esModule && Object.prototype.hasOwnProperty.call(r, "default") ? r.default : r
}
var qs = {
        exports: {}
    },
    go = {},
    Js = {
        exports: {}
    },
    Se = {};
/**
 * @license React
 * react.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Lf;

function Yh() {
    if (Lf) return Se;
    Lf = 1;
    var r = Symbol.for("react.element"),
        s = Symbol.for("react.portal"),
        i = Symbol.for("react.fragment"),
        u = Symbol.for("react.strict_mode"),
        c = Symbol.for("react.profiler"),
        d = Symbol.for("react.provider"),
        m = Symbol.for("react.context"),
        p = Symbol.for("react.forward_ref"),
        h = Symbol.for("react.suspense"),
        y = Symbol.for("react.memo"),
        S = Symbol.for("react.lazy"),
        C = Symbol.iterator;

    function R(E) {
        return E === null || typeof E != "object" ? null : (E = C && E[C] || E["@@iterator"], typeof E == "function" ? E : null)
    }
    var _ = {
            isMounted: function() {
                return !1
            },
            enqueueForceUpdate: function() {},
            enqueueReplaceState: function() {},
            enqueueSetState: function() {}
        },
        A = Object.assign,
        w = {};

    function N(E, D, ce) {
        this.props = E, this.context = D, this.refs = w, this.updater = ce || _
    }
    N.prototype.isReactComponent = {}, N.prototype.setState = function(E, D) {
        if (typeof E != "object" && typeof E != "function" && E != null) throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
        this.updater.enqueueSetState(this, E, D, "setState")
    }, N.prototype.forceUpdate = function(E) {
        this.updater.enqueueForceUpdate(this, E, "forceUpdate")
    };

    function M() {}
    M.prototype = N.prototype;

    function O(E, D, ce) {
        this.props = E, this.context = D, this.refs = w, this.updater = ce || _
    }
    var z = O.prototype = new M;
    z.constructor = O, A(z, N.prototype), z.isPureReactComponent = !0;
    var F = Array.isArray,
        W = Object.prototype.hasOwnProperty,
        G = {
            current: null
        },
        K = {
            key: !0,
            ref: !0,
            __self: !0,
            __source: !0
        };

    function re(E, D, ce) {
        var ue, ge = {},
            he = null,
            Q = null;
        if (D != null)
            for (ue in D.ref !== void 0 && (Q = D.ref), D.key !== void 0 && (he = "" + D.key), D) W.call(D, ue) && !K.hasOwnProperty(ue) && (ge[ue] = D[ue]);
        var ne = arguments.length - 2;
        if (ne === 1) ge.children = ce;
        else if (1 < ne) {
            for (var ye = Array(ne), xe = 0; xe < ne; xe++) ye[xe] = arguments[xe + 2];
            ge.children = ye
        }
        if (E && E.defaultProps)
            for (ue in ne = E.defaultProps, ne) ge[ue] === void 0 && (ge[ue] = ne[ue]);
        return {
            $$typeof: r,
            type: E,
            key: he,
            ref: Q,
            props: ge,
            _owner: G.current
        }
    }

    function pe(E, D) {
        return {
            $$typeof: r,
            type: E.type,
            key: D,
            ref: E.ref,
            props: E.props,
            _owner: E._owner
        }
    }

    function se(E) {
        return typeof E == "object" && E !== null && E.$$typeof === r
    }

    function ve(E) {
        var D = {
            "=": "=0",
            ":": "=2"
        };
        return "$" + E.replace(/[=:]/g, function(ce) {
            return D[ce]
        })
    }
    var Z = /\/+/g;

    function ae(E, D) {
        return typeof E == "object" && E !== null && E.key != null ? ve("" + E.key) : D.toString(36)
    }

    function fe(E, D, ce, ue, ge) {
        var he = typeof E;
        (he === "undefined" || he === "boolean") && (E = null);
        var Q = !1;
        if (E === null) Q = !0;
        else switch (he) {
            case "string":
            case "number":
                Q = !0;
                break;
            case "object":
                switch (E.$$typeof) {
                    case r:
                    case s:
                        Q = !0
                }
        }
        if (Q) return Q = E, ge = ge(Q), E = ue === "" ? "." + ae(Q, 0) : ue, F(ge) ? (ce = "", E != null && (ce = E.replace(Z, "$&/") + "/"), fe(ge, D, ce, "", function(xe) {
            return xe
        })) : ge != null && (se(ge) && (ge = pe(ge, ce + (!ge.key || Q && Q.key === ge.key ? "" : ("" + ge.key).replace(Z, "$&/") + "/") + E)), D.push(ge)), 1;
        if (Q = 0, ue = ue === "" ? "." : ue + ":", F(E))
            for (var ne = 0; ne < E.length; ne++) {
                he = E[ne];
                var ye = ue + ae(he, ne);
                Q += fe(he, D, ce, ye, ge)
            } else if (ye = R(E), typeof ye == "function")
                for (E = ye.call(E), ne = 0; !(he = E.next()).done;) he = he.value, ye = ue + ae(he, ne++), Q += fe(he, D, ce, ye, ge);
            else if (he === "object") throw D = String(E), Error("Objects are not valid as a React child (found: " + (D === "[object Object]" ? "object with keys {" + Object.keys(E).join(", ") + "}" : D) + "). If you meant to render a collection of children, use an array instead.");
        return Q
    }

    function me(E, D, ce) {
        if (E == null) return E;
        var ue = [],
            ge = 0;
        return fe(E, ue, "", "", function(he) {
            return D.call(ce, he, ge++)
        }), ue
    }

    function oe(E) {
        if (E._status === -1) {
            var D = E._result;
            D = D(), D.then(function(ce) {
                (E._status === 0 || E._status === -1) && (E._status = 1, E._result = ce)
            }, function(ce) {
                (E._status === 0 || E._status === -1) && (E._status = 2, E._result = ce)
            }), E._status === -1 && (E._status = 0, E._result = D)
        }
        if (E._status === 1) return E._result.default;
        throw E._result
    }
    var ee = {
            current: null
        },
        j = {
            transition: null
        },
        $ = {
            ReactCurrentDispatcher: ee,
            ReactCurrentBatchConfig: j,
            ReactCurrentOwner: G
        };

    function V() {
        throw Error("act(...) is not supported in production builds of React.")
    }
    return Se.Children = {
        map: me,
        forEach: function(E, D, ce) {
            me(E, function() {
                D.apply(this, arguments)
            }, ce)
        },
        count: function(E) {
            var D = 0;
            return me(E, function() {
                D++
            }), D
        },
        toArray: function(E) {
            return me(E, function(D) {
                return D
            }) || []
        },
        only: function(E) {
            if (!se(E)) throw Error("React.Children.only expected to receive a single React element child.");
            return E
        }
    }, Se.Component = N, Se.Fragment = i, Se.Profiler = c, Se.PureComponent = O, Se.StrictMode = u, Se.Suspense = h, Se.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = $, Se.act = V, Se.cloneElement = function(E, D, ce) {
        if (E == null) throw Error("React.cloneElement(...): The argument must be a React element, but you passed " + E + ".");
        var ue = A({}, E.props),
            ge = E.key,
            he = E.ref,
            Q = E._owner;
        if (D != null) {
            if (D.ref !== void 0 && (he = D.ref, Q = G.current), D.key !== void 0 && (ge = "" + D.key), E.type && E.type.defaultProps) var ne = E.type.defaultProps;
            for (ye in D) W.call(D, ye) && !K.hasOwnProperty(ye) && (ue[ye] = D[ye] === void 0 && ne !== void 0 ? ne[ye] : D[ye])
        }
        var ye = arguments.length - 2;
        if (ye === 1) ue.children = ce;
        else if (1 < ye) {
            ne = Array(ye);
            for (var xe = 0; xe < ye; xe++) ne[xe] = arguments[xe + 2];
            ue.children = ne
        }
        return {
            $$typeof: r,
            type: E.type,
            key: ge,
            ref: he,
            props: ue,
            _owner: Q
        }
    }, Se.createContext = function(E) {
        return E = {
            $$typeof: m,
            _currentValue: E,
            _currentValue2: E,
            _threadCount: 0,
            Provider: null,
            Consumer: null,
            _defaultValue: null,
            _globalName: null
        }, E.Provider = {
            $$typeof: d,
            _context: E
        }, E.Consumer = E
    }, Se.createElement = re, Se.createFactory = function(E) {
        var D = re.bind(null, E);
        return D.type = E, D
    }, Se.createRef = function() {
        return {
            current: null
        }
    }, Se.forwardRef = function(E) {
        return {
            $$typeof: p,
            render: E
        }
    }, Se.isValidElement = se, Se.lazy = function(E) {
        return {
            $$typeof: S,
            _payload: {
                _status: -1,
                _result: E
            },
            _init: oe
        }
    }, Se.memo = function(E, D) {
        return {
            $$typeof: y,
            type: E,
            compare: D === void 0 ? null : D
        }
    }, Se.startTransition = function(E) {
        var D = j.transition;
        j.transition = {};
        try {
            E()
        } finally {
            j.transition = D
        }
    }, Se.unstable_act = V, Se.useCallback = function(E, D) {
        return ee.current.useCallback(E, D)
    }, Se.useContext = function(E) {
        return ee.current.useContext(E)
    }, Se.useDebugValue = function() {}, Se.useDeferredValue = function(E) {
        return ee.current.useDeferredValue(E)
    }, Se.useEffect = function(E, D) {
        return ee.current.useEffect(E, D)
    }, Se.useId = function() {
        return ee.current.useId()
    }, Se.useImperativeHandle = function(E, D, ce) {
        return ee.current.useImperativeHandle(E, D, ce)
    }, Se.useInsertionEffect = function(E, D) {
        return ee.current.useInsertionEffect(E, D)
    }, Se.useLayoutEffect = function(E, D) {
        return ee.current.useLayoutEffect(E, D)
    }, Se.useMemo = function(E, D) {
        return ee.current.useMemo(E, D)
    }, Se.useReducer = function(E, D, ce) {
        return ee.current.useReducer(E, D, ce)
    }, Se.useRef = function(E) {
        return ee.current.useRef(E)
    }, Se.useState = function(E) {
        return ee.current.useState(E)
    }, Se.useSyncExternalStore = function(E, D, ce) {
        return ee.current.useSyncExternalStore(E, D, ce)
    }, Se.useTransition = function() {
        return ee.current.useTransition()
    }, Se.version = "18.3.1", Se
}
var Of;

function Pa() {
    return Of || (Of = 1, Js.exports = Yh()), Js.exports
}
/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Mf;

function Xh() {
    if (Mf) return go;
    Mf = 1;
    var r = Pa(),
        s = Symbol.for("react.element"),
        i = Symbol.for("react.fragment"),
        u = Object.prototype.hasOwnProperty,
        c = r.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner,
        d = {
            key: !0,
            ref: !0,
            __self: !0,
            __source: !0
        };

    function m(p, h, y) {
        var S, C = {},
            R = null,
            _ = null;
        y !== void 0 && (R = "" + y), h.key !== void 0 && (R = "" + h.key), h.ref !== void 0 && (_ = h.ref);
        for (S in h) u.call(h, S) && !d.hasOwnProperty(S) && (C[S] = h[S]);
        if (p && p.defaultProps)
            for (S in h = p.defaultProps, h) C[S] === void 0 && (C[S] = h[S]);
        return {
            $$typeof: s,
            type: p,
            key: R,
            ref: _,
            props: C,
            _owner: c.current
        }
    }
    return go.Fragment = i, go.jsx = m, go.jsxs = m, go
}
var Af;

function Zh() {
    return Af || (Af = 1, qs.exports = Xh()), qs.exports
}
var P = Zh(),
    g = Pa();
const Nn = pd(g),
    md = Gh({
        __proto__: null,
        default: Nn
    }, [g]);
var zl = {},
    ea = {
        exports: {}
    },
    ut = {},
    ta = {
        exports: {}
    },
    na = {};
/**
 * @license React
 * scheduler.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var zf;

function qh() {
    return zf || (zf = 1, function(r) {
        function s(j, $) {
            var V = j.length;
            j.push($);
            e: for (; 0 < V;) {
                var E = V - 1 >>> 1,
                    D = j[E];
                if (0 < c(D, $)) j[E] = $, j[V] = D, V = E;
                else break e
            }
        }

        function i(j) {
            return j.length === 0 ? null : j[0]
        }

        function u(j) {
            if (j.length === 0) return null;
            var $ = j[0],
                V = j.pop();
            if (V !== $) {
                j[0] = V;
                e: for (var E = 0, D = j.length, ce = D >>> 1; E < ce;) {
                    var ue = 2 * (E + 1) - 1,
                        ge = j[ue],
                        he = ue + 1,
                        Q = j[he];
                    if (0 > c(ge, V)) he < D && 0 > c(Q, ge) ? (j[E] = Q, j[he] = V, E = he) : (j[E] = ge, j[ue] = V, E = ue);
                    else if (he < D && 0 > c(Q, V)) j[E] = Q, j[he] = V, E = he;
                    else break e
                }
            }
            return $
        }

        function c(j, $) {
            var V = j.sortIndex - $.sortIndex;
            return V !== 0 ? V : j.id - $.id
        }
        if (typeof performance == "object" && typeof performance.now == "function") {
            var d = performance;
            r.unstable_now = function() {
                return d.now()
            }
        } else {
            var m = Date,
                p = m.now();
            r.unstable_now = function() {
                return m.now() - p
            }
        }
        var h = [],
            y = [],
            S = 1,
            C = null,
            R = 3,
            _ = !1,
            A = !1,
            w = !1,
            N = typeof setTimeout == "function" ? setTimeout : null,
            M = typeof clearTimeout == "function" ? clearTimeout : null,
            O = typeof setImmediate < "u" ? setImmediate : null;
        typeof navigator < "u" && navigator.scheduling !== void 0 && navigator.scheduling.isInputPending !== void 0 && navigator.scheduling.isInputPending.bind(navigator.scheduling);

        function z(j) {
            for (var $ = i(y); $ !== null;) {
                if ($.callback === null) u(y);
                else if ($.startTime <= j) u(y), $.sortIndex = $.expirationTime, s(h, $);
                else break;
                $ = i(y)
            }
        }

        function F(j) {
            if (w = !1, z(j), !A)
                if (i(h) !== null) A = !0, oe(W);
                else {
                    var $ = i(y);
                    $ !== null && ee(F, $.startTime - j)
                }
        }

        function W(j, $) {
            A = !1, w && (w = !1, M(re), re = -1), _ = !0;
            var V = R;
            try {
                for (z($), C = i(h); C !== null && (!(C.expirationTime > $) || j && !ve());) {
                    var E = C.callback;
                    if (typeof E == "function") {
                        C.callback = null, R = C.priorityLevel;
                        var D = E(C.expirationTime <= $);
                        $ = r.unstable_now(), typeof D == "function" ? C.callback = D : C === i(h) && u(h), z($)
                    } else u(h);
                    C = i(h)
                }
                if (C !== null) var ce = !0;
                else {
                    var ue = i(y);
                    ue !== null && ee(F, ue.startTime - $), ce = !1
                }
                return ce
            } finally {
                C = null, R = V, _ = !1
            }
        }
        var G = !1,
            K = null,
            re = -1,
            pe = 5,
            se = -1;

        function ve() {
            return !(r.unstable_now() - se < pe)
        }

        function Z() {
            if (K !== null) {
                var j = r.unstable_now();
                se = j;
                var $ = !0;
                try {
                    $ = K(!0, j)
                } finally {
                    $ ? ae() : (G = !1, K = null)
                }
            } else G = !1
        }
        var ae;
        if (typeof O == "function") ae = function() {
            O(Z)
        };
        else if (typeof MessageChannel < "u") {
            var fe = new MessageChannel,
                me = fe.port2;
            fe.port1.onmessage = Z, ae = function() {
                me.postMessage(null)
            }
        } else ae = function() {
            N(Z, 0)
        };

        function oe(j) {
            K = j, G || (G = !0, ae())
        }

        function ee(j, $) {
            re = N(function() {
                j(r.unstable_now())
            }, $)
        }
        r.unstable_IdlePriority = 5, r.unstable_ImmediatePriority = 1, r.unstable_LowPriority = 4, r.unstable_NormalPriority = 3, r.unstable_Profiling = null, r.unstable_UserBlockingPriority = 2, r.unstable_cancelCallback = function(j) {
            j.callback = null
        }, r.unstable_continueExecution = function() {
            A || _ || (A = !0, oe(W))
        }, r.unstable_forceFrameRate = function(j) {
            0 > j || 125 < j ? console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported") : pe = 0 < j ? Math.floor(1e3 / j) : 5
        }, r.unstable_getCurrentPriorityLevel = function() {
            return R
        }, r.unstable_getFirstCallbackNode = function() {
            return i(h)
        }, r.unstable_next = function(j) {
            switch (R) {
                case 1:
                case 2:
                case 3:
                    var $ = 3;
                    break;
                default:
                    $ = R
            }
            var V = R;
            R = $;
            try {
                return j()
            } finally {
                R = V
            }
        }, r.unstable_pauseExecution = function() {}, r.unstable_requestPaint = function() {}, r.unstable_runWithPriority = function(j, $) {
            switch (j) {
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                    break;
                default:
                    j = 3
            }
            var V = R;
            R = j;
            try {
                return $()
            } finally {
                R = V
            }
        }, r.unstable_scheduleCallback = function(j, $, V) {
            var E = r.unstable_now();
            switch (typeof V == "object" && V !== null ? (V = V.delay, V = typeof V == "number" && 0 < V ? E + V : E) : V = E, j) {
                case 1:
                    var D = -1;
                    break;
                case 2:
                    D = 250;
                    break;
                case 5:
                    D = 1073741823;
                    break;
                case 4:
                    D = 1e4;
                    break;
                default:
                    D = 5e3
            }
            return D = V + D, j = {
                id: S++,
                callback: $,
                priorityLevel: j,
                startTime: V,
                expirationTime: D,
                sortIndex: -1
            }, V > E ? (j.sortIndex = V, s(y, j), i(h) === null && j === i(y) && (w ? (M(re), re = -1) : w = !0, ee(F, V - E))) : (j.sortIndex = D, s(h, j), A || _ || (A = !0, oe(W))), j
        }, r.unstable_shouldYield = ve, r.unstable_wrapCallback = function(j) {
            var $ = R;
            return function() {
                var V = R;
                R = $;
                try {
                    return j.apply(this, arguments)
                } finally {
                    R = V
                }
            }
        }
    }(na)), na
}
var jf;

function Jh() {
    return jf || (jf = 1, ta.exports = qh()), ta.exports
}
/**
 * @license React
 * react-dom.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Df;

function ev() {
    if (Df) return ut;
    Df = 1;
    var r = Pa(),
        s = Jh();

    function i(e) {
        for (var t = "https://reactjs.org/docs/error-decoder.html?invariant=" + e, n = 1; n < arguments.length; n++) t += "&args[]=" + encodeURIComponent(arguments[n]);
        return "Minified React error #" + e + "; visit " + t + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings."
    }
    var u = new Set,
        c = {};

    function d(e, t) {
        m(e, t), m(e + "Capture", t)
    }

    function m(e, t) {
        for (c[e] = t, e = 0; e < t.length; e++) u.add(t[e])
    }
    var p = !(typeof window > "u" || typeof window.document > "u" || typeof window.document.createElement > "u"),
        h = Object.prototype.hasOwnProperty,
        y = /^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/,
        S = {},
        C = {};

    function R(e) {
        return h.call(C, e) ? !0 : h.call(S, e) ? !1 : y.test(e) ? C[e] = !0 : (S[e] = !0, !1)
    }

    function _(e, t, n, o) {
        if (n !== null && n.type === 0) return !1;
        switch (typeof t) {
            case "function":
            case "symbol":
                return !0;
            case "boolean":
                return o ? !1 : n !== null ? !n.acceptsBooleans : (e = e.toLowerCase().slice(0, 5), e !== "data-" && e !== "aria-");
            default:
                return !1
        }
    }

    function A(e, t, n, o) {
        if (t === null || typeof t > "u" || _(e, t, n, o)) return !0;
        if (o) return !1;
        if (n !== null) switch (n.type) {
            case 3:
                return !t;
            case 4:
                return t === !1;
            case 5:
                return isNaN(t);
            case 6:
                return isNaN(t) || 1 > t
        }
        return !1
    }

    function w(e, t, n, o, l, a, f) {
        this.acceptsBooleans = t === 2 || t === 3 || t === 4, this.attributeName = o, this.attributeNamespace = l, this.mustUseProperty = n, this.propertyName = e, this.type = t, this.sanitizeURL = a, this.removeEmptyString = f
    }
    var N = {};
    "children dangerouslySetInnerHTML defaultValue defaultChecked innerHTML suppressContentEditableWarning suppressHydrationWarning style".split(" ").forEach(function(e) {
        N[e] = new w(e, 0, !1, e, null, !1, !1)
    }), [
        ["acceptCharset", "accept-charset"],
        ["className", "class"],
        ["htmlFor", "for"],
        ["httpEquiv", "http-equiv"]
    ].forEach(function(e) {
        var t = e[0];
        N[t] = new w(t, 1, !1, e[1], null, !1, !1)
    }), ["contentEditable", "draggable", "spellCheck", "value"].forEach(function(e) {
        N[e] = new w(e, 2, !1, e.toLowerCase(), null, !1, !1)
    }), ["autoReverse", "externalResourcesRequired", "focusable", "preserveAlpha"].forEach(function(e) {
        N[e] = new w(e, 2, !1, e, null, !1, !1)
    }), "allowFullScreen async autoFocus autoPlay controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden loop noModule noValidate open playsInline readOnly required reversed scoped seamless itemScope".split(" ").forEach(function(e) {
        N[e] = new w(e, 3, !1, e.toLowerCase(), null, !1, !1)
    }), ["checked", "multiple", "muted", "selected"].forEach(function(e) {
        N[e] = new w(e, 3, !0, e, null, !1, !1)
    }), ["capture", "download"].forEach(function(e) {
        N[e] = new w(e, 4, !1, e, null, !1, !1)
    }), ["cols", "rows", "size", "span"].forEach(function(e) {
        N[e] = new w(e, 6, !1, e, null, !1, !1)
    }), ["rowSpan", "start"].forEach(function(e) {
        N[e] = new w(e, 5, !1, e.toLowerCase(), null, !1, !1)
    });
    var M = /[\-:]([a-z])/g;

    function O(e) {
        return e[1].toUpperCase()
    }
    "accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height".split(" ").forEach(function(e) {
        var t = e.replace(M, O);
        N[t] = new w(t, 1, !1, e, null, !1, !1)
    }), "xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type".split(" ").forEach(function(e) {
        var t = e.replace(M, O);
        N[t] = new w(t, 1, !1, e, "http://www.w3.org/1999/xlink", !1, !1)
    }), ["xml:base", "xml:lang", "xml:space"].forEach(function(e) {
        var t = e.replace(M, O);
        N[t] = new w(t, 1, !1, e, "http://www.w3.org/XML/1998/namespace", !1, !1)
    }), ["tabIndex", "crossOrigin"].forEach(function(e) {
        N[e] = new w(e, 1, !1, e.toLowerCase(), null, !1, !1)
    }), N.xlinkHref = new w("xlinkHref", 1, !1, "xlink:href", "http://www.w3.org/1999/xlink", !0, !1), ["src", "href", "action", "formAction"].forEach(function(e) {
        N[e] = new w(e, 1, !1, e.toLowerCase(), null, !0, !0)
    });

    function z(e, t, n, o) {
        var l = N.hasOwnProperty(t) ? N[t] : null;
        (l !== null ? l.type !== 0 : o || !(2 < t.length) || t[0] !== "o" && t[0] !== "O" || t[1] !== "n" && t[1] !== "N") && (A(t, n, l, o) && (n = null), o || l === null ? R(t) && (n === null ? e.removeAttribute(t) : e.setAttribute(t, "" + n)) : l.mustUseProperty ? e[l.propertyName] = n === null ? l.type === 3 ? !1 : "" : n : (t = l.attributeName, o = l.attributeNamespace, n === null ? e.removeAttribute(t) : (l = l.type, n = l === 3 || l === 4 && n === !0 ? "" : "" + n, o ? e.setAttributeNS(o, t, n) : e.setAttribute(t, n))))
    }
    var F = r.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,
        W = Symbol.for("react.element"),
        G = Symbol.for("react.portal"),
        K = Symbol.for("react.fragment"),
        re = Symbol.for("react.strict_mode"),
        pe = Symbol.for("react.profiler"),
        se = Symbol.for("react.provider"),
        ve = Symbol.for("react.context"),
        Z = Symbol.for("react.forward_ref"),
        ae = Symbol.for("react.suspense"),
        fe = Symbol.for("react.suspense_list"),
        me = Symbol.for("react.memo"),
        oe = Symbol.for("react.lazy"),
        ee = Symbol.for("react.offscreen"),
        j = Symbol.iterator;

    function $(e) {
        return e === null || typeof e != "object" ? null : (e = j && e[j] || e["@@iterator"], typeof e == "function" ? e : null)
    }
    var V = Object.assign,
        E;

    function D(e) {
        if (E === void 0) try {
            throw Error()
        } catch (n) {
            var t = n.stack.trim().match(/\n( *(at )?)/);
            E = t && t[1] || ""
        }
        return `
` + E + e
    }
    var ce = !1;

    function ue(e, t) {
        if (!e || ce) return "";
        ce = !0;
        var n = Error.prepareStackTrace;
        Error.prepareStackTrace = void 0;
        try {
            if (t)
                if (t = function() {
                        throw Error()
                    }, Object.defineProperty(t.prototype, "props", {
                        set: function() {
                            throw Error()
                        }
                    }), typeof Reflect == "object" && Reflect.construct) {
                    try {
                        Reflect.construct(t, [])
                    } catch (L) {
                        var o = L
                    }
                    Reflect.construct(e, [], t)
                } else {
                    try {
                        t.call()
                    } catch (L) {
                        o = L
                    }
                    e.call(t.prototype)
                }
            else {
                try {
                    throw Error()
                } catch (L) {
                    o = L
                }
                e()
            }
        } catch (L) {
            if (L && o && typeof L.stack == "string") {
                for (var l = L.stack.split(`
`), a = o.stack.split(`
`), f = l.length - 1, v = a.length - 1; 1 <= f && 0 <= v && l[f] !== a[v];) v--;
                for (; 1 <= f && 0 <= v; f--, v--)
                    if (l[f] !== a[v]) {
                        if (f !== 1 || v !== 1)
                            do
                                if (f--, v--, 0 > v || l[f] !== a[v]) {
                                    var x = `
` + l[f].replace(" at new ", " at ");
                                    return e.displayName && x.includes("<anonymous>") && (x = x.replace("<anonymous>", e.displayName)), x
                                } while (1 <= f && 0 <= v);
                        break
                    }
            }
        } finally {
            ce = !1, Error.prepareStackTrace = n
        }
        return (e = e ? e.displayName || e.name : "") ? D(e) : ""
    }

    function ge(e) {
        switch (e.tag) {
            case 5:
                return D(e.type);
            case 16:
                return D("Lazy");
            case 13:
                return D("Suspense");
            case 19:
                return D("SuspenseList");
            case 0:
            case 2:
            case 15:
                return e = ue(e.type, !1), e;
            case 11:
                return e = ue(e.type.render, !1), e;
            case 1:
                return e = ue(e.type, !0), e;
            default:
                return ""
        }
    }

    function he(e) {
        if (e == null) return null;
        if (typeof e == "function") return e.displayName || e.name || null;
        if (typeof e == "string") return e;
        switch (e) {
            case K:
                return "Fragment";
            case G:
                return "Portal";
            case pe:
                return "Profiler";
            case re:
                return "StrictMode";
            case ae:
                return "Suspense";
            case fe:
                return "SuspenseList"
        }
        if (typeof e == "object") switch (e.$$typeof) {
            case ve:
                return (e.displayName || "Context") + ".Consumer";
            case se:
                return (e._context.displayName || "Context") + ".Provider";
            case Z:
                var t = e.render;
                return e = e.displayName, e || (e = t.displayName || t.name || "", e = e !== "" ? "ForwardRef(" + e + ")" : "ForwardRef"), e;
            case me:
                return t = e.displayName || null, t !== null ? t : he(e.type) || "Memo";
            case oe:
                t = e._payload, e = e._init;
                try {
                    return he(e(t))
                } catch {}
        }
        return null
    }

    function Q(e) {
        var t = e.type;
        switch (e.tag) {
            case 24:
                return "Cache";
            case 9:
                return (t.displayName || "Context") + ".Consumer";
            case 10:
                return (t._context.displayName || "Context") + ".Provider";
            case 18:
                return "DehydratedFragment";
            case 11:
                return e = t.render, e = e.displayName || e.name || "", t.displayName || (e !== "" ? "ForwardRef(" + e + ")" : "ForwardRef");
            case 7:
                return "Fragment";
            case 5:
                return t;
            case 4:
                return "Portal";
            case 3:
                return "Root";
            case 6:
                return "Text";
            case 16:
                return he(t);
            case 8:
                return t === re ? "StrictMode" : "Mode";
            case 22:
                return "Offscreen";
            case 12:
                return "Profiler";
            case 21:
                return "Scope";
            case 13:
                return "Suspense";
            case 19:
                return "SuspenseList";
            case 25:
                return "TracingMarker";
            case 1:
            case 0:
            case 17:
            case 2:
            case 14:
            case 15:
                if (typeof t == "function") return t.displayName || t.name || null;
                if (typeof t == "string") return t
        }
        return null
    }

    function ne(e) {
        switch (typeof e) {
            case "boolean":
            case "number":
            case "string":
            case "undefined":
                return e;
            case "object":
                return e;
            default:
                return ""
        }
    }

    function ye(e) {
        var t = e.type;
        return (e = e.nodeName) && e.toLowerCase() === "input" && (t === "checkbox" || t === "radio")
    }

    function xe(e) {
        var t = ye(e) ? "checked" : "value",
            n = Object.getOwnPropertyDescriptor(e.constructor.prototype, t),
            o = "" + e[t];
        if (!e.hasOwnProperty(t) && typeof n < "u" && typeof n.get == "function" && typeof n.set == "function") {
            var l = n.get,
                a = n.set;
            return Object.defineProperty(e, t, {
                configurable: !0,
                get: function() {
                    return l.call(this)
                },
                set: function(f) {
                    o = "" + f, a.call(this, f)
                }
            }), Object.defineProperty(e, t, {
                enumerable: n.enumerable
            }), {
                getValue: function() {
                    return o
                },
                setValue: function(f) {
                    o = "" + f
                },
                stopTracking: function() {
                    e._valueTracker = null, delete e[t]
                }
            }
        }
    }

    function Ce(e) {
        e._valueTracker || (e._valueTracker = xe(e))
    }

    function Pe(e) {
        if (!e) return !1;
        var t = e._valueTracker;
        if (!t) return !0;
        var n = t.getValue(),
            o = "";
        return e && (o = ye(e) ? e.checked ? "true" : "false" : e.value), e = o, e !== n ? (t.setValue(e), !0) : !1
    }

    function Ve(e) {
        if (e = e || (typeof document < "u" ? document : void 0), typeof e > "u") return null;
        try {
            return e.activeElement || e.body
        } catch {
            return e.body
        }
    }

    function rt(e, t) {
        var n = t.checked;
        return V({}, t, {
            defaultChecked: void 0,
            defaultValue: void 0,
            value: void 0,
            checked: n ?? e._wrapperState.initialChecked
        })
    }

    function tn(e, t) {
        var n = t.defaultValue == null ? "" : t.defaultValue,
            o = t.checked != null ? t.checked : t.defaultChecked;
        n = ne(t.value != null ? t.value : n), e._wrapperState = {
            initialChecked: o,
            initialValue: n,
            controlled: t.type === "checkbox" || t.type === "radio" ? t.checked != null : t.value != null
        }
    }

    function nn(e, t) {
        t = t.checked, t != null && z(e, "checked", t, !1)
    }

    function Vt(e, t) {
        nn(e, t);
        var n = ne(t.value),
            o = t.type;
        if (n != null) o === "number" ? (n === 0 && e.value === "" || e.value != n) && (e.value = "" + n) : e.value !== "" + n && (e.value = "" + n);
        else if (o === "submit" || o === "reset") {
            e.removeAttribute("value");
            return
        }
        t.hasOwnProperty("value") ? rn(e, t.type, n) : t.hasOwnProperty("defaultValue") && rn(e, t.type, ne(t.defaultValue)), t.checked == null && t.defaultChecked != null && (e.defaultChecked = !!t.defaultChecked)
    }

    function No(e, t, n) {
        if (t.hasOwnProperty("value") || t.hasOwnProperty("defaultValue")) {
            var o = t.type;
            if (!(o !== "submit" && o !== "reset" || t.value !== void 0 && t.value !== null)) return;
            t = "" + e._wrapperState.initialValue, n || t === e.value || (e.value = t), e.defaultValue = t
        }
        n = e.name, n !== "" && (e.name = ""), e.defaultChecked = !!e._wrapperState.initialChecked, n !== "" && (e.name = n)
    }

    function rn(e, t, n) {
        (t !== "number" || Ve(e.ownerDocument) !== e) && (n == null ? e.defaultValue = "" + e._wrapperState.initialValue : e.defaultValue !== "" + n && (e.defaultValue = "" + n))
    }
    var Lr = Array.isArray;

    function Yn(e, t, n, o) {
        if (e = e.options, t) {
            t = {};
            for (var l = 0; l < n.length; l++) t["$" + n[l]] = !0;
            for (n = 0; n < e.length; n++) l = t.hasOwnProperty("$" + e[n].value), e[n].selected !== l && (e[n].selected = l), l && o && (e[n].defaultSelected = !0)
        } else {
            for (n = "" + ne(n), t = null, l = 0; l < e.length; l++) {
                if (e[l].value === n) {
                    e[l].selected = !0, o && (e[l].defaultSelected = !0);
                    return
                }
                t !== null || e[l].disabled || (t = e[l])
            }
            t !== null && (t.selected = !0)
        }
    }

    function ai(e, t) {
        if (t.dangerouslySetInnerHTML != null) throw Error(i(91));
        return V({}, t, {
            value: void 0,
            defaultValue: void 0,
            children: "" + e._wrapperState.initialValue
        })
    }

    function Ua(e, t) {
        var n = t.value;
        if (n == null) {
            if (n = t.children, t = t.defaultValue, n != null) {
                if (t != null) throw Error(i(92));
                if (Lr(n)) {
                    if (1 < n.length) throw Error(i(93));
                    n = n[0]
                }
                t = n
            }
            t == null && (t = ""), n = t
        }
        e._wrapperState = {
            initialValue: ne(n)
        }
    }

    function Ba(e, t) {
        var n = ne(t.value),
            o = ne(t.defaultValue);
        n != null && (n = "" + n, n !== e.value && (e.value = n), t.defaultValue == null && e.defaultValue !== n && (e.defaultValue = n)), o != null && (e.defaultValue = "" + o)
    }

    function Va(e) {
        var t = e.textContent;
        t === e._wrapperState.initialValue && t !== "" && t !== null && (e.value = t)
    }

    function Wa(e) {
        switch (e) {
            case "svg":
                return "http://www.w3.org/2000/svg";
            case "math":
                return "http://www.w3.org/1998/Math/MathML";
            default:
                return "http://www.w3.org/1999/xhtml"
        }
    }

    function ui(e, t) {
        return e == null || e === "http://www.w3.org/1999/xhtml" ? Wa(t) : e === "http://www.w3.org/2000/svg" && t === "foreignObject" ? "http://www.w3.org/1999/xhtml" : e
    }
    var Ro, Ha = function(e) {
        return typeof MSApp < "u" && MSApp.execUnsafeLocalFunction ? function(t, n, o, l) {
            MSApp.execUnsafeLocalFunction(function() {
                return e(t, n, o, l)
            })
        } : e
    }(function(e, t) {
        if (e.namespaceURI !== "http://www.w3.org/2000/svg" || "innerHTML" in e) e.innerHTML = t;
        else {
            for (Ro = Ro || document.createElement("div"), Ro.innerHTML = "<svg>" + t.valueOf().toString() + "</svg>", t = Ro.firstChild; e.firstChild;) e.removeChild(e.firstChild);
            for (; t.firstChild;) e.appendChild(t.firstChild)
        }
    });

    function Or(e, t) {
        if (t) {
            var n = e.firstChild;
            if (n && n === e.lastChild && n.nodeType === 3) {
                n.nodeValue = t;
                return
            }
        }
        e.textContent = t
    }
    var Mr = {
            animationIterationCount: !0,
            aspectRatio: !0,
            borderImageOutset: !0,
            borderImageSlice: !0,
            borderImageWidth: !0,
            boxFlex: !0,
            boxFlexGroup: !0,
            boxOrdinalGroup: !0,
            columnCount: !0,
            columns: !0,
            flex: !0,
            flexGrow: !0,
            flexPositive: !0,
            flexShrink: !0,
            flexNegative: !0,
            flexOrder: !0,
            gridArea: !0,
            gridRow: !0,
            gridRowEnd: !0,
            gridRowSpan: !0,
            gridRowStart: !0,
            gridColumn: !0,
            gridColumnEnd: !0,
            gridColumnSpan: !0,
            gridColumnStart: !0,
            fontWeight: !0,
            lineClamp: !0,
            lineHeight: !0,
            opacity: !0,
            order: !0,
            orphans: !0,
            tabSize: !0,
            widows: !0,
            zIndex: !0,
            zoom: !0,
            fillOpacity: !0,
            floodOpacity: !0,
            stopOpacity: !0,
            strokeDasharray: !0,
            strokeDashoffset: !0,
            strokeMiterlimit: !0,
            strokeOpacity: !0,
            strokeWidth: !0
        },
        qp = ["Webkit", "ms", "Moz", "O"];
    Object.keys(Mr).forEach(function(e) {
        qp.forEach(function(t) {
            t = t + e.charAt(0).toUpperCase() + e.substring(1), Mr[t] = Mr[e]
        })
    });

    function $a(e, t, n) {
        return t == null || typeof t == "boolean" || t === "" ? "" : n || typeof t != "number" || t === 0 || Mr.hasOwnProperty(e) && Mr[e] ? ("" + t).trim() : t + "px"
    }

    function Ka(e, t) {
        e = e.style;
        for (var n in t)
            if (t.hasOwnProperty(n)) {
                var o = n.indexOf("--") === 0,
                    l = $a(n, t[n], o);
                n === "float" && (n = "cssFloat"), o ? e.setProperty(n, l) : e[n] = l
            }
    }
    var Jp = V({
        menuitem: !0
    }, {
        area: !0,
        base: !0,
        br: !0,
        col: !0,
        embed: !0,
        hr: !0,
        img: !0,
        input: !0,
        keygen: !0,
        link: !0,
        meta: !0,
        param: !0,
        source: !0,
        track: !0,
        wbr: !0
    });

    function ci(e, t) {
        if (t) {
            if (Jp[e] && (t.children != null || t.dangerouslySetInnerHTML != null)) throw Error(i(137, e));
            if (t.dangerouslySetInnerHTML != null) {
                if (t.children != null) throw Error(i(60));
                if (typeof t.dangerouslySetInnerHTML != "object" || !("__html" in t.dangerouslySetInnerHTML)) throw Error(i(61))
            }
            if (t.style != null && typeof t.style != "object") throw Error(i(62))
        }
    }

    function fi(e, t) {
        if (e.indexOf("-") === -1) return typeof t.is == "string";
        switch (e) {
            case "annotation-xml":
            case "color-profile":
            case "font-face":
            case "font-face-src":
            case "font-face-uri":
            case "font-face-format":
            case "font-face-name":
            case "missing-glyph":
                return !1;
            default:
                return !0
        }
    }
    var di = null;

    function pi(e) {
        return e = e.target || e.srcElement || window, e.correspondingUseElement && (e = e.correspondingUseElement), e.nodeType === 3 ? e.parentNode : e
    }
    var mi = null,
        Xn = null,
        Zn = null;

    function Qa(e) {
        if (e = to(e)) {
            if (typeof mi != "function") throw Error(i(280));
            var t = e.stateNode;
            t && (t = Xo(t), mi(e.stateNode, e.type, t))
        }
    }

    function Ga(e) {
        Xn ? Zn ? Zn.push(e) : Zn = [e] : Xn = e
    }

    function Ya() {
        if (Xn) {
            var e = Xn,
                t = Zn;
            if (Zn = Xn = null, Qa(e), t)
                for (e = 0; e < t.length; e++) Qa(t[e])
        }
    }

    function Xa(e, t) {
        return e(t)
    }

    function Za() {}
    var hi = !1;

    function qa(e, t, n) {
        if (hi) return e(t, n);
        hi = !0;
        try {
            return Xa(e, t, n)
        } finally {
            hi = !1, (Xn !== null || Zn !== null) && (Za(), Ya())
        }
    }

    function Ar(e, t) {
        var n = e.stateNode;
        if (n === null) return null;
        var o = Xo(n);
        if (o === null) return null;
        n = o[t];
        e: switch (t) {
            case "onClick":
            case "onClickCapture":
            case "onDoubleClick":
            case "onDoubleClickCapture":
            case "onMouseDown":
            case "onMouseDownCapture":
            case "onMouseMove":
            case "onMouseMoveCapture":
            case "onMouseUp":
            case "onMouseUpCapture":
            case "onMouseEnter":
                (o = !o.disabled) || (e = e.type, o = !(e === "button" || e === "input" || e === "select" || e === "textarea")), e = !o;
                break e;
            default:
                e = !1
        }
        if (e) return null;
        if (n && typeof n != "function") throw Error(i(231, t, typeof n));
        return n
    }
    var vi = !1;
    if (p) try {
        var zr = {};
        Object.defineProperty(zr, "passive", {
            get: function() {
                vi = !0
            }
        }), window.addEventListener("test", zr, zr), window.removeEventListener("test", zr, zr)
    } catch {
        vi = !1
    }

    function em(e, t, n, o, l, a, f, v, x) {
        var L = Array.prototype.slice.call(arguments, 3);
        try {
            t.apply(n, L)
        } catch (U) {
            this.onError(U)
        }
    }
    var jr = !1,
        To = null,
        _o = !1,
        gi = null,
        tm = {
            onError: function(e) {
                jr = !0, To = e
            }
        };

    function nm(e, t, n, o, l, a, f, v, x) {
        jr = !1, To = null, em.apply(tm, arguments)
    }

    function rm(e, t, n, o, l, a, f, v, x) {
        if (nm.apply(this, arguments), jr) {
            if (jr) {
                var L = To;
                jr = !1, To = null
            } else throw Error(i(198));
            _o || (_o = !0, gi = L)
        }
    }

    function On(e) {
        var t = e,
            n = e;
        if (e.alternate)
            for (; t.return;) t = t.return;
        else {
            e = t;
            do t = e, (t.flags & 4098) !== 0 && (n = t.return), e = t.return; while (e)
        }
        return t.tag === 3 ? n : null
    }

    function Ja(e) {
        if (e.tag === 13) {
            var t = e.memoizedState;
            if (t === null && (e = e.alternate, e !== null && (t = e.memoizedState)), t !== null) return t.dehydrated
        }
        return null
    }

    function eu(e) {
        if (On(e) !== e) throw Error(i(188))
    }

    function om(e) {
        var t = e.alternate;
        if (!t) {
            if (t = On(e), t === null) throw Error(i(188));
            return t !== e ? null : e
        }
        for (var n = e, o = t;;) {
            var l = n.return;
            if (l === null) break;
            var a = l.alternate;
            if (a === null) {
                if (o = l.return, o !== null) {
                    n = o;
                    continue
                }
                break
            }
            if (l.child === a.child) {
                for (a = l.child; a;) {
                    if (a === n) return eu(l), e;
                    if (a === o) return eu(l), t;
                    a = a.sibling
                }
                throw Error(i(188))
            }
            if (n.return !== o.return) n = l, o = a;
            else {
                for (var f = !1, v = l.child; v;) {
                    if (v === n) {
                        f = !0, n = l, o = a;
                        break
                    }
                    if (v === o) {
                        f = !0, o = l, n = a;
                        break
                    }
                    v = v.sibling
                }
                if (!f) {
                    for (v = a.child; v;) {
                        if (v === n) {
                            f = !0, n = a, o = l;
                            break
                        }
                        if (v === o) {
                            f = !0, o = a, n = l;
                            break
                        }
                        v = v.sibling
                    }
                    if (!f) throw Error(i(189))
                }
            }
            if (n.alternate !== o) throw Error(i(190))
        }
        if (n.tag !== 3) throw Error(i(188));
        return n.stateNode.current === n ? e : t
    }

    function tu(e) {
        return e = om(e), e !== null ? nu(e) : null
    }

    function nu(e) {
        if (e.tag === 5 || e.tag === 6) return e;
        for (e = e.child; e !== null;) {
            var t = nu(e);
            if (t !== null) return t;
            e = e.sibling
        }
        return null
    }
    var ru = s.unstable_scheduleCallback,
        ou = s.unstable_cancelCallback,
        lm = s.unstable_shouldYield,
        im = s.unstable_requestPaint,
        je = s.unstable_now,
        sm = s.unstable_getCurrentPriorityLevel,
        yi = s.unstable_ImmediatePriority,
        lu = s.unstable_UserBlockingPriority,
        Io = s.unstable_NormalPriority,
        am = s.unstable_LowPriority,
        iu = s.unstable_IdlePriority,
        Lo = null,
        Mt = null;

    function um(e) {
        if (Mt && typeof Mt.onCommitFiberRoot == "function") try {
            Mt.onCommitFiberRoot(Lo, e, void 0, (e.current.flags & 128) === 128)
        } catch {}
    }
    var Et = Math.clz32 ? Math.clz32 : dm,
        cm = Math.log,
        fm = Math.LN2;

    function dm(e) {
        return e >>>= 0, e === 0 ? 32 : 31 - (cm(e) / fm | 0) | 0
    }
    var Oo = 64,
        Mo = 4194304;

    function Dr(e) {
        switch (e & -e) {
            case 1:
                return 1;
            case 2:
                return 2;
            case 4:
                return 4;
            case 8:
                return 8;
            case 16:
                return 16;
            case 32:
                return 32;
            case 64:
            case 128:
            case 256:
            case 512:
            case 1024:
            case 2048:
            case 4096:
            case 8192:
            case 16384:
            case 32768:
            case 65536:
            case 131072:
            case 262144:
            case 524288:
            case 1048576:
            case 2097152:
                return e & 4194240;
            case 4194304:
            case 8388608:
            case 16777216:
            case 33554432:
            case 67108864:
                return e & 130023424;
            case 134217728:
                return 134217728;
            case 268435456:
                return 268435456;
            case 536870912:
                return 536870912;
            case 1073741824:
                return 1073741824;
            default:
                return e
        }
    }

    function Ao(e, t) {
        var n = e.pendingLanes;
        if (n === 0) return 0;
        var o = 0,
            l = e.suspendedLanes,
            a = e.pingedLanes,
            f = n & 268435455;
        if (f !== 0) {
            var v = f & ~l;
            v !== 0 ? o = Dr(v) : (a &= f, a !== 0 && (o = Dr(a)))
        } else f = n & ~l, f !== 0 ? o = Dr(f) : a !== 0 && (o = Dr(a));
        if (o === 0) return 0;
        if (t !== 0 && t !== o && (t & l) === 0 && (l = o & -o, a = t & -t, l >= a || l === 16 && (a & 4194240) !== 0)) return t;
        if ((o & 4) !== 0 && (o |= n & 16), t = e.entangledLanes, t !== 0)
            for (e = e.entanglements, t &= o; 0 < t;) n = 31 - Et(t), l = 1 << n, o |= e[n], t &= ~l;
        return o
    }

    function pm(e, t) {
        switch (e) {
            case 1:
            case 2:
            case 4:
                return t + 250;
            case 8:
            case 16:
            case 32:
            case 64:
            case 128:
            case 256:
            case 512:
            case 1024:
            case 2048:
            case 4096:
            case 8192:
            case 16384:
            case 32768:
            case 65536:
            case 131072:
            case 262144:
            case 524288:
            case 1048576:
            case 2097152:
                return t + 5e3;
            case 4194304:
            case 8388608:
            case 16777216:
            case 33554432:
            case 67108864:
                return -1;
            case 134217728:
            case 268435456:
            case 536870912:
            case 1073741824:
                return -1;
            default:
                return -1
        }
    }

    function mm(e, t) {
        for (var n = e.suspendedLanes, o = e.pingedLanes, l = e.expirationTimes, a = e.pendingLanes; 0 < a;) {
            var f = 31 - Et(a),
                v = 1 << f,
                x = l[f];
            x === -1 ? ((v & n) === 0 || (v & o) !== 0) && (l[f] = pm(v, t)) : x <= t && (e.expiredLanes |= v), a &= ~v
        }
    }

    function wi(e) {
        return e = e.pendingLanes & -1073741825, e !== 0 ? e : e & 1073741824 ? 1073741824 : 0
    }

    function su() {
        var e = Oo;
        return Oo <<= 1, (Oo & 4194240) === 0 && (Oo = 64), e
    }

    function xi(e) {
        for (var t = [], n = 0; 31 > n; n++) t.push(e);
        return t
    }

    function Fr(e, t, n) {
        e.pendingLanes |= t, t !== 536870912 && (e.suspendedLanes = 0, e.pingedLanes = 0), e = e.eventTimes, t = 31 - Et(t), e[t] = n
    }

    function hm(e, t) {
        var n = e.pendingLanes & ~t;
        e.pendingLanes = t, e.suspendedLanes = 0, e.pingedLanes = 0, e.expiredLanes &= t, e.mutableReadLanes &= t, e.entangledLanes &= t, t = e.entanglements;
        var o = e.eventTimes;
        for (e = e.expirationTimes; 0 < n;) {
            var l = 31 - Et(n),
                a = 1 << l;
            t[l] = 0, o[l] = -1, e[l] = -1, n &= ~a
        }
    }

    function Si(e, t) {
        var n = e.entangledLanes |= t;
        for (e = e.entanglements; n;) {
            var o = 31 - Et(n),
                l = 1 << o;
            l & t | e[o] & t && (e[o] |= t), n &= ~l
        }
    }
    var Ne = 0;

    function au(e) {
        return e &= -e, 1 < e ? 4 < e ? (e & 268435455) !== 0 ? 16 : 536870912 : 4 : 1
    }
    var uu, Ci, cu, fu, du, Ei = !1,
        zo = [],
        on = null,
        ln = null,
        sn = null,
        br = new Map,
        Ur = new Map,
        an = [],
        vm = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset submit".split(" ");

    function pu(e, t) {
        switch (e) {
            case "focusin":
            case "focusout":
                on = null;
                break;
            case "dragenter":
            case "dragleave":
                ln = null;
                break;
            case "mouseover":
            case "mouseout":
                sn = null;
                break;
            case "pointerover":
            case "pointerout":
                br.delete(t.pointerId);
                break;
            case "gotpointercapture":
            case "lostpointercapture":
                Ur.delete(t.pointerId)
        }
    }

    function Br(e, t, n, o, l, a) {
        return e === null || e.nativeEvent !== a ? (e = {
            blockedOn: t,
            domEventName: n,
            eventSystemFlags: o,
            nativeEvent: a,
            targetContainers: [l]
        }, t !== null && (t = to(t), t !== null && Ci(t)), e) : (e.eventSystemFlags |= o, t = e.targetContainers, l !== null && t.indexOf(l) === -1 && t.push(l), e)
    }

    function gm(e, t, n, o, l) {
        switch (t) {
            case "focusin":
                return on = Br(on, e, t, n, o, l), !0;
            case "dragenter":
                return ln = Br(ln, e, t, n, o, l), !0;
            case "mouseover":
                return sn = Br(sn, e, t, n, o, l), !0;
            case "pointerover":
                var a = l.pointerId;
                return br.set(a, Br(br.get(a) || null, e, t, n, o, l)), !0;
            case "gotpointercapture":
                return a = l.pointerId, Ur.set(a, Br(Ur.get(a) || null, e, t, n, o, l)), !0
        }
        return !1
    }

    function mu(e) {
        var t = Mn(e.target);
        if (t !== null) {
            var n = On(t);
            if (n !== null) {
                if (t = n.tag, t === 13) {
                    if (t = Ja(n), t !== null) {
                        e.blockedOn = t, du(e.priority, function() {
                            cu(n)
                        });
                        return
                    }
                } else if (t === 3 && n.stateNode.current.memoizedState.isDehydrated) {
                    e.blockedOn = n.tag === 3 ? n.stateNode.containerInfo : null;
                    return
                }
            }
        }
        e.blockedOn = null
    }

    function jo(e) {
        if (e.blockedOn !== null) return !1;
        for (var t = e.targetContainers; 0 < t.length;) {
            var n = Pi(e.domEventName, e.eventSystemFlags, t[0], e.nativeEvent);
            if (n === null) {
                n = e.nativeEvent;
                var o = new n.constructor(n.type, n);
                di = o, n.target.dispatchEvent(o), di = null
            } else return t = to(n), t !== null && Ci(t), e.blockedOn = n, !1;
            t.shift()
        }
        return !0
    }

    function hu(e, t, n) {
        jo(e) && n.delete(t)
    }

    function ym() {
        Ei = !1, on !== null && jo(on) && (on = null), ln !== null && jo(ln) && (ln = null), sn !== null && jo(sn) && (sn = null), br.forEach(hu), Ur.forEach(hu)
    }

    function Vr(e, t) {
        e.blockedOn === t && (e.blockedOn = null, Ei || (Ei = !0, s.unstable_scheduleCallback(s.unstable_NormalPriority, ym)))
    }

    function Wr(e) {
        function t(l) {
            return Vr(l, e)
        }
        if (0 < zo.length) {
            Vr(zo[0], e);
            for (var n = 1; n < zo.length; n++) {
                var o = zo[n];
                o.blockedOn === e && (o.blockedOn = null)
            }
        }
        for (on !== null && Vr(on, e), ln !== null && Vr(ln, e), sn !== null && Vr(sn, e), br.forEach(t), Ur.forEach(t), n = 0; n < an.length; n++) o = an[n], o.blockedOn === e && (o.blockedOn = null);
        for (; 0 < an.length && (n = an[0], n.blockedOn === null);) mu(n), n.blockedOn === null && an.shift()
    }
    var qn = F.ReactCurrentBatchConfig,
        Do = !0;

    function wm(e, t, n, o) {
        var l = Ne,
            a = qn.transition;
        qn.transition = null;
        try {
            Ne = 1, ki(e, t, n, o)
        } finally {
            Ne = l, qn.transition = a
        }
    }

    function xm(e, t, n, o) {
        var l = Ne,
            a = qn.transition;
        qn.transition = null;
        try {
            Ne = 4, ki(e, t, n, o)
        } finally {
            Ne = l, qn.transition = a
        }
    }

    function ki(e, t, n, o) {
        if (Do) {
            var l = Pi(e, t, n, o);
            if (l === null) Vi(e, t, o, Fo, n), pu(e, o);
            else if (gm(l, e, t, n, o)) o.stopPropagation();
            else if (pu(e, o), t & 4 && -1 < vm.indexOf(e)) {
                for (; l !== null;) {
                    var a = to(l);
                    if (a !== null && uu(a), a = Pi(e, t, n, o), a === null && Vi(e, t, o, Fo, n), a === l) break;
                    l = a
                }
                l !== null && o.stopPropagation()
            } else Vi(e, t, o, null, n)
        }
    }
    var Fo = null;

    function Pi(e, t, n, o) {
        if (Fo = null, e = pi(o), e = Mn(e), e !== null)
            if (t = On(e), t === null) e = null;
            else if (n = t.tag, n === 13) {
            if (e = Ja(t), e !== null) return e;
            e = null
        } else if (n === 3) {
            if (t.stateNode.current.memoizedState.isDehydrated) return t.tag === 3 ? t.stateNode.containerInfo : null;
            e = null
        } else t !== e && (e = null);
        return Fo = e, null
    }

    function vu(e) {
        switch (e) {
            case "cancel":
            case "click":
            case "close":
            case "contextmenu":
            case "copy":
            case "cut":
            case "auxclick":
            case "dblclick":
            case "dragend":
            case "dragstart":
            case "drop":
            case "focusin":
            case "focusout":
            case "input":
            case "invalid":
            case "keydown":
            case "keypress":
            case "keyup":
            case "mousedown":
            case "mouseup":
            case "paste":
            case "pause":
            case "play":
            case "pointercancel":
            case "pointerdown":
            case "pointerup":
            case "ratechange":
            case "reset":
            case "resize":
            case "seeked":
            case "submit":
            case "touchcancel":
            case "touchend":
            case "touchstart":
            case "volumechange":
            case "change":
            case "selectionchange":
            case "textInput":
            case "compositionstart":
            case "compositionend":
            case "compositionupdate":
            case "beforeblur":
            case "afterblur":
            case "beforeinput":
            case "blur":
            case "fullscreenchange":
            case "focus":
            case "hashchange":
            case "popstate":
            case "select":
            case "selectstart":
                return 1;
            case "drag":
            case "dragenter":
            case "dragexit":
            case "dragleave":
            case "dragover":
            case "mousemove":
            case "mouseout":
            case "mouseover":
            case "pointermove":
            case "pointerout":
            case "pointerover":
            case "scroll":
            case "toggle":
            case "touchmove":
            case "wheel":
            case "mouseenter":
            case "mouseleave":
            case "pointerenter":
            case "pointerleave":
                return 4;
            case "message":
                switch (sm()) {
                    case yi:
                        return 1;
                    case lu:
                        return 4;
                    case Io:
                    case am:
                        return 16;
                    case iu:
                        return 536870912;
                    default:
                        return 16
                }
            default:
                return 16
        }
    }
    var un = null,
        Ni = null,
        bo = null;

    function gu() {
        if (bo) return bo;
        var e, t = Ni,
            n = t.length,
            o, l = "value" in un ? un.value : un.textContent,
            a = l.length;
        for (e = 0; e < n && t[e] === l[e]; e++);
        var f = n - e;
        for (o = 1; o <= f && t[n - o] === l[a - o]; o++);
        return bo = l.slice(e, 1 < o ? 1 - o : void 0)
    }

    function Uo(e) {
        var t = e.keyCode;
        return "charCode" in e ? (e = e.charCode, e === 0 && t === 13 && (e = 13)) : e = t, e === 10 && (e = 13), 32 <= e || e === 13 ? e : 0
    }

    function Bo() {
        return !0
    }

    function yu() {
        return !1
    }

    function ft(e) {
        function t(n, o, l, a, f) {
            this._reactName = n, this._targetInst = l, this.type = o, this.nativeEvent = a, this.target = f, this.currentTarget = null;
            for (var v in e) e.hasOwnProperty(v) && (n = e[v], this[v] = n ? n(a) : a[v]);
            return this.isDefaultPrevented = (a.defaultPrevented != null ? a.defaultPrevented : a.returnValue === !1) ? Bo : yu, this.isPropagationStopped = yu, this
        }
        return V(t.prototype, {
            preventDefault: function() {
                this.defaultPrevented = !0;
                var n = this.nativeEvent;
                n && (n.preventDefault ? n.preventDefault() : typeof n.returnValue != "unknown" && (n.returnValue = !1), this.isDefaultPrevented = Bo)
            },
            stopPropagation: function() {
                var n = this.nativeEvent;
                n && (n.stopPropagation ? n.stopPropagation() : typeof n.cancelBubble != "unknown" && (n.cancelBubble = !0), this.isPropagationStopped = Bo)
            },
            persist: function() {},
            isPersistent: Bo
        }), t
    }
    var Jn = {
            eventPhase: 0,
            bubbles: 0,
            cancelable: 0,
            timeStamp: function(e) {
                return e.timeStamp || Date.now()
            },
            defaultPrevented: 0,
            isTrusted: 0
        },
        Ri = ft(Jn),
        Hr = V({}, Jn, {
            view: 0,
            detail: 0
        }),
        Sm = ft(Hr),
        Ti, _i, $r, Vo = V({}, Hr, {
            screenX: 0,
            screenY: 0,
            clientX: 0,
            clientY: 0,
            pageX: 0,
            pageY: 0,
            ctrlKey: 0,
            shiftKey: 0,
            altKey: 0,
            metaKey: 0,
            getModifierState: Li,
            button: 0,
            buttons: 0,
            relatedTarget: function(e) {
                return e.relatedTarget === void 0 ? e.fromElement === e.srcElement ? e.toElement : e.fromElement : e.relatedTarget
            },
            movementX: function(e) {
                return "movementX" in e ? e.movementX : (e !== $r && ($r && e.type === "mousemove" ? (Ti = e.screenX - $r.screenX, _i = e.screenY - $r.screenY) : _i = Ti = 0, $r = e), Ti)
            },
            movementY: function(e) {
                return "movementY" in e ? e.movementY : _i
            }
        }),
        wu = ft(Vo),
        Cm = V({}, Vo, {
            dataTransfer: 0
        }),
        Em = ft(Cm),
        km = V({}, Hr, {
            relatedTarget: 0
        }),
        Ii = ft(km),
        Pm = V({}, Jn, {
            animationName: 0,
            elapsedTime: 0,
            pseudoElement: 0
        }),
        Nm = ft(Pm),
        Rm = V({}, Jn, {
            clipboardData: function(e) {
                return "clipboardData" in e ? e.clipboardData : window.clipboardData
            }
        }),
        Tm = ft(Rm),
        _m = V({}, Jn, {
            data: 0
        }),
        xu = ft(_m),
        Im = {
            Esc: "Escape",
            Spacebar: " ",
            Left: "ArrowLeft",
            Up: "ArrowUp",
            Right: "ArrowRight",
            Down: "ArrowDown",
            Del: "Delete",
            Win: "OS",
            Menu: "ContextMenu",
            Apps: "ContextMenu",
            Scroll: "ScrollLock",
            MozPrintableKey: "Unidentified"
        },
        Lm = {
            8: "Backspace",
            9: "Tab",
            12: "Clear",
            13: "Enter",
            16: "Shift",
            17: "Control",
            18: "Alt",
            19: "Pause",
            20: "CapsLock",
            27: "Escape",
            32: " ",
            33: "PageUp",
            34: "PageDown",
            35: "End",
            36: "Home",
            37: "ArrowLeft",
            38: "ArrowUp",
            39: "ArrowRight",
            40: "ArrowDown",
            45: "Insert",
            46: "Delete",
            112: "F1",
            113: "F2",
            114: "F3",
            115: "F4",
            116: "F5",
            117: "F6",
            118: "F7",
            119: "F8",
            120: "F9",
            121: "F10",
            122: "F11",
            123: "F12",
            144: "NumLock",
            145: "ScrollLock",
            224: "Meta"
        },
        Om = {
            Alt: "altKey",
            Control: "ctrlKey",
            Meta: "metaKey",
            Shift: "shiftKey"
        };

    function Mm(e) {
        var t = this.nativeEvent;
        return t.getModifierState ? t.getModifierState(e) : (e = Om[e]) ? !!t[e] : !1
    }

    function Li() {
        return Mm
    }
    var Am = V({}, Hr, {
            key: function(e) {
                if (e.key) {
                    var t = Im[e.key] || e.key;
                    if (t !== "Unidentified") return t
                }
                return e.type === "keypress" ? (e = Uo(e), e === 13 ? "Enter" : String.fromCharCode(e)) : e.type === "keydown" || e.type === "keyup" ? Lm[e.keyCode] || "Unidentified" : ""
            },
            code: 0,
            location: 0,
            ctrlKey: 0,
            shiftKey: 0,
            altKey: 0,
            metaKey: 0,
            repeat: 0,
            locale: 0,
            getModifierState: Li,
            charCode: function(e) {
                return e.type === "keypress" ? Uo(e) : 0
            },
            keyCode: function(e) {
                return e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0
            },
            which: function(e) {
                return e.type === "keypress" ? Uo(e) : e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0
            }
        }),
        zm = ft(Am),
        jm = V({}, Vo, {
            pointerId: 0,
            width: 0,
            height: 0,
            pressure: 0,
            tangentialPressure: 0,
            tiltX: 0,
            tiltY: 0,
            twist: 0,
            pointerType: 0,
            isPrimary: 0
        }),
        Su = ft(jm),
        Dm = V({}, Hr, {
            touches: 0,
            targetTouches: 0,
            changedTouches: 0,
            altKey: 0,
            metaKey: 0,
            ctrlKey: 0,
            shiftKey: 0,
            getModifierState: Li
        }),
        Fm = ft(Dm),
        bm = V({}, Jn, {
            propertyName: 0,
            elapsedTime: 0,
            pseudoElement: 0
        }),
        Um = ft(bm),
        Bm = V({}, Vo, {
            deltaX: function(e) {
                return "deltaX" in e ? e.deltaX : "wheelDeltaX" in e ? -e.wheelDeltaX : 0
            },
            deltaY: function(e) {
                return "deltaY" in e ? e.deltaY : "wheelDeltaY" in e ? -e.wheelDeltaY : "wheelDelta" in e ? -e.wheelDelta : 0
            },
            deltaZ: 0,
            deltaMode: 0
        }),
        Vm = ft(Bm),
        Wm = [9, 13, 27, 32],
        Oi = p && "CompositionEvent" in window,
        Kr = null;
    p && "documentMode" in document && (Kr = document.documentMode);
    var Hm = p && "TextEvent" in window && !Kr,
        Cu = p && (!Oi || Kr && 8 < Kr && 11 >= Kr),
        Eu = " ",
        ku = !1;

    function Pu(e, t) {
        switch (e) {
            case "keyup":
                return Wm.indexOf(t.keyCode) !== -1;
            case "keydown":
                return t.keyCode !== 229;
            case "keypress":
            case "mousedown":
            case "focusout":
                return !0;
            default:
                return !1
        }
    }

    function Nu(e) {
        return e = e.detail, typeof e == "object" && "data" in e ? e.data : null
    }
    var er = !1;

    function $m(e, t) {
        switch (e) {
            case "compositionend":
                return Nu(t);
            case "keypress":
                return t.which !== 32 ? null : (ku = !0, Eu);
            case "textInput":
                return e = t.data, e === Eu && ku ? null : e;
            default:
                return null
        }
    }

    function Km(e, t) {
        if (er) return e === "compositionend" || !Oi && Pu(e, t) ? (e = gu(), bo = Ni = un = null, er = !1, e) : null;
        switch (e) {
            case "paste":
                return null;
            case "keypress":
                if (!(t.ctrlKey || t.altKey || t.metaKey) || t.ctrlKey && t.altKey) {
                    if (t.char && 1 < t.char.length) return t.char;
                    if (t.which) return String.fromCharCode(t.which)
                }
                return null;
            case "compositionend":
                return Cu && t.locale !== "ko" ? null : t.data;
            default:
                return null
        }
    }
    var Qm = {
        color: !0,
        date: !0,
        datetime: !0,
        "datetime-local": !0,
        email: !0,
        month: !0,
        number: !0,
        password: !0,
        range: !0,
        search: !0,
        tel: !0,
        text: !0,
        time: !0,
        url: !0,
        week: !0
    };

    function Ru(e) {
        var t = e && e.nodeName && e.nodeName.toLowerCase();
        return t === "input" ? !!Qm[e.type] : t === "textarea"
    }

    function Tu(e, t, n, o) {
        Ga(o), t = Qo(t, "onChange"), 0 < t.length && (n = new Ri("onChange", "change", null, n, o), e.push({
            event: n,
            listeners: t
        }))
    }
    var Qr = null,
        Gr = null;

    function Gm(e) {
        Ku(e, 0)
    }

    function Wo(e) {
        var t = lr(e);
        if (Pe(t)) return e
    }

    function Ym(e, t) {
        if (e === "change") return t
    }
    var _u = !1;
    if (p) {
        var Mi;
        if (p) {
            var Ai = "oninput" in document;
            if (!Ai) {
                var Iu = document.createElement("div");
                Iu.setAttribute("oninput", "return;"), Ai = typeof Iu.oninput == "function"
            }
            Mi = Ai
        } else Mi = !1;
        _u = Mi && (!document.documentMode || 9 < document.documentMode)
    }

    function Lu() {
        Qr && (Qr.detachEvent("onpropertychange", Ou), Gr = Qr = null)
    }

    function Ou(e) {
        if (e.propertyName === "value" && Wo(Gr)) {
            var t = [];
            Tu(t, Gr, e, pi(e)), qa(Gm, t)
        }
    }

    function Xm(e, t, n) {
        e === "focusin" ? (Lu(), Qr = t, Gr = n, Qr.attachEvent("onpropertychange", Ou)) : e === "focusout" && Lu()
    }

    function Zm(e) {
        if (e === "selectionchange" || e === "keyup" || e === "keydown") return Wo(Gr)
    }

    function qm(e, t) {
        if (e === "click") return Wo(t)
    }

    function Jm(e, t) {
        if (e === "input" || e === "change") return Wo(t)
    }

    function eh(e, t) {
        return e === t && (e !== 0 || 1 / e === 1 / t) || e !== e && t !== t
    }
    var kt = typeof Object.is == "function" ? Object.is : eh;

    function Yr(e, t) {
        if (kt(e, t)) return !0;
        if (typeof e != "object" || e === null || typeof t != "object" || t === null) return !1;
        var n = Object.keys(e),
            o = Object.keys(t);
        if (n.length !== o.length) return !1;
        for (o = 0; o < n.length; o++) {
            var l = n[o];
            if (!h.call(t, l) || !kt(e[l], t[l])) return !1
        }
        return !0
    }

    function Mu(e) {
        for (; e && e.firstChild;) e = e.firstChild;
        return e
    }

    function Au(e, t) {
        var n = Mu(e);
        e = 0;
        for (var o; n;) {
            if (n.nodeType === 3) {
                if (o = e + n.textContent.length, e <= t && o >= t) return {
                    node: n,
                    offset: t - e
                };
                e = o
            }
            e: {
                for (; n;) {
                    if (n.nextSibling) {
                        n = n.nextSibling;
                        break e
                    }
                    n = n.parentNode
                }
                n = void 0
            }
            n = Mu(n)
        }
    }

    function zu(e, t) {
        return e && t ? e === t ? !0 : e && e.nodeType === 3 ? !1 : t && t.nodeType === 3 ? zu(e, t.parentNode) : "contains" in e ? e.contains(t) : e.compareDocumentPosition ? !!(e.compareDocumentPosition(t) & 16) : !1 : !1
    }

    function ju() {
        for (var e = window, t = Ve(); t instanceof e.HTMLIFrameElement;) {
            try {
                var n = typeof t.contentWindow.location.href == "string"
            } catch {
                n = !1
            }
            if (n) e = t.contentWindow;
            else break;
            t = Ve(e.document)
        }
        return t
    }

    function zi(e) {
        var t = e && e.nodeName && e.nodeName.toLowerCase();
        return t && (t === "input" && (e.type === "text" || e.type === "search" || e.type === "tel" || e.type === "url" || e.type === "password") || t === "textarea" || e.contentEditable === "true")
    }

    function th(e) {
        var t = ju(),
            n = e.focusedElem,
            o = e.selectionRange;
        if (t !== n && n && n.ownerDocument && zu(n.ownerDocument.documentElement, n)) {
            if (o !== null && zi(n)) {
                if (t = o.start, e = o.end, e === void 0 && (e = t), "selectionStart" in n) n.selectionStart = t, n.selectionEnd = Math.min(e, n.value.length);
                else if (e = (t = n.ownerDocument || document) && t.defaultView || window, e.getSelection) {
                    e = e.getSelection();
                    var l = n.textContent.length,
                        a = Math.min(o.start, l);
                    o = o.end === void 0 ? a : Math.min(o.end, l), !e.extend && a > o && (l = o, o = a, a = l), l = Au(n, a);
                    var f = Au(n, o);
                    l && f && (e.rangeCount !== 1 || e.anchorNode !== l.node || e.anchorOffset !== l.offset || e.focusNode !== f.node || e.focusOffset !== f.offset) && (t = t.createRange(), t.setStart(l.node, l.offset), e.removeAllRanges(), a > o ? (e.addRange(t), e.extend(f.node, f.offset)) : (t.setEnd(f.node, f.offset), e.addRange(t)))
                }
            }
            for (t = [], e = n; e = e.parentNode;) e.nodeType === 1 && t.push({
                element: e,
                left: e.scrollLeft,
                top: e.scrollTop
            });
            for (typeof n.focus == "function" && n.focus(), n = 0; n < t.length; n++) e = t[n], e.element.scrollLeft = e.left, e.element.scrollTop = e.top
        }
    }
    var nh = p && "documentMode" in document && 11 >= document.documentMode,
        tr = null,
        ji = null,
        Xr = null,
        Di = !1;

    function Du(e, t, n) {
        var o = n.window === n ? n.document : n.nodeType === 9 ? n : n.ownerDocument;
        Di || tr == null || tr !== Ve(o) || (o = tr, "selectionStart" in o && zi(o) ? o = {
            start: o.selectionStart,
            end: o.selectionEnd
        } : (o = (o.ownerDocument && o.ownerDocument.defaultView || window).getSelection(), o = {
            anchorNode: o.anchorNode,
            anchorOffset: o.anchorOffset,
            focusNode: o.focusNode,
            focusOffset: o.focusOffset
        }), Xr && Yr(Xr, o) || (Xr = o, o = Qo(ji, "onSelect"), 0 < o.length && (t = new Ri("onSelect", "select", null, t, n), e.push({
            event: t,
            listeners: o
        }), t.target = tr)))
    }

    function Ho(e, t) {
        var n = {};
        return n[e.toLowerCase()] = t.toLowerCase(), n["Webkit" + e] = "webkit" + t, n["Moz" + e] = "moz" + t, n
    }
    var nr = {
            animationend: Ho("Animation", "AnimationEnd"),
            animationiteration: Ho("Animation", "AnimationIteration"),
            animationstart: Ho("Animation", "AnimationStart"),
            transitionend: Ho("Transition", "TransitionEnd")
        },
        Fi = {},
        Fu = {};
    p && (Fu = document.createElement("div").style, "AnimationEvent" in window || (delete nr.animationend.animation, delete nr.animationiteration.animation, delete nr.animationstart.animation), "TransitionEvent" in window || delete nr.transitionend.transition);

    function $o(e) {
        if (Fi[e]) return Fi[e];
        if (!nr[e]) return e;
        var t = nr[e],
            n;
        for (n in t)
            if (t.hasOwnProperty(n) && n in Fu) return Fi[e] = t[n];
        return e
    }
    var bu = $o("animationend"),
        Uu = $o("animationiteration"),
        Bu = $o("animationstart"),
        Vu = $o("transitionend"),
        Wu = new Map,
        Hu = "abort auxClick cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");

    function cn(e, t) {
        Wu.set(e, t), d(t, [e])
    }
    for (var bi = 0; bi < Hu.length; bi++) {
        var Ui = Hu[bi],
            rh = Ui.toLowerCase(),
            oh = Ui[0].toUpperCase() + Ui.slice(1);
        cn(rh, "on" + oh)
    }
    cn(bu, "onAnimationEnd"), cn(Uu, "onAnimationIteration"), cn(Bu, "onAnimationStart"), cn("dblclick", "onDoubleClick"), cn("focusin", "onFocus"), cn("focusout", "onBlur"), cn(Vu, "onTransitionEnd"), m("onMouseEnter", ["mouseout", "mouseover"]), m("onMouseLeave", ["mouseout", "mouseover"]), m("onPointerEnter", ["pointerout", "pointerover"]), m("onPointerLeave", ["pointerout", "pointerover"]), d("onChange", "change click focusin focusout input keydown keyup selectionchange".split(" ")), d("onSelect", "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" ")), d("onBeforeInput", ["compositionend", "keypress", "textInput", "paste"]), d("onCompositionEnd", "compositionend focusout keydown keypress keyup mousedown".split(" ")), d("onCompositionStart", "compositionstart focusout keydown keypress keyup mousedown".split(" ")), d("onCompositionUpdate", "compositionupdate focusout keydown keypress keyup mousedown".split(" "));
    var Zr = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "),
        lh = new Set("cancel close invalid load scroll toggle".split(" ").concat(Zr));

    function $u(e, t, n) {
        var o = e.type || "unknown-event";
        e.currentTarget = n, rm(o, t, void 0, e), e.currentTarget = null
    }

    function Ku(e, t) {
        t = (t & 4) !== 0;
        for (var n = 0; n < e.length; n++) {
            var o = e[n],
                l = o.event;
            o = o.listeners;
            e: {
                var a = void 0;
                if (t)
                    for (var f = o.length - 1; 0 <= f; f--) {
                        var v = o[f],
                            x = v.instance,
                            L = v.currentTarget;
                        if (v = v.listener, x !== a && l.isPropagationStopped()) break e;
                        $u(l, v, L), a = x
                    } else
                        for (f = 0; f < o.length; f++) {
                            if (v = o[f], x = v.instance, L = v.currentTarget, v = v.listener, x !== a && l.isPropagationStopped()) break e;
                            $u(l, v, L), a = x
                        }
            }
        }
        if (_o) throw e = gi, _o = !1, gi = null, e
    }

    function Te(e, t) {
        var n = t[Gi];
        n === void 0 && (n = t[Gi] = new Set);
        var o = e + "__bubble";
        n.has(o) || (Qu(t, e, 2, !1), n.add(o))
    }

    function Bi(e, t, n) {
        var o = 0;
        t && (o |= 4), Qu(n, e, o, t)
    }
    var Ko = "_reactListening" + Math.random().toString(36).slice(2);

    function qr(e) {
        if (!e[Ko]) {
            e[Ko] = !0, u.forEach(function(n) {
                n !== "selectionchange" && (lh.has(n) || Bi(n, !1, e), Bi(n, !0, e))
            });
            var t = e.nodeType === 9 ? e : e.ownerDocument;
            t === null || t[Ko] || (t[Ko] = !0, Bi("selectionchange", !1, t))
        }
    }

    function Qu(e, t, n, o) {
        switch (vu(t)) {
            case 1:
                var l = wm;
                break;
            case 4:
                l = xm;
                break;
            default:
                l = ki
        }
        n = l.bind(null, t, n, e), l = void 0, !vi || t !== "touchstart" && t !== "touchmove" && t !== "wheel" || (l = !0), o ? l !== void 0 ? e.addEventListener(t, n, {
            capture: !0,
            passive: l
        }) : e.addEventListener(t, n, !0) : l !== void 0 ? e.addEventListener(t, n, {
            passive: l
        }) : e.addEventListener(t, n, !1)
    }

    function Vi(e, t, n, o, l) {
        var a = o;
        if ((t & 1) === 0 && (t & 2) === 0 && o !== null) e: for (;;) {
            if (o === null) return;
            var f = o.tag;
            if (f === 3 || f === 4) {
                var v = o.stateNode.containerInfo;
                if (v === l || v.nodeType === 8 && v.parentNode === l) break;
                if (f === 4)
                    for (f = o.return; f !== null;) {
                        var x = f.tag;
                        if ((x === 3 || x === 4) && (x = f.stateNode.containerInfo, x === l || x.nodeType === 8 && x.parentNode === l)) return;
                        f = f.return
                    }
                for (; v !== null;) {
                    if (f = Mn(v), f === null) return;
                    if (x = f.tag, x === 5 || x === 6) {
                        o = a = f;
                        continue e
                    }
                    v = v.parentNode
                }
            }
            o = o.return
        }
        qa(function() {
            var L = a,
                U = pi(n),
                B = [];
            e: {
                var b = Wu.get(e);
                if (b !== void 0) {
                    var Y = Ri,
                        q = e;
                    switch (e) {
                        case "keypress":
                            if (Uo(n) === 0) break e;
                        case "keydown":
                        case "keyup":
                            Y = zm;
                            break;
                        case "focusin":
                            q = "focus", Y = Ii;
                            break;
                        case "focusout":
                            q = "blur", Y = Ii;
                            break;
                        case "beforeblur":
                        case "afterblur":
                            Y = Ii;
                            break;
                        case "click":
                            if (n.button === 2) break e;
                        case "auxclick":
                        case "dblclick":
                        case "mousedown":
                        case "mousemove":
                        case "mouseup":
                        case "mouseout":
                        case "mouseover":
                        case "contextmenu":
                            Y = wu;
                            break;
                        case "drag":
                        case "dragend":
                        case "dragenter":
                        case "dragexit":
                        case "dragleave":
                        case "dragover":
                        case "dragstart":
                        case "drop":
                            Y = Em;
                            break;
                        case "touchcancel":
                        case "touchend":
                        case "touchmove":
                        case "touchstart":
                            Y = Fm;
                            break;
                        case bu:
                        case Uu:
                        case Bu:
                            Y = Nm;
                            break;
                        case Vu:
                            Y = Um;
                            break;
                        case "scroll":
                            Y = Sm;
                            break;
                        case "wheel":
                            Y = Vm;
                            break;
                        case "copy":
                        case "cut":
                        case "paste":
                            Y = Tm;
                            break;
                        case "gotpointercapture":
                        case "lostpointercapture":
                        case "pointercancel":
                        case "pointerdown":
                        case "pointermove":
                        case "pointerout":
                        case "pointerover":
                        case "pointerup":
                            Y = Su
                    }
                    var J = (t & 4) !== 0,
                        De = !J && e === "scroll",
                        T = J ? b !== null ? b + "Capture" : null : b;
                    J = [];
                    for (var k = L, I; k !== null;) {
                        I = k;
                        var H = I.stateNode;
                        if (I.tag === 5 && H !== null && (I = H, T !== null && (H = Ar(k, T), H != null && J.push(Jr(k, H, I)))), De) break;
                        k = k.return
                    }
                    0 < J.length && (b = new Y(b, q, null, n, U), B.push({
                        event: b,
                        listeners: J
                    }))
                }
            }
            if ((t & 7) === 0) {
                e: {
                    if (b = e === "mouseover" || e === "pointerover", Y = e === "mouseout" || e === "pointerout", b && n !== di && (q = n.relatedTarget || n.fromElement) && (Mn(q) || q[Wt])) break e;
                    if ((Y || b) && (b = U.window === U ? U : (b = U.ownerDocument) ? b.defaultView || b.parentWindow : window, Y ? (q = n.relatedTarget || n.toElement, Y = L, q = q ? Mn(q) : null, q !== null && (De = On(q), q !== De || q.tag !== 5 && q.tag !== 6) && (q = null)) : (Y = null, q = L), Y !== q)) {
                        if (J = wu, H = "onMouseLeave", T = "onMouseEnter", k = "mouse", (e === "pointerout" || e === "pointerover") && (J = Su, H = "onPointerLeave", T = "onPointerEnter", k = "pointer"), De = Y == null ? b : lr(Y), I = q == null ? b : lr(q), b = new J(H, k + "leave", Y, n, U), b.target = De, b.relatedTarget = I, H = null, Mn(U) === L && (J = new J(T, k + "enter", q, n, U), J.target = I, J.relatedTarget = De, H = J), De = H, Y && q) t: {
                            for (J = Y, T = q, k = 0, I = J; I; I = rr(I)) k++;
                            for (I = 0, H = T; H; H = rr(H)) I++;
                            for (; 0 < k - I;) J = rr(J),
                            k--;
                            for (; 0 < I - k;) T = rr(T),
                            I--;
                            for (; k--;) {
                                if (J === T || T !== null && J === T.alternate) break t;
                                J = rr(J), T = rr(T)
                            }
                            J = null
                        }
                        else J = null;
                        Y !== null && Gu(B, b, Y, J, !1), q !== null && De !== null && Gu(B, De, q, J, !0)
                    }
                }
                e: {
                    if (b = L ? lr(L) : window, Y = b.nodeName && b.nodeName.toLowerCase(), Y === "select" || Y === "input" && b.type === "file") var te = Ym;
                    else if (Ru(b))
                        if (_u) te = Jm;
                        else {
                            te = Zm;
                            var le = Xm
                        }
                    else(Y = b.nodeName) && Y.toLowerCase() === "input" && (b.type === "checkbox" || b.type === "radio") && (te = qm);
                    if (te && (te = te(e, L))) {
                        Tu(B, te, n, U);
                        break e
                    }
                    le && le(e, b, L),
                    e === "focusout" && (le = b._wrapperState) && le.controlled && b.type === "number" && rn(b, "number", b.value)
                }
                switch (le = L ? lr(L) : window, e) {
                    case "focusin":
                        (Ru(le) || le.contentEditable === "true") && (tr = le, ji = L, Xr = null);
                        break;
                    case "focusout":
                        Xr = ji = tr = null;
                        break;
                    case "mousedown":
                        Di = !0;
                        break;
                    case "contextmenu":
                    case "mouseup":
                    case "dragend":
                        Di = !1, Du(B, n, U);
                        break;
                    case "selectionchange":
                        if (nh) break;
                    case "keydown":
                    case "keyup":
                        Du(B, n, U)
                }
                var ie;
                if (Oi) e: {
                    switch (e) {
                        case "compositionstart":
                            var de = "onCompositionStart";
                            break e;
                        case "compositionend":
                            de = "onCompositionEnd";
                            break e;
                        case "compositionupdate":
                            de = "onCompositionUpdate";
                            break e
                    }
                    de = void 0
                }
                else er ? Pu(e, n) && (de = "onCompositionEnd") : e === "keydown" && n.keyCode === 229 && (de = "onCompositionStart");de && (Cu && n.locale !== "ko" && (er || de !== "onCompositionStart" ? de === "onCompositionEnd" && er && (ie = gu()) : (un = U, Ni = "value" in un ? un.value : un.textContent, er = !0)), le = Qo(L, de), 0 < le.length && (de = new xu(de, e, null, n, U), B.push({
                    event: de,
                    listeners: le
                }), ie ? de.data = ie : (ie = Nu(n), ie !== null && (de.data = ie)))),
                (ie = Hm ? $m(e, n) : Km(e, n)) && (L = Qo(L, "onBeforeInput"), 0 < L.length && (U = new xu("onBeforeInput", "beforeinput", null, n, U), B.push({
                    event: U,
                    listeners: L
                }), U.data = ie))
            }
            Ku(B, t)
        })
    }

    function Jr(e, t, n) {
        return {
            instance: e,
            listener: t,
            currentTarget: n
        }
    }

    function Qo(e, t) {
        for (var n = t + "Capture", o = []; e !== null;) {
            var l = e,
                a = l.stateNode;
            l.tag === 5 && a !== null && (l = a, a = Ar(e, n), a != null && o.unshift(Jr(e, a, l)), a = Ar(e, t), a != null && o.push(Jr(e, a, l))), e = e.return
        }
        return o
    }

    function rr(e) {
        if (e === null) return null;
        do e = e.return; while (e && e.tag !== 5);
        return e || null
    }

    function Gu(e, t, n, o, l) {
        for (var a = t._reactName, f = []; n !== null && n !== o;) {
            var v = n,
                x = v.alternate,
                L = v.stateNode;
            if (x !== null && x === o) break;
            v.tag === 5 && L !== null && (v = L, l ? (x = Ar(n, a), x != null && f.unshift(Jr(n, x, v))) : l || (x = Ar(n, a), x != null && f.push(Jr(n, x, v)))), n = n.return
        }
        f.length !== 0 && e.push({
            event: t,
            listeners: f
        })
    }
    var ih = /\r\n?/g,
        sh = /\u0000|\uFFFD/g;

    function Yu(e) {
        return (typeof e == "string" ? e : "" + e).replace(ih, `
`).replace(sh, "")
    }

    function Go(e, t, n) {
        if (t = Yu(t), Yu(e) !== t && n) throw Error(i(425))
    }

    function Yo() {}
    var Wi = null,
        Hi = null;

    function $i(e, t) {
        return e === "textarea" || e === "noscript" || typeof t.children == "string" || typeof t.children == "number" || typeof t.dangerouslySetInnerHTML == "object" && t.dangerouslySetInnerHTML !== null && t.dangerouslySetInnerHTML.__html != null
    }
    var Ki = typeof setTimeout == "function" ? setTimeout : void 0,
        ah = typeof clearTimeout == "function" ? clearTimeout : void 0,
        Xu = typeof Promise == "function" ? Promise : void 0,
        uh = typeof queueMicrotask == "function" ? queueMicrotask : typeof Xu < "u" ? function(e) {
            return Xu.resolve(null).then(e).catch(ch)
        } : Ki;

    function ch(e) {
        setTimeout(function() {
            throw e
        })
    }

    function Qi(e, t) {
        var n = t,
            o = 0;
        do {
            var l = n.nextSibling;
            if (e.removeChild(n), l && l.nodeType === 8)
                if (n = l.data, n === "/$") {
                    if (o === 0) {
                        e.removeChild(l), Wr(t);
                        return
                    }
                    o--
                } else n !== "$" && n !== "$?" && n !== "$!" || o++;
            n = l
        } while (n);
        Wr(t)
    }

    function fn(e) {
        for (; e != null; e = e.nextSibling) {
            var t = e.nodeType;
            if (t === 1 || t === 3) break;
            if (t === 8) {
                if (t = e.data, t === "$" || t === "$!" || t === "$?") break;
                if (t === "/$") return null
            }
        }
        return e
    }

    function Zu(e) {
        e = e.previousSibling;
        for (var t = 0; e;) {
            if (e.nodeType === 8) {
                var n = e.data;
                if (n === "$" || n === "$!" || n === "$?") {
                    if (t === 0) return e;
                    t--
                } else n === "/$" && t++
            }
            e = e.previousSibling
        }
        return null
    }
    var or = Math.random().toString(36).slice(2),
        At = "__reactFiber$" + or,
        eo = "__reactProps$" + or,
        Wt = "__reactContainer$" + or,
        Gi = "__reactEvents$" + or,
        fh = "__reactListeners$" + or,
        dh = "__reactHandles$" + or;

    function Mn(e) {
        var t = e[At];
        if (t) return t;
        for (var n = e.parentNode; n;) {
            if (t = n[Wt] || n[At]) {
                if (n = t.alternate, t.child !== null || n !== null && n.child !== null)
                    for (e = Zu(e); e !== null;) {
                        if (n = e[At]) return n;
                        e = Zu(e)
                    }
                return t
            }
            e = n, n = e.parentNode
        }
        return null
    }

    function to(e) {
        return e = e[At] || e[Wt], !e || e.tag !== 5 && e.tag !== 6 && e.tag !== 13 && e.tag !== 3 ? null : e
    }

    function lr(e) {
        if (e.tag === 5 || e.tag === 6) return e.stateNode;
        throw Error(i(33))
    }

    function Xo(e) {
        return e[eo] || null
    }
    var Yi = [],
        ir = -1;

    function dn(e) {
        return {
            current: e
        }
    }

    function _e(e) {
        0 > ir || (e.current = Yi[ir], Yi[ir] = null, ir--)
    }

    function Re(e, t) {
        ir++, Yi[ir] = e.current, e.current = t
    }
    var pn = {},
        Xe = dn(pn),
        ot = dn(!1),
        An = pn;

    function sr(e, t) {
        var n = e.type.contextTypes;
        if (!n) return pn;
        var o = e.stateNode;
        if (o && o.__reactInternalMemoizedUnmaskedChildContext === t) return o.__reactInternalMemoizedMaskedChildContext;
        var l = {},
            a;
        for (a in n) l[a] = t[a];
        return o && (e = e.stateNode, e.__reactInternalMemoizedUnmaskedChildContext = t, e.__reactInternalMemoizedMaskedChildContext = l), l
    }

    function lt(e) {
        return e = e.childContextTypes, e != null
    }

    function Zo() {
        _e(ot), _e(Xe)
    }

    function qu(e, t, n) {
        if (Xe.current !== pn) throw Error(i(168));
        Re(Xe, t), Re(ot, n)
    }

    function Ju(e, t, n) {
        var o = e.stateNode;
        if (t = t.childContextTypes, typeof o.getChildContext != "function") return n;
        o = o.getChildContext();
        for (var l in o)
            if (!(l in t)) throw Error(i(108, Q(e) || "Unknown", l));
        return V({}, n, o)
    }

    function qo(e) {
        return e = (e = e.stateNode) && e.__reactInternalMemoizedMergedChildContext || pn, An = Xe.current, Re(Xe, e), Re(ot, ot.current), !0
    }

    function ec(e, t, n) {
        var o = e.stateNode;
        if (!o) throw Error(i(169));
        n ? (e = Ju(e, t, An), o.__reactInternalMemoizedMergedChildContext = e, _e(ot), _e(Xe), Re(Xe, e)) : _e(ot), Re(ot, n)
    }
    var Ht = null,
        Jo = !1,
        Xi = !1;

    function tc(e) {
        Ht === null ? Ht = [e] : Ht.push(e)
    }

    function ph(e) {
        Jo = !0, tc(e)
    }

    function mn() {
        if (!Xi && Ht !== null) {
            Xi = !0;
            var e = 0,
                t = Ne;
            try {
                var n = Ht;
                for (Ne = 1; e < n.length; e++) {
                    var o = n[e];
                    do o = o(!0); while (o !== null)
                }
                Ht = null, Jo = !1
            } catch (l) {
                throw Ht !== null && (Ht = Ht.slice(e + 1)), ru(yi, mn), l
            } finally {
                Ne = t, Xi = !1
            }
        }
        return null
    }
    var ar = [],
        ur = 0,
        el = null,
        tl = 0,
        gt = [],
        yt = 0,
        zn = null,
        $t = 1,
        Kt = "";

    function jn(e, t) {
        ar[ur++] = tl, ar[ur++] = el, el = e, tl = t
    }

    function nc(e, t, n) {
        gt[yt++] = $t, gt[yt++] = Kt, gt[yt++] = zn, zn = e;
        var o = $t;
        e = Kt;
        var l = 32 - Et(o) - 1;
        o &= ~(1 << l), n += 1;
        var a = 32 - Et(t) + l;
        if (30 < a) {
            var f = l - l % 5;
            a = (o & (1 << f) - 1).toString(32), o >>= f, l -= f, $t = 1 << 32 - Et(t) + l | n << l | o, Kt = a + e
        } else $t = 1 << a | n << l | o, Kt = e
    }

    function Zi(e) {
        e.return !== null && (jn(e, 1), nc(e, 1, 0))
    }

    function qi(e) {
        for (; e === el;) el = ar[--ur], ar[ur] = null, tl = ar[--ur], ar[ur] = null;
        for (; e === zn;) zn = gt[--yt], gt[yt] = null, Kt = gt[--yt], gt[yt] = null, $t = gt[--yt], gt[yt] = null
    }
    var dt = null,
        pt = null,
        Le = !1,
        Pt = null;

    function rc(e, t) {
        var n = Ct(5, null, null, 0);
        n.elementType = "DELETED", n.stateNode = t, n.return = e, t = e.deletions, t === null ? (e.deletions = [n], e.flags |= 16) : t.push(n)
    }

    function oc(e, t) {
        switch (e.tag) {
            case 5:
                var n = e.type;
                return t = t.nodeType !== 1 || n.toLowerCase() !== t.nodeName.toLowerCase() ? null : t, t !== null ? (e.stateNode = t, dt = e, pt = fn(t.firstChild), !0) : !1;
            case 6:
                return t = e.pendingProps === "" || t.nodeType !== 3 ? null : t, t !== null ? (e.stateNode = t, dt = e, pt = null, !0) : !1;
            case 13:
                return t = t.nodeType !== 8 ? null : t, t !== null ? (n = zn !== null ? {
                    id: $t,
                    overflow: Kt
                } : null, e.memoizedState = {
                    dehydrated: t,
                    treeContext: n,
                    retryLane: 1073741824
                }, n = Ct(18, null, null, 0), n.stateNode = t, n.return = e, e.child = n, dt = e, pt = null, !0) : !1;
            default:
                return !1
        }
    }

    function Ji(e) {
        return (e.mode & 1) !== 0 && (e.flags & 128) === 0
    }

    function es(e) {
        if (Le) {
            var t = pt;
            if (t) {
                var n = t;
                if (!oc(e, t)) {
                    if (Ji(e)) throw Error(i(418));
                    t = fn(n.nextSibling);
                    var o = dt;
                    t && oc(e, t) ? rc(o, n) : (e.flags = e.flags & -4097 | 2, Le = !1, dt = e)
                }
            } else {
                if (Ji(e)) throw Error(i(418));
                e.flags = e.flags & -4097 | 2, Le = !1, dt = e
            }
        }
    }

    function lc(e) {
        for (e = e.return; e !== null && e.tag !== 5 && e.tag !== 3 && e.tag !== 13;) e = e.return;
        dt = e
    }

    function nl(e) {
        if (e !== dt) return !1;
        if (!Le) return lc(e), Le = !0, !1;
        var t;
        if ((t = e.tag !== 3) && !(t = e.tag !== 5) && (t = e.type, t = t !== "head" && t !== "body" && !$i(e.type, e.memoizedProps)), t && (t = pt)) {
            if (Ji(e)) throw ic(), Error(i(418));
            for (; t;) rc(e, t), t = fn(t.nextSibling)
        }
        if (lc(e), e.tag === 13) {
            if (e = e.memoizedState, e = e !== null ? e.dehydrated : null, !e) throw Error(i(317));
            e: {
                for (e = e.nextSibling, t = 0; e;) {
                    if (e.nodeType === 8) {
                        var n = e.data;
                        if (n === "/$") {
                            if (t === 0) {
                                pt = fn(e.nextSibling);
                                break e
                            }
                            t--
                        } else n !== "$" && n !== "$!" && n !== "$?" || t++
                    }
                    e = e.nextSibling
                }
                pt = null
            }
        } else pt = dt ? fn(e.stateNode.nextSibling) : null;
        return !0
    }

    function ic() {
        for (var e = pt; e;) e = fn(e.nextSibling)
    }

    function cr() {
        pt = dt = null, Le = !1
    }

    function ts(e) {
        Pt === null ? Pt = [e] : Pt.push(e)
    }
    var mh = F.ReactCurrentBatchConfig;

    function no(e, t, n) {
        if (e = n.ref, e !== null && typeof e != "function" && typeof e != "object") {
            if (n._owner) {
                if (n = n._owner, n) {
                    if (n.tag !== 1) throw Error(i(309));
                    var o = n.stateNode
                }
                if (!o) throw Error(i(147, e));
                var l = o,
                    a = "" + e;
                return t !== null && t.ref !== null && typeof t.ref == "function" && t.ref._stringRef === a ? t.ref : (t = function(f) {
                    var v = l.refs;
                    f === null ? delete v[a] : v[a] = f
                }, t._stringRef = a, t)
            }
            if (typeof e != "string") throw Error(i(284));
            if (!n._owner) throw Error(i(290, e))
        }
        return e
    }

    function rl(e, t) {
        throw e = Object.prototype.toString.call(t), Error(i(31, e === "[object Object]" ? "object with keys {" + Object.keys(t).join(", ") + "}" : e))
    }

    function sc(e) {
        var t = e._init;
        return t(e._payload)
    }

    function ac(e) {
        function t(T, k) {
            if (e) {
                var I = T.deletions;
                I === null ? (T.deletions = [k], T.flags |= 16) : I.push(k)
            }
        }

        function n(T, k) {
            if (!e) return null;
            for (; k !== null;) t(T, k), k = k.sibling;
            return null
        }

        function o(T, k) {
            for (T = new Map; k !== null;) k.key !== null ? T.set(k.key, k) : T.set(k.index, k), k = k.sibling;
            return T
        }

        function l(T, k) {
            return T = Cn(T, k), T.index = 0, T.sibling = null, T
        }

        function a(T, k, I) {
            return T.index = I, e ? (I = T.alternate, I !== null ? (I = I.index, I < k ? (T.flags |= 2, k) : I) : (T.flags |= 2, k)) : (T.flags |= 1048576, k)
        }

        function f(T) {
            return e && T.alternate === null && (T.flags |= 2), T
        }

        function v(T, k, I, H) {
            return k === null || k.tag !== 6 ? (k = Ks(I, T.mode, H), k.return = T, k) : (k = l(k, I), k.return = T, k)
        }

        function x(T, k, I, H) {
            var te = I.type;
            return te === K ? U(T, k, I.props.children, H, I.key) : k !== null && (k.elementType === te || typeof te == "object" && te !== null && te.$$typeof === oe && sc(te) === k.type) ? (H = l(k, I.props), H.ref = no(T, k, I), H.return = T, H) : (H = Rl(I.type, I.key, I.props, null, T.mode, H), H.ref = no(T, k, I), H.return = T, H)
        }

        function L(T, k, I, H) {
            return k === null || k.tag !== 4 || k.stateNode.containerInfo !== I.containerInfo || k.stateNode.implementation !== I.implementation ? (k = Qs(I, T.mode, H), k.return = T, k) : (k = l(k, I.children || []), k.return = T, k)
        }

        function U(T, k, I, H, te) {
            return k === null || k.tag !== 7 ? (k = Hn(I, T.mode, H, te), k.return = T, k) : (k = l(k, I), k.return = T, k)
        }

        function B(T, k, I) {
            if (typeof k == "string" && k !== "" || typeof k == "number") return k = Ks("" + k, T.mode, I), k.return = T, k;
            if (typeof k == "object" && k !== null) {
                switch (k.$$typeof) {
                    case W:
                        return I = Rl(k.type, k.key, k.props, null, T.mode, I), I.ref = no(T, null, k), I.return = T, I;
                    case G:
                        return k = Qs(k, T.mode, I), k.return = T, k;
                    case oe:
                        var H = k._init;
                        return B(T, H(k._payload), I)
                }
                if (Lr(k) || $(k)) return k = Hn(k, T.mode, I, null), k.return = T, k;
                rl(T, k)
            }
            return null
        }

        function b(T, k, I, H) {
            var te = k !== null ? k.key : null;
            if (typeof I == "string" && I !== "" || typeof I == "number") return te !== null ? null : v(T, k, "" + I, H);
            if (typeof I == "object" && I !== null) {
                switch (I.$$typeof) {
                    case W:
                        return I.key === te ? x(T, k, I, H) : null;
                    case G:
                        return I.key === te ? L(T, k, I, H) : null;
                    case oe:
                        return te = I._init, b(T, k, te(I._payload), H)
                }
                if (Lr(I) || $(I)) return te !== null ? null : U(T, k, I, H, null);
                rl(T, I)
            }
            return null
        }

        function Y(T, k, I, H, te) {
            if (typeof H == "string" && H !== "" || typeof H == "number") return T = T.get(I) || null, v(k, T, "" + H, te);
            if (typeof H == "object" && H !== null) {
                switch (H.$$typeof) {
                    case W:
                        return T = T.get(H.key === null ? I : H.key) || null, x(k, T, H, te);
                    case G:
                        return T = T.get(H.key === null ? I : H.key) || null, L(k, T, H, te);
                    case oe:
                        var le = H._init;
                        return Y(T, k, I, le(H._payload), te)
                }
                if (Lr(H) || $(H)) return T = T.get(I) || null, U(k, T, H, te, null);
                rl(k, H)
            }
            return null
        }

        function q(T, k, I, H) {
            for (var te = null, le = null, ie = k, de = k = 0, $e = null; ie !== null && de < I.length; de++) {
                ie.index > de ? ($e = ie, ie = null) : $e = ie.sibling;
                var ke = b(T, ie, I[de], H);
                if (ke === null) {
                    ie === null && (ie = $e);
                    break
                }
                e && ie && ke.alternate === null && t(T, ie), k = a(ke, k, de), le === null ? te = ke : le.sibling = ke, le = ke, ie = $e
            }
            if (de === I.length) return n(T, ie), Le && jn(T, de), te;
            if (ie === null) {
                for (; de < I.length; de++) ie = B(T, I[de], H), ie !== null && (k = a(ie, k, de), le === null ? te = ie : le.sibling = ie, le = ie);
                return Le && jn(T, de), te
            }
            for (ie = o(T, ie); de < I.length; de++) $e = Y(ie, T, de, I[de], H), $e !== null && (e && $e.alternate !== null && ie.delete($e.key === null ? de : $e.key), k = a($e, k, de), le === null ? te = $e : le.sibling = $e, le = $e);
            return e && ie.forEach(function(En) {
                return t(T, En)
            }), Le && jn(T, de), te
        }

        function J(T, k, I, H) {
            var te = $(I);
            if (typeof te != "function") throw Error(i(150));
            if (I = te.call(I), I == null) throw Error(i(151));
            for (var le = te = null, ie = k, de = k = 0, $e = null, ke = I.next(); ie !== null && !ke.done; de++, ke = I.next()) {
                ie.index > de ? ($e = ie, ie = null) : $e = ie.sibling;
                var En = b(T, ie, ke.value, H);
                if (En === null) {
                    ie === null && (ie = $e);
                    break
                }
                e && ie && En.alternate === null && t(T, ie), k = a(En, k, de), le === null ? te = En : le.sibling = En, le = En, ie = $e
            }
            if (ke.done) return n(T, ie), Le && jn(T, de), te;
            if (ie === null) {
                for (; !ke.done; de++, ke = I.next()) ke = B(T, ke.value, H), ke !== null && (k = a(ke, k, de), le === null ? te = ke : le.sibling = ke, le = ke);
                return Le && jn(T, de), te
            }
            for (ie = o(T, ie); !ke.done; de++, ke = I.next()) ke = Y(ie, T, de, ke.value, H), ke !== null && (e && ke.alternate !== null && ie.delete(ke.key === null ? de : ke.key), k = a(ke, k, de), le === null ? te = ke : le.sibling = ke, le = ke);
            return e && ie.forEach(function(Qh) {
                return t(T, Qh)
            }), Le && jn(T, de), te
        }

        function De(T, k, I, H) {
            if (typeof I == "object" && I !== null && I.type === K && I.key === null && (I = I.props.children), typeof I == "object" && I !== null) {
                switch (I.$$typeof) {
                    case W:
                        e: {
                            for (var te = I.key, le = k; le !== null;) {
                                if (le.key === te) {
                                    if (te = I.type, te === K) {
                                        if (le.tag === 7) {
                                            n(T, le.sibling), k = l(le, I.props.children), k.return = T, T = k;
                                            break e
                                        }
                                    } else if (le.elementType === te || typeof te == "object" && te !== null && te.$$typeof === oe && sc(te) === le.type) {
                                        n(T, le.sibling), k = l(le, I.props), k.ref = no(T, le, I), k.return = T, T = k;
                                        break e
                                    }
                                    n(T, le);
                                    break
                                } else t(T, le);
                                le = le.sibling
                            }
                            I.type === K ? (k = Hn(I.props.children, T.mode, H, I.key), k.return = T, T = k) : (H = Rl(I.type, I.key, I.props, null, T.mode, H), H.ref = no(T, k, I), H.return = T, T = H)
                        }
                        return f(T);
                    case G:
                        e: {
                            for (le = I.key; k !== null;) {
                                if (k.key === le)
                                    if (k.tag === 4 && k.stateNode.containerInfo === I.containerInfo && k.stateNode.implementation === I.implementation) {
                                        n(T, k.sibling), k = l(k, I.children || []), k.return = T, T = k;
                                        break e
                                    } else {
                                        n(T, k);
                                        break
                                    }
                                else t(T, k);
                                k = k.sibling
                            }
                            k = Qs(I, T.mode, H),
                            k.return = T,
                            T = k
                        }
                        return f(T);
                    case oe:
                        return le = I._init, De(T, k, le(I._payload), H)
                }
                if (Lr(I)) return q(T, k, I, H);
                if ($(I)) return J(T, k, I, H);
                rl(T, I)
            }
            return typeof I == "string" && I !== "" || typeof I == "number" ? (I = "" + I, k !== null && k.tag === 6 ? (n(T, k.sibling), k = l(k, I), k.return = T, T = k) : (n(T, k), k = Ks(I, T.mode, H), k.return = T, T = k), f(T)) : n(T, k)
        }
        return De
    }
    var fr = ac(!0),
        uc = ac(!1),
        ol = dn(null),
        ll = null,
        dr = null,
        ns = null;

    function rs() {
        ns = dr = ll = null
    }

    function os(e) {
        var t = ol.current;
        _e(ol), e._currentValue = t
    }

    function ls(e, t, n) {
        for (; e !== null;) {
            var o = e.alternate;
            if ((e.childLanes & t) !== t ? (e.childLanes |= t, o !== null && (o.childLanes |= t)) : o !== null && (o.childLanes & t) !== t && (o.childLanes |= t), e === n) break;
            e = e.return
        }
    }

    function pr(e, t) {
        ll = e, ns = dr = null, e = e.dependencies, e !== null && e.firstContext !== null && ((e.lanes & t) !== 0 && (it = !0), e.firstContext = null)
    }

    function wt(e) {
        var t = e._currentValue;
        if (ns !== e)
            if (e = {
                    context: e,
                    memoizedValue: t,
                    next: null
                }, dr === null) {
                if (ll === null) throw Error(i(308));
                dr = e, ll.dependencies = {
                    lanes: 0,
                    firstContext: e
                }
            } else dr = dr.next = e;
        return t
    }
    var Dn = null;

    function is(e) {
        Dn === null ? Dn = [e] : Dn.push(e)
    }

    function cc(e, t, n, o) {
        var l = t.interleaved;
        return l === null ? (n.next = n, is(t)) : (n.next = l.next, l.next = n), t.interleaved = n, Qt(e, o)
    }

    function Qt(e, t) {
        e.lanes |= t;
        var n = e.alternate;
        for (n !== null && (n.lanes |= t), n = e, e = e.return; e !== null;) e.childLanes |= t, n = e.alternate, n !== null && (n.childLanes |= t), n = e, e = e.return;
        return n.tag === 3 ? n.stateNode : null
    }
    var hn = !1;

    function ss(e) {
        e.updateQueue = {
            baseState: e.memoizedState,
            firstBaseUpdate: null,
            lastBaseUpdate: null,
            shared: {
                pending: null,
                interleaved: null,
                lanes: 0
            },
            effects: null
        }
    }

    function fc(e, t) {
        e = e.updateQueue, t.updateQueue === e && (t.updateQueue = {
            baseState: e.baseState,
            firstBaseUpdate: e.firstBaseUpdate,
            lastBaseUpdate: e.lastBaseUpdate,
            shared: e.shared,
            effects: e.effects
        })
    }

    function Gt(e, t) {
        return {
            eventTime: e,
            lane: t,
            tag: 0,
            payload: null,
            callback: null,
            next: null
        }
    }

    function vn(e, t, n) {
        var o = e.updateQueue;
        if (o === null) return null;
        if (o = o.shared, (Ee & 2) !== 0) {
            var l = o.pending;
            return l === null ? t.next = t : (t.next = l.next, l.next = t), o.pending = t, Qt(e, n)
        }
        return l = o.interleaved, l === null ? (t.next = t, is(o)) : (t.next = l.next, l.next = t), o.interleaved = t, Qt(e, n)
    }

    function il(e, t, n) {
        if (t = t.updateQueue, t !== null && (t = t.shared, (n & 4194240) !== 0)) {
            var o = t.lanes;
            o &= e.pendingLanes, n |= o, t.lanes = n, Si(e, n)
        }
    }

    function dc(e, t) {
        var n = e.updateQueue,
            o = e.alternate;
        if (o !== null && (o = o.updateQueue, n === o)) {
            var l = null,
                a = null;
            if (n = n.firstBaseUpdate, n !== null) {
                do {
                    var f = {
                        eventTime: n.eventTime,
                        lane: n.lane,
                        tag: n.tag,
                        payload: n.payload,
                        callback: n.callback,
                        next: null
                    };
                    a === null ? l = a = f : a = a.next = f, n = n.next
                } while (n !== null);
                a === null ? l = a = t : a = a.next = t
            } else l = a = t;
            n = {
                baseState: o.baseState,
                firstBaseUpdate: l,
                lastBaseUpdate: a,
                shared: o.shared,
                effects: o.effects
            }, e.updateQueue = n;
            return
        }
        e = n.lastBaseUpdate, e === null ? n.firstBaseUpdate = t : e.next = t, n.lastBaseUpdate = t
    }

    function sl(e, t, n, o) {
        var l = e.updateQueue;
        hn = !1;
        var a = l.firstBaseUpdate,
            f = l.lastBaseUpdate,
            v = l.shared.pending;
        if (v !== null) {
            l.shared.pending = null;
            var x = v,
                L = x.next;
            x.next = null, f === null ? a = L : f.next = L, f = x;
            var U = e.alternate;
            U !== null && (U = U.updateQueue, v = U.lastBaseUpdate, v !== f && (v === null ? U.firstBaseUpdate = L : v.next = L, U.lastBaseUpdate = x))
        }
        if (a !== null) {
            var B = l.baseState;
            f = 0, U = L = x = null, v = a;
            do {
                var b = v.lane,
                    Y = v.eventTime;
                if ((o & b) === b) {
                    U !== null && (U = U.next = {
                        eventTime: Y,
                        lane: 0,
                        tag: v.tag,
                        payload: v.payload,
                        callback: v.callback,
                        next: null
                    });
                    e: {
                        var q = e,
                            J = v;
                        switch (b = t, Y = n, J.tag) {
                            case 1:
                                if (q = J.payload, typeof q == "function") {
                                    B = q.call(Y, B, b);
                                    break e
                                }
                                B = q;
                                break e;
                            case 3:
                                q.flags = q.flags & -65537 | 128;
                            case 0:
                                if (q = J.payload, b = typeof q == "function" ? q.call(Y, B, b) : q, b == null) break e;
                                B = V({}, B, b);
                                break e;
                            case 2:
                                hn = !0
                        }
                    }
                    v.callback !== null && v.lane !== 0 && (e.flags |= 64, b = l.effects, b === null ? l.effects = [v] : b.push(v))
                } else Y = {
                    eventTime: Y,
                    lane: b,
                    tag: v.tag,
                    payload: v.payload,
                    callback: v.callback,
                    next: null
                }, U === null ? (L = U = Y, x = B) : U = U.next = Y, f |= b;
                if (v = v.next, v === null) {
                    if (v = l.shared.pending, v === null) break;
                    b = v, v = b.next, b.next = null, l.lastBaseUpdate = b, l.shared.pending = null
                }
            } while (!0);
            if (U === null && (x = B), l.baseState = x, l.firstBaseUpdate = L, l.lastBaseUpdate = U, t = l.shared.interleaved, t !== null) {
                l = t;
                do f |= l.lane, l = l.next; while (l !== t)
            } else a === null && (l.shared.lanes = 0);
            Un |= f, e.lanes = f, e.memoizedState = B
        }
    }

    function pc(e, t, n) {
        if (e = t.effects, t.effects = null, e !== null)
            for (t = 0; t < e.length; t++) {
                var o = e[t],
                    l = o.callback;
                if (l !== null) {
                    if (o.callback = null, o = n, typeof l != "function") throw Error(i(191, l));
                    l.call(o)
                }
            }
    }
    var ro = {},
        zt = dn(ro),
        oo = dn(ro),
        lo = dn(ro);

    function Fn(e) {
        if (e === ro) throw Error(i(174));
        return e
    }

    function as(e, t) {
        switch (Re(lo, t), Re(oo, e), Re(zt, ro), e = t.nodeType, e) {
            case 9:
            case 11:
                t = (t = t.documentElement) ? t.namespaceURI : ui(null, "");
                break;
            default:
                e = e === 8 ? t.parentNode : t, t = e.namespaceURI || null, e = e.tagName, t = ui(t, e)
        }
        _e(zt), Re(zt, t)
    }

    function mr() {
        _e(zt), _e(oo), _e(lo)
    }

    function mc(e) {
        Fn(lo.current);
        var t = Fn(zt.current),
            n = ui(t, e.type);
        t !== n && (Re(oo, e), Re(zt, n))
    }

    function us(e) {
        oo.current === e && (_e(zt), _e(oo))
    }
    var Oe = dn(0);

    function al(e) {
        for (var t = e; t !== null;) {
            if (t.tag === 13) {
                var n = t.memoizedState;
                if (n !== null && (n = n.dehydrated, n === null || n.data === "$?" || n.data === "$!")) return t
            } else if (t.tag === 19 && t.memoizedProps.revealOrder !== void 0) {
                if ((t.flags & 128) !== 0) return t
            } else if (t.child !== null) {
                t.child.return = t, t = t.child;
                continue
            }
            if (t === e) break;
            for (; t.sibling === null;) {
                if (t.return === null || t.return === e) return null;
                t = t.return
            }
            t.sibling.return = t.return, t = t.sibling
        }
        return null
    }
    var cs = [];

    function fs() {
        for (var e = 0; e < cs.length; e++) cs[e]._workInProgressVersionPrimary = null;
        cs.length = 0
    }
    var ul = F.ReactCurrentDispatcher,
        ds = F.ReactCurrentBatchConfig,
        bn = 0,
        Me = null,
        Ue = null,
        We = null,
        cl = !1,
        io = !1,
        so = 0,
        hh = 0;

    function Ze() {
        throw Error(i(321))
    }

    function ps(e, t) {
        if (t === null) return !1;
        for (var n = 0; n < t.length && n < e.length; n++)
            if (!kt(e[n], t[n])) return !1;
        return !0
    }

    function ms(e, t, n, o, l, a) {
        if (bn = a, Me = t, t.memoizedState = null, t.updateQueue = null, t.lanes = 0, ul.current = e === null || e.memoizedState === null ? wh : xh, e = n(o, l), io) {
            a = 0;
            do {
                if (io = !1, so = 0, 25 <= a) throw Error(i(301));
                a += 1, We = Ue = null, t.updateQueue = null, ul.current = Sh, e = n(o, l)
            } while (io)
        }
        if (ul.current = pl, t = Ue !== null && Ue.next !== null, bn = 0, We = Ue = Me = null, cl = !1, t) throw Error(i(300));
        return e
    }

    function hs() {
        var e = so !== 0;
        return so = 0, e
    }

    function jt() {
        var e = {
            memoizedState: null,
            baseState: null,
            baseQueue: null,
            queue: null,
            next: null
        };
        return We === null ? Me.memoizedState = We = e : We = We.next = e, We
    }

    function xt() {
        if (Ue === null) {
            var e = Me.alternate;
            e = e !== null ? e.memoizedState : null
        } else e = Ue.next;
        var t = We === null ? Me.memoizedState : We.next;
        if (t !== null) We = t, Ue = e;
        else {
            if (e === null) throw Error(i(310));
            Ue = e, e = {
                memoizedState: Ue.memoizedState,
                baseState: Ue.baseState,
                baseQueue: Ue.baseQueue,
                queue: Ue.queue,
                next: null
            }, We === null ? Me.memoizedState = We = e : We = We.next = e
        }
        return We
    }

    function ao(e, t) {
        return typeof t == "function" ? t(e) : t
    }

    function vs(e) {
        var t = xt(),
            n = t.queue;
        if (n === null) throw Error(i(311));
        n.lastRenderedReducer = e;
        var o = Ue,
            l = o.baseQueue,
            a = n.pending;
        if (a !== null) {
            if (l !== null) {
                var f = l.next;
                l.next = a.next, a.next = f
            }
            o.baseQueue = l = a, n.pending = null
        }
        if (l !== null) {
            a = l.next, o = o.baseState;
            var v = f = null,
                x = null,
                L = a;
            do {
                var U = L.lane;
                if ((bn & U) === U) x !== null && (x = x.next = {
                    lane: 0,
                    action: L.action,
                    hasEagerState: L.hasEagerState,
                    eagerState: L.eagerState,
                    next: null
                }), o = L.hasEagerState ? L.eagerState : e(o, L.action);
                else {
                    var B = {
                        lane: U,
                        action: L.action,
                        hasEagerState: L.hasEagerState,
                        eagerState: L.eagerState,
                        next: null
                    };
                    x === null ? (v = x = B, f = o) : x = x.next = B, Me.lanes |= U, Un |= U
                }
                L = L.next
            } while (L !== null && L !== a);
            x === null ? f = o : x.next = v, kt(o, t.memoizedState) || (it = !0), t.memoizedState = o, t.baseState = f, t.baseQueue = x, n.lastRenderedState = o
        }
        if (e = n.interleaved, e !== null) {
            l = e;
            do a = l.lane, Me.lanes |= a, Un |= a, l = l.next; while (l !== e)
        } else l === null && (n.lanes = 0);
        return [t.memoizedState, n.dispatch]
    }

    function gs(e) {
        var t = xt(),
            n = t.queue;
        if (n === null) throw Error(i(311));
        n.lastRenderedReducer = e;
        var o = n.dispatch,
            l = n.pending,
            a = t.memoizedState;
        if (l !== null) {
            n.pending = null;
            var f = l = l.next;
            do a = e(a, f.action), f = f.next; while (f !== l);
            kt(a, t.memoizedState) || (it = !0), t.memoizedState = a, t.baseQueue === null && (t.baseState = a), n.lastRenderedState = a
        }
        return [a, o]
    }

    function hc() {}

    function vc(e, t) {
        var n = Me,
            o = xt(),
            l = t(),
            a = !kt(o.memoizedState, l);
        if (a && (o.memoizedState = l, it = !0), o = o.queue, ys(wc.bind(null, n, o, e), [e]), o.getSnapshot !== t || a || We !== null && We.memoizedState.tag & 1) {
            if (n.flags |= 2048, uo(9, yc.bind(null, n, o, l, t), void 0, null), He === null) throw Error(i(349));
            (bn & 30) !== 0 || gc(n, t, l)
        }
        return l
    }

    function gc(e, t, n) {
        e.flags |= 16384, e = {
            getSnapshot: t,
            value: n
        }, t = Me.updateQueue, t === null ? (t = {
            lastEffect: null,
            stores: null
        }, Me.updateQueue = t, t.stores = [e]) : (n = t.stores, n === null ? t.stores = [e] : n.push(e))
    }

    function yc(e, t, n, o) {
        t.value = n, t.getSnapshot = o, xc(t) && Sc(e)
    }

    function wc(e, t, n) {
        return n(function() {
            xc(t) && Sc(e)
        })
    }

    function xc(e) {
        var t = e.getSnapshot;
        e = e.value;
        try {
            var n = t();
            return !kt(e, n)
        } catch {
            return !0
        }
    }

    function Sc(e) {
        var t = Qt(e, 1);
        t !== null && _t(t, e, 1, -1)
    }

    function Cc(e) {
        var t = jt();
        return typeof e == "function" && (e = e()), t.memoizedState = t.baseState = e, e = {
            pending: null,
            interleaved: null,
            lanes: 0,
            dispatch: null,
            lastRenderedReducer: ao,
            lastRenderedState: e
        }, t.queue = e, e = e.dispatch = yh.bind(null, Me, e), [t.memoizedState, e]
    }

    function uo(e, t, n, o) {
        return e = {
            tag: e,
            create: t,
            destroy: n,
            deps: o,
            next: null
        }, t = Me.updateQueue, t === null ? (t = {
            lastEffect: null,
            stores: null
        }, Me.updateQueue = t, t.lastEffect = e.next = e) : (n = t.lastEffect, n === null ? t.lastEffect = e.next = e : (o = n.next, n.next = e, e.next = o, t.lastEffect = e)), e
    }

    function Ec() {
        return xt().memoizedState
    }

    function fl(e, t, n, o) {
        var l = jt();
        Me.flags |= e, l.memoizedState = uo(1 | t, n, void 0, o === void 0 ? null : o)
    }

    function dl(e, t, n, o) {
        var l = xt();
        o = o === void 0 ? null : o;
        var a = void 0;
        if (Ue !== null) {
            var f = Ue.memoizedState;
            if (a = f.destroy, o !== null && ps(o, f.deps)) {
                l.memoizedState = uo(t, n, a, o);
                return
            }
        }
        Me.flags |= e, l.memoizedState = uo(1 | t, n, a, o)
    }

    function kc(e, t) {
        return fl(8390656, 8, e, t)
    }

    function ys(e, t) {
        return dl(2048, 8, e, t)
    }

    function Pc(e, t) {
        return dl(4, 2, e, t)
    }

    function Nc(e, t) {
        return dl(4, 4, e, t)
    }

    function Rc(e, t) {
        if (typeof t == "function") return e = e(), t(e),
            function() {
                t(null)
            };
        if (t != null) return e = e(), t.current = e,
            function() {
                t.current = null
            }
    }

    function Tc(e, t, n) {
        return n = n != null ? n.concat([e]) : null, dl(4, 4, Rc.bind(null, t, e), n)
    }

    function ws() {}

    function _c(e, t) {
        var n = xt();
        t = t === void 0 ? null : t;
        var o = n.memoizedState;
        return o !== null && t !== null && ps(t, o[1]) ? o[0] : (n.memoizedState = [e, t], e)
    }

    function Ic(e, t) {
        var n = xt();
        t = t === void 0 ? null : t;
        var o = n.memoizedState;
        return o !== null && t !== null && ps(t, o[1]) ? o[0] : (e = e(), n.memoizedState = [e, t], e)
    }

    function Lc(e, t, n) {
        return (bn & 21) === 0 ? (e.baseState && (e.baseState = !1, it = !0), e.memoizedState = n) : (kt(n, t) || (n = su(), Me.lanes |= n, Un |= n, e.baseState = !0), t)
    }

    function vh(e, t) {
        var n = Ne;
        Ne = n !== 0 && 4 > n ? n : 4, e(!0);
        var o = ds.transition;
        ds.transition = {};
        try {
            e(!1), t()
        } finally {
            Ne = n, ds.transition = o
        }
    }

    function Oc() {
        return xt().memoizedState
    }

    function gh(e, t, n) {
        var o = xn(e);
        if (n = {
                lane: o,
                action: n,
                hasEagerState: !1,
                eagerState: null,
                next: null
            }, Mc(e)) Ac(t, n);
        else if (n = cc(e, t, n, o), n !== null) {
            var l = nt();
            _t(n, e, o, l), zc(n, t, o)
        }
    }

    function yh(e, t, n) {
        var o = xn(e),
            l = {
                lane: o,
                action: n,
                hasEagerState: !1,
                eagerState: null,
                next: null
            };
        if (Mc(e)) Ac(t, l);
        else {
            var a = e.alternate;
            if (e.lanes === 0 && (a === null || a.lanes === 0) && (a = t.lastRenderedReducer, a !== null)) try {
                var f = t.lastRenderedState,
                    v = a(f, n);
                if (l.hasEagerState = !0, l.eagerState = v, kt(v, f)) {
                    var x = t.interleaved;
                    x === null ? (l.next = l, is(t)) : (l.next = x.next, x.next = l), t.interleaved = l;
                    return
                }
            } catch {} finally {}
            n = cc(e, t, l, o), n !== null && (l = nt(), _t(n, e, o, l), zc(n, t, o))
        }
    }

    function Mc(e) {
        var t = e.alternate;
        return e === Me || t !== null && t === Me
    }

    function Ac(e, t) {
        io = cl = !0;
        var n = e.pending;
        n === null ? t.next = t : (t.next = n.next, n.next = t), e.pending = t
    }

    function zc(e, t, n) {
        if ((n & 4194240) !== 0) {
            var o = t.lanes;
            o &= e.pendingLanes, n |= o, t.lanes = n, Si(e, n)
        }
    }
    var pl = {
            readContext: wt,
            useCallback: Ze,
            useContext: Ze,
            useEffect: Ze,
            useImperativeHandle: Ze,
            useInsertionEffect: Ze,
            useLayoutEffect: Ze,
            useMemo: Ze,
            useReducer: Ze,
            useRef: Ze,
            useState: Ze,
            useDebugValue: Ze,
            useDeferredValue: Ze,
            useTransition: Ze,
            useMutableSource: Ze,
            useSyncExternalStore: Ze,
            useId: Ze,
            unstable_isNewReconciler: !1
        },
        wh = {
            readContext: wt,
            useCallback: function(e, t) {
                return jt().memoizedState = [e, t === void 0 ? null : t], e
            },
            useContext: wt,
            useEffect: kc,
            useImperativeHandle: function(e, t, n) {
                return n = n != null ? n.concat([e]) : null, fl(4194308, 4, Rc.bind(null, t, e), n)
            },
            useLayoutEffect: function(e, t) {
                return fl(4194308, 4, e, t)
            },
            useInsertionEffect: function(e, t) {
                return fl(4, 2, e, t)
            },
            useMemo: function(e, t) {
                var n = jt();
                return t = t === void 0 ? null : t, e = e(), n.memoizedState = [e, t], e
            },
            useReducer: function(e, t, n) {
                var o = jt();
                return t = n !== void 0 ? n(t) : t, o.memoizedState = o.baseState = t, e = {
                    pending: null,
                    interleaved: null,
                    lanes: 0,
                    dispatch: null,
                    lastRenderedReducer: e,
                    lastRenderedState: t
                }, o.queue = e, e = e.dispatch = gh.bind(null, Me, e), [o.memoizedState, e]
            },
            useRef: function(e) {
                var t = jt();
                return e = {
                    current: e
                }, t.memoizedState = e
            },
            useState: Cc,
            useDebugValue: ws,
            useDeferredValue: function(e) {
                return jt().memoizedState = e
            },
            useTransition: function() {
                var e = Cc(!1),
                    t = e[0];
                return e = vh.bind(null, e[1]), jt().memoizedState = e, [t, e]
            },
            useMutableSource: function() {},
            useSyncExternalStore: function(e, t, n) {
                var o = Me,
                    l = jt();
                if (Le) {
                    if (n === void 0) throw Error(i(407));
                    n = n()
                } else {
                    if (n = t(), He === null) throw Error(i(349));
                    (bn & 30) !== 0 || gc(o, t, n)
                }
                l.memoizedState = n;
                var a = {
                    value: n,
                    getSnapshot: t
                };
                return l.queue = a, kc(wc.bind(null, o, a, e), [e]), o.flags |= 2048, uo(9, yc.bind(null, o, a, n, t), void 0, null), n
            },
            useId: function() {
                var e = jt(),
                    t = He.identifierPrefix;
                if (Le) {
                    var n = Kt,
                        o = $t;
                    n = (o & ~(1 << 32 - Et(o) - 1)).toString(32) + n, t = ":" + t + "R" + n, n = so++, 0 < n && (t += "H" + n.toString(32)), t += ":"
                } else n = hh++, t = ":" + t + "r" + n.toString(32) + ":";
                return e.memoizedState = t
            },
            unstable_isNewReconciler: !1
        },
        xh = {
            readContext: wt,
            useCallback: _c,
            useContext: wt,
            useEffect: ys,
            useImperativeHandle: Tc,
            useInsertionEffect: Pc,
            useLayoutEffect: Nc,
            useMemo: Ic,
            useReducer: vs,
            useRef: Ec,
            useState: function() {
                return vs(ao)
            },
            useDebugValue: ws,
            useDeferredValue: function(e) {
                var t = xt();
                return Lc(t, Ue.memoizedState, e)
            },
            useTransition: function() {
                var e = vs(ao)[0],
                    t = xt().memoizedState;
                return [e, t]
            },
            useMutableSource: hc,
            useSyncExternalStore: vc,
            useId: Oc,
            unstable_isNewReconciler: !1
        },
        Sh = {
            readContext: wt,
            useCallback: _c,
            useContext: wt,
            useEffect: ys,
            useImperativeHandle: Tc,
            useInsertionEffect: Pc,
            useLayoutEffect: Nc,
            useMemo: Ic,
            useReducer: gs,
            useRef: Ec,
            useState: function() {
                return gs(ao)
            },
            useDebugValue: ws,
            useDeferredValue: function(e) {
                var t = xt();
                return Ue === null ? t.memoizedState = e : Lc(t, Ue.memoizedState, e)
            },
            useTransition: function() {
                var e = gs(ao)[0],
                    t = xt().memoizedState;
                return [e, t]
            },
            useMutableSource: hc,
            useSyncExternalStore: vc,
            useId: Oc,
            unstable_isNewReconciler: !1
        };

    function Nt(e, t) {
        if (e && e.defaultProps) {
            t = V({}, t), e = e.defaultProps;
            for (var n in e) t[n] === void 0 && (t[n] = e[n]);
            return t
        }
        return t
    }

    function xs(e, t, n, o) {
        t = e.memoizedState, n = n(o, t), n = n == null ? t : V({}, t, n), e.memoizedState = n, e.lanes === 0 && (e.updateQueue.baseState = n)
    }
    var ml = {
        isMounted: function(e) {
            return (e = e._reactInternals) ? On(e) === e : !1
        },
        enqueueSetState: function(e, t, n) {
            e = e._reactInternals;
            var o = nt(),
                l = xn(e),
                a = Gt(o, l);
            a.payload = t, n != null && (a.callback = n), t = vn(e, a, l), t !== null && (_t(t, e, l, o), il(t, e, l))
        },
        enqueueReplaceState: function(e, t, n) {
            e = e._reactInternals;
            var o = nt(),
                l = xn(e),
                a = Gt(o, l);
            a.tag = 1, a.payload = t, n != null && (a.callback = n), t = vn(e, a, l), t !== null && (_t(t, e, l, o), il(t, e, l))
        },
        enqueueForceUpdate: function(e, t) {
            e = e._reactInternals;
            var n = nt(),
                o = xn(e),
                l = Gt(n, o);
            l.tag = 2, t != null && (l.callback = t), t = vn(e, l, o), t !== null && (_t(t, e, o, n), il(t, e, o))
        }
    };

    function jc(e, t, n, o, l, a, f) {
        return e = e.stateNode, typeof e.shouldComponentUpdate == "function" ? e.shouldComponentUpdate(o, a, f) : t.prototype && t.prototype.isPureReactComponent ? !Yr(n, o) || !Yr(l, a) : !0
    }

    function Dc(e, t, n) {
        var o = !1,
            l = pn,
            a = t.contextType;
        return typeof a == "object" && a !== null ? a = wt(a) : (l = lt(t) ? An : Xe.current, o = t.contextTypes, a = (o = o != null) ? sr(e, l) : pn), t = new t(n, a), e.memoizedState = t.state !== null && t.state !== void 0 ? t.state : null, t.updater = ml, e.stateNode = t, t._reactInternals = e, o && (e = e.stateNode, e.__reactInternalMemoizedUnmaskedChildContext = l, e.__reactInternalMemoizedMaskedChildContext = a), t
    }

    function Fc(e, t, n, o) {
        e = t.state, typeof t.componentWillReceiveProps == "function" && t.componentWillReceiveProps(n, o), typeof t.UNSAFE_componentWillReceiveProps == "function" && t.UNSAFE_componentWillReceiveProps(n, o), t.state !== e && ml.enqueueReplaceState(t, t.state, null)
    }

    function Ss(e, t, n, o) {
        var l = e.stateNode;
        l.props = n, l.state = e.memoizedState, l.refs = {}, ss(e);
        var a = t.contextType;
        typeof a == "object" && a !== null ? l.context = wt(a) : (a = lt(t) ? An : Xe.current, l.context = sr(e, a)), l.state = e.memoizedState, a = t.getDerivedStateFromProps, typeof a == "function" && (xs(e, t, a, n), l.state = e.memoizedState), typeof t.getDerivedStateFromProps == "function" || typeof l.getSnapshotBeforeUpdate == "function" || typeof l.UNSAFE_componentWillMount != "function" && typeof l.componentWillMount != "function" || (t = l.state, typeof l.componentWillMount == "function" && l.componentWillMount(), typeof l.UNSAFE_componentWillMount == "function" && l.UNSAFE_componentWillMount(), t !== l.state && ml.enqueueReplaceState(l, l.state, null), sl(e, n, l, o), l.state = e.memoizedState), typeof l.componentDidMount == "function" && (e.flags |= 4194308)
    }

    function hr(e, t) {
        try {
            var n = "",
                o = t;
            do n += ge(o), o = o.return; while (o);
            var l = n
        } catch (a) {
            l = `
Error generating stack: ` + a.message + `
` + a.stack
        }
        return {
            value: e,
            source: t,
            stack: l,
            digest: null
        }
    }

    function Cs(e, t, n) {
        return {
            value: e,
            source: null,
            stack: n ?? null,
            digest: t ?? null
        }
    }

    function Es(e, t) {
        try {
            console.error(t.value)
        } catch (n) {
            setTimeout(function() {
                throw n
            })
        }
    }
    var Ch = typeof WeakMap == "function" ? WeakMap : Map;

    function bc(e, t, n) {
        n = Gt(-1, n), n.tag = 3, n.payload = {
            element: null
        };
        var o = t.value;
        return n.callback = function() {
            Sl || (Sl = !0, Fs = o), Es(e, t)
        }, n
    }

    function Uc(e, t, n) {
        n = Gt(-1, n), n.tag = 3;
        var o = e.type.getDerivedStateFromError;
        if (typeof o == "function") {
            var l = t.value;
            n.payload = function() {
                return o(l)
            }, n.callback = function() {
                Es(e, t)
            }
        }
        var a = e.stateNode;
        return a !== null && typeof a.componentDidCatch == "function" && (n.callback = function() {
            Es(e, t), typeof o != "function" && (yn === null ? yn = new Set([this]) : yn.add(this));
            var f = t.stack;
            this.componentDidCatch(t.value, {
                componentStack: f !== null ? f : ""
            })
        }), n
    }

    function Bc(e, t, n) {
        var o = e.pingCache;
        if (o === null) {
            o = e.pingCache = new Ch;
            var l = new Set;
            o.set(t, l)
        } else l = o.get(t), l === void 0 && (l = new Set, o.set(t, l));
        l.has(n) || (l.add(n), e = jh.bind(null, e, t, n), t.then(e, e))
    }

    function Vc(e) {
        do {
            var t;
            if ((t = e.tag === 13) && (t = e.memoizedState, t = t !== null ? t.dehydrated !== null : !0), t) return e;
            e = e.return
        } while (e !== null);
        return null
    }

    function Wc(e, t, n, o, l) {
        return (e.mode & 1) === 0 ? (e === t ? e.flags |= 65536 : (e.flags |= 128, n.flags |= 131072, n.flags &= -52805, n.tag === 1 && (n.alternate === null ? n.tag = 17 : (t = Gt(-1, 1), t.tag = 2, vn(n, t, 1))), n.lanes |= 1), e) : (e.flags |= 65536, e.lanes = l, e)
    }
    var Eh = F.ReactCurrentOwner,
        it = !1;

    function tt(e, t, n, o) {
        t.child = e === null ? uc(t, null, n, o) : fr(t, e.child, n, o)
    }

    function Hc(e, t, n, o, l) {
        n = n.render;
        var a = t.ref;
        return pr(t, l), o = ms(e, t, n, o, a, l), n = hs(), e !== null && !it ? (t.updateQueue = e.updateQueue, t.flags &= -2053, e.lanes &= ~l, Yt(e, t, l)) : (Le && n && Zi(t), t.flags |= 1, tt(e, t, o, l), t.child)
    }

    function $c(e, t, n, o, l) {
        if (e === null) {
            var a = n.type;
            return typeof a == "function" && !$s(a) && a.defaultProps === void 0 && n.compare === null && n.defaultProps === void 0 ? (t.tag = 15, t.type = a, Kc(e, t, a, o, l)) : (e = Rl(n.type, null, o, t, t.mode, l), e.ref = t.ref, e.return = t, t.child = e)
        }
        if (a = e.child, (e.lanes & l) === 0) {
            var f = a.memoizedProps;
            if (n = n.compare, n = n !== null ? n : Yr, n(f, o) && e.ref === t.ref) return Yt(e, t, l)
        }
        return t.flags |= 1, e = Cn(a, o), e.ref = t.ref, e.return = t, t.child = e
    }

    function Kc(e, t, n, o, l) {
        if (e !== null) {
            var a = e.memoizedProps;
            if (Yr(a, o) && e.ref === t.ref)
                if (it = !1, t.pendingProps = o = a, (e.lanes & l) !== 0)(e.flags & 131072) !== 0 && (it = !0);
                else return t.lanes = e.lanes, Yt(e, t, l)
        }
        return ks(e, t, n, o, l)
    }

    function Qc(e, t, n) {
        var o = t.pendingProps,
            l = o.children,
            a = e !== null ? e.memoizedState : null;
        if (o.mode === "hidden")
            if ((t.mode & 1) === 0) t.memoizedState = {
                baseLanes: 0,
                cachePool: null,
                transitions: null
            }, Re(gr, mt), mt |= n;
            else {
                if ((n & 1073741824) === 0) return e = a !== null ? a.baseLanes | n : n, t.lanes = t.childLanes = 1073741824, t.memoizedState = {
                    baseLanes: e,
                    cachePool: null,
                    transitions: null
                }, t.updateQueue = null, Re(gr, mt), mt |= e, null;
                t.memoizedState = {
                    baseLanes: 0,
                    cachePool: null,
                    transitions: null
                }, o = a !== null ? a.baseLanes : n, Re(gr, mt), mt |= o
            }
        else a !== null ? (o = a.baseLanes | n, t.memoizedState = null) : o = n, Re(gr, mt), mt |= o;
        return tt(e, t, l, n), t.child
    }

    function Gc(e, t) {
        var n = t.ref;
        (e === null && n !== null || e !== null && e.ref !== n) && (t.flags |= 512, t.flags |= 2097152)
    }

    function ks(e, t, n, o, l) {
        var a = lt(n) ? An : Xe.current;
        return a = sr(t, a), pr(t, l), n = ms(e, t, n, o, a, l), o = hs(), e !== null && !it ? (t.updateQueue = e.updateQueue, t.flags &= -2053, e.lanes &= ~l, Yt(e, t, l)) : (Le && o && Zi(t), t.flags |= 1, tt(e, t, n, l), t.child)
    }

    function Yc(e, t, n, o, l) {
        if (lt(n)) {
            var a = !0;
            qo(t)
        } else a = !1;
        if (pr(t, l), t.stateNode === null) vl(e, t), Dc(t, n, o), Ss(t, n, o, l), o = !0;
        else if (e === null) {
            var f = t.stateNode,
                v = t.memoizedProps;
            f.props = v;
            var x = f.context,
                L = n.contextType;
            typeof L == "object" && L !== null ? L = wt(L) : (L = lt(n) ? An : Xe.current, L = sr(t, L));
            var U = n.getDerivedStateFromProps,
                B = typeof U == "function" || typeof f.getSnapshotBeforeUpdate == "function";
            B || typeof f.UNSAFE_componentWillReceiveProps != "function" && typeof f.componentWillReceiveProps != "function" || (v !== o || x !== L) && Fc(t, f, o, L), hn = !1;
            var b = t.memoizedState;
            f.state = b, sl(t, o, f, l), x = t.memoizedState, v !== o || b !== x || ot.current || hn ? (typeof U == "function" && (xs(t, n, U, o), x = t.memoizedState), (v = hn || jc(t, n, v, o, b, x, L)) ? (B || typeof f.UNSAFE_componentWillMount != "function" && typeof f.componentWillMount != "function" || (typeof f.componentWillMount == "function" && f.componentWillMount(), typeof f.UNSAFE_componentWillMount == "function" && f.UNSAFE_componentWillMount()), typeof f.componentDidMount == "function" && (t.flags |= 4194308)) : (typeof f.componentDidMount == "function" && (t.flags |= 4194308), t.memoizedProps = o, t.memoizedState = x), f.props = o, f.state = x, f.context = L, o = v) : (typeof f.componentDidMount == "function" && (t.flags |= 4194308), o = !1)
        } else {
            f = t.stateNode, fc(e, t), v = t.memoizedProps, L = t.type === t.elementType ? v : Nt(t.type, v), f.props = L, B = t.pendingProps, b = f.context, x = n.contextType, typeof x == "object" && x !== null ? x = wt(x) : (x = lt(n) ? An : Xe.current, x = sr(t, x));
            var Y = n.getDerivedStateFromProps;
            (U = typeof Y == "function" || typeof f.getSnapshotBeforeUpdate == "function") || typeof f.UNSAFE_componentWillReceiveProps != "function" && typeof f.componentWillReceiveProps != "function" || (v !== B || b !== x) && Fc(t, f, o, x), hn = !1, b = t.memoizedState, f.state = b, sl(t, o, f, l);
            var q = t.memoizedState;
            v !== B || b !== q || ot.current || hn ? (typeof Y == "function" && (xs(t, n, Y, o), q = t.memoizedState), (L = hn || jc(t, n, L, o, b, q, x) || !1) ? (U || typeof f.UNSAFE_componentWillUpdate != "function" && typeof f.componentWillUpdate != "function" || (typeof f.componentWillUpdate == "function" && f.componentWillUpdate(o, q, x), typeof f.UNSAFE_componentWillUpdate == "function" && f.UNSAFE_componentWillUpdate(o, q, x)), typeof f.componentDidUpdate == "function" && (t.flags |= 4), typeof f.getSnapshotBeforeUpdate == "function" && (t.flags |= 1024)) : (typeof f.componentDidUpdate != "function" || v === e.memoizedProps && b === e.memoizedState || (t.flags |= 4), typeof f.getSnapshotBeforeUpdate != "function" || v === e.memoizedProps && b === e.memoizedState || (t.flags |= 1024), t.memoizedProps = o, t.memoizedState = q), f.props = o, f.state = q, f.context = x, o = L) : (typeof f.componentDidUpdate != "function" || v === e.memoizedProps && b === e.memoizedState || (t.flags |= 4), typeof f.getSnapshotBeforeUpdate != "function" || v === e.memoizedProps && b === e.memoizedState || (t.flags |= 1024), o = !1)
        }
        return Ps(e, t, n, o, a, l)
    }

    function Ps(e, t, n, o, l, a) {
        Gc(e, t);
        var f = (t.flags & 128) !== 0;
        if (!o && !f) return l && ec(t, n, !1), Yt(e, t, a);
        o = t.stateNode, Eh.current = t;
        var v = f && typeof n.getDerivedStateFromError != "function" ? null : o.render();
        return t.flags |= 1, e !== null && f ? (t.child = fr(t, e.child, null, a), t.child = fr(t, null, v, a)) : tt(e, t, v, a), t.memoizedState = o.state, l && ec(t, n, !0), t.child
    }

    function Xc(e) {
        var t = e.stateNode;
        t.pendingContext ? qu(e, t.pendingContext, t.pendingContext !== t.context) : t.context && qu(e, t.context, !1), as(e, t.containerInfo)
    }

    function Zc(e, t, n, o, l) {
        return cr(), ts(l), t.flags |= 256, tt(e, t, n, o), t.child
    }
    var Ns = {
        dehydrated: null,
        treeContext: null,
        retryLane: 0
    };

    function Rs(e) {
        return {
            baseLanes: e,
            cachePool: null,
            transitions: null
        }
    }

    function qc(e, t, n) {
        var o = t.pendingProps,
            l = Oe.current,
            a = !1,
            f = (t.flags & 128) !== 0,
            v;
        if ((v = f) || (v = e !== null && e.memoizedState === null ? !1 : (l & 2) !== 0), v ? (a = !0, t.flags &= -129) : (e === null || e.memoizedState !== null) && (l |= 1), Re(Oe, l & 1), e === null) return es(t), e = t.memoizedState, e !== null && (e = e.dehydrated, e !== null) ? ((t.mode & 1) === 0 ? t.lanes = 1 : e.data === "$!" ? t.lanes = 8 : t.lanes = 1073741824, null) : (f = o.children, e = o.fallback, a ? (o = t.mode, a = t.child, f = {
            mode: "hidden",
            children: f
        }, (o & 1) === 0 && a !== null ? (a.childLanes = 0, a.pendingProps = f) : a = Tl(f, o, 0, null), e = Hn(e, o, n, null), a.return = t, e.return = t, a.sibling = e, t.child = a, t.child.memoizedState = Rs(n), t.memoizedState = Ns, e) : Ts(t, f));
        if (l = e.memoizedState, l !== null && (v = l.dehydrated, v !== null)) return kh(e, t, f, o, v, l, n);
        if (a) {
            a = o.fallback, f = t.mode, l = e.child, v = l.sibling;
            var x = {
                mode: "hidden",
                children: o.children
            };
            return (f & 1) === 0 && t.child !== l ? (o = t.child, o.childLanes = 0, o.pendingProps = x, t.deletions = null) : (o = Cn(l, x), o.subtreeFlags = l.subtreeFlags & 14680064), v !== null ? a = Cn(v, a) : (a = Hn(a, f, n, null), a.flags |= 2), a.return = t, o.return = t, o.sibling = a, t.child = o, o = a, a = t.child, f = e.child.memoizedState, f = f === null ? Rs(n) : {
                baseLanes: f.baseLanes | n,
                cachePool: null,
                transitions: f.transitions
            }, a.memoizedState = f, a.childLanes = e.childLanes & ~n, t.memoizedState = Ns, o
        }
        return a = e.child, e = a.sibling, o = Cn(a, {
            mode: "visible",
            children: o.children
        }), (t.mode & 1) === 0 && (o.lanes = n), o.return = t, o.sibling = null, e !== null && (n = t.deletions, n === null ? (t.deletions = [e], t.flags |= 16) : n.push(e)), t.child = o, t.memoizedState = null, o
    }

    function Ts(e, t) {
        return t = Tl({
            mode: "visible",
            children: t
        }, e.mode, 0, null), t.return = e, e.child = t
    }

    function hl(e, t, n, o) {
        return o !== null && ts(o), fr(t, e.child, null, n), e = Ts(t, t.pendingProps.children), e.flags |= 2, t.memoizedState = null, e
    }

    function kh(e, t, n, o, l, a, f) {
        if (n) return t.flags & 256 ? (t.flags &= -257, o = Cs(Error(i(422))), hl(e, t, f, o)) : t.memoizedState !== null ? (t.child = e.child, t.flags |= 128, null) : (a = o.fallback, l = t.mode, o = Tl({
            mode: "visible",
            children: o.children
        }, l, 0, null), a = Hn(a, l, f, null), a.flags |= 2, o.return = t, a.return = t, o.sibling = a, t.child = o, (t.mode & 1) !== 0 && fr(t, e.child, null, f), t.child.memoizedState = Rs(f), t.memoizedState = Ns, a);
        if ((t.mode & 1) === 0) return hl(e, t, f, null);
        if (l.data === "$!") {
            if (o = l.nextSibling && l.nextSibling.dataset, o) var v = o.dgst;
            return o = v, a = Error(i(419)), o = Cs(a, o, void 0), hl(e, t, f, o)
        }
        if (v = (f & e.childLanes) !== 0, it || v) {
            if (o = He, o !== null) {
                switch (f & -f) {
                    case 4:
                        l = 2;
                        break;
                    case 16:
                        l = 8;
                        break;
                    case 64:
                    case 128:
                    case 256:
                    case 512:
                    case 1024:
                    case 2048:
                    case 4096:
                    case 8192:
                    case 16384:
                    case 32768:
                    case 65536:
                    case 131072:
                    case 262144:
                    case 524288:
                    case 1048576:
                    case 2097152:
                    case 4194304:
                    case 8388608:
                    case 16777216:
                    case 33554432:
                    case 67108864:
                        l = 32;
                        break;
                    case 536870912:
                        l = 268435456;
                        break;
                    default:
                        l = 0
                }
                l = (l & (o.suspendedLanes | f)) !== 0 ? 0 : l, l !== 0 && l !== a.retryLane && (a.retryLane = l, Qt(e, l), _t(o, e, l, -1))
            }
            return Hs(), o = Cs(Error(i(421))), hl(e, t, f, o)
        }
        return l.data === "$?" ? (t.flags |= 128, t.child = e.child, t = Dh.bind(null, e), l._reactRetry = t, null) : (e = a.treeContext, pt = fn(l.nextSibling), dt = t, Le = !0, Pt = null, e !== null && (gt[yt++] = $t, gt[yt++] = Kt, gt[yt++] = zn, $t = e.id, Kt = e.overflow, zn = t), t = Ts(t, o.children), t.flags |= 4096, t)
    }

    function Jc(e, t, n) {
        e.lanes |= t;
        var o = e.alternate;
        o !== null && (o.lanes |= t), ls(e.return, t, n)
    }

    function _s(e, t, n, o, l) {
        var a = e.memoizedState;
        a === null ? e.memoizedState = {
            isBackwards: t,
            rendering: null,
            renderingStartTime: 0,
            last: o,
            tail: n,
            tailMode: l
        } : (a.isBackwards = t, a.rendering = null, a.renderingStartTime = 0, a.last = o, a.tail = n, a.tailMode = l)
    }

    function ef(e, t, n) {
        var o = t.pendingProps,
            l = o.revealOrder,
            a = o.tail;
        if (tt(e, t, o.children, n), o = Oe.current, (o & 2) !== 0) o = o & 1 | 2, t.flags |= 128;
        else {
            if (e !== null && (e.flags & 128) !== 0) e: for (e = t.child; e !== null;) {
                if (e.tag === 13) e.memoizedState !== null && Jc(e, n, t);
                else if (e.tag === 19) Jc(e, n, t);
                else if (e.child !== null) {
                    e.child.return = e, e = e.child;
                    continue
                }
                if (e === t) break e;
                for (; e.sibling === null;) {
                    if (e.return === null || e.return === t) break e;
                    e = e.return
                }
                e.sibling.return = e.return, e = e.sibling
            }
            o &= 1
        }
        if (Re(Oe, o), (t.mode & 1) === 0) t.memoizedState = null;
        else switch (l) {
            case "forwards":
                for (n = t.child, l = null; n !== null;) e = n.alternate, e !== null && al(e) === null && (l = n), n = n.sibling;
                n = l, n === null ? (l = t.child, t.child = null) : (l = n.sibling, n.sibling = null), _s(t, !1, l, n, a);
                break;
            case "backwards":
                for (n = null, l = t.child, t.child = null; l !== null;) {
                    if (e = l.alternate, e !== null && al(e) === null) {
                        t.child = l;
                        break
                    }
                    e = l.sibling, l.sibling = n, n = l, l = e
                }
                _s(t, !0, n, null, a);
                break;
            case "together":
                _s(t, !1, null, null, void 0);
                break;
            default:
                t.memoizedState = null
        }
        return t.child
    }

    function vl(e, t) {
        (t.mode & 1) === 0 && e !== null && (e.alternate = null, t.alternate = null, t.flags |= 2)
    }

    function Yt(e, t, n) {
        if (e !== null && (t.dependencies = e.dependencies), Un |= t.lanes, (n & t.childLanes) === 0) return null;
        if (e !== null && t.child !== e.child) throw Error(i(153));
        if (t.child !== null) {
            for (e = t.child, n = Cn(e, e.pendingProps), t.child = n, n.return = t; e.sibling !== null;) e = e.sibling, n = n.sibling = Cn(e, e.pendingProps), n.return = t;
            n.sibling = null
        }
        return t.child
    }

    function Ph(e, t, n) {
        switch (t.tag) {
            case 3:
                Xc(t), cr();
                break;
            case 5:
                mc(t);
                break;
            case 1:
                lt(t.type) && qo(t);
                break;
            case 4:
                as(t, t.stateNode.containerInfo);
                break;
            case 10:
                var o = t.type._context,
                    l = t.memoizedProps.value;
                Re(ol, o._currentValue), o._currentValue = l;
                break;
            case 13:
                if (o = t.memoizedState, o !== null) return o.dehydrated !== null ? (Re(Oe, Oe.current & 1), t.flags |= 128, null) : (n & t.child.childLanes) !== 0 ? qc(e, t, n) : (Re(Oe, Oe.current & 1), e = Yt(e, t, n), e !== null ? e.sibling : null);
                Re(Oe, Oe.current & 1);
                break;
            case 19:
                if (o = (n & t.childLanes) !== 0, (e.flags & 128) !== 0) {
                    if (o) return ef(e, t, n);
                    t.flags |= 128
                }
                if (l = t.memoizedState, l !== null && (l.rendering = null, l.tail = null, l.lastEffect = null), Re(Oe, Oe.current), o) break;
                return null;
            case 22:
            case 23:
                return t.lanes = 0, Qc(e, t, n)
        }
        return Yt(e, t, n)
    }
    var tf, Is, nf, rf;
    tf = function(e, t) {
        for (var n = t.child; n !== null;) {
            if (n.tag === 5 || n.tag === 6) e.appendChild(n.stateNode);
            else if (n.tag !== 4 && n.child !== null) {
                n.child.return = n, n = n.child;
                continue
            }
            if (n === t) break;
            for (; n.sibling === null;) {
                if (n.return === null || n.return === t) return;
                n = n.return
            }
            n.sibling.return = n.return, n = n.sibling
        }
    }, Is = function() {}, nf = function(e, t, n, o) {
        var l = e.memoizedProps;
        if (l !== o) {
            e = t.stateNode, Fn(zt.current);
            var a = null;
            switch (n) {
                case "input":
                    l = rt(e, l), o = rt(e, o), a = [];
                    break;
                case "select":
                    l = V({}, l, {
                        value: void 0
                    }), o = V({}, o, {
                        value: void 0
                    }), a = [];
                    break;
                case "textarea":
                    l = ai(e, l), o = ai(e, o), a = [];
                    break;
                default:
                    typeof l.onClick != "function" && typeof o.onClick == "function" && (e.onclick = Yo)
            }
            ci(n, o);
            var f;
            n = null;
            for (L in l)
                if (!o.hasOwnProperty(L) && l.hasOwnProperty(L) && l[L] != null)
                    if (L === "style") {
                        var v = l[L];
                        for (f in v) v.hasOwnProperty(f) && (n || (n = {}), n[f] = "")
                    } else L !== "dangerouslySetInnerHTML" && L !== "children" && L !== "suppressContentEditableWarning" && L !== "suppressHydrationWarning" && L !== "autoFocus" && (c.hasOwnProperty(L) ? a || (a = []) : (a = a || []).push(L, null));
            for (L in o) {
                var x = o[L];
                if (v = l != null ? l[L] : void 0, o.hasOwnProperty(L) && x !== v && (x != null || v != null))
                    if (L === "style")
                        if (v) {
                            for (f in v) !v.hasOwnProperty(f) || x && x.hasOwnProperty(f) || (n || (n = {}), n[f] = "");
                            for (f in x) x.hasOwnProperty(f) && v[f] !== x[f] && (n || (n = {}), n[f] = x[f])
                        } else n || (a || (a = []), a.push(L, n)), n = x;
                else L === "dangerouslySetInnerHTML" ? (x = x ? x.__html : void 0, v = v ? v.__html : void 0, x != null && v !== x && (a = a || []).push(L, x)) : L === "children" ? typeof x != "string" && typeof x != "number" || (a = a || []).push(L, "" + x) : L !== "suppressContentEditableWarning" && L !== "suppressHydrationWarning" && (c.hasOwnProperty(L) ? (x != null && L === "onScroll" && Te("scroll", e), a || v === x || (a = [])) : (a = a || []).push(L, x))
            }
            n && (a = a || []).push("style", n);
            var L = a;
            (t.updateQueue = L) && (t.flags |= 4)
        }
    }, rf = function(e, t, n, o) {
        n !== o && (t.flags |= 4)
    };

    function co(e, t) {
        if (!Le) switch (e.tailMode) {
            case "hidden":
                t = e.tail;
                for (var n = null; t !== null;) t.alternate !== null && (n = t), t = t.sibling;
                n === null ? e.tail = null : n.sibling = null;
                break;
            case "collapsed":
                n = e.tail;
                for (var o = null; n !== null;) n.alternate !== null && (o = n), n = n.sibling;
                o === null ? t || e.tail === null ? e.tail = null : e.tail.sibling = null : o.sibling = null
        }
    }

    function qe(e) {
        var t = e.alternate !== null && e.alternate.child === e.child,
            n = 0,
            o = 0;
        if (t)
            for (var l = e.child; l !== null;) n |= l.lanes | l.childLanes, o |= l.subtreeFlags & 14680064, o |= l.flags & 14680064, l.return = e, l = l.sibling;
        else
            for (l = e.child; l !== null;) n |= l.lanes | l.childLanes, o |= l.subtreeFlags, o |= l.flags, l.return = e, l = l.sibling;
        return e.subtreeFlags |= o, e.childLanes = n, t
    }

    function Nh(e, t, n) {
        var o = t.pendingProps;
        switch (qi(t), t.tag) {
            case 2:
            case 16:
            case 15:
            case 0:
            case 11:
            case 7:
            case 8:
            case 12:
            case 9:
            case 14:
                return qe(t), null;
            case 1:
                return lt(t.type) && Zo(), qe(t), null;
            case 3:
                return o = t.stateNode, mr(), _e(ot), _e(Xe), fs(), o.pendingContext && (o.context = o.pendingContext, o.pendingContext = null), (e === null || e.child === null) && (nl(t) ? t.flags |= 4 : e === null || e.memoizedState.isDehydrated && (t.flags & 256) === 0 || (t.flags |= 1024, Pt !== null && (Bs(Pt), Pt = null))), Is(e, t), qe(t), null;
            case 5:
                us(t);
                var l = Fn(lo.current);
                if (n = t.type, e !== null && t.stateNode != null) nf(e, t, n, o, l), e.ref !== t.ref && (t.flags |= 512, t.flags |= 2097152);
                else {
                    if (!o) {
                        if (t.stateNode === null) throw Error(i(166));
                        return qe(t), null
                    }
                    if (e = Fn(zt.current), nl(t)) {
                        o = t.stateNode, n = t.type;
                        var a = t.memoizedProps;
                        switch (o[At] = t, o[eo] = a, e = (t.mode & 1) !== 0, n) {
                            case "dialog":
                                Te("cancel", o), Te("close", o);
                                break;
                            case "iframe":
                            case "object":
                            case "embed":
                                Te("load", o);
                                break;
                            case "video":
                            case "audio":
                                for (l = 0; l < Zr.length; l++) Te(Zr[l], o);
                                break;
                            case "source":
                                Te("error", o);
                                break;
                            case "img":
                            case "image":
                            case "link":
                                Te("error", o), Te("load", o);
                                break;
                            case "details":
                                Te("toggle", o);
                                break;
                            case "input":
                                tn(o, a), Te("invalid", o);
                                break;
                            case "select":
                                o._wrapperState = {
                                    wasMultiple: !!a.multiple
                                }, Te("invalid", o);
                                break;
                            case "textarea":
                                Ua(o, a), Te("invalid", o)
                        }
                        ci(n, a), l = null;
                        for (var f in a)
                            if (a.hasOwnProperty(f)) {
                                var v = a[f];
                                f === "children" ? typeof v == "string" ? o.textContent !== v && (a.suppressHydrationWarning !== !0 && Go(o.textContent, v, e), l = ["children", v]) : typeof v == "number" && o.textContent !== "" + v && (a.suppressHydrationWarning !== !0 && Go(o.textContent, v, e), l = ["children", "" + v]) : c.hasOwnProperty(f) && v != null && f === "onScroll" && Te("scroll", o)
                            } switch (n) {
                            case "input":
                                Ce(o), No(o, a, !0);
                                break;
                            case "textarea":
                                Ce(o), Va(o);
                                break;
                            case "select":
                            case "option":
                                break;
                            default:
                                typeof a.onClick == "function" && (o.onclick = Yo)
                        }
                        o = l, t.updateQueue = o, o !== null && (t.flags |= 4)
                    } else {
                        f = l.nodeType === 9 ? l : l.ownerDocument, e === "http://www.w3.org/1999/xhtml" && (e = Wa(n)), e === "http://www.w3.org/1999/xhtml" ? n === "script" ? (e = f.createElement("div"), e.innerHTML = "<script><\/script>", e = e.removeChild(e.firstChild)) : typeof o.is == "string" ? e = f.createElement(n, {
                            is: o.is
                        }) : (e = f.createElement(n), n === "select" && (f = e, o.multiple ? f.multiple = !0 : o.size && (f.size = o.size))) : e = f.createElementNS(e, n), e[At] = t, e[eo] = o, tf(e, t, !1, !1), t.stateNode = e;
                        e: {
                            switch (f = fi(n, o), n) {
                                case "dialog":
                                    Te("cancel", e), Te("close", e), l = o;
                                    break;
                                case "iframe":
                                case "object":
                                case "embed":
                                    Te("load", e), l = o;
                                    break;
                                case "video":
                                case "audio":
                                    for (l = 0; l < Zr.length; l++) Te(Zr[l], e);
                                    l = o;
                                    break;
                                case "source":
                                    Te("error", e), l = o;
                                    break;
                                case "img":
                                case "image":
                                case "link":
                                    Te("error", e), Te("load", e), l = o;
                                    break;
                                case "details":
                                    Te("toggle", e), l = o;
                                    break;
                                case "input":
                                    tn(e, o), l = rt(e, o), Te("invalid", e);
                                    break;
                                case "option":
                                    l = o;
                                    break;
                                case "select":
                                    e._wrapperState = {
                                        wasMultiple: !!o.multiple
                                    }, l = V({}, o, {
                                        value: void 0
                                    }), Te("invalid", e);
                                    break;
                                case "textarea":
                                    Ua(e, o), l = ai(e, o), Te("invalid", e);
                                    break;
                                default:
                                    l = o
                            }
                            ci(n, l),
                            v = l;
                            for (a in v)
                                if (v.hasOwnProperty(a)) {
                                    var x = v[a];
                                    a === "style" ? Ka(e, x) : a === "dangerouslySetInnerHTML" ? (x = x ? x.__html : void 0, x != null && Ha(e, x)) : a === "children" ? typeof x == "string" ? (n !== "textarea" || x !== "") && Or(e, x) : typeof x == "number" && Or(e, "" + x) : a !== "suppressContentEditableWarning" && a !== "suppressHydrationWarning" && a !== "autoFocus" && (c.hasOwnProperty(a) ? x != null && a === "onScroll" && Te("scroll", e) : x != null && z(e, a, x, f))
                                } switch (n) {
                                case "input":
                                    Ce(e), No(e, o, !1);
                                    break;
                                case "textarea":
                                    Ce(e), Va(e);
                                    break;
                                case "option":
                                    o.value != null && e.setAttribute("value", "" + ne(o.value));
                                    break;
                                case "select":
                                    e.multiple = !!o.multiple, a = o.value, a != null ? Yn(e, !!o.multiple, a, !1) : o.defaultValue != null && Yn(e, !!o.multiple, o.defaultValue, !0);
                                    break;
                                default:
                                    typeof l.onClick == "function" && (e.onclick = Yo)
                            }
                            switch (n) {
                                case "button":
                                case "input":
                                case "select":
                                case "textarea":
                                    o = !!o.autoFocus;
                                    break e;
                                case "img":
                                    o = !0;
                                    break e;
                                default:
                                    o = !1
                            }
                        }
                        o && (t.flags |= 4)
                    }
                    t.ref !== null && (t.flags |= 512, t.flags |= 2097152)
                }
                return qe(t), null;
            case 6:
                if (e && t.stateNode != null) rf(e, t, e.memoizedProps, o);
                else {
                    if (typeof o != "string" && t.stateNode === null) throw Error(i(166));
                    if (n = Fn(lo.current), Fn(zt.current), nl(t)) {
                        if (o = t.stateNode, n = t.memoizedProps, o[At] = t, (a = o.nodeValue !== n) && (e = dt, e !== null)) switch (e.tag) {
                            case 3:
                                Go(o.nodeValue, n, (e.mode & 1) !== 0);
                                break;
                            case 5:
                                e.memoizedProps.suppressHydrationWarning !== !0 && Go(o.nodeValue, n, (e.mode & 1) !== 0)
                        }
                        a && (t.flags |= 4)
                    } else o = (n.nodeType === 9 ? n : n.ownerDocument).createTextNode(o), o[At] = t, t.stateNode = o
                }
                return qe(t), null;
            case 13:
                if (_e(Oe), o = t.memoizedState, e === null || e.memoizedState !== null && e.memoizedState.dehydrated !== null) {
                    if (Le && pt !== null && (t.mode & 1) !== 0 && (t.flags & 128) === 0) ic(), cr(), t.flags |= 98560, a = !1;
                    else if (a = nl(t), o !== null && o.dehydrated !== null) {
                        if (e === null) {
                            if (!a) throw Error(i(318));
                            if (a = t.memoizedState, a = a !== null ? a.dehydrated : null, !a) throw Error(i(317));
                            a[At] = t
                        } else cr(), (t.flags & 128) === 0 && (t.memoizedState = null), t.flags |= 4;
                        qe(t), a = !1
                    } else Pt !== null && (Bs(Pt), Pt = null), a = !0;
                    if (!a) return t.flags & 65536 ? t : null
                }
                return (t.flags & 128) !== 0 ? (t.lanes = n, t) : (o = o !== null, o !== (e !== null && e.memoizedState !== null) && o && (t.child.flags |= 8192, (t.mode & 1) !== 0 && (e === null || (Oe.current & 1) !== 0 ? Be === 0 && (Be = 3) : Hs())), t.updateQueue !== null && (t.flags |= 4), qe(t), null);
            case 4:
                return mr(), Is(e, t), e === null && qr(t.stateNode.containerInfo), qe(t), null;
            case 10:
                return os(t.type._context), qe(t), null;
            case 17:
                return lt(t.type) && Zo(), qe(t), null;
            case 19:
                if (_e(Oe), a = t.memoizedState, a === null) return qe(t), null;
                if (o = (t.flags & 128) !== 0, f = a.rendering, f === null)
                    if (o) co(a, !1);
                    else {
                        if (Be !== 0 || e !== null && (e.flags & 128) !== 0)
                            for (e = t.child; e !== null;) {
                                if (f = al(e), f !== null) {
                                    for (t.flags |= 128, co(a, !1), o = f.updateQueue, o !== null && (t.updateQueue = o, t.flags |= 4), t.subtreeFlags = 0, o = n, n = t.child; n !== null;) a = n, e = o, a.flags &= 14680066, f = a.alternate, f === null ? (a.childLanes = 0, a.lanes = e, a.child = null, a.subtreeFlags = 0, a.memoizedProps = null, a.memoizedState = null, a.updateQueue = null, a.dependencies = null, a.stateNode = null) : (a.childLanes = f.childLanes, a.lanes = f.lanes, a.child = f.child, a.subtreeFlags = 0, a.deletions = null, a.memoizedProps = f.memoizedProps, a.memoizedState = f.memoizedState, a.updateQueue = f.updateQueue, a.type = f.type, e = f.dependencies, a.dependencies = e === null ? null : {
                                        lanes: e.lanes,
                                        firstContext: e.firstContext
                                    }), n = n.sibling;
                                    return Re(Oe, Oe.current & 1 | 2), t.child
                                }
                                e = e.sibling
                            }
                        a.tail !== null && je() > yr && (t.flags |= 128, o = !0, co(a, !1), t.lanes = 4194304)
                    }
                else {
                    if (!o)
                        if (e = al(f), e !== null) {
                            if (t.flags |= 128, o = !0, n = e.updateQueue, n !== null && (t.updateQueue = n, t.flags |= 4), co(a, !0), a.tail === null && a.tailMode === "hidden" && !f.alternate && !Le) return qe(t), null
                        } else 2 * je() - a.renderingStartTime > yr && n !== 1073741824 && (t.flags |= 128, o = !0, co(a, !1), t.lanes = 4194304);
                    a.isBackwards ? (f.sibling = t.child, t.child = f) : (n = a.last, n !== null ? n.sibling = f : t.child = f, a.last = f)
                }
                return a.tail !== null ? (t = a.tail, a.rendering = t, a.tail = t.sibling, a.renderingStartTime = je(), t.sibling = null, n = Oe.current, Re(Oe, o ? n & 1 | 2 : n & 1), t) : (qe(t), null);
            case 22:
            case 23:
                return Ws(), o = t.memoizedState !== null, e !== null && e.memoizedState !== null !== o && (t.flags |= 8192), o && (t.mode & 1) !== 0 ? (mt & 1073741824) !== 0 && (qe(t), t.subtreeFlags & 6 && (t.flags |= 8192)) : qe(t), null;
            case 24:
                return null;
            case 25:
                return null
        }
        throw Error(i(156, t.tag))
    }

    function Rh(e, t) {
        switch (qi(t), t.tag) {
            case 1:
                return lt(t.type) && Zo(), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
            case 3:
                return mr(), _e(ot), _e(Xe), fs(), e = t.flags, (e & 65536) !== 0 && (e & 128) === 0 ? (t.flags = e & -65537 | 128, t) : null;
            case 5:
                return us(t), null;
            case 13:
                if (_e(Oe), e = t.memoizedState, e !== null && e.dehydrated !== null) {
                    if (t.alternate === null) throw Error(i(340));
                    cr()
                }
                return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
            case 19:
                return _e(Oe), null;
            case 4:
                return mr(), null;
            case 10:
                return os(t.type._context), null;
            case 22:
            case 23:
                return Ws(), null;
            case 24:
                return null;
            default:
                return null
        }
    }
    var gl = !1,
        Je = !1,
        Th = typeof WeakSet == "function" ? WeakSet : Set,
        X = null;

    function vr(e, t) {
        var n = e.ref;
        if (n !== null)
            if (typeof n == "function") try {
                n(null)
            } catch (o) {
                Ae(e, t, o)
            } else n.current = null
    }

    function Ls(e, t, n) {
        try {
            n()
        } catch (o) {
            Ae(e, t, o)
        }
    }
    var of = !1;

    function _h(e, t) {
        if (Wi = Do, e = ju(), zi(e)) {
            if ("selectionStart" in e) var n = {
                start: e.selectionStart,
                end: e.selectionEnd
            };
            else e: {
                n = (n = e.ownerDocument) && n.defaultView || window;
                var o = n.getSelection && n.getSelection();
                if (o && o.rangeCount !== 0) {
                    n = o.anchorNode;
                    var l = o.anchorOffset,
                        a = o.focusNode;
                    o = o.focusOffset;
                    try {
                        n.nodeType, a.nodeType
                    } catch {
                        n = null;
                        break e
                    }
                    var f = 0,
                        v = -1,
                        x = -1,
                        L = 0,
                        U = 0,
                        B = e,
                        b = null;
                    t: for (;;) {
                        for (var Y; B !== n || l !== 0 && B.nodeType !== 3 || (v = f + l), B !== a || o !== 0 && B.nodeType !== 3 || (x = f + o), B.nodeType === 3 && (f += B.nodeValue.length), (Y = B.firstChild) !== null;) b = B, B = Y;
                        for (;;) {
                            if (B === e) break t;
                            if (b === n && ++L === l && (v = f), b === a && ++U === o && (x = f), (Y = B.nextSibling) !== null) break;
                            B = b, b = B.parentNode
                        }
                        B = Y
                    }
                    n = v === -1 || x === -1 ? null : {
                        start: v,
                        end: x
                    }
                } else n = null
            }
            n = n || {
                start: 0,
                end: 0
            }
        } else n = null;
        for (Hi = {
                focusedElem: e,
                selectionRange: n
            }, Do = !1, X = t; X !== null;)
            if (t = X, e = t.child, (t.subtreeFlags & 1028) !== 0 && e !== null) e.return = t, X = e;
            else
                for (; X !== null;) {
                    t = X;
                    try {
                        var q = t.alternate;
                        if ((t.flags & 1024) !== 0) switch (t.tag) {
                            case 0:
                            case 11:
                            case 15:
                                break;
                            case 1:
                                if (q !== null) {
                                    var J = q.memoizedProps,
                                        De = q.memoizedState,
                                        T = t.stateNode,
                                        k = T.getSnapshotBeforeUpdate(t.elementType === t.type ? J : Nt(t.type, J), De);
                                    T.__reactInternalSnapshotBeforeUpdate = k
                                }
                                break;
                            case 3:
                                var I = t.stateNode.containerInfo;
                                I.nodeType === 1 ? I.textContent = "" : I.nodeType === 9 && I.documentElement && I.removeChild(I.documentElement);
                                break;
                            case 5:
                            case 6:
                            case 4:
                            case 17:
                                break;
                            default:
                                throw Error(i(163))
                        }
                    } catch (H) {
                        Ae(t, t.return, H)
                    }
                    if (e = t.sibling, e !== null) {
                        e.return = t.return, X = e;
                        break
                    }
                    X = t.return
                }
        return q = of, of = !1, q
    }

    function fo(e, t, n) {
        var o = t.updateQueue;
        if (o = o !== null ? o.lastEffect : null, o !== null) {
            var l = o = o.next;
            do {
                if ((l.tag & e) === e) {
                    var a = l.destroy;
                    l.destroy = void 0, a !== void 0 && Ls(t, n, a)
                }
                l = l.next
            } while (l !== o)
        }
    }

    function yl(e, t) {
        if (t = t.updateQueue, t = t !== null ? t.lastEffect : null, t !== null) {
            var n = t = t.next;
            do {
                if ((n.tag & e) === e) {
                    var o = n.create;
                    n.destroy = o()
                }
                n = n.next
            } while (n !== t)
        }
    }

    function Os(e) {
        var t = e.ref;
        if (t !== null) {
            var n = e.stateNode;
            switch (e.tag) {
                case 5:
                    e = n;
                    break;
                default:
                    e = n
            }
            typeof t == "function" ? t(e) : t.current = e
        }
    }

    function lf(e) {
        var t = e.alternate;
        t !== null && (e.alternate = null, lf(t)), e.child = null, e.deletions = null, e.sibling = null, e.tag === 5 && (t = e.stateNode, t !== null && (delete t[At], delete t[eo], delete t[Gi], delete t[fh], delete t[dh])), e.stateNode = null, e.return = null, e.dependencies = null, e.memoizedProps = null, e.memoizedState = null, e.pendingProps = null, e.stateNode = null, e.updateQueue = null
    }

    function sf(e) {
        return e.tag === 5 || e.tag === 3 || e.tag === 4
    }

    function af(e) {
        e: for (;;) {
            for (; e.sibling === null;) {
                if (e.return === null || sf(e.return)) return null;
                e = e.return
            }
            for (e.sibling.return = e.return, e = e.sibling; e.tag !== 5 && e.tag !== 6 && e.tag !== 18;) {
                if (e.flags & 2 || e.child === null || e.tag === 4) continue e;
                e.child.return = e, e = e.child
            }
            if (!(e.flags & 2)) return e.stateNode
        }
    }

    function Ms(e, t, n) {
        var o = e.tag;
        if (o === 5 || o === 6) e = e.stateNode, t ? n.nodeType === 8 ? n.parentNode.insertBefore(e, t) : n.insertBefore(e, t) : (n.nodeType === 8 ? (t = n.parentNode, t.insertBefore(e, n)) : (t = n, t.appendChild(e)), n = n._reactRootContainer, n != null || t.onclick !== null || (t.onclick = Yo));
        else if (o !== 4 && (e = e.child, e !== null))
            for (Ms(e, t, n), e = e.sibling; e !== null;) Ms(e, t, n), e = e.sibling
    }

    function As(e, t, n) {
        var o = e.tag;
        if (o === 5 || o === 6) e = e.stateNode, t ? n.insertBefore(e, t) : n.appendChild(e);
        else if (o !== 4 && (e = e.child, e !== null))
            for (As(e, t, n), e = e.sibling; e !== null;) As(e, t, n), e = e.sibling
    }
    var Ke = null,
        Rt = !1;

    function gn(e, t, n) {
        for (n = n.child; n !== null;) uf(e, t, n), n = n.sibling
    }

    function uf(e, t, n) {
        if (Mt && typeof Mt.onCommitFiberUnmount == "function") try {
            Mt.onCommitFiberUnmount(Lo, n)
        } catch {}
        switch (n.tag) {
            case 5:
                Je || vr(n, t);
            case 6:
                var o = Ke,
                    l = Rt;
                Ke = null, gn(e, t, n), Ke = o, Rt = l, Ke !== null && (Rt ? (e = Ke, n = n.stateNode, e.nodeType === 8 ? e.parentNode.removeChild(n) : e.removeChild(n)) : Ke.removeChild(n.stateNode));
                break;
            case 18:
                Ke !== null && (Rt ? (e = Ke, n = n.stateNode, e.nodeType === 8 ? Qi(e.parentNode, n) : e.nodeType === 1 && Qi(e, n), Wr(e)) : Qi(Ke, n.stateNode));
                break;
            case 4:
                o = Ke, l = Rt, Ke = n.stateNode.containerInfo, Rt = !0, gn(e, t, n), Ke = o, Rt = l;
                break;
            case 0:
            case 11:
            case 14:
            case 15:
                if (!Je && (o = n.updateQueue, o !== null && (o = o.lastEffect, o !== null))) {
                    l = o = o.next;
                    do {
                        var a = l,
                            f = a.destroy;
                        a = a.tag, f !== void 0 && ((a & 2) !== 0 || (a & 4) !== 0) && Ls(n, t, f), l = l.next
                    } while (l !== o)
                }
                gn(e, t, n);
                break;
            case 1:
                if (!Je && (vr(n, t), o = n.stateNode, typeof o.componentWillUnmount == "function")) try {
                    o.props = n.memoizedProps, o.state = n.memoizedState, o.componentWillUnmount()
                } catch (v) {
                    Ae(n, t, v)
                }
                gn(e, t, n);
                break;
            case 21:
                gn(e, t, n);
                break;
            case 22:
                n.mode & 1 ? (Je = (o = Je) || n.memoizedState !== null, gn(e, t, n), Je = o) : gn(e, t, n);
                break;
            default:
                gn(e, t, n)
        }
    }

    function cf(e) {
        var t = e.updateQueue;
        if (t !== null) {
            e.updateQueue = null;
            var n = e.stateNode;
            n === null && (n = e.stateNode = new Th), t.forEach(function(o) {
                var l = Fh.bind(null, e, o);
                n.has(o) || (n.add(o), o.then(l, l))
            })
        }
    }

    function Tt(e, t) {
        var n = t.deletions;
        if (n !== null)
            for (var o = 0; o < n.length; o++) {
                var l = n[o];
                try {
                    var a = e,
                        f = t,
                        v = f;
                    e: for (; v !== null;) {
                        switch (v.tag) {
                            case 5:
                                Ke = v.stateNode, Rt = !1;
                                break e;
                            case 3:
                                Ke = v.stateNode.containerInfo, Rt = !0;
                                break e;
                            case 4:
                                Ke = v.stateNode.containerInfo, Rt = !0;
                                break e
                        }
                        v = v.return
                    }
                    if (Ke === null) throw Error(i(160));
                    uf(a, f, l), Ke = null, Rt = !1;
                    var x = l.alternate;
                    x !== null && (x.return = null), l.return = null
                } catch (L) {
                    Ae(l, t, L)
                }
            }
        if (t.subtreeFlags & 12854)
            for (t = t.child; t !== null;) ff(t, e), t = t.sibling
    }

    function ff(e, t) {
        var n = e.alternate,
            o = e.flags;
        switch (e.tag) {
            case 0:
            case 11:
            case 14:
            case 15:
                if (Tt(t, e), Dt(e), o & 4) {
                    try {
                        fo(3, e, e.return), yl(3, e)
                    } catch (J) {
                        Ae(e, e.return, J)
                    }
                    try {
                        fo(5, e, e.return)
                    } catch (J) {
                        Ae(e, e.return, J)
                    }
                }
                break;
            case 1:
                Tt(t, e), Dt(e), o & 512 && n !== null && vr(n, n.return);
                break;
            case 5:
                if (Tt(t, e), Dt(e), o & 512 && n !== null && vr(n, n.return), e.flags & 32) {
                    var l = e.stateNode;
                    try {
                        Or(l, "")
                    } catch (J) {
                        Ae(e, e.return, J)
                    }
                }
                if (o & 4 && (l = e.stateNode, l != null)) {
                    var a = e.memoizedProps,
                        f = n !== null ? n.memoizedProps : a,
                        v = e.type,
                        x = e.updateQueue;
                    if (e.updateQueue = null, x !== null) try {
                        v === "input" && a.type === "radio" && a.name != null && nn(l, a), fi(v, f);
                        var L = fi(v, a);
                        for (f = 0; f < x.length; f += 2) {
                            var U = x[f],
                                B = x[f + 1];
                            U === "style" ? Ka(l, B) : U === "dangerouslySetInnerHTML" ? Ha(l, B) : U === "children" ? Or(l, B) : z(l, U, B, L)
                        }
                        switch (v) {
                            case "input":
                                Vt(l, a);
                                break;
                            case "textarea":
                                Ba(l, a);
                                break;
                            case "select":
                                var b = l._wrapperState.wasMultiple;
                                l._wrapperState.wasMultiple = !!a.multiple;
                                var Y = a.value;
                                Y != null ? Yn(l, !!a.multiple, Y, !1) : b !== !!a.multiple && (a.defaultValue != null ? Yn(l, !!a.multiple, a.defaultValue, !0) : Yn(l, !!a.multiple, a.multiple ? [] : "", !1))
                        }
                        l[eo] = a
                    } catch (J) {
                        Ae(e, e.return, J)
                    }
                }
                break;
            case 6:
                if (Tt(t, e), Dt(e), o & 4) {
                    if (e.stateNode === null) throw Error(i(162));
                    l = e.stateNode, a = e.memoizedProps;
                    try {
                        l.nodeValue = a
                    } catch (J) {
                        Ae(e, e.return, J)
                    }
                }
                break;
            case 3:
                if (Tt(t, e), Dt(e), o & 4 && n !== null && n.memoizedState.isDehydrated) try {
                    Wr(t.containerInfo)
                } catch (J) {
                    Ae(e, e.return, J)
                }
                break;
            case 4:
                Tt(t, e), Dt(e);
                break;
            case 13:
                Tt(t, e), Dt(e), l = e.child, l.flags & 8192 && (a = l.memoizedState !== null, l.stateNode.isHidden = a, !a || l.alternate !== null && l.alternate.memoizedState !== null || (Ds = je())), o & 4 && cf(e);
                break;
            case 22:
                if (U = n !== null && n.memoizedState !== null, e.mode & 1 ? (Je = (L = Je) || U, Tt(t, e), Je = L) : Tt(t, e), Dt(e), o & 8192) {
                    if (L = e.memoizedState !== null, (e.stateNode.isHidden = L) && !U && (e.mode & 1) !== 0)
                        for (X = e, U = e.child; U !== null;) {
                            for (B = X = U; X !== null;) {
                                switch (b = X, Y = b.child, b.tag) {
                                    case 0:
                                    case 11:
                                    case 14:
                                    case 15:
                                        fo(4, b, b.return);
                                        break;
                                    case 1:
                                        vr(b, b.return);
                                        var q = b.stateNode;
                                        if (typeof q.componentWillUnmount == "function") {
                                            o = b, n = b.return;
                                            try {
                                                t = o, q.props = t.memoizedProps, q.state = t.memoizedState, q.componentWillUnmount()
                                            } catch (J) {
                                                Ae(o, n, J)
                                            }
                                        }
                                        break;
                                    case 5:
                                        vr(b, b.return);
                                        break;
                                    case 22:
                                        if (b.memoizedState !== null) {
                                            mf(B);
                                            continue
                                        }
                                }
                                Y !== null ? (Y.return = b, X = Y) : mf(B)
                            }
                            U = U.sibling
                        }
                    e: for (U = null, B = e;;) {
                        if (B.tag === 5) {
                            if (U === null) {
                                U = B;
                                try {
                                    l = B.stateNode, L ? (a = l.style, typeof a.setProperty == "function" ? a.setProperty("display", "none", "important") : a.display = "none") : (v = B.stateNode, x = B.memoizedProps.style, f = x != null && x.hasOwnProperty("display") ? x.display : null, v.style.display = $a("display", f))
                                } catch (J) {
                                    Ae(e, e.return, J)
                                }
                            }
                        } else if (B.tag === 6) {
                            if (U === null) try {
                                B.stateNode.nodeValue = L ? "" : B.memoizedProps
                            } catch (J) {
                                Ae(e, e.return, J)
                            }
                        } else if ((B.tag !== 22 && B.tag !== 23 || B.memoizedState === null || B === e) && B.child !== null) {
                            B.child.return = B, B = B.child;
                            continue
                        }
                        if (B === e) break e;
                        for (; B.sibling === null;) {
                            if (B.return === null || B.return === e) break e;
                            U === B && (U = null), B = B.return
                        }
                        U === B && (U = null), B.sibling.return = B.return, B = B.sibling
                    }
                }
                break;
            case 19:
                Tt(t, e), Dt(e), o & 4 && cf(e);
                break;
            case 21:
                break;
            default:
                Tt(t, e), Dt(e)
        }
    }

    function Dt(e) {
        var t = e.flags;
        if (t & 2) {
            try {
                e: {
                    for (var n = e.return; n !== null;) {
                        if (sf(n)) {
                            var o = n;
                            break e
                        }
                        n = n.return
                    }
                    throw Error(i(160))
                }
                switch (o.tag) {
                    case 5:
                        var l = o.stateNode;
                        o.flags & 32 && (Or(l, ""), o.flags &= -33);
                        var a = af(e);
                        As(e, a, l);
                        break;
                    case 3:
                    case 4:
                        var f = o.stateNode.containerInfo,
                            v = af(e);
                        Ms(e, v, f);
                        break;
                    default:
                        throw Error(i(161))
                }
            }
            catch (x) {
                Ae(e, e.return, x)
            }
            e.flags &= -3
        }
        t & 4096 && (e.flags &= -4097)
    }

    function Ih(e, t, n) {
        X = e, df(e)
    }

    function df(e, t, n) {
        for (var o = (e.mode & 1) !== 0; X !== null;) {
            var l = X,
                a = l.child;
            if (l.tag === 22 && o) {
                var f = l.memoizedState !== null || gl;
                if (!f) {
                    var v = l.alternate,
                        x = v !== null && v.memoizedState !== null || Je;
                    v = gl;
                    var L = Je;
                    if (gl = f, (Je = x) && !L)
                        for (X = l; X !== null;) f = X, x = f.child, f.tag === 22 && f.memoizedState !== null ? hf(l) : x !== null ? (x.return = f, X = x) : hf(l);
                    for (; a !== null;) X = a, df(a), a = a.sibling;
                    X = l, gl = v, Je = L
                }
                pf(e)
            } else(l.subtreeFlags & 8772) !== 0 && a !== null ? (a.return = l, X = a) : pf(e)
        }
    }

    function pf(e) {
        for (; X !== null;) {
            var t = X;
            if ((t.flags & 8772) !== 0) {
                var n = t.alternate;
                try {
                    if ((t.flags & 8772) !== 0) switch (t.tag) {
                        case 0:
                        case 11:
                        case 15:
                            Je || yl(5, t);
                            break;
                        case 1:
                            var o = t.stateNode;
                            if (t.flags & 4 && !Je)
                                if (n === null) o.componentDidMount();
                                else {
                                    var l = t.elementType === t.type ? n.memoizedProps : Nt(t.type, n.memoizedProps);
                                    o.componentDidUpdate(l, n.memoizedState, o.__reactInternalSnapshotBeforeUpdate)
                                } var a = t.updateQueue;
                            a !== null && pc(t, a, o);
                            break;
                        case 3:
                            var f = t.updateQueue;
                            if (f !== null) {
                                if (n = null, t.child !== null) switch (t.child.tag) {
                                    case 5:
                                        n = t.child.stateNode;
                                        break;
                                    case 1:
                                        n = t.child.stateNode
                                }
                                pc(t, f, n)
                            }
                            break;
                        case 5:
                            var v = t.stateNode;
                            if (n === null && t.flags & 4) {
                                n = v;
                                var x = t.memoizedProps;
                                switch (t.type) {
                                    case "button":
                                    case "input":
                                    case "select":
                                    case "textarea":
                                        x.autoFocus && n.focus();
                                        break;
                                    case "img":
                                        x.src && (n.src = x.src)
                                }
                            }
                            break;
                        case 6:
                            break;
                        case 4:
                            break;
                        case 12:
                            break;
                        case 13:
                            if (t.memoizedState === null) {
                                var L = t.alternate;
                                if (L !== null) {
                                    var U = L.memoizedState;
                                    if (U !== null) {
                                        var B = U.dehydrated;
                                        B !== null && Wr(B)
                                    }
                                }
                            }
                            break;
                        case 19:
                        case 17:
                        case 21:
                        case 22:
                        case 23:
                        case 25:
                            break;
                        default:
                            throw Error(i(163))
                    }
                    Je || t.flags & 512 && Os(t)
                } catch (b) {
                    Ae(t, t.return, b)
                }
            }
            if (t === e) {
                X = null;
                break
            }
            if (n = t.sibling, n !== null) {
                n.return = t.return, X = n;
                break
            }
            X = t.return
        }
    }

    function mf(e) {
        for (; X !== null;) {
            var t = X;
            if (t === e) {
                X = null;
                break
            }
            var n = t.sibling;
            if (n !== null) {
                n.return = t.return, X = n;
                break
            }
            X = t.return
        }
    }

    function hf(e) {
        for (; X !== null;) {
            var t = X;
            try {
                switch (t.tag) {
                    case 0:
                    case 11:
                    case 15:
                        var n = t.return;
                        try {
                            yl(4, t)
                        } catch (x) {
                            Ae(t, n, x)
                        }
                        break;
                    case 1:
                        var o = t.stateNode;
                        if (typeof o.componentDidMount == "function") {
                            var l = t.return;
                            try {
                                o.componentDidMount()
                            } catch (x) {
                                Ae(t, l, x)
                            }
                        }
                        var a = t.return;
                        try {
                            Os(t)
                        } catch (x) {
                            Ae(t, a, x)
                        }
                        break;
                    case 5:
                        var f = t.return;
                        try {
                            Os(t)
                        } catch (x) {
                            Ae(t, f, x)
                        }
                }
            } catch (x) {
                Ae(t, t.return, x)
            }
            if (t === e) {
                X = null;
                break
            }
            var v = t.sibling;
            if (v !== null) {
                v.return = t.return, X = v;
                break
            }
            X = t.return
        }
    }
    var Lh = Math.ceil,
        wl = F.ReactCurrentDispatcher,
        zs = F.ReactCurrentOwner,
        St = F.ReactCurrentBatchConfig,
        Ee = 0,
        He = null,
        Fe = null,
        Qe = 0,
        mt = 0,
        gr = dn(0),
        Be = 0,
        po = null,
        Un = 0,
        xl = 0,
        js = 0,
        mo = null,
        st = null,
        Ds = 0,
        yr = 1 / 0,
        Xt = null,
        Sl = !1,
        Fs = null,
        yn = null,
        Cl = !1,
        wn = null,
        El = 0,
        ho = 0,
        bs = null,
        kl = -1,
        Pl = 0;

    function nt() {
        return (Ee & 6) !== 0 ? je() : kl !== -1 ? kl : kl = je()
    }

    function xn(e) {
        return (e.mode & 1) === 0 ? 1 : (Ee & 2) !== 0 && Qe !== 0 ? Qe & -Qe : mh.transition !== null ? (Pl === 0 && (Pl = su()), Pl) : (e = Ne, e !== 0 || (e = window.event, e = e === void 0 ? 16 : vu(e.type)), e)
    }

    function _t(e, t, n, o) {
        if (50 < ho) throw ho = 0, bs = null, Error(i(185));
        Fr(e, n, o), ((Ee & 2) === 0 || e !== He) && (e === He && ((Ee & 2) === 0 && (xl |= n), Be === 4 && Sn(e, Qe)), at(e, o), n === 1 && Ee === 0 && (t.mode & 1) === 0 && (yr = je() + 500, Jo && mn()))
    }

    function at(e, t) {
        var n = e.callbackNode;
        mm(e, t);
        var o = Ao(e, e === He ? Qe : 0);
        if (o === 0) n !== null && ou(n), e.callbackNode = null, e.callbackPriority = 0;
        else if (t = o & -o, e.callbackPriority !== t) {
            if (n != null && ou(n), t === 1) e.tag === 0 ? ph(gf.bind(null, e)) : tc(gf.bind(null, e)), uh(function() {
                (Ee & 6) === 0 && mn()
            }), n = null;
            else {
                switch (au(o)) {
                    case 1:
                        n = yi;
                        break;
                    case 4:
                        n = lu;
                        break;
                    case 16:
                        n = Io;
                        break;
                    case 536870912:
                        n = iu;
                        break;
                    default:
                        n = Io
                }
                n = Pf(n, vf.bind(null, e))
            }
            e.callbackPriority = t, e.callbackNode = n
        }
    }

    function vf(e, t) {
        if (kl = -1, Pl = 0, (Ee & 6) !== 0) throw Error(i(327));
        var n = e.callbackNode;
        if (wr() && e.callbackNode !== n) return null;
        var o = Ao(e, e === He ? Qe : 0);
        if (o === 0) return null;
        if ((o & 30) !== 0 || (o & e.expiredLanes) !== 0 || t) t = Nl(e, o);
        else {
            t = o;
            var l = Ee;
            Ee |= 2;
            var a = wf();
            (He !== e || Qe !== t) && (Xt = null, yr = je() + 500, Vn(e, t));
            do try {
                Ah();
                break
            } catch (v) {
                yf(e, v)
            }
            while (!0);
            rs(), wl.current = a, Ee = l, Fe !== null ? t = 0 : (He = null, Qe = 0, t = Be)
        }
        if (t !== 0) {
            if (t === 2 && (l = wi(e), l !== 0 && (o = l, t = Us(e, l))), t === 1) throw n = po, Vn(e, 0), Sn(e, o), at(e, je()), n;
            if (t === 6) Sn(e, o);
            else {
                if (l = e.current.alternate, (o & 30) === 0 && !Oh(l) && (t = Nl(e, o), t === 2 && (a = wi(e), a !== 0 && (o = a, t = Us(e, a))), t === 1)) throw n = po, Vn(e, 0), Sn(e, o), at(e, je()), n;
                switch (e.finishedWork = l, e.finishedLanes = o, t) {
                    case 0:
                    case 1:
                        throw Error(i(345));
                    case 2:
                        Wn(e, st, Xt);
                        break;
                    case 3:
                        if (Sn(e, o), (o & 130023424) === o && (t = Ds + 500 - je(), 10 < t)) {
                            if (Ao(e, 0) !== 0) break;
                            if (l = e.suspendedLanes, (l & o) !== o) {
                                nt(), e.pingedLanes |= e.suspendedLanes & l;
                                break
                            }
                            e.timeoutHandle = Ki(Wn.bind(null, e, st, Xt), t);
                            break
                        }
                        Wn(e, st, Xt);
                        break;
                    case 4:
                        if (Sn(e, o), (o & 4194240) === o) break;
                        for (t = e.eventTimes, l = -1; 0 < o;) {
                            var f = 31 - Et(o);
                            a = 1 << f, f = t[f], f > l && (l = f), o &= ~a
                        }
                        if (o = l, o = je() - o, o = (120 > o ? 120 : 480 > o ? 480 : 1080 > o ? 1080 : 1920 > o ? 1920 : 3e3 > o ? 3e3 : 4320 > o ? 4320 : 1960 * Lh(o / 1960)) - o, 10 < o) {
                            e.timeoutHandle = Ki(Wn.bind(null, e, st, Xt), o);
                            break
                        }
                        Wn(e, st, Xt);
                        break;
                    case 5:
                        Wn(e, st, Xt);
                        break;
                    default:
                        throw Error(i(329))
                }
            }
        }
        return at(e, je()), e.callbackNode === n ? vf.bind(null, e) : null
    }

    function Us(e, t) {
        var n = mo;
        return e.current.memoizedState.isDehydrated && (Vn(e, t).flags |= 256), e = Nl(e, t), e !== 2 && (t = st, st = n, t !== null && Bs(t)), e
    }

    function Bs(e) {
        st === null ? st = e : st.push.apply(st, e)
    }

    function Oh(e) {
        for (var t = e;;) {
            if (t.flags & 16384) {
                var n = t.updateQueue;
                if (n !== null && (n = n.stores, n !== null))
                    for (var o = 0; o < n.length; o++) {
                        var l = n[o],
                            a = l.getSnapshot;
                        l = l.value;
                        try {
                            if (!kt(a(), l)) return !1
                        } catch {
                            return !1
                        }
                    }
            }
            if (n = t.child, t.subtreeFlags & 16384 && n !== null) n.return = t, t = n;
            else {
                if (t === e) break;
                for (; t.sibling === null;) {
                    if (t.return === null || t.return === e) return !0;
                    t = t.return
                }
                t.sibling.return = t.return, t = t.sibling
            }
        }
        return !0
    }

    function Sn(e, t) {
        for (t &= ~js, t &= ~xl, e.suspendedLanes |= t, e.pingedLanes &= ~t, e = e.expirationTimes; 0 < t;) {
            var n = 31 - Et(t),
                o = 1 << n;
            e[n] = -1, t &= ~o
        }
    }

    function gf(e) {
        if ((Ee & 6) !== 0) throw Error(i(327));
        wr();
        var t = Ao(e, 0);
        if ((t & 1) === 0) return at(e, je()), null;
        var n = Nl(e, t);
        if (e.tag !== 0 && n === 2) {
            var o = wi(e);
            o !== 0 && (t = o, n = Us(e, o))
        }
        if (n === 1) throw n = po, Vn(e, 0), Sn(e, t), at(e, je()), n;
        if (n === 6) throw Error(i(345));
        return e.finishedWork = e.current.alternate, e.finishedLanes = t, Wn(e, st, Xt), at(e, je()), null
    }

    function Vs(e, t) {
        var n = Ee;
        Ee |= 1;
        try {
            return e(t)
        } finally {
            Ee = n, Ee === 0 && (yr = je() + 500, Jo && mn())
        }
    }

    function Bn(e) {
        wn !== null && wn.tag === 0 && (Ee & 6) === 0 && wr();
        var t = Ee;
        Ee |= 1;
        var n = St.transition,
            o = Ne;
        try {
            if (St.transition = null, Ne = 1, e) return e()
        } finally {
            Ne = o, St.transition = n, Ee = t, (Ee & 6) === 0 && mn()
        }
    }

    function Ws() {
        mt = gr.current, _e(gr)
    }

    function Vn(e, t) {
        e.finishedWork = null, e.finishedLanes = 0;
        var n = e.timeoutHandle;
        if (n !== -1 && (e.timeoutHandle = -1, ah(n)), Fe !== null)
            for (n = Fe.return; n !== null;) {
                var o = n;
                switch (qi(o), o.tag) {
                    case 1:
                        o = o.type.childContextTypes, o != null && Zo();
                        break;
                    case 3:
                        mr(), _e(ot), _e(Xe), fs();
                        break;
                    case 5:
                        us(o);
                        break;
                    case 4:
                        mr();
                        break;
                    case 13:
                        _e(Oe);
                        break;
                    case 19:
                        _e(Oe);
                        break;
                    case 10:
                        os(o.type._context);
                        break;
                    case 22:
                    case 23:
                        Ws()
                }
                n = n.return
            }
        if (He = e, Fe = e = Cn(e.current, null), Qe = mt = t, Be = 0, po = null, js = xl = Un = 0, st = mo = null, Dn !== null) {
            for (t = 0; t < Dn.length; t++)
                if (n = Dn[t], o = n.interleaved, o !== null) {
                    n.interleaved = null;
                    var l = o.next,
                        a = n.pending;
                    if (a !== null) {
                        var f = a.next;
                        a.next = l, o.next = f
                    }
                    n.pending = o
                } Dn = null
        }
        return e
    }

    function yf(e, t) {
        do {
            var n = Fe;
            try {
                if (rs(), ul.current = pl, cl) {
                    for (var o = Me.memoizedState; o !== null;) {
                        var l = o.queue;
                        l !== null && (l.pending = null), o = o.next
                    }
                    cl = !1
                }
                if (bn = 0, We = Ue = Me = null, io = !1, so = 0, zs.current = null, n === null || n.return === null) {
                    Be = 1, po = t, Fe = null;
                    break
                }
                e: {
                    var a = e,
                        f = n.return,
                        v = n,
                        x = t;
                    if (t = Qe, v.flags |= 32768, x !== null && typeof x == "object" && typeof x.then == "function") {
                        var L = x,
                            U = v,
                            B = U.tag;
                        if ((U.mode & 1) === 0 && (B === 0 || B === 11 || B === 15)) {
                            var b = U.alternate;
                            b ? (U.updateQueue = b.updateQueue, U.memoizedState = b.memoizedState, U.lanes = b.lanes) : (U.updateQueue = null, U.memoizedState = null)
                        }
                        var Y = Vc(f);
                        if (Y !== null) {
                            Y.flags &= -257, Wc(Y, f, v, a, t), Y.mode & 1 && Bc(a, L, t), t = Y, x = L;
                            var q = t.updateQueue;
                            if (q === null) {
                                var J = new Set;
                                J.add(x), t.updateQueue = J
                            } else q.add(x);
                            break e
                        } else {
                            if ((t & 1) === 0) {
                                Bc(a, L, t), Hs();
                                break e
                            }
                            x = Error(i(426))
                        }
                    } else if (Le && v.mode & 1) {
                        var De = Vc(f);
                        if (De !== null) {
                            (De.flags & 65536) === 0 && (De.flags |= 256), Wc(De, f, v, a, t), ts(hr(x, v));
                            break e
                        }
                    }
                    a = x = hr(x, v),
                    Be !== 4 && (Be = 2),
                    mo === null ? mo = [a] : mo.push(a),
                    a = f;do {
                        switch (a.tag) {
                            case 3:
                                a.flags |= 65536, t &= -t, a.lanes |= t;
                                var T = bc(a, x, t);
                                dc(a, T);
                                break e;
                            case 1:
                                v = x;
                                var k = a.type,
                                    I = a.stateNode;
                                if ((a.flags & 128) === 0 && (typeof k.getDerivedStateFromError == "function" || I !== null && typeof I.componentDidCatch == "function" && (yn === null || !yn.has(I)))) {
                                    a.flags |= 65536, t &= -t, a.lanes |= t;
                                    var H = Uc(a, v, t);
                                    dc(a, H);
                                    break e
                                }
                        }
                        a = a.return
                    } while (a !== null)
                }
                Sf(n)
            } catch (te) {
                t = te, Fe === n && n !== null && (Fe = n = n.return);
                continue
            }
            break
        } while (!0)
    }

    function wf() {
        var e = wl.current;
        return wl.current = pl, e === null ? pl : e
    }

    function Hs() {
        (Be === 0 || Be === 3 || Be === 2) && (Be = 4), He === null || (Un & 268435455) === 0 && (xl & 268435455) === 0 || Sn(He, Qe)
    }

    function Nl(e, t) {
        var n = Ee;
        Ee |= 2;
        var o = wf();
        (He !== e || Qe !== t) && (Xt = null, Vn(e, t));
        do try {
            Mh();
            break
        } catch (l) {
            yf(e, l)
        }
        while (!0);
        if (rs(), Ee = n, wl.current = o, Fe !== null) throw Error(i(261));
        return He = null, Qe = 0, Be
    }

    function Mh() {
        for (; Fe !== null;) xf(Fe)
    }

    function Ah() {
        for (; Fe !== null && !lm();) xf(Fe)
    }

    function xf(e) {
        var t = kf(e.alternate, e, mt);
        e.memoizedProps = e.pendingProps, t === null ? Sf(e) : Fe = t, zs.current = null
    }

    function Sf(e) {
        var t = e;
        do {
            var n = t.alternate;
            if (e = t.return, (t.flags & 32768) === 0) {
                if (n = Nh(n, t, mt), n !== null) {
                    Fe = n;
                    return
                }
            } else {
                if (n = Rh(n, t), n !== null) {
                    n.flags &= 32767, Fe = n;
                    return
                }
                if (e !== null) e.flags |= 32768, e.subtreeFlags = 0, e.deletions = null;
                else {
                    Be = 6, Fe = null;
                    return
                }
            }
            if (t = t.sibling, t !== null) {
                Fe = t;
                return
            }
            Fe = t = e
        } while (t !== null);
        Be === 0 && (Be = 5)
    }

    function Wn(e, t, n) {
        var o = Ne,
            l = St.transition;
        try {
            St.transition = null, Ne = 1, zh(e, t, n, o)
        } finally {
            St.transition = l, Ne = o
        }
        return null
    }

    function zh(e, t, n, o) {
        do wr(); while (wn !== null);
        if ((Ee & 6) !== 0) throw Error(i(327));
        n = e.finishedWork;
        var l = e.finishedLanes;
        if (n === null) return null;
        if (e.finishedWork = null, e.finishedLanes = 0, n === e.current) throw Error(i(177));
        e.callbackNode = null, e.callbackPriority = 0;
        var a = n.lanes | n.childLanes;
        if (hm(e, a), e === He && (Fe = He = null, Qe = 0), (n.subtreeFlags & 2064) === 0 && (n.flags & 2064) === 0 || Cl || (Cl = !0, Pf(Io, function() {
                return wr(), null
            })), a = (n.flags & 15990) !== 0, (n.subtreeFlags & 15990) !== 0 || a) {
            a = St.transition, St.transition = null;
            var f = Ne;
            Ne = 1;
            var v = Ee;
            Ee |= 4, zs.current = null, _h(e, n), ff(n, e), th(Hi), Do = !!Wi, Hi = Wi = null, e.current = n, Ih(n), im(), Ee = v, Ne = f, St.transition = a
        } else e.current = n;
        if (Cl && (Cl = !1, wn = e, El = l), a = e.pendingLanes, a === 0 && (yn = null), um(n.stateNode), at(e, je()), t !== null)
            for (o = e.onRecoverableError, n = 0; n < t.length; n++) l = t[n], o(l.value, {
                componentStack: l.stack,
                digest: l.digest
            });
        if (Sl) throw Sl = !1, e = Fs, Fs = null, e;
        return (El & 1) !== 0 && e.tag !== 0 && wr(), a = e.pendingLanes, (a & 1) !== 0 ? e === bs ? ho++ : (ho = 0, bs = e) : ho = 0, mn(), null
    }

    function wr() {
        if (wn !== null) {
            var e = au(El),
                t = St.transition,
                n = Ne;
            try {
                if (St.transition = null, Ne = 16 > e ? 16 : e, wn === null) var o = !1;
                else {
                    if (e = wn, wn = null, El = 0, (Ee & 6) !== 0) throw Error(i(331));
                    var l = Ee;
                    for (Ee |= 4, X = e.current; X !== null;) {
                        var a = X,
                            f = a.child;
                        if ((X.flags & 16) !== 0) {
                            var v = a.deletions;
                            if (v !== null) {
                                for (var x = 0; x < v.length; x++) {
                                    var L = v[x];
                                    for (X = L; X !== null;) {
                                        var U = X;
                                        switch (U.tag) {
                                            case 0:
                                            case 11:
                                            case 15:
                                                fo(8, U, a)
                                        }
                                        var B = U.child;
                                        if (B !== null) B.return = U, X = B;
                                        else
                                            for (; X !== null;) {
                                                U = X;
                                                var b = U.sibling,
                                                    Y = U.return;
                                                if (lf(U), U === L) {
                                                    X = null;
                                                    break
                                                }
                                                if (b !== null) {
                                                    b.return = Y, X = b;
                                                    break
                                                }
                                                X = Y
                                            }
                                    }
                                }
                                var q = a.alternate;
                                if (q !== null) {
                                    var J = q.child;
                                    if (J !== null) {
                                        q.child = null;
                                        do {
                                            var De = J.sibling;
                                            J.sibling = null, J = De
                                        } while (J !== null)
                                    }
                                }
                                X = a
                            }
                        }
                        if ((a.subtreeFlags & 2064) !== 0 && f !== null) f.return = a, X = f;
                        else e: for (; X !== null;) {
                            if (a = X, (a.flags & 2048) !== 0) switch (a.tag) {
                                case 0:
                                case 11:
                                case 15:
                                    fo(9, a, a.return)
                            }
                            var T = a.sibling;
                            if (T !== null) {
                                T.return = a.return, X = T;
                                break e
                            }
                            X = a.return
                        }
                    }
                    var k = e.current;
                    for (X = k; X !== null;) {
                        f = X;
                        var I = f.child;
                        if ((f.subtreeFlags & 2064) !== 0 && I !== null) I.return = f, X = I;
                        else e: for (f = k; X !== null;) {
                            if (v = X, (v.flags & 2048) !== 0) try {
                                switch (v.tag) {
                                    case 0:
                                    case 11:
                                    case 15:
                                        yl(9, v)
                                }
                            } catch (te) {
                                Ae(v, v.return, te)
                            }
                            if (v === f) {
                                X = null;
                                break e
                            }
                            var H = v.sibling;
                            if (H !== null) {
                                H.return = v.return, X = H;
                                break e
                            }
                            X = v.return
                        }
                    }
                    if (Ee = l, mn(), Mt && typeof Mt.onPostCommitFiberRoot == "function") try {
                        Mt.onPostCommitFiberRoot(Lo, e)
                    } catch {}
                    o = !0
                }
                return o
            } finally {
                Ne = n, St.transition = t
            }
        }
        return !1
    }

    function Cf(e, t, n) {
        t = hr(n, t), t = bc(e, t, 1), e = vn(e, t, 1), t = nt(), e !== null && (Fr(e, 1, t), at(e, t))
    }

    function Ae(e, t, n) {
        if (e.tag === 3) Cf(e, e, n);
        else
            for (; t !== null;) {
                if (t.tag === 3) {
                    Cf(t, e, n);
                    break
                } else if (t.tag === 1) {
                    var o = t.stateNode;
                    if (typeof t.type.getDerivedStateFromError == "function" || typeof o.componentDidCatch == "function" && (yn === null || !yn.has(o))) {
                        e = hr(n, e), e = Uc(t, e, 1), t = vn(t, e, 1), e = nt(), t !== null && (Fr(t, 1, e), at(t, e));
                        break
                    }
                }
                t = t.return
            }
    }

    function jh(e, t, n) {
        var o = e.pingCache;
        o !== null && o.delete(t), t = nt(), e.pingedLanes |= e.suspendedLanes & n, He === e && (Qe & n) === n && (Be === 4 || Be === 3 && (Qe & 130023424) === Qe && 500 > je() - Ds ? Vn(e, 0) : js |= n), at(e, t)
    }

    function Ef(e, t) {
        t === 0 && ((e.mode & 1) === 0 ? t = 1 : (t = Mo, Mo <<= 1, (Mo & 130023424) === 0 && (Mo = 4194304)));
        var n = nt();
        e = Qt(e, t), e !== null && (Fr(e, t, n), at(e, n))
    }

    function Dh(e) {
        var t = e.memoizedState,
            n = 0;
        t !== null && (n = t.retryLane), Ef(e, n)
    }

    function Fh(e, t) {
        var n = 0;
        switch (e.tag) {
            case 13:
                var o = e.stateNode,
                    l = e.memoizedState;
                l !== null && (n = l.retryLane);
                break;
            case 19:
                o = e.stateNode;
                break;
            default:
                throw Error(i(314))
        }
        o !== null && o.delete(t), Ef(e, n)
    }
    var kf;
    kf = function(e, t, n) {
        if (e !== null)
            if (e.memoizedProps !== t.pendingProps || ot.current) it = !0;
            else {
                if ((e.lanes & n) === 0 && (t.flags & 128) === 0) return it = !1, Ph(e, t, n);
                it = (e.flags & 131072) !== 0
            }
        else it = !1, Le && (t.flags & 1048576) !== 0 && nc(t, tl, t.index);
        switch (t.lanes = 0, t.tag) {
            case 2:
                var o = t.type;
                vl(e, t), e = t.pendingProps;
                var l = sr(t, Xe.current);
                pr(t, n), l = ms(null, t, o, e, l, n);
                var a = hs();
                return t.flags |= 1, typeof l == "object" && l !== null && typeof l.render == "function" && l.$$typeof === void 0 ? (t.tag = 1, t.memoizedState = null, t.updateQueue = null, lt(o) ? (a = !0, qo(t)) : a = !1, t.memoizedState = l.state !== null && l.state !== void 0 ? l.state : null, ss(t), l.updater = ml, t.stateNode = l, l._reactInternals = t, Ss(t, o, e, n), t = Ps(null, t, o, !0, a, n)) : (t.tag = 0, Le && a && Zi(t), tt(null, t, l, n), t = t.child), t;
            case 16:
                o = t.elementType;
                e: {
                    switch (vl(e, t), e = t.pendingProps, l = o._init, o = l(o._payload), t.type = o, l = t.tag = Uh(o), e = Nt(o, e), l) {
                        case 0:
                            t = ks(null, t, o, e, n);
                            break e;
                        case 1:
                            t = Yc(null, t, o, e, n);
                            break e;
                        case 11:
                            t = Hc(null, t, o, e, n);
                            break e;
                        case 14:
                            t = $c(null, t, o, Nt(o.type, e), n);
                            break e
                    }
                    throw Error(i(306, o, ""))
                }
                return t;
            case 0:
                return o = t.type, l = t.pendingProps, l = t.elementType === o ? l : Nt(o, l), ks(e, t, o, l, n);
            case 1:
                return o = t.type, l = t.pendingProps, l = t.elementType === o ? l : Nt(o, l), Yc(e, t, o, l, n);
            case 3:
                e: {
                    if (Xc(t), e === null) throw Error(i(387));o = t.pendingProps,
                    a = t.memoizedState,
                    l = a.element,
                    fc(e, t),
                    sl(t, o, null, n);
                    var f = t.memoizedState;
                    if (o = f.element, a.isDehydrated)
                        if (a = {
                                element: o,
                                isDehydrated: !1,
                                cache: f.cache,
                                pendingSuspenseBoundaries: f.pendingSuspenseBoundaries,
                                transitions: f.transitions
                            }, t.updateQueue.baseState = a, t.memoizedState = a, t.flags & 256) {
                            l = hr(Error(i(423)), t), t = Zc(e, t, o, n, l);
                            break e
                        } else if (o !== l) {
                        l = hr(Error(i(424)), t), t = Zc(e, t, o, n, l);
                        break e
                    } else
                        for (pt = fn(t.stateNode.containerInfo.firstChild), dt = t, Le = !0, Pt = null, n = uc(t, null, o, n), t.child = n; n;) n.flags = n.flags & -3 | 4096, n = n.sibling;
                    else {
                        if (cr(), o === l) {
                            t = Yt(e, t, n);
                            break e
                        }
                        tt(e, t, o, n)
                    }
                    t = t.child
                }
                return t;
            case 5:
                return mc(t), e === null && es(t), o = t.type, l = t.pendingProps, a = e !== null ? e.memoizedProps : null, f = l.children, $i(o, l) ? f = null : a !== null && $i(o, a) && (t.flags |= 32), Gc(e, t), tt(e, t, f, n), t.child;
            case 6:
                return e === null && es(t), null;
            case 13:
                return qc(e, t, n);
            case 4:
                return as(t, t.stateNode.containerInfo), o = t.pendingProps, e === null ? t.child = fr(t, null, o, n) : tt(e, t, o, n), t.child;
            case 11:
                return o = t.type, l = t.pendingProps, l = t.elementType === o ? l : Nt(o, l), Hc(e, t, o, l, n);
            case 7:
                return tt(e, t, t.pendingProps, n), t.child;
            case 8:
                return tt(e, t, t.pendingProps.children, n), t.child;
            case 12:
                return tt(e, t, t.pendingProps.children, n), t.child;
            case 10:
                e: {
                    if (o = t.type._context, l = t.pendingProps, a = t.memoizedProps, f = l.value, Re(ol, o._currentValue), o._currentValue = f, a !== null)
                        if (kt(a.value, f)) {
                            if (a.children === l.children && !ot.current) {
                                t = Yt(e, t, n);
                                break e
                            }
                        } else
                            for (a = t.child, a !== null && (a.return = t); a !== null;) {
                                var v = a.dependencies;
                                if (v !== null) {
                                    f = a.child;
                                    for (var x = v.firstContext; x !== null;) {
                                        if (x.context === o) {
                                            if (a.tag === 1) {
                                                x = Gt(-1, n & -n), x.tag = 2;
                                                var L = a.updateQueue;
                                                if (L !== null) {
                                                    L = L.shared;
                                                    var U = L.pending;
                                                    U === null ? x.next = x : (x.next = U.next, U.next = x), L.pending = x
                                                }
                                            }
                                            a.lanes |= n, x = a.alternate, x !== null && (x.lanes |= n), ls(a.return, n, t), v.lanes |= n;
                                            break
                                        }
                                        x = x.next
                                    }
                                } else if (a.tag === 10) f = a.type === t.type ? null : a.child;
                                else if (a.tag === 18) {
                                    if (f = a.return, f === null) throw Error(i(341));
                                    f.lanes |= n, v = f.alternate, v !== null && (v.lanes |= n), ls(f, n, t), f = a.sibling
                                } else f = a.child;
                                if (f !== null) f.return = a;
                                else
                                    for (f = a; f !== null;) {
                                        if (f === t) {
                                            f = null;
                                            break
                                        }
                                        if (a = f.sibling, a !== null) {
                                            a.return = f.return, f = a;
                                            break
                                        }
                                        f = f.return
                                    }
                                a = f
                            }
                    tt(e, t, l.children, n),
                    t = t.child
                }
                return t;
            case 9:
                return l = t.type, o = t.pendingProps.children, pr(t, n), l = wt(l), o = o(l), t.flags |= 1, tt(e, t, o, n), t.child;
            case 14:
                return o = t.type, l = Nt(o, t.pendingProps), l = Nt(o.type, l), $c(e, t, o, l, n);
            case 15:
                return Kc(e, t, t.type, t.pendingProps, n);
            case 17:
                return o = t.type, l = t.pendingProps, l = t.elementType === o ? l : Nt(o, l), vl(e, t), t.tag = 1, lt(o) ? (e = !0, qo(t)) : e = !1, pr(t, n), Dc(t, o, l), Ss(t, o, l, n), Ps(null, t, o, !0, e, n);
            case 19:
                return ef(e, t, n);
            case 22:
                return Qc(e, t, n)
        }
        throw Error(i(156, t.tag))
    };

    function Pf(e, t) {
        return ru(e, t)
    }

    function bh(e, t, n, o) {
        this.tag = e, this.key = n, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.ref = null, this.pendingProps = t, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = o, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null
    }

    function Ct(e, t, n, o) {
        return new bh(e, t, n, o)
    }

    function $s(e) {
        return e = e.prototype, !(!e || !e.isReactComponent)
    }

    function Uh(e) {
        if (typeof e == "function") return $s(e) ? 1 : 0;
        if (e != null) {
            if (e = e.$$typeof, e === Z) return 11;
            if (e === me) return 14
        }
        return 2
    }

    function Cn(e, t) {
        var n = e.alternate;
        return n === null ? (n = Ct(e.tag, t, e.key, e.mode), n.elementType = e.elementType, n.type = e.type, n.stateNode = e.stateNode, n.alternate = e, e.alternate = n) : (n.pendingProps = t, n.type = e.type, n.flags = 0, n.subtreeFlags = 0, n.deletions = null), n.flags = e.flags & 14680064, n.childLanes = e.childLanes, n.lanes = e.lanes, n.child = e.child, n.memoizedProps = e.memoizedProps, n.memoizedState = e.memoizedState, n.updateQueue = e.updateQueue, t = e.dependencies, n.dependencies = t === null ? null : {
            lanes: t.lanes,
            firstContext: t.firstContext
        }, n.sibling = e.sibling, n.index = e.index, n.ref = e.ref, n
    }

    function Rl(e, t, n, o, l, a) {
        var f = 2;
        if (o = e, typeof e == "function") $s(e) && (f = 1);
        else if (typeof e == "string") f = 5;
        else e: switch (e) {
            case K:
                return Hn(n.children, l, a, t);
            case re:
                f = 8, l |= 8;
                break;
            case pe:
                return e = Ct(12, n, t, l | 2), e.elementType = pe, e.lanes = a, e;
            case ae:
                return e = Ct(13, n, t, l), e.elementType = ae, e.lanes = a, e;
            case fe:
                return e = Ct(19, n, t, l), e.elementType = fe, e.lanes = a, e;
            case ee:
                return Tl(n, l, a, t);
            default:
                if (typeof e == "object" && e !== null) switch (e.$$typeof) {
                    case se:
                        f = 10;
                        break e;
                    case ve:
                        f = 9;
                        break e;
                    case Z:
                        f = 11;
                        break e;
                    case me:
                        f = 14;
                        break e;
                    case oe:
                        f = 16, o = null;
                        break e
                }
                throw Error(i(130, e == null ? e : typeof e, ""))
        }
        return t = Ct(f, n, t, l), t.elementType = e, t.type = o, t.lanes = a, t
    }

    function Hn(e, t, n, o) {
        return e = Ct(7, e, o, t), e.lanes = n, e
    }

    function Tl(e, t, n, o) {
        return e = Ct(22, e, o, t), e.elementType = ee, e.lanes = n, e.stateNode = {
            isHidden: !1
        }, e
    }

    function Ks(e, t, n) {
        return e = Ct(6, e, null, t), e.lanes = n, e
    }

    function Qs(e, t, n) {
        return t = Ct(4, e.children !== null ? e.children : [], e.key, t), t.lanes = n, t.stateNode = {
            containerInfo: e.containerInfo,
            pendingChildren: null,
            implementation: e.implementation
        }, t
    }

    function Bh(e, t, n, o, l) {
        this.tag = t, this.containerInfo = e, this.finishedWork = this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = -1, this.callbackNode = this.pendingContext = this.context = null, this.callbackPriority = 0, this.eventTimes = xi(0), this.expirationTimes = xi(-1), this.entangledLanes = this.finishedLanes = this.mutableReadLanes = this.expiredLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = xi(0), this.identifierPrefix = o, this.onRecoverableError = l, this.mutableSourceEagerHydrationData = null
    }

    function Gs(e, t, n, o, l, a, f, v, x) {
        return e = new Bh(e, t, n, v, x), t === 1 ? (t = 1, a === !0 && (t |= 8)) : t = 0, a = Ct(3, null, null, t), e.current = a, a.stateNode = e, a.memoizedState = {
            element: o,
            isDehydrated: n,
            cache: null,
            transitions: null,
            pendingSuspenseBoundaries: null
        }, ss(a), e
    }

    function Vh(e, t, n) {
        var o = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
        return {
            $$typeof: G,
            key: o == null ? null : "" + o,
            children: e,
            containerInfo: t,
            implementation: n
        }
    }

    function Nf(e) {
        if (!e) return pn;
        e = e._reactInternals;
        e: {
            if (On(e) !== e || e.tag !== 1) throw Error(i(170));
            var t = e;do {
                switch (t.tag) {
                    case 3:
                        t = t.stateNode.context;
                        break e;
                    case 1:
                        if (lt(t.type)) {
                            t = t.stateNode.__reactInternalMemoizedMergedChildContext;
                            break e
                        }
                }
                t = t.return
            } while (t !== null);
            throw Error(i(171))
        }
        if (e.tag === 1) {
            var n = e.type;
            if (lt(n)) return Ju(e, n, t)
        }
        return t
    }

    function Rf(e, t, n, o, l, a, f, v, x) {
        return e = Gs(n, o, !0, e, l, a, f, v, x), e.context = Nf(null), n = e.current, o = nt(), l = xn(n), a = Gt(o, l), a.callback = t ?? null, vn(n, a, l), e.current.lanes = l, Fr(e, l, o), at(e, o), e
    }

    function _l(e, t, n, o) {
        var l = t.current,
            a = nt(),
            f = xn(l);
        return n = Nf(n), t.context === null ? t.context = n : t.pendingContext = n, t = Gt(a, f), t.payload = {
            element: e
        }, o = o === void 0 ? null : o, o !== null && (t.callback = o), e = vn(l, t, f), e !== null && (_t(e, l, f, a), il(e, l, f)), f
    }

    function Il(e) {
        if (e = e.current, !e.child) return null;
        switch (e.child.tag) {
            case 5:
                return e.child.stateNode;
            default:
                return e.child.stateNode
        }
    }

    function Tf(e, t) {
        if (e = e.memoizedState, e !== null && e.dehydrated !== null) {
            var n = e.retryLane;
            e.retryLane = n !== 0 && n < t ? n : t
        }
    }

    function Ys(e, t) {
        Tf(e, t), (e = e.alternate) && Tf(e, t)
    }

    function Wh() {
        return null
    }
    var _f = typeof reportError == "function" ? reportError : function(e) {
        console.error(e)
    };

    function Xs(e) {
        this._internalRoot = e
    }
    Ll.prototype.render = Xs.prototype.render = function(e) {
        var t = this._internalRoot;
        if (t === null) throw Error(i(409));
        _l(e, t, null, null)
    }, Ll.prototype.unmount = Xs.prototype.unmount = function() {
        var e = this._internalRoot;
        if (e !== null) {
            this._internalRoot = null;
            var t = e.containerInfo;
            Bn(function() {
                _l(null, e, null, null)
            }), t[Wt] = null
        }
    };

    function Ll(e) {
        this._internalRoot = e
    }
    Ll.prototype.unstable_scheduleHydration = function(e) {
        if (e) {
            var t = fu();
            e = {
                blockedOn: null,
                target: e,
                priority: t
            };
            for (var n = 0; n < an.length && t !== 0 && t < an[n].priority; n++);
            an.splice(n, 0, e), n === 0 && mu(e)
        }
    };

    function Zs(e) {
        return !(!e || e.nodeType !== 1 && e.nodeType !== 9 && e.nodeType !== 11)
    }

    function Ol(e) {
        return !(!e || e.nodeType !== 1 && e.nodeType !== 9 && e.nodeType !== 11 && (e.nodeType !== 8 || e.nodeValue !== " react-mount-point-unstable "))
    }

    function If() {}

    function Hh(e, t, n, o, l) {
        if (l) {
            if (typeof o == "function") {
                var a = o;
                o = function() {
                    var L = Il(f);
                    a.call(L)
                }
            }
            var f = Rf(t, o, e, 0, null, !1, !1, "", If);
            return e._reactRootContainer = f, e[Wt] = f.current, qr(e.nodeType === 8 ? e.parentNode : e), Bn(), f
        }
        for (; l = e.lastChild;) e.removeChild(l);
        if (typeof o == "function") {
            var v = o;
            o = function() {
                var L = Il(x);
                v.call(L)
            }
        }
        var x = Gs(e, 0, !1, null, null, !1, !1, "", If);
        return e._reactRootContainer = x, e[Wt] = x.current, qr(e.nodeType === 8 ? e.parentNode : e), Bn(function() {
            _l(t, x, n, o)
        }), x
    }

    function Ml(e, t, n, o, l) {
        var a = n._reactRootContainer;
        if (a) {
            var f = a;
            if (typeof l == "function") {
                var v = l;
                l = function() {
                    var x = Il(f);
                    v.call(x)
                }
            }
            _l(t, f, e, l)
        } else f = Hh(n, t, e, l, o);
        return Il(f)
    }
    uu = function(e) {
        switch (e.tag) {
            case 3:
                var t = e.stateNode;
                if (t.current.memoizedState.isDehydrated) {
                    var n = Dr(t.pendingLanes);
                    n !== 0 && (Si(t, n | 1), at(t, je()), (Ee & 6) === 0 && (yr = je() + 500, mn()))
                }
                break;
            case 13:
                Bn(function() {
                    var o = Qt(e, 1);
                    if (o !== null) {
                        var l = nt();
                        _t(o, e, 1, l)
                    }
                }), Ys(e, 1)
        }
    }, Ci = function(e) {
        if (e.tag === 13) {
            var t = Qt(e, 134217728);
            if (t !== null) {
                var n = nt();
                _t(t, e, 134217728, n)
            }
            Ys(e, 134217728)
        }
    }, cu = function(e) {
        if (e.tag === 13) {
            var t = xn(e),
                n = Qt(e, t);
            if (n !== null) {
                var o = nt();
                _t(n, e, t, o)
            }
            Ys(e, t)
        }
    }, fu = function() {
        return Ne
    }, du = function(e, t) {
        var n = Ne;
        try {
            return Ne = e, t()
        } finally {
            Ne = n
        }
    }, mi = function(e, t, n) {
        switch (t) {
            case "input":
                if (Vt(e, n), t = n.name, n.type === "radio" && t != null) {
                    for (n = e; n.parentNode;) n = n.parentNode;
                    for (n = n.querySelectorAll("input[name=" + JSON.stringify("" + t) + '][type="radio"]'), t = 0; t < n.length; t++) {
                        var o = n[t];
                        if (o !== e && o.form === e.form) {
                            var l = Xo(o);
                            if (!l) throw Error(i(90));
                            Pe(o), Vt(o, l)
                        }
                    }
                }
                break;
            case "textarea":
                Ba(e, n);
                break;
            case "select":
                t = n.value, t != null && Yn(e, !!n.multiple, t, !1)
        }
    }, Xa = Vs, Za = Bn;
    var $h = {
            usingClientEntryPoint: !1,
            Events: [to, lr, Xo, Ga, Ya, Vs]
        },
        vo = {
            findFiberByHostInstance: Mn,
            bundleType: 0,
            version: "18.3.1",
            rendererPackageName: "react-dom"
        },
        Kh = {
            bundleType: vo.bundleType,
            version: vo.version,
            rendererPackageName: vo.rendererPackageName,
            rendererConfig: vo.rendererConfig,
            overrideHookState: null,
            overrideHookStateDeletePath: null,
            overrideHookStateRenamePath: null,
            overrideProps: null,
            overridePropsDeletePath: null,
            overridePropsRenamePath: null,
            setErrorHandler: null,
            setSuspenseHandler: null,
            scheduleUpdate: null,
            currentDispatcherRef: F.ReactCurrentDispatcher,
            findHostInstanceByFiber: function(e) {
                return e = tu(e), e === null ? null : e.stateNode
            },
            findFiberByHostInstance: vo.findFiberByHostInstance || Wh,
            findHostInstancesForRefresh: null,
            scheduleRefresh: null,
            scheduleRoot: null,
            setRefreshHandler: null,
            getCurrentFiber: null,
            reconcilerVersion: "18.3.1-next-f1338f8080-20240426"
        };
    if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
        var Al = __REACT_DEVTOOLS_GLOBAL_HOOK__;
        if (!Al.isDisabled && Al.supportsFiber) try {
            Lo = Al.inject(Kh), Mt = Al
        } catch {}
    }
    return ut.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = $h, ut.createPortal = function(e, t) {
        var n = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
        if (!Zs(t)) throw Error(i(200));
        return Vh(e, t, null, n)
    }, ut.createRoot = function(e, t) {
        if (!Zs(e)) throw Error(i(299));
        var n = !1,
            o = "",
            l = _f;
        return t != null && (t.unstable_strictMode === !0 && (n = !0), t.identifierPrefix !== void 0 && (o = t.identifierPrefix), t.onRecoverableError !== void 0 && (l = t.onRecoverableError)), t = Gs(e, 1, !1, null, null, n, !1, o, l), e[Wt] = t.current, qr(e.nodeType === 8 ? e.parentNode : e), new Xs(t)
    }, ut.findDOMNode = function(e) {
        if (e == null) return null;
        if (e.nodeType === 1) return e;
        var t = e._reactInternals;
        if (t === void 0) throw typeof e.render == "function" ? Error(i(188)) : (e = Object.keys(e).join(","), Error(i(268, e)));
        return e = tu(t), e = e === null ? null : e.stateNode, e
    }, ut.flushSync = function(e) {
        return Bn(e)
    }, ut.hydrate = function(e, t, n) {
        if (!Ol(t)) throw Error(i(200));
        return Ml(null, e, t, !0, n)
    }, ut.hydrateRoot = function(e, t, n) {
        if (!Zs(e)) throw Error(i(405));
        var o = n != null && n.hydratedSources || null,
            l = !1,
            a = "",
            f = _f;
        if (n != null && (n.unstable_strictMode === !0 && (l = !0), n.identifierPrefix !== void 0 && (a = n.identifierPrefix), n.onRecoverableError !== void 0 && (f = n.onRecoverableError)), t = Rf(t, null, e, 1, n ?? null, l, !1, a, f), e[Wt] = t.current, qr(e), o)
            for (e = 0; e < o.length; e++) n = o[e], l = n._getVersion, l = l(n._source), t.mutableSourceEagerHydrationData == null ? t.mutableSourceEagerHydrationData = [n, l] : t.mutableSourceEagerHydrationData.push(n, l);
        return new Ll(t)
    }, ut.render = function(e, t, n) {
        if (!Ol(t)) throw Error(i(200));
        return Ml(null, e, t, !1, n)
    }, ut.unmountComponentAtNode = function(e) {
        if (!Ol(e)) throw Error(i(40));
        return e._reactRootContainer ? (Bn(function() {
            Ml(null, null, e, !1, function() {
                e._reactRootContainer = null, e[Wt] = null
            })
        }), !0) : !1
    }, ut.unstable_batchedUpdates = Vs, ut.unstable_renderSubtreeIntoContainer = function(e, t, n, o) {
        if (!Ol(n)) throw Error(i(200));
        if (e == null || e._reactInternals === void 0) throw Error(i(38));
        return Ml(e, t, n, !1, o)
    }, ut.version = "18.3.1-next-f1338f8080-20240426", ut
}
var Ff;

function hd() {
    if (Ff) return ea.exports;
    Ff = 1;

    function r() {
        if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function")) try {
            __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(r)
        } catch (s) {
            console.error(s)
        }
    }
    return r(), ea.exports = ev(), ea.exports
}
var bf;

function tv() {
    if (bf) return zl;
    bf = 1;
    var r = hd();
    return zl.createRoot = r.createRoot, zl.hydrateRoot = r.hydrateRoot, zl
}
var nv = tv();

function vd(r) {
    var s, i, u = "";
    if (typeof r == "string" || typeof r == "number") u += r;
    else if (typeof r == "object")
        if (Array.isArray(r)) {
            var c = r.length;
            for (s = 0; s < c; s++) r[s] && (i = vd(r[s])) && (u && (u += " "), u += i)
        } else
            for (i in r) r[i] && (u && (u += " "), u += i);
    return u
}

function gd() {
    for (var r, s, i = 0, u = "", c = arguments.length; i < c; i++)(r = arguments[i]) && (s = vd(r)) && (u && (u += " "), u += s);
    return u
}
const Na = "-",
    rv = r => {
        const s = lv(r),
            {
                conflictingClassGroups: i,
                conflictingClassGroupModifiers: u
            } = r;
        return {
            getClassGroupId: m => {
                const p = m.split(Na);
                return p[0] === "" && p.length !== 1 && p.shift(), yd(p, s) || ov(m)
            },
            getConflictingClassGroupIds: (m, p) => {
                const h = i[m] || [];
                return p && u[m] ? [...h, ...u[m]] : h
            }
        }
    },
    yd = (r, s) => {
        var m;
        if (r.length === 0) return s.classGroupId;
        const i = r[0],
            u = s.nextPart.get(i),
            c = u ? yd(r.slice(1), u) : void 0;
        if (c) return c;
        if (s.validators.length === 0) return;
        const d = r.join(Na);
        return (m = s.validators.find(({
            validator: p
        }) => p(d))) == null ? void 0 : m.classGroupId
    },
    Uf = /^\[(.+)\]$/,
    ov = r => {
        if (Uf.test(r)) {
            const s = Uf.exec(r)[1],
                i = s == null ? void 0 : s.substring(0, s.indexOf(":"));
            if (i) return "arbitrary.." + i
        }
    },
    lv = r => {
        const {
            theme: s,
            prefix: i
        } = r, u = {
            nextPart: new Map,
            validators: []
        };
        return sv(Object.entries(r.classGroups), i).forEach(([d, m]) => {
            pa(m, u, d, s)
        }), u
    },
    pa = (r, s, i, u) => {
        r.forEach(c => {
            if (typeof c == "string") {
                const d = c === "" ? s : Bf(s, c);
                d.classGroupId = i;
                return
            }
            if (typeof c == "function") {
                if (iv(c)) {
                    pa(c(u), s, i, u);
                    return
                }
                s.validators.push({
                    validator: c,
                    classGroupId: i
                });
                return
            }
            Object.entries(c).forEach(([d, m]) => {
                pa(m, Bf(s, d), i, u)
            })
        })
    },
    Bf = (r, s) => {
        let i = r;
        return s.split(Na).forEach(u => {
            i.nextPart.has(u) || i.nextPart.set(u, {
                nextPart: new Map,
                validators: []
            }), i = i.nextPart.get(u)
        }), i
    },
    iv = r => r.isThemeGetter,
    sv = (r, s) => s ? r.map(([i, u]) => {
        const c = u.map(d => typeof d == "string" ? s + d : typeof d == "object" ? Object.fromEntries(Object.entries(d).map(([m, p]) => [s + m, p])) : d);
        return [i, c]
    }) : r,
    av = r => {
        if (r < 1) return {
            get: () => {},
            set: () => {}
        };
        let s = 0,
            i = new Map,
            u = new Map;
        const c = (d, m) => {
            i.set(d, m), s++, s > r && (s = 0, u = i, i = new Map)
        };
        return {
            get(d) {
                let m = i.get(d);
                if (m !== void 0) return m;
                if ((m = u.get(d)) !== void 0) return c(d, m), m
            },
            set(d, m) {
                i.has(d) ? i.set(d, m) : c(d, m)
            }
        }
    },
    wd = "!",
    uv = r => {
        const {
            separator: s,
            experimentalParseClassName: i
        } = r, u = s.length === 1, c = s[0], d = s.length, m = p => {
            const h = [];
            let y = 0,
                S = 0,
                C;
            for (let N = 0; N < p.length; N++) {
                let M = p[N];
                if (y === 0) {
                    if (M === c && (u || p.slice(N, N + d) === s)) {
                        h.push(p.slice(S, N)), S = N + d;
                        continue
                    }
                    if (M === "/") {
                        C = N;
                        continue
                    }
                }
                M === "[" ? y++ : M === "]" && y--
            }
            const R = h.length === 0 ? p : p.substring(S),
                _ = R.startsWith(wd),
                A = _ ? R.substring(1) : R,
                w = C && C > S ? C - S : void 0;
            return {
                modifiers: h,
                hasImportantModifier: _,
                baseClassName: A,
                maybePostfixModifierPosition: w
            }
        };
        return i ? p => i({
            className: p,
            parseClassName: m
        }) : m
    },
    cv = r => {
        if (r.length <= 1) return r;
        const s = [];
        let i = [];
        return r.forEach(u => {
            u[0] === "[" ? (s.push(...i.sort(), u), i = []) : i.push(u)
        }), s.push(...i.sort()), s
    },
    fv = r => ({
        cache: av(r.cacheSize),
        parseClassName: uv(r),
        ...rv(r)
    }),
    dv = /\s+/,
    pv = (r, s) => {
        const {
            parseClassName: i,
            getClassGroupId: u,
            getConflictingClassGroupIds: c
        } = s, d = [], m = r.trim().split(dv);
        let p = "";
        for (let h = m.length - 1; h >= 0; h -= 1) {
            const y = m[h],
                {
                    modifiers: S,
                    hasImportantModifier: C,
                    baseClassName: R,
                    maybePostfixModifierPosition: _
                } = i(y);
            let A = !!_,
                w = u(A ? R.substring(0, _) : R);
            if (!w) {
                if (!A) {
                    p = y + (p.length > 0 ? " " + p : p);
                    continue
                }
                if (w = u(R), !w) {
                    p = y + (p.length > 0 ? " " + p : p);
                    continue
                }
                A = !1
            }
            const N = cv(S).join(":"),
                M = C ? N + wd : N,
                O = M + w;
            if (d.includes(O)) continue;
            d.push(O);
            const z = c(w, A);
            for (let F = 0; F < z.length; ++F) {
                const W = z[F];
                d.push(M + W)
            }
            p = y + (p.length > 0 ? " " + p : p)
        }
        return p
    };

function mv() {
    let r = 0,
        s, i, u = "";
    for (; r < arguments.length;)(s = arguments[r++]) && (i = xd(s)) && (u && (u += " "), u += i);
    return u
}
const xd = r => {
    if (typeof r == "string") return r;
    let s, i = "";
    for (let u = 0; u < r.length; u++) r[u] && (s = xd(r[u])) && (i && (i += " "), i += s);
    return i
};

function hv(r, ...s) {
    let i, u, c, d = m;

    function m(h) {
        const y = s.reduce((S, C) => C(S), r());
        return i = fv(y), u = i.cache.get, c = i.cache.set, d = p, p(h)
    }

    function p(h) {
        const y = u(h);
        if (y) return y;
        const S = pv(h, i);
        return c(h, S), S
    }
    return function() {
        return d(mv.apply(null, arguments))
    }
}
const Ie = r => {
        const s = i => i[r] || [];
        return s.isThemeGetter = !0, s
    },
    Sd = /^\[(?:([a-z-]+):)?(.+)\]$/i,
    vv = /^\d+\/\d+$/,
    gv = new Set(["px", "full", "screen"]),
    yv = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/,
    wv = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/,
    xv = /^(rgba?|hsla?|hwb|(ok)?(lab|lch))\(.+\)$/,
    Sv = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/,
    Cv = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/,
    Zt = r => Er(r) || gv.has(r) || vv.test(r),
    kn = r => Rr(r, "length", Iv),
    Er = r => !!r && !Number.isNaN(Number(r)),
    ra = r => Rr(r, "number", Er),
    yo = r => !!r && Number.isInteger(Number(r)),
    Ev = r => r.endsWith("%") && Er(r.slice(0, -1)),
    we = r => Sd.test(r),
    Pn = r => yv.test(r),
    kv = new Set(["length", "size", "percentage"]),
    Pv = r => Rr(r, kv, Cd),
    Nv = r => Rr(r, "position", Cd),
    Rv = new Set(["image", "url"]),
    Tv = r => Rr(r, Rv, Ov),
    _v = r => Rr(r, "", Lv),
    wo = () => !0,
    Rr = (r, s, i) => {
        const u = Sd.exec(r);
        return u ? u[1] ? typeof s == "string" ? u[1] === s : s.has(u[1]) : i(u[2]) : !1
    },
    Iv = r => wv.test(r) && !xv.test(r),
    Cd = () => !1,
    Lv = r => Sv.test(r),
    Ov = r => Cv.test(r),
    Mv = () => {
        const r = Ie("colors"),
            s = Ie("spacing"),
            i = Ie("blur"),
            u = Ie("brightness"),
            c = Ie("borderColor"),
            d = Ie("borderRadius"),
            m = Ie("borderSpacing"),
            p = Ie("borderWidth"),
            h = Ie("contrast"),
            y = Ie("grayscale"),
            S = Ie("hueRotate"),
            C = Ie("invert"),
            R = Ie("gap"),
            _ = Ie("gradientColorStops"),
            A = Ie("gradientColorStopPositions"),
            w = Ie("inset"),
            N = Ie("margin"),
            M = Ie("opacity"),
            O = Ie("padding"),
            z = Ie("saturate"),
            F = Ie("scale"),
            W = Ie("sepia"),
            G = Ie("skew"),
            K = Ie("space"),
            re = Ie("translate"),
            pe = () => ["auto", "contain", "none"],
            se = () => ["auto", "hidden", "clip", "visible", "scroll"],
            ve = () => ["auto", we, s],
            Z = () => [we, s],
            ae = () => ["", Zt, kn],
            fe = () => ["auto", Er, we],
            me = () => ["bottom", "center", "left", "left-bottom", "left-top", "right", "right-bottom", "right-top", "top"],
            oe = () => ["solid", "dashed", "dotted", "double", "none"],
            ee = () => ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"],
            j = () => ["start", "end", "center", "between", "around", "evenly", "stretch"],
            $ = () => ["", "0", we],
            V = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"],
            E = () => [Er, we];
        return {
            cacheSize: 500,
            separator: ":",
            theme: {
                colors: [wo],
                spacing: [Zt, kn],
                blur: ["none", "", Pn, we],
                brightness: E(),
                borderColor: [r],
                borderRadius: ["none", "", "full", Pn, we],
                borderSpacing: Z(),
                borderWidth: ae(),
                contrast: E(),
                grayscale: $(),
                hueRotate: E(),
                invert: $(),
                gap: Z(),
                gradientColorStops: [r],
                gradientColorStopPositions: [Ev, kn],
                inset: ve(),
                margin: ve(),
                opacity: E(),
                padding: Z(),
                saturate: E(),
                scale: E(),
                sepia: $(),
                skew: E(),
                space: Z(),
                translate: Z()
            },
            classGroups: {
                aspect: [{
                    aspect: ["auto", "square", "video", we]
                }],
                container: ["container"],
                columns: [{
                    columns: [Pn]
                }],
                "break-after": [{
                    "break-after": V()
                }],
                "break-before": [{
                    "break-before": V()
                }],
                "break-inside": [{
                    "break-inside": ["auto", "avoid", "avoid-page", "avoid-column"]
                }],
                "box-decoration": [{
                    "box-decoration": ["slice", "clone"]
                }],
                box: [{
                    box: ["border", "content"]
                }],
                display: ["block", "inline-block", "inline", "flex", "inline-flex", "table", "inline-table", "table-caption", "table-cell", "table-column", "table-column-group", "table-footer-group", "table-header-group", "table-row-group", "table-row", "flow-root", "grid", "inline-grid", "contents", "list-item", "hidden"],
                float: [{
                    float: ["right", "left", "none", "start", "end"]
                }],
                clear: [{
                    clear: ["left", "right", "both", "none", "start", "end"]
                }],
                isolation: ["isolate", "isolation-auto"],
                "object-fit": [{
                    object: ["contain", "cover", "fill", "none", "scale-down"]
                }],
                "object-position": [{
                    object: [...me(), we]
                }],
                overflow: [{
                    overflow: se()
                }],
                "overflow-x": [{
                    "overflow-x": se()
                }],
                "overflow-y": [{
                    "overflow-y": se()
                }],
                overscroll: [{
                    overscroll: pe()
                }],
                "overscroll-x": [{
                    "overscroll-x": pe()
                }],
                "overscroll-y": [{
                    "overscroll-y": pe()
                }],
                position: ["static", "fixed", "absolute", "relative", "sticky"],
                inset: [{
                    inset: [w]
                }],
                "inset-x": [{
                    "inset-x": [w]
                }],
                "inset-y": [{
                    "inset-y": [w]
                }],
                start: [{
                    start: [w]
                }],
                end: [{
                    end: [w]
                }],
                top: [{
                    top: [w]
                }],
                right: [{
                    right: [w]
                }],
                bottom: [{
                    bottom: [w]
                }],
                left: [{
                    left: [w]
                }],
                visibility: ["visible", "invisible", "collapse"],
                z: [{
                    z: ["auto", yo, we]
                }],
                basis: [{
                    basis: ve()
                }],
                "flex-direction": [{
                    flex: ["row", "row-reverse", "col", "col-reverse"]
                }],
                "flex-wrap": [{
                    flex: ["wrap", "wrap-reverse", "nowrap"]
                }],
                flex: [{
                    flex: ["1", "auto", "initial", "none", we]
                }],
                grow: [{
                    grow: $()
                }],
                shrink: [{
                    shrink: $()
                }],
                order: [{
                    order: ["first", "last", "none", yo, we]
                }],
                "grid-cols": [{
                    "grid-cols": [wo]
                }],
                "col-start-end": [{
                    col: ["auto", {
                        span: ["full", yo, we]
                    }, we]
                }],
                "col-start": [{
                    "col-start": fe()
                }],
                "col-end": [{
                    "col-end": fe()
                }],
                "grid-rows": [{
                    "grid-rows": [wo]
                }],
                "row-start-end": [{
                    row: ["auto", {
                        span: [yo, we]
                    }, we]
                }],
                "row-start": [{
                    "row-start": fe()
                }],
                "row-end": [{
                    "row-end": fe()
                }],
                "grid-flow": [{
                    "grid-flow": ["row", "col", "dense", "row-dense", "col-dense"]
                }],
                "auto-cols": [{
                    "auto-cols": ["auto", "min", "max", "fr", we]
                }],
                "auto-rows": [{
                    "auto-rows": ["auto", "min", "max", "fr", we]
                }],
                gap: [{
                    gap: [R]
                }],
                "gap-x": [{
                    "gap-x": [R]
                }],
                "gap-y": [{
                    "gap-y": [R]
                }],
                "justify-content": [{
                    justify: ["normal", ...j()]
                }],
                "justify-items": [{
                    "justify-items": ["start", "end", "center", "stretch"]
                }],
                "justify-self": [{
                    "justify-self": ["auto", "start", "end", "center", "stretch"]
                }],
                "align-content": [{
                    content: ["normal", ...j(), "baseline"]
                }],
                "align-items": [{
                    items: ["start", "end", "center", "baseline", "stretch"]
                }],
                "align-self": [{
                    self: ["auto", "start", "end", "center", "stretch", "baseline"]
                }],
                "place-content": [{
                    "place-content": [...j(), "baseline"]
                }],
                "place-items": [{
                    "place-items": ["start", "end", "center", "baseline", "stretch"]
                }],
                "place-self": [{
                    "place-self": ["auto", "start", "end", "center", "stretch"]
                }],
                p: [{
                    p: [O]
                }],
                px: [{
                    px: [O]
                }],
                py: [{
                    py: [O]
                }],
                ps: [{
                    ps: [O]
                }],
                pe: [{
                    pe: [O]
                }],
                pt: [{
                    pt: [O]
                }],
                pr: [{
                    pr: [O]
                }],
                pb: [{
                    pb: [O]
                }],
                pl: [{
                    pl: [O]
                }],
                m: [{
                    m: [N]
                }],
                mx: [{
                    mx: [N]
                }],
                my: [{
                    my: [N]
                }],
                ms: [{
                    ms: [N]
                }],
                me: [{
                    me: [N]
                }],
                mt: [{
                    mt: [N]
                }],
                mr: [{
                    mr: [N]
                }],
                mb: [{
                    mb: [N]
                }],
                ml: [{
                    ml: [N]
                }],
                "space-x": [{
                    "space-x": [K]
                }],
                "space-x-reverse": ["space-x-reverse"],
                "space-y": [{
                    "space-y": [K]
                }],
                "space-y-reverse": ["space-y-reverse"],
                w: [{
                    w: ["auto", "min", "max", "fit", "svw", "lvw", "dvw", we, s]
                }],
                "min-w": [{
                    "min-w": [we, s, "min", "max", "fit"]
                }],
                "max-w": [{
                    "max-w": [we, s, "none", "full", "min", "max", "fit", "prose", {
                        screen: [Pn]
                    }, Pn]
                }],
                h: [{
                    h: [we, s, "auto", "min", "max", "fit", "svh", "lvh", "dvh"]
                }],
                "min-h": [{
                    "min-h": [we, s, "min", "max", "fit", "svh", "lvh", "dvh"]
                }],
                "max-h": [{
                    "max-h": [we, s, "min", "max", "fit", "svh", "lvh", "dvh"]
                }],
                size: [{
                    size: [we, s, "auto", "min", "max", "fit"]
                }],
                "font-size": [{
                    text: ["base", Pn, kn]
                }],
                "font-smoothing": ["antialiased", "subpixel-antialiased"],
                "font-style": ["italic", "not-italic"],
                "font-weight": [{
                    font: ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black", ra]
                }],
                "font-family": [{
                    font: [wo]
                }],
                "fvn-normal": ["normal-nums"],
                "fvn-ordinal": ["ordinal"],
                "fvn-slashed-zero": ["slashed-zero"],
                "fvn-figure": ["lining-nums", "oldstyle-nums"],
                "fvn-spacing": ["proportional-nums", "tabular-nums"],
                "fvn-fraction": ["diagonal-fractions", "stacked-fractions"],
                tracking: [{
                    tracking: ["tighter", "tight", "normal", "wide", "wider", "widest", we]
                }],
                "line-clamp": [{
                    "line-clamp": ["none", Er, ra]
                }],
                leading: [{
                    leading: ["none", "tight", "snug", "normal", "relaxed", "loose", Zt, we]
                }],
                "list-image": [{
                    "list-image": ["none", we]
                }],
                "list-style-type": [{
                    list: ["none", "disc", "decimal", we]
                }],
                "list-style-position": [{
                    list: ["inside", "outside"]
                }],
                "placeholder-color": [{
                    placeholder: [r]
                }],
                "placeholder-opacity": [{
                    "placeholder-opacity": [M]
                }],
                "text-alignment": [{
                    text: ["left", "center", "right", "justify", "start", "end"]
                }],
                "text-color": [{
                    text: [r]
                }],
                "text-opacity": [{
                    "text-opacity": [M]
                }],
                "text-decoration": ["underline", "overline", "line-through", "no-underline"],
                "text-decoration-style": [{
                    decoration: [...oe(), "wavy"]
                }],
                "text-decoration-thickness": [{
                    decoration: ["auto", "from-font", Zt, kn]
                }],
                "underline-offset": [{
                    "underline-offset": ["auto", Zt, we]
                }],
                "text-decoration-color": [{
                    decoration: [r]
                }],
                "text-transform": ["uppercase", "lowercase", "capitalize", "normal-case"],
                "text-overflow": ["truncate", "text-ellipsis", "text-clip"],
                "text-wrap": [{
                    text: ["wrap", "nowrap", "balance", "pretty"]
                }],
                indent: [{
                    indent: Z()
                }],
                "vertical-align": [{
                    align: ["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super", we]
                }],
                whitespace: [{
                    whitespace: ["normal", "nowrap", "pre", "pre-line", "pre-wrap", "break-spaces"]
                }],
                break: [{
                    break: ["normal", "words", "all", "keep"]
                }],
                hyphens: [{
                    hyphens: ["none", "manual", "auto"]
                }],
                content: [{
                    content: ["none", we]
                }],
                "bg-attachment": [{
                    bg: ["fixed", "local", "scroll"]
                }],
                "bg-clip": [{
                    "bg-clip": ["border", "padding", "content", "text"]
                }],
                "bg-opacity": [{
                    "bg-opacity": [M]
                }],
                "bg-origin": [{
                    "bg-origin": ["border", "padding", "content"]
                }],
                "bg-position": [{
                    bg: [...me(), Nv]
                }],
                "bg-repeat": [{
                    bg: ["no-repeat", {
                        repeat: ["", "x", "y", "round", "space"]
                    }]
                }],
                "bg-size": [{
                    bg: ["auto", "cover", "contain", Pv]
                }],
                "bg-image": [{
                    bg: ["none", {
                        "gradient-to": ["t", "tr", "r", "br", "b", "bl", "l", "tl"]
                    }, Tv]
                }],
                "bg-color": [{
                    bg: [r]
                }],
                "gradient-from-pos": [{
                    from: [A]
                }],
                "gradient-via-pos": [{
                    via: [A]
                }],
                "gradient-to-pos": [{
                    to: [A]
                }],
                "gradient-from": [{
                    from: [_]
                }],
                "gradient-via": [{
                    via: [_]
                }],
                "gradient-to": [{
                    to: [_]
                }],
                rounded: [{
                    rounded: [d]
                }],
                "rounded-s": [{
                    "rounded-s": [d]
                }],
                "rounded-e": [{
                    "rounded-e": [d]
                }],
                "rounded-t": [{
                    "rounded-t": [d]
                }],
                "rounded-r": [{
                    "rounded-r": [d]
                }],
                "rounded-b": [{
                    "rounded-b": [d]
                }],
                "rounded-l": [{
                    "rounded-l": [d]
                }],
                "rounded-ss": [{
                    "rounded-ss": [d]
                }],
                "rounded-se": [{
                    "rounded-se": [d]
                }],
                "rounded-ee": [{
                    "rounded-ee": [d]
                }],
                "rounded-es": [{
                    "rounded-es": [d]
                }],
                "rounded-tl": [{
                    "rounded-tl": [d]
                }],
                "rounded-tr": [{
                    "rounded-tr": [d]
                }],
                "rounded-br": [{
                    "rounded-br": [d]
                }],
                "rounded-bl": [{
                    "rounded-bl": [d]
                }],
                "border-w": [{
                    border: [p]
                }],
                "border-w-x": [{
                    "border-x": [p]
                }],
                "border-w-y": [{
                    "border-y": [p]
                }],
                "border-w-s": [{
                    "border-s": [p]
                }],
                "border-w-e": [{
                    "border-e": [p]
                }],
                "border-w-t": [{
                    "border-t": [p]
                }],
                "border-w-r": [{
                    "border-r": [p]
                }],
                "border-w-b": [{
                    "border-b": [p]
                }],
                "border-w-l": [{
                    "border-l": [p]
                }],
                "border-opacity": [{
                    "border-opacity": [M]
                }],
                "border-style": [{
                    border: [...oe(), "hidden"]
                }],
                "divide-x": [{
                    "divide-x": [p]
                }],
                "divide-x-reverse": ["divide-x-reverse"],
                "divide-y": [{
                    "divide-y": [p]
                }],
                "divide-y-reverse": ["divide-y-reverse"],
                "divide-opacity": [{
                    "divide-opacity": [M]
                }],
                "divide-style": [{
                    divide: oe()
                }],
                "border-color": [{
                    border: [c]
                }],
                "border-color-x": [{
                    "border-x": [c]
                }],
                "border-color-y": [{
                    "border-y": [c]
                }],
                "border-color-s": [{
                    "border-s": [c]
                }],
                "border-color-e": [{
                    "border-e": [c]
                }],
                "border-color-t": [{
                    "border-t": [c]
                }],
                "border-color-r": [{
                    "border-r": [c]
                }],
                "border-color-b": [{
                    "border-b": [c]
                }],
                "border-color-l": [{
                    "border-l": [c]
                }],
                "divide-color": [{
                    divide: [c]
                }],
                "outline-style": [{
                    outline: ["", ...oe()]
                }],
                "outline-offset": [{
                    "outline-offset": [Zt, we]
                }],
                "outline-w": [{
                    outline: [Zt, kn]
                }],
                "outline-color": [{
                    outline: [r]
                }],
                "ring-w": [{
                    ring: ae()
                }],
                "ring-w-inset": ["ring-inset"],
                "ring-color": [{
                    ring: [r]
                }],
                "ring-opacity": [{
                    "ring-opacity": [M]
                }],
                "ring-offset-w": [{
                    "ring-offset": [Zt, kn]
                }],
                "ring-offset-color": [{
                    "ring-offset": [r]
                }],
                shadow: [{
                    shadow: ["", "inner", "none", Pn, _v]
                }],
                "shadow-color": [{
                    shadow: [wo]
                }],
                opacity: [{
                    opacity: [M]
                }],
                "mix-blend": [{
                    "mix-blend": [...ee(), "plus-lighter", "plus-darker"]
                }],
                "bg-blend": [{
                    "bg-blend": ee()
                }],
                filter: [{
                    filter: ["", "none"]
                }],
                blur: [{
                    blur: [i]
                }],
                brightness: [{
                    brightness: [u]
                }],
                contrast: [{
                    contrast: [h]
                }],
                "drop-shadow": [{
                    "drop-shadow": ["", "none", Pn, we]
                }],
                grayscale: [{
                    grayscale: [y]
                }],
                "hue-rotate": [{
                    "hue-rotate": [S]
                }],
                invert: [{
                    invert: [C]
                }],
                saturate: [{
                    saturate: [z]
                }],
                sepia: [{
                    sepia: [W]
                }],
                "backdrop-filter": [{
                    "backdrop-filter": ["", "none"]
                }],
                "backdrop-blur": [{
                    "backdrop-blur": [i]
                }],
                "backdrop-brightness": [{
                    "backdrop-brightness": [u]
                }],
                "backdrop-contrast": [{
                    "backdrop-contrast": [h]
                }],
                "backdrop-grayscale": [{
                    "backdrop-grayscale": [y]
                }],
                "backdrop-hue-rotate": [{
                    "backdrop-hue-rotate": [S]
                }],
                "backdrop-invert": [{
                    "backdrop-invert": [C]
                }],
                "backdrop-opacity": [{
                    "backdrop-opacity": [M]
                }],
                "backdrop-saturate": [{
                    "backdrop-saturate": [z]
                }],
                "backdrop-sepia": [{
                    "backdrop-sepia": [W]
                }],
                "border-collapse": [{
                    border: ["collapse", "separate"]
                }],
                "border-spacing": [{
                    "border-spacing": [m]
                }],
                "border-spacing-x": [{
                    "border-spacing-x": [m]
                }],
                "border-spacing-y": [{
                    "border-spacing-y": [m]
                }],
                "table-layout": [{
                    table: ["auto", "fixed"]
                }],
                caption: [{
                    caption: ["top", "bottom"]
                }],
                transition: [{
                    transition: ["none", "all", "", "colors", "opacity", "shadow", "transform", we]
                }],
                duration: [{
                    duration: E()
                }],
                ease: [{
                    ease: ["linear", "in", "out", "in-out", we]
                }],
                delay: [{
                    delay: E()
                }],
                animate: [{
                    animate: ["none", "spin", "ping", "pulse", "bounce", we]
                }],
                transform: [{
                    transform: ["", "gpu", "none"]
                }],
                scale: [{
                    scale: [F]
                }],
                "scale-x": [{
                    "scale-x": [F]
                }],
                "scale-y": [{
                    "scale-y": [F]
                }],
                rotate: [{
                    rotate: [yo, we]
                }],
                "translate-x": [{
                    "translate-x": [re]
                }],
                "translate-y": [{
                    "translate-y": [re]
                }],
                "skew-x": [{
                    "skew-x": [G]
                }],
                "skew-y": [{
                    "skew-y": [G]
                }],
                "transform-origin": [{
                    origin: ["center", "top", "top-right", "right", "bottom-right", "bottom", "bottom-left", "left", "top-left", we]
                }],
                accent: [{
                    accent: ["auto", r]
                }],
                appearance: [{
                    appearance: ["none", "auto"]
                }],
                cursor: [{
                    cursor: ["auto", "default", "pointer", "wait", "text", "move", "help", "not-allowed", "none", "context-menu", "progress", "cell", "crosshair", "vertical-text", "alias", "copy", "no-drop", "grab", "grabbing", "all-scroll", "col-resize", "row-resize", "n-resize", "e-resize", "s-resize", "w-resize", "ne-resize", "nw-resize", "se-resize", "sw-resize", "ew-resize", "ns-resize", "nesw-resize", "nwse-resize", "zoom-in", "zoom-out", we]
                }],
                "caret-color": [{
                    caret: [r]
                }],
                "pointer-events": [{
                    "pointer-events": ["none", "auto"]
                }],
                resize: [{
                    resize: ["none", "y", "x", ""]
                }],
                "scroll-behavior": [{
                    scroll: ["auto", "smooth"]
                }],
                "scroll-m": [{
                    "scroll-m": Z()
                }],
                "scroll-mx": [{
                    "scroll-mx": Z()
                }],
                "scroll-my": [{
                    "scroll-my": Z()
                }],
                "scroll-ms": [{
                    "scroll-ms": Z()
                }],
                "scroll-me": [{
                    "scroll-me": Z()
                }],
                "scroll-mt": [{
                    "scroll-mt": Z()
                }],
                "scroll-mr": [{
                    "scroll-mr": Z()
                }],
                "scroll-mb": [{
                    "scroll-mb": Z()
                }],
                "scroll-ml": [{
                    "scroll-ml": Z()
                }],
                "scroll-p": [{
                    "scroll-p": Z()
                }],
                "scroll-px": [{
                    "scroll-px": Z()
                }],
                "scroll-py": [{
                    "scroll-py": Z()
                }],
                "scroll-ps": [{
                    "scroll-ps": Z()
                }],
                "scroll-pe": [{
                    "scroll-pe": Z()
                }],
                "scroll-pt": [{
                    "scroll-pt": Z()
                }],
                "scroll-pr": [{
                    "scroll-pr": Z()
                }],
                "scroll-pb": [{
                    "scroll-pb": Z()
                }],
                "scroll-pl": [{
                    "scroll-pl": Z()
                }],
                "snap-align": [{
                    snap: ["start", "end", "center", "align-none"]
                }],
                "snap-stop": [{
                    snap: ["normal", "always"]
                }],
                "snap-type": [{
                    snap: ["none", "x", "y", "both"]
                }],
                "snap-strictness": [{
                    snap: ["mandatory", "proximity"]
                }],
                touch: [{
                    touch: ["auto", "none", "manipulation"]
                }],
                "touch-x": [{
                    "touch-pan": ["x", "left", "right"]
                }],
                "touch-y": [{
                    "touch-pan": ["y", "up", "down"]
                }],
                "touch-pz": ["touch-pinch-zoom"],
                select: [{
                    select: ["none", "text", "all", "auto"]
                }],
                "will-change": [{
                    "will-change": ["auto", "scroll", "contents", "transform", we]
                }],
                fill: [{
                    fill: [r, "none"]
                }],
                "stroke-w": [{
                    stroke: [Zt, kn, ra]
                }],
                stroke: [{
                    stroke: [r, "none"]
                }],
                sr: ["sr-only", "not-sr-only"],
                "forced-color-adjust": [{
                    "forced-color-adjust": ["auto", "none"]
                }]
            },
            conflictingClassGroups: {
                overflow: ["overflow-x", "overflow-y"],
                overscroll: ["overscroll-x", "overscroll-y"],
                inset: ["inset-x", "inset-y", "start", "end", "top", "right", "bottom", "left"],
                "inset-x": ["right", "left"],
                "inset-y": ["top", "bottom"],
                flex: ["basis", "grow", "shrink"],
                gap: ["gap-x", "gap-y"],
                p: ["px", "py", "ps", "pe", "pt", "pr", "pb", "pl"],
                px: ["pr", "pl"],
                py: ["pt", "pb"],
                m: ["mx", "my", "ms", "me", "mt", "mr", "mb", "ml"],
                mx: ["mr", "ml"],
                my: ["mt", "mb"],
                size: ["w", "h"],
                "font-size": ["leading"],
                "fvn-normal": ["fvn-ordinal", "fvn-slashed-zero", "fvn-figure", "fvn-spacing", "fvn-fraction"],
                "fvn-ordinal": ["fvn-normal"],
                "fvn-slashed-zero": ["fvn-normal"],
                "fvn-figure": ["fvn-normal"],
                "fvn-spacing": ["fvn-normal"],
                "fvn-fraction": ["fvn-normal"],
                "line-clamp": ["display", "overflow"],
                rounded: ["rounded-s", "rounded-e", "rounded-t", "rounded-r", "rounded-b", "rounded-l", "rounded-ss", "rounded-se", "rounded-ee", "rounded-es", "rounded-tl", "rounded-tr", "rounded-br", "rounded-bl"],
                "rounded-s": ["rounded-ss", "rounded-es"],
                "rounded-e": ["rounded-se", "rounded-ee"],
                "rounded-t": ["rounded-tl", "rounded-tr"],
                "rounded-r": ["rounded-tr", "rounded-br"],
                "rounded-b": ["rounded-br", "rounded-bl"],
                "rounded-l": ["rounded-tl", "rounded-bl"],
                "border-spacing": ["border-spacing-x", "border-spacing-y"],
                "border-w": ["border-w-s", "border-w-e", "border-w-t", "border-w-r", "border-w-b", "border-w-l"],
                "border-w-x": ["border-w-r", "border-w-l"],
                "border-w-y": ["border-w-t", "border-w-b"],
                "border-color": ["border-color-s", "border-color-e", "border-color-t", "border-color-r", "border-color-b", "border-color-l"],
                "border-color-x": ["border-color-r", "border-color-l"],
                "border-color-y": ["border-color-t", "border-color-b"],
                "scroll-m": ["scroll-mx", "scroll-my", "scroll-ms", "scroll-me", "scroll-mt", "scroll-mr", "scroll-mb", "scroll-ml"],
                "scroll-mx": ["scroll-mr", "scroll-ml"],
                "scroll-my": ["scroll-mt", "scroll-mb"],
                "scroll-p": ["scroll-px", "scroll-py", "scroll-ps", "scroll-pe", "scroll-pt", "scroll-pr", "scroll-pb", "scroll-pl"],
                "scroll-px": ["scroll-pr", "scroll-pl"],
                "scroll-py": ["scroll-pt", "scroll-pb"],
                touch: ["touch-x", "touch-y", "touch-pz"],
                "touch-x": ["touch"],
                "touch-y": ["touch"],
                "touch-pz": ["touch"]
            },
            conflictingClassGroupModifiers: {
                "font-size": ["leading"]
            }
        }
    },
    Av = hv(Mv);

function et(...r) {
    return Av(gd(r))
}
const Ed = g.forwardRef(({
    className: r,
    type: s,
    ...i
}, u) => P.jsx("input", {
    type: s,
    className: et("flex h-9 w-full rounded-md border border-zinc-200 bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-zinc-950 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:border-zinc-800 dark:file:text-zinc-50 dark:placeholder:text-zinc-400 dark:focus-visible:ring-zinc-300", r),
    ref: u,
    ...i
}));
Ed.displayName = "Input";
var ko = hd();
const zv = pd(ko);

function Vf(r, s) {
    if (typeof r == "function") return r(s);
    r != null && (r.current = s)
}

function kd(...r) {
    return s => {
        let i = !1;
        const u = r.map(c => {
            const d = Vf(c, s);
            return !i && typeof d == "function" && (i = !0), d
        });
        if (i) return () => {
            for (let c = 0; c < u.length; c++) {
                const d = u[c];
                typeof d == "function" ? d() : Vf(r[c], null)
            }
        }
    }
}

function Ye(...r) {
    return g.useCallback(kd(...r), r)
}

function Yl(r) {
    const s = jv(r),
        i = g.forwardRef((u, c) => {
            const {
                children: d,
                ...m
            } = u, p = g.Children.toArray(d), h = p.find(Fv);
            if (h) {
                const y = h.props.children,
                    S = p.map(C => C === h ? g.Children.count(y) > 1 ? g.Children.only(null) : g.isValidElement(y) ? y.props.children : null : C);
                return P.jsx(s, {
                    ...m,
                    ref: c,
                    children: g.isValidElement(y) ? g.cloneElement(y, void 0, S) : null
                })
            }
            return P.jsx(s, {
                ...m,
                ref: c,
                children: d
            })
        });
    return i.displayName = `${r}.Slot`, i
}

function jv(r) {
    const s = g.forwardRef((i, u) => {
        const {
            children: c,
            ...d
        } = i;
        if (g.isValidElement(c)) {
            const m = Uv(c),
                p = bv(d, c.props);
            return c.type !== g.Fragment && (p.ref = u ? kd(u, m) : m), g.cloneElement(c, p)
        }
        return g.Children.count(c) > 1 ? g.Children.only(null) : null
    });
    return s.displayName = `${r}.SlotClone`, s
}
var Dv = Symbol("radix.slottable");

function Fv(r) {
    return g.isValidElement(r) && typeof r.type == "function" && "__radixId" in r.type && r.type.__radixId === Dv
}

function bv(r, s) {
    const i = {
        ...s
    };
    for (const u in s) {
        const c = r[u],
            d = s[u];
        /^on[A-Z]/.test(u) ? c && d ? i[u] = (...p) => {
            d(...p), c(...p)
        } : c && (i[u] = c) : u === "style" ? i[u] = {
            ...c,
            ...d
        } : u === "className" && (i[u] = [c, d].filter(Boolean).join(" "))
    }
    return {
        ...r,
        ...i
    }
}

function Uv(r) {
    var u, c;
    let s = (u = Object.getOwnPropertyDescriptor(r.props, "ref")) == null ? void 0 : u.get,
        i = s && "isReactWarning" in s && s.isReactWarning;
    return i ? r.ref : (s = (c = Object.getOwnPropertyDescriptor(r, "ref")) == null ? void 0 : c.get, i = s && "isReactWarning" in s && s.isReactWarning, i ? r.props.ref : r.props.ref || r.ref)
}
var Bv = ["a", "button", "div", "form", "h2", "h3", "img", "input", "label", "li", "nav", "ol", "p", "select", "span", "svg", "ul"],
    ze = Bv.reduce((r, s) => {
        const i = Yl(`Primitive.${s}`),
            u = g.forwardRef((c, d) => {
                const {
                    asChild: m,
                    ...p
                } = c, h = m ? i : s;
                return typeof window < "u" && (window[Symbol.for("radix-ui")] = !0), P.jsx(h, {
                    ...p,
                    ref: d
                })
            });
        return u.displayName = `Primitive.${s}`, {
            ...r,
            [s]: u
        }
    }, {});

function Vv(r, s) {
    r && ko.flushSync(() => r.dispatchEvent(s))
}
var Wv = "Label",
    Pd = g.forwardRef((r, s) => P.jsx(ze.label, {
        ...r,
        ref: s,
        onMouseDown: i => {
            var c;
            i.target.closest("button, input, select, textarea") || ((c = r.onMouseDown) == null || c.call(r, i), !i.defaultPrevented && i.detail > 1 && i.preventDefault())
        }
    }));
Pd.displayName = Wv;
var Nd = Pd;
const Hv = gd,
    $v = (r, s) => i => Hv(r, i == null ? void 0 : i.class, i == null ? void 0 : i.className),
    Kv = $v("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"),
    Rd = g.forwardRef(({
        className: r,
        ...s
    }, i) => P.jsx(Nd, {
        ref: i,
        className: et(Kv(), r),
        ...s
    }));
Rd.displayName = Nd.displayName;
const Bl = g.forwardRef(({
    className: r,
    ...s
}, i) => P.jsx("div", {
    ref: i,
    className: et("rounded-xl border border-zinc-200 bg-white text-zinc-950 shadow dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50", r),
    ...s
}));
Bl.displayName = "Card";
const Vl = g.forwardRef(({
    className: r,
    ...s
}, i) => P.jsx("div", {
    ref: i,
    className: et("flex flex-col space-y-1.5 p-6", r),
    ...s
}));
Vl.displayName = "CardHeader";
const Wl = g.forwardRef(({
    className: r,
    ...s
}, i) => P.jsx("div", {
    ref: i,
    className: et("font-semibold leading-none tracking-tight", r),
    ...s
}));
Wl.displayName = "CardTitle";
const ma = g.forwardRef(({
    className: r,
    ...s
}, i) => P.jsx("div", {
    ref: i,
    className: et("text-sm text-zinc-500 dark:text-zinc-400", r),
    ...s
}));
ma.displayName = "CardDescription";
const Hl = g.forwardRef(({
    className: r,
    ...s
}, i) => P.jsx("div", {
    ref: i,
    className: et("p-6 pt-0", r),
    ...s
}));
Hl.displayName = "CardContent";
const Qv = g.forwardRef(({
    className: r,
    ...s
}, i) => P.jsx("div", {
    ref: i,
    className: et("flex items-center p-6 pt-0", r),
    ...s
}));
Qv.displayName = "CardFooter";

function Wf(r, [s, i]) {
    return Math.min(i, Math.max(s, r))
}

function be(r, s, {
    checkForDefaultPrevented: i = !0
} = {}) {
    return function(c) {
        if (r == null || r(c), i === !1 || !c.defaultPrevented) return s == null ? void 0 : s(c)
    }
}

function Ra(r, s = []) {
    let i = [];

    function u(d, m) {
        const p = g.createContext(m),
            h = i.length;
        i = [...i, m];
        const y = C => {
            var M;
            const {
                scope: R,
                children: _,
                ...A
            } = C, w = ((M = R == null ? void 0 : R[r]) == null ? void 0 : M[h]) || p, N = g.useMemo(() => A, Object.values(A));
            return P.jsx(w.Provider, {
                value: N,
                children: _
            })
        };
        y.displayName = d + "Provider";

        function S(C, R) {
            var w;
            const _ = ((w = R == null ? void 0 : R[r]) == null ? void 0 : w[h]) || p,
                A = g.useContext(_);
            if (A) return A;
            if (m !== void 0) return m;
            throw new Error(`\`${C}\` must be used within \`${d}\``)
        }
        return [y, S]
    }
    const c = () => {
        const d = i.map(m => g.createContext(m));
        return function(p) {
            const h = (p == null ? void 0 : p[r]) || d;
            return g.useMemo(() => ({
                [`__scope${r}`]: {
                    ...p,
                    [r]: h
                }
            }), [p, h])
        }
    };
    return c.scopeName = r, [u, Gv(c, ...s)]
}

function Gv(...r) {
    const s = r[0];
    if (r.length === 1) return s;
    const i = () => {
        const u = r.map(c => ({
            useScope: c(),
            scopeName: c.scopeName
        }));
        return function(d) {
            const m = u.reduce((p, {
                useScope: h,
                scopeName: y
            }) => {
                const C = h(d)[`__scope${y}`];
                return {
                    ...p,
                    ...C
                }
            }, {});
            return g.useMemo(() => ({
                [`__scope${s.scopeName}`]: m
            }), [m])
        }
    };
    return i.scopeName = s.scopeName, i
}

function Yv(r) {
    const s = r + "CollectionProvider",
        [i, u] = Ra(s),
        [c, d] = i(s, {
            collectionRef: {
                current: null
            },
            itemMap: new Map
        }),
        m = w => {
            const {
                scope: N,
                children: M
            } = w, O = Nn.useRef(null), z = Nn.useRef(new Map).current;
            return P.jsx(c, {
                scope: N,
                itemMap: z,
                collectionRef: O,
                children: M
            })
        };
    m.displayName = s;
    const p = r + "CollectionSlot",
        h = Yl(p),
        y = Nn.forwardRef((w, N) => {
            const {
                scope: M,
                children: O
            } = w, z = d(p, M), F = Ye(N, z.collectionRef);
            return P.jsx(h, {
                ref: F,
                children: O
            })
        });
    y.displayName = p;
    const S = r + "CollectionItemSlot",
        C = "data-radix-collection-item",
        R = Yl(S),
        _ = Nn.forwardRef((w, N) => {
            const {
                scope: M,
                children: O,
                ...z
            } = w, F = Nn.useRef(null), W = Ye(N, F), G = d(S, M);
            return Nn.useEffect(() => (G.itemMap.set(F, {
                ref: F,
                ...z
            }), () => void G.itemMap.delete(F))), P.jsx(R, {
                [C]: "",
                ref: W,
                children: O
            })
        });
    _.displayName = S;

    function A(w) {
        const N = d(r + "CollectionConsumer", w);
        return Nn.useCallback(() => {
            const O = N.collectionRef.current;
            if (!O) return [];
            const z = Array.from(O.querySelectorAll(`[${C}]`));
            return Array.from(N.itemMap.values()).sort((G, K) => z.indexOf(G.ref.current) - z.indexOf(K.ref.current))
        }, [N.collectionRef, N.itemMap])
    }
    return [{
        Provider: m,
        Slot: y,
        ItemSlot: _
    }, A, u]
}
var Xv = g.createContext(void 0);

function Zv(r) {
    const s = g.useContext(Xv);
    return r || s || "ltr"
}

function $n(r) {
    const s = g.useRef(r);
    return g.useEffect(() => {
        s.current = r
    }), g.useMemo(() => (...i) => {
        var u;
        return (u = s.current) == null ? void 0 : u.call(s, ...i)
    }, [])
}

function qv(r, s = globalThis == null ? void 0 : globalThis.document) {
    const i = $n(r);
    g.useEffect(() => {
        const u = c => {
            c.key === "Escape" && i(c)
        };
        return s.addEventListener("keydown", u, {
            capture: !0
        }), () => s.removeEventListener("keydown", u, {
            capture: !0
        })
    }, [i, s])
}
var Jv = "DismissableLayer",
    ha = "dismissableLayer.update",
    eg = "dismissableLayer.pointerDownOutside",
    tg = "dismissableLayer.focusOutside",
    Hf, Td = g.createContext({
        layers: new Set,
        layersWithOutsidePointerEventsDisabled: new Set,
        branches: new Set
    }),
    _d = g.forwardRef((r, s) => {
        const {
            disableOutsidePointerEvents: i = !1,
            onEscapeKeyDown: u,
            onPointerDownOutside: c,
            onFocusOutside: d,
            onInteractOutside: m,
            onDismiss: p,
            ...h
        } = r, y = g.useContext(Td), [S, C] = g.useState(null), R = (S == null ? void 0 : S.ownerDocument) ?? (globalThis == null ? void 0 : globalThis.document), [, _] = g.useState({}), A = Ye(s, K => C(K)), w = Array.from(y.layers), [N] = [...y.layersWithOutsidePointerEventsDisabled].slice(-1), M = w.indexOf(N), O = S ? w.indexOf(S) : -1, z = y.layersWithOutsidePointerEventsDisabled.size > 0, F = O >= M, W = og(K => {
            const re = K.target,
                pe = [...y.branches].some(se => se.contains(re));
            !F || pe || (c == null || c(K), m == null || m(K), K.defaultPrevented || p == null || p())
        }, R), G = lg(K => {
            const re = K.target;
            [...y.branches].some(se => se.contains(re)) || (d == null || d(K), m == null || m(K), K.defaultPrevented || p == null || p())
        }, R);
        return qv(K => {
            O === y.layers.size - 1 && (u == null || u(K), !K.defaultPrevented && p && (K.preventDefault(), p()))
        }, R), g.useEffect(() => {
            if (S) return i && (y.layersWithOutsidePointerEventsDisabled.size === 0 && (Hf = R.body.style.pointerEvents, R.body.style.pointerEvents = "none"), y.layersWithOutsidePointerEventsDisabled.add(S)), y.layers.add(S), $f(), () => {
                i && y.layersWithOutsidePointerEventsDisabled.size === 1 && (R.body.style.pointerEvents = Hf)
            }
        }, [S, R, i, y]), g.useEffect(() => () => {
            S && (y.layers.delete(S), y.layersWithOutsidePointerEventsDisabled.delete(S), $f())
        }, [S, y]), g.useEffect(() => {
            const K = () => _({});
            return document.addEventListener(ha, K), () => document.removeEventListener(ha, K)
        }, []), P.jsx(ze.div, {
            ...h,
            ref: A,
            style: {
                pointerEvents: z ? F ? "auto" : "none" : void 0,
                ...r.style
            },
            onFocusCapture: be(r.onFocusCapture, G.onFocusCapture),
            onBlurCapture: be(r.onBlurCapture, G.onBlurCapture),
            onPointerDownCapture: be(r.onPointerDownCapture, W.onPointerDownCapture)
        })
    });
_d.displayName = Jv;
var ng = "DismissableLayerBranch",
    rg = g.forwardRef((r, s) => {
        const i = g.useContext(Td),
            u = g.useRef(null),
            c = Ye(s, u);
        return g.useEffect(() => {
            const d = u.current;
            if (d) return i.branches.add(d), () => {
                i.branches.delete(d)
            }
        }, [i.branches]), P.jsx(ze.div, {
            ...r,
            ref: c
        })
    });
rg.displayName = ng;

function og(r, s = globalThis == null ? void 0 : globalThis.document) {
    const i = $n(r),
        u = g.useRef(!1),
        c = g.useRef(() => {});
    return g.useEffect(() => {
        const d = p => {
                if (p.target && !u.current) {
                    let h = function() {
                        Id(eg, i, y, {
                            discrete: !0
                        })
                    };
                    const y = {
                        originalEvent: p
                    };
                    p.pointerType === "touch" ? (s.removeEventListener("click", c.current), c.current = h, s.addEventListener("click", c.current, {
                        once: !0
                    })) : h()
                } else s.removeEventListener("click", c.current);
                u.current = !1
            },
            m = window.setTimeout(() => {
                s.addEventListener("pointerdown", d)
            }, 0);
        return () => {
            window.clearTimeout(m), s.removeEventListener("pointerdown", d), s.removeEventListener("click", c.current)
        }
    }, [s, i]), {
        onPointerDownCapture: () => u.current = !0
    }
}

function lg(r, s = globalThis == null ? void 0 : globalThis.document) {
    const i = $n(r),
        u = g.useRef(!1);
    return g.useEffect(() => {
        const c = d => {
            d.target && !u.current && Id(tg, i, {
                originalEvent: d
            }, {
                discrete: !1
            })
        };
        return s.addEventListener("focusin", c), () => s.removeEventListener("focusin", c)
    }, [s, i]), {
        onFocusCapture: () => u.current = !0,
        onBlurCapture: () => u.current = !1
    }
}

function $f() {
    const r = new CustomEvent(ha);
    document.dispatchEvent(r)
}

function Id(r, s, i, {
    discrete: u
}) {
    const c = i.originalEvent.target,
        d = new CustomEvent(r, {
            bubbles: !1,
            cancelable: !0,
            detail: i
        });
    s && c.addEventListener(r, s, {
        once: !0
    }), u ? Vv(c, d) : c.dispatchEvent(d)
}
var oa = 0;

function ig() {
    g.useEffect(() => {
        const r = document.querySelectorAll("[data-radix-focus-guard]");
        return document.body.insertAdjacentElement("afterbegin", r[0] ?? Kf()), document.body.insertAdjacentElement("beforeend", r[1] ?? Kf()), oa++, () => {
            oa === 1 && document.querySelectorAll("[data-radix-focus-guard]").forEach(s => s.remove()), oa--
        }
    }, [])
}

function Kf() {
    const r = document.createElement("span");
    return r.setAttribute("data-radix-focus-guard", ""), r.tabIndex = 0, r.style.outline = "none", r.style.opacity = "0", r.style.position = "fixed", r.style.pointerEvents = "none", r
}
var la = "focusScope.autoFocusOnMount",
    ia = "focusScope.autoFocusOnUnmount",
    Qf = {
        bubbles: !1,
        cancelable: !0
    },
    sg = "FocusScope",
    Ld = g.forwardRef((r, s) => {
        const {
            loop: i = !1,
            trapped: u = !1,
            onMountAutoFocus: c,
            onUnmountAutoFocus: d,
            ...m
        } = r, [p, h] = g.useState(null), y = $n(c), S = $n(d), C = g.useRef(null), R = Ye(s, w => h(w)), _ = g.useRef({
            paused: !1,
            pause() {
                this.paused = !0
            },
            resume() {
                this.paused = !1
            }
        }).current;
        g.useEffect(() => {
            if (u) {
                let w = function(z) {
                        if (_.paused || !p) return;
                        const F = z.target;
                        p.contains(F) ? C.current = F : Rn(C.current, {
                            select: !0
                        })
                    },
                    N = function(z) {
                        if (_.paused || !p) return;
                        const F = z.relatedTarget;
                        F !== null && (p.contains(F) || Rn(C.current, {
                            select: !0
                        }))
                    },
                    M = function(z) {
                        if (document.activeElement === document.body)
                            for (const W of z) W.removedNodes.length > 0 && Rn(p)
                    };
                document.addEventListener("focusin", w), document.addEventListener("focusout", N);
                const O = new MutationObserver(M);
                return p && O.observe(p, {
                    childList: !0,
                    subtree: !0
                }), () => {
                    document.removeEventListener("focusin", w), document.removeEventListener("focusout", N), O.disconnect()
                }
            }
        }, [u, p, _.paused]), g.useEffect(() => {
            if (p) {
                Yf.add(_);
                const w = document.activeElement;
                if (!p.contains(w)) {
                    const M = new CustomEvent(la, Qf);
                    p.addEventListener(la, y), p.dispatchEvent(M), M.defaultPrevented || (ag(pg(Od(p)), {
                        select: !0
                    }), document.activeElement === w && Rn(p))
                }
                return () => {
                    p.removeEventListener(la, y), setTimeout(() => {
                        const M = new CustomEvent(ia, Qf);
                        p.addEventListener(ia, S), p.dispatchEvent(M), M.defaultPrevented || Rn(w ?? document.body, {
                            select: !0
                        }), p.removeEventListener(ia, S), Yf.remove(_)
                    }, 0)
                }
            }
        }, [p, y, S, _]);
        const A = g.useCallback(w => {
            if (!i && !u || _.paused) return;
            const N = w.key === "Tab" && !w.altKey && !w.ctrlKey && !w.metaKey,
                M = document.activeElement;
            if (N && M) {
                const O = w.currentTarget,
                    [z, F] = ug(O);
                z && F ? !w.shiftKey && M === F ? (w.preventDefault(), i && Rn(z, {
                    select: !0
                })) : w.shiftKey && M === z && (w.preventDefault(), i && Rn(F, {
                    select: !0
                })) : M === O && w.preventDefault()
            }
        }, [i, u, _.paused]);
        return P.jsx(ze.div, {
            tabIndex: -1,
            ...m,
            ref: R,
            onKeyDown: A
        })
    });
Ld.displayName = sg;

function ag(r, {
    select: s = !1
} = {}) {
    const i = document.activeElement;
    for (const u of r)
        if (Rn(u, {
                select: s
            }), document.activeElement !== i) return
}

function ug(r) {
    const s = Od(r),
        i = Gf(s, r),
        u = Gf(s.reverse(), r);
    return [i, u]
}

function Od(r) {
    const s = [],
        i = document.createTreeWalker(r, NodeFilter.SHOW_ELEMENT, {
            acceptNode: u => {
                const c = u.tagName === "INPUT" && u.type === "hidden";
                return u.disabled || u.hidden || c ? NodeFilter.FILTER_SKIP : u.tabIndex >= 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
            }
        });
    for (; i.nextNode();) s.push(i.currentNode);
    return s
}

function Gf(r, s) {
    for (const i of r)
        if (!cg(i, {
                upTo: s
            })) return i
}

function cg(r, {
    upTo: s
}) {
    if (getComputedStyle(r).visibility === "hidden") return !0;
    for (; r;) {
        if (s !== void 0 && r === s) return !1;
        if (getComputedStyle(r).display === "none") return !0;
        r = r.parentElement
    }
    return !1
}

function fg(r) {
    return r instanceof HTMLInputElement && "select" in r
}

function Rn(r, {
    select: s = !1
} = {}) {
    if (r && r.focus) {
        const i = document.activeElement;
        r.focus({
            preventScroll: !0
        }), r !== i && fg(r) && s && r.select()
    }
}
var Yf = dg();

function dg() {
    let r = [];
    return {
        add(s) {
            const i = r[0];
            s !== i && (i == null || i.pause()), r = Xf(r, s), r.unshift(s)
        },
        remove(s) {
            var i;
            r = Xf(r, s), (i = r[0]) == null || i.resume()
        }
    }
}

function Xf(r, s) {
    const i = [...r],
        u = i.indexOf(s);
    return u !== -1 && i.splice(u, 1), i
}

function pg(r) {
    return r.filter(s => s.tagName !== "A")
}
var ct = globalThis != null && globalThis.document ? g.useLayoutEffect : () => {},
    mg = md[" useId ".trim().toString()] || (() => {}),
    hg = 0;

function Ta(r) {
    const [s, i] = g.useState(mg());
    return ct(() => {
        i(u => u ?? String(hg++))
    }, [r]), s ? `radix-${s}` : ""
}
const vg = ["top", "right", "bottom", "left"],
    Tn = Math.min,
    ht = Math.max,
    Xl = Math.round,
    jl = Math.floor,
    bt = r => ({
        x: r,
        y: r
    }),
    gg = {
        left: "right",
        right: "left",
        bottom: "top",
        top: "bottom"
    },
    yg = {
        start: "end",
        end: "start"
    };

function va(r, s, i) {
    return ht(r, Tn(s, i))
}

function Jt(r, s) {
    return typeof r == "function" ? r(s) : r
}

function en(r) {
    return r.split("-")[0]
}

function Tr(r) {
    return r.split("-")[1]
}

function _a(r) {
    return r === "x" ? "y" : "x"
}

function Ia(r) {
    return r === "y" ? "height" : "width"
}

function qt(r) {
    return ["top", "bottom"].includes(en(r)) ? "y" : "x"
}

function La(r) {
    return _a(qt(r))
}

function wg(r, s, i) {
    i === void 0 && (i = !1);
    const u = Tr(r),
        c = La(r),
        d = Ia(c);
    let m = c === "x" ? u === (i ? "end" : "start") ? "right" : "left" : u === "start" ? "bottom" : "top";
    return s.reference[d] > s.floating[d] && (m = Zl(m)), [m, Zl(m)]
}

function xg(r) {
    const s = Zl(r);
    return [ga(r), s, ga(s)]
}

function ga(r) {
    return r.replace(/start|end/g, s => yg[s])
}

function Sg(r, s, i) {
    const u = ["left", "right"],
        c = ["right", "left"],
        d = ["top", "bottom"],
        m = ["bottom", "top"];
    switch (r) {
        case "top":
        case "bottom":
            return i ? s ? c : u : s ? u : c;
        case "left":
        case "right":
            return s ? d : m;
        default:
            return []
    }
}

function Cg(r, s, i, u) {
    const c = Tr(r);
    let d = Sg(en(r), i === "start", u);
    return c && (d = d.map(m => m + "-" + c), s && (d = d.concat(d.map(ga)))), d
}

function Zl(r) {
    return r.replace(/left|right|bottom|top/g, s => gg[s])
}

function Eg(r) {
    return {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        ...r
    }
}

function Md(r) {
    return typeof r != "number" ? Eg(r) : {
        top: r,
        right: r,
        bottom: r,
        left: r
    }
}

function ql(r) {
    const {
        x: s,
        y: i,
        width: u,
        height: c
    } = r;
    return {
        width: u,
        height: c,
        top: i,
        left: s,
        right: s + u,
        bottom: i + c,
        x: s,
        y: i
    }
}

function Zf(r, s, i) {
    let {
        reference: u,
        floating: c
    } = r;
    const d = qt(s),
        m = La(s),
        p = Ia(m),
        h = en(s),
        y = d === "y",
        S = u.x + u.width / 2 - c.width / 2,
        C = u.y + u.height / 2 - c.height / 2,
        R = u[p] / 2 - c[p] / 2;
    let _;
    switch (h) {
        case "top":
            _ = {
                x: S,
                y: u.y - c.height
            };
            break;
        case "bottom":
            _ = {
                x: S,
                y: u.y + u.height
            };
            break;
        case "right":
            _ = {
                x: u.x + u.width,
                y: C
            };
            break;
        case "left":
            _ = {
                x: u.x - c.width,
                y: C
            };
            break;
        default:
            _ = {
                x: u.x,
                y: u.y
            }
    }
    switch (Tr(s)) {
        case "start":
            _[m] -= R * (i && y ? -1 : 1);
            break;
        case "end":
            _[m] += R * (i && y ? -1 : 1);
            break
    }
    return _
}
const kg = async (r, s, i) => {
    const {
        placement: u = "bottom",
        strategy: c = "absolute",
        middleware: d = [],
        platform: m
    } = i, p = d.filter(Boolean), h = await (m.isRTL == null ? void 0 : m.isRTL(s));
    let y = await m.getElementRects({
            reference: r,
            floating: s,
            strategy: c
        }),
        {
            x: S,
            y: C
        } = Zf(y, u, h),
        R = u,
        _ = {},
        A = 0;
    for (let w = 0; w < p.length; w++) {
        const {
            name: N,
            fn: M
        } = p[w], {
            x: O,
            y: z,
            data: F,
            reset: W
        } = await M({
            x: S,
            y: C,
            initialPlacement: u,
            placement: R,
            strategy: c,
            middlewareData: _,
            rects: y,
            platform: m,
            elements: {
                reference: r,
                floating: s
            }
        });
        S = O ?? S, C = z ?? C, _ = {
            ..._,
            [N]: {
                ..._[N],
                ...F
            }
        }, W && A <= 50 && (A++, typeof W == "object" && (W.placement && (R = W.placement), W.rects && (y = W.rects === !0 ? await m.getElementRects({
            reference: r,
            floating: s,
            strategy: c
        }) : W.rects), {
            x: S,
            y: C
        } = Zf(y, R, h)), w = -1)
    }
    return {
        x: S,
        y: C,
        placement: R,
        strategy: c,
        middlewareData: _
    }
};
async function Co(r, s) {
    var i;
    s === void 0 && (s = {});
    const {
        x: u,
        y: c,
        platform: d,
        rects: m,
        elements: p,
        strategy: h
    } = r, {
        boundary: y = "clippingAncestors",
        rootBoundary: S = "viewport",
        elementContext: C = "floating",
        altBoundary: R = !1,
        padding: _ = 0
    } = Jt(s, r), A = Md(_), N = p[R ? C === "floating" ? "reference" : "floating" : C], M = ql(await d.getClippingRect({
        element: (i = await (d.isElement == null ? void 0 : d.isElement(N))) == null || i ? N : N.contextElement || await (d.getDocumentElement == null ? void 0 : d.getDocumentElement(p.floating)),
        boundary: y,
        rootBoundary: S,
        strategy: h
    })), O = C === "floating" ? {
        x: u,
        y: c,
        width: m.floating.width,
        height: m.floating.height
    } : m.reference, z = await (d.getOffsetParent == null ? void 0 : d.getOffsetParent(p.floating)), F = await (d.isElement == null ? void 0 : d.isElement(z)) ? await (d.getScale == null ? void 0 : d.getScale(z)) || {
        x: 1,
        y: 1
    } : {
        x: 1,
        y: 1
    }, W = ql(d.convertOffsetParentRelativeRectToViewportRelativeRect ? await d.convertOffsetParentRelativeRectToViewportRelativeRect({
        elements: p,
        rect: O,
        offsetParent: z,
        strategy: h
    }) : O);
    return {
        top: (M.top - W.top + A.top) / F.y,
        bottom: (W.bottom - M.bottom + A.bottom) / F.y,
        left: (M.left - W.left + A.left) / F.x,
        right: (W.right - M.right + A.right) / F.x
    }
}
const Pg = r => ({
        name: "arrow",
        options: r,
        async fn(s) {
            const {
                x: i,
                y: u,
                placement: c,
                rects: d,
                platform: m,
                elements: p,
                middlewareData: h
            } = s, {
                element: y,
                padding: S = 0
            } = Jt(r, s) || {};
            if (y == null) return {};
            const C = Md(S),
                R = {
                    x: i,
                    y: u
                },
                _ = La(c),
                A = Ia(_),
                w = await m.getDimensions(y),
                N = _ === "y",
                M = N ? "top" : "left",
                O = N ? "bottom" : "right",
                z = N ? "clientHeight" : "clientWidth",
                F = d.reference[A] + d.reference[_] - R[_] - d.floating[A],
                W = R[_] - d.reference[_],
                G = await (m.getOffsetParent == null ? void 0 : m.getOffsetParent(y));
            let K = G ? G[z] : 0;
            (!K || !await (m.isElement == null ? void 0 : m.isElement(G))) && (K = p.floating[z] || d.floating[A]);
            const re = F / 2 - W / 2,
                pe = K / 2 - w[A] / 2 - 1,
                se = Tn(C[M], pe),
                ve = Tn(C[O], pe),
                Z = se,
                ae = K - w[A] - ve,
                fe = K / 2 - w[A] / 2 + re,
                me = va(Z, fe, ae),
                oe = !h.arrow && Tr(c) != null && fe !== me && d.reference[A] / 2 - (fe < Z ? se : ve) - w[A] / 2 < 0,
                ee = oe ? fe < Z ? fe - Z : fe - ae : 0;
            return {
                [_]: R[_] + ee,
                data: {
                    [_]: me,
                    centerOffset: fe - me - ee,
                    ...oe && {
                        alignmentOffset: ee
                    }
                },
                reset: oe
            }
        }
    }),
    Ng = function(r) {
        return r === void 0 && (r = {}), {
            name: "flip",
            options: r,
            async fn(s) {
                var i, u;
                const {
                    placement: c,
                    middlewareData: d,
                    rects: m,
                    initialPlacement: p,
                    platform: h,
                    elements: y
                } = s, {
                    mainAxis: S = !0,
                    crossAxis: C = !0,
                    fallbackPlacements: R,
                    fallbackStrategy: _ = "bestFit",
                    fallbackAxisSideDirection: A = "none",
                    flipAlignment: w = !0,
                    ...N
                } = Jt(r, s);
                if ((i = d.arrow) != null && i.alignmentOffset) return {};
                const M = en(c),
                    O = qt(p),
                    z = en(p) === p,
                    F = await (h.isRTL == null ? void 0 : h.isRTL(y.floating)),
                    W = R || (z || !w ? [Zl(p)] : xg(p)),
                    G = A !== "none";
                !R && G && W.push(...Cg(p, w, A, F));
                const K = [p, ...W],
                    re = await Co(s, N),
                    pe = [];
                let se = ((u = d.flip) == null ? void 0 : u.overflows) || [];
                if (S && pe.push(re[M]), C) {
                    const me = wg(c, m, F);
                    pe.push(re[me[0]], re[me[1]])
                }
                if (se = [...se, {
                        placement: c,
                        overflows: pe
                    }], !pe.every(me => me <= 0)) {
                    var ve, Z;
                    const me = (((ve = d.flip) == null ? void 0 : ve.index) || 0) + 1,
                        oe = K[me];
                    if (oe) {
                        var ae;
                        const j = C === "alignment" ? O !== qt(oe) : !1,
                            $ = ((ae = se[0]) == null ? void 0 : ae.overflows[0]) > 0;
                        if (!j || $) return {
                            data: {
                                index: me,
                                overflows: se
                            },
                            reset: {
                                placement: oe
                            }
                        }
                    }
                    let ee = (Z = se.filter(j => j.overflows[0] <= 0).sort((j, $) => j.overflows[1] - $.overflows[1])[0]) == null ? void 0 : Z.placement;
                    if (!ee) switch (_) {
                        case "bestFit": {
                            var fe;
                            const j = (fe = se.filter($ => {
                                if (G) {
                                    const V = qt($.placement);
                                    return V === O || V === "y"
                                }
                                return !0
                            }).map($ => [$.placement, $.overflows.filter(V => V > 0).reduce((V, E) => V + E, 0)]).sort(($, V) => $[1] - V[1])[0]) == null ? void 0 : fe[0];
                            j && (ee = j);
                            break
                        }
                        case "initialPlacement":
                            ee = p;
                            break
                    }
                    if (c !== ee) return {
                        reset: {
                            placement: ee
                        }
                    }
                }
                return {}
            }
        }
    };

function qf(r, s) {
    return {
        top: r.top - s.height,
        right: r.right - s.width,
        bottom: r.bottom - s.height,
        left: r.left - s.width
    }
}

function Jf(r) {
    return vg.some(s => r[s] >= 0)
}
const Rg = function(r) {
    return r === void 0 && (r = {}), {
        name: "hide",
        options: r,
        async fn(s) {
            const {
                rects: i
            } = s, {
                strategy: u = "referenceHidden",
                ...c
            } = Jt(r, s);
            switch (u) {
                case "referenceHidden": {
                    const d = await Co(s, {
                            ...c,
                            elementContext: "reference"
                        }),
                        m = qf(d, i.reference);
                    return {
                        data: {
                            referenceHiddenOffsets: m,
                            referenceHidden: Jf(m)
                        }
                    }
                }
                case "escaped": {
                    const d = await Co(s, {
                            ...c,
                            altBoundary: !0
                        }),
                        m = qf(d, i.floating);
                    return {
                        data: {
                            escapedOffsets: m,
                            escaped: Jf(m)
                        }
                    }
                }
                default:
                    return {}
            }
        }
    }
};
async function Tg(r, s) {
    const {
        placement: i,
        platform: u,
        elements: c
    } = r, d = await (u.isRTL == null ? void 0 : u.isRTL(c.floating)), m = en(i), p = Tr(i), h = qt(i) === "y", y = ["left", "top"].includes(m) ? -1 : 1, S = d && h ? -1 : 1, C = Jt(s, r);
    let {
        mainAxis: R,
        crossAxis: _,
        alignmentAxis: A
    } = typeof C == "number" ? {
        mainAxis: C,
        crossAxis: 0,
        alignmentAxis: null
    } : {
        mainAxis: C.mainAxis || 0,
        crossAxis: C.crossAxis || 0,
        alignmentAxis: C.alignmentAxis
    };
    return p && typeof A == "number" && (_ = p === "end" ? A * -1 : A), h ? {
        x: _ * S,
        y: R * y
    } : {
        x: R * y,
        y: _ * S
    }
}
const _g = function(r) {
        return r === void 0 && (r = 0), {
            name: "offset",
            options: r,
            async fn(s) {
                var i, u;
                const {
                    x: c,
                    y: d,
                    placement: m,
                    middlewareData: p
                } = s, h = await Tg(s, r);
                return m === ((i = p.offset) == null ? void 0 : i.placement) && (u = p.arrow) != null && u.alignmentOffset ? {} : {
                    x: c + h.x,
                    y: d + h.y,
                    data: {
                        ...h,
                        placement: m
                    }
                }
            }
        }
    },
    Ig = function(r) {
        return r === void 0 && (r = {}), {
            name: "shift",
            options: r,
            async fn(s) {
                const {
                    x: i,
                    y: u,
                    placement: c
                } = s, {
                    mainAxis: d = !0,
                    crossAxis: m = !1,
                    limiter: p = {
                        fn: N => {
                            let {
                                x: M,
                                y: O
                            } = N;
                            return {
                                x: M,
                                y: O
                            }
                        }
                    },
                    ...h
                } = Jt(r, s), y = {
                    x: i,
                    y: u
                }, S = await Co(s, h), C = qt(en(c)), R = _a(C);
                let _ = y[R],
                    A = y[C];
                if (d) {
                    const N = R === "y" ? "top" : "left",
                        M = R === "y" ? "bottom" : "right",
                        O = _ + S[N],
                        z = _ - S[M];
                    _ = va(O, _, z)
                }
                if (m) {
                    const N = C === "y" ? "top" : "left",
                        M = C === "y" ? "bottom" : "right",
                        O = A + S[N],
                        z = A - S[M];
                    A = va(O, A, z)
                }
                const w = p.fn({
                    ...s,
                    [R]: _,
                    [C]: A
                });
                return {
                    ...w,
                    data: {
                        x: w.x - i,
                        y: w.y - u,
                        enabled: {
                            [R]: d,
                            [C]: m
                        }
                    }
                }
            }
        }
    },
    Lg = function(r) {
        return r === void 0 && (r = {}), {
            options: r,
            fn(s) {
                const {
                    x: i,
                    y: u,
                    placement: c,
                    rects: d,
                    middlewareData: m
                } = s, {
                    offset: p = 0,
                    mainAxis: h = !0,
                    crossAxis: y = !0
                } = Jt(r, s), S = {
                    x: i,
                    y: u
                }, C = qt(c), R = _a(C);
                let _ = S[R],
                    A = S[C];
                const w = Jt(p, s),
                    N = typeof w == "number" ? {
                        mainAxis: w,
                        crossAxis: 0
                    } : {
                        mainAxis: 0,
                        crossAxis: 0,
                        ...w
                    };
                if (h) {
                    const z = R === "y" ? "height" : "width",
                        F = d.reference[R] - d.floating[z] + N.mainAxis,
                        W = d.reference[R] + d.reference[z] - N.mainAxis;
                    _ < F ? _ = F : _ > W && (_ = W)
                }
                if (y) {
                    var M, O;
                    const z = R === "y" ? "width" : "height",
                        F = ["top", "left"].includes(en(c)),
                        W = d.reference[C] - d.floating[z] + (F && ((M = m.offset) == null ? void 0 : M[C]) || 0) + (F ? 0 : N.crossAxis),
                        G = d.reference[C] + d.reference[z] + (F ? 0 : ((O = m.offset) == null ? void 0 : O[C]) || 0) - (F ? N.crossAxis : 0);
                    A < W ? A = W : A > G && (A = G)
                }
                return {
                    [R]: _,
                    [C]: A
                }
            }
        }
    },
    Og = function(r) {
        return r === void 0 && (r = {}), {
            name: "size",
            options: r,
            async fn(s) {
                var i, u;
                const {
                    placement: c,
                    rects: d,
                    platform: m,
                    elements: p
                } = s, {
                    apply: h = () => {},
                    ...y
                } = Jt(r, s), S = await Co(s, y), C = en(c), R = Tr(c), _ = qt(c) === "y", {
                    width: A,
                    height: w
                } = d.floating;
                let N, M;
                C === "top" || C === "bottom" ? (N = C, M = R === (await (m.isRTL == null ? void 0 : m.isRTL(p.floating)) ? "start" : "end") ? "left" : "right") : (M = C, N = R === "end" ? "top" : "bottom");
                const O = w - S.top - S.bottom,
                    z = A - S.left - S.right,
                    F = Tn(w - S[N], O),
                    W = Tn(A - S[M], z),
                    G = !s.middlewareData.shift;
                let K = F,
                    re = W;
                if ((i = s.middlewareData.shift) != null && i.enabled.x && (re = z), (u = s.middlewareData.shift) != null && u.enabled.y && (K = O), G && !R) {
                    const se = ht(S.left, 0),
                        ve = ht(S.right, 0),
                        Z = ht(S.top, 0),
                        ae = ht(S.bottom, 0);
                    _ ? re = A - 2 * (se !== 0 || ve !== 0 ? se + ve : ht(S.left, S.right)) : K = w - 2 * (Z !== 0 || ae !== 0 ? Z + ae : ht(S.top, S.bottom))
                }
                await h({
                    ...s,
                    availableWidth: re,
                    availableHeight: K
                });
                const pe = await m.getDimensions(p.floating);
                return A !== pe.width || w !== pe.height ? {
                    reset: {
                        rects: !0
                    }
                } : {}
            }
        }
    };

function ti() {
    return typeof window < "u"
}

function _r(r) {
    return Ad(r) ? (r.nodeName || "").toLowerCase() : "#document"
}

function vt(r) {
    var s;
    return (r == null || (s = r.ownerDocument) == null ? void 0 : s.defaultView) || window
}

function Bt(r) {
    var s;
    return (s = (Ad(r) ? r.ownerDocument : r.document) || window.document) == null ? void 0 : s.documentElement
}

function Ad(r) {
    return ti() ? r instanceof Node || r instanceof vt(r).Node : !1
}

function Lt(r) {
    return ti() ? r instanceof Element || r instanceof vt(r).Element : !1
}

function Ut(r) {
    return ti() ? r instanceof HTMLElement || r instanceof vt(r).HTMLElement : !1
}

function ed(r) {
    return !ti() || typeof ShadowRoot > "u" ? !1 : r instanceof ShadowRoot || r instanceof vt(r).ShadowRoot
}

function Po(r) {
    const {
        overflow: s,
        overflowX: i,
        overflowY: u,
        display: c
    } = Ot(r);
    return /auto|scroll|overlay|hidden|clip/.test(s + u + i) && !["inline", "contents"].includes(c)
}

function Mg(r) {
    return ["table", "td", "th"].includes(_r(r))
}

function ni(r) {
    return [":popover-open", ":modal"].some(s => {
        try {
            return r.matches(s)
        } catch {
            return !1
        }
    })
}

function Oa(r) {
    const s = Ma(),
        i = Lt(r) ? Ot(r) : r;
    return ["transform", "translate", "scale", "rotate", "perspective"].some(u => i[u] ? i[u] !== "none" : !1) || (i.containerType ? i.containerType !== "normal" : !1) || !s && (i.backdropFilter ? i.backdropFilter !== "none" : !1) || !s && (i.filter ? i.filter !== "none" : !1) || ["transform", "translate", "scale", "rotate", "perspective", "filter"].some(u => (i.willChange || "").includes(u)) || ["paint", "layout", "strict", "content"].some(u => (i.contain || "").includes(u))
}

function Ag(r) {
    let s = _n(r);
    for (; Ut(s) && !Nr(s);) {
        if (Oa(s)) return s;
        if (ni(s)) return null;
        s = _n(s)
    }
    return null
}

function Ma() {
    return typeof CSS > "u" || !CSS.supports ? !1 : CSS.supports("-webkit-backdrop-filter", "none")
}

function Nr(r) {
    return ["html", "body", "#document"].includes(_r(r))
}

function Ot(r) {
    return vt(r).getComputedStyle(r)
}

function ri(r) {
    return Lt(r) ? {
        scrollLeft: r.scrollLeft,
        scrollTop: r.scrollTop
    } : {
        scrollLeft: r.scrollX,
        scrollTop: r.scrollY
    }
}

function _n(r) {
    if (_r(r) === "html") return r;
    const s = r.assignedSlot || r.parentNode || ed(r) && r.host || Bt(r);
    return ed(s) ? s.host : s
}

function zd(r) {
    const s = _n(r);
    return Nr(s) ? r.ownerDocument ? r.ownerDocument.body : r.body : Ut(s) && Po(s) ? s : zd(s)
}

function Eo(r, s, i) {
    var u;
    s === void 0 && (s = []), i === void 0 && (i = !0);
    const c = zd(r),
        d = c === ((u = r.ownerDocument) == null ? void 0 : u.body),
        m = vt(c);
    if (d) {
        const p = ya(m);
        return s.concat(m, m.visualViewport || [], Po(c) ? c : [], p && i ? Eo(p) : [])
    }
    return s.concat(c, Eo(c, [], i))
}

function ya(r) {
    return r.parent && Object.getPrototypeOf(r.parent) ? r.frameElement : null
}

function jd(r) {
    const s = Ot(r);
    let i = parseFloat(s.width) || 0,
        u = parseFloat(s.height) || 0;
    const c = Ut(r),
        d = c ? r.offsetWidth : i,
        m = c ? r.offsetHeight : u,
        p = Xl(i) !== d || Xl(u) !== m;
    return p && (i = d, u = m), {
        width: i,
        height: u,
        $: p
    }
}

function Aa(r) {
    return Lt(r) ? r : r.contextElement
}

function kr(r) {
    const s = Aa(r);
    if (!Ut(s)) return bt(1);
    const i = s.getBoundingClientRect(),
        {
            width: u,
            height: c,
            $: d
        } = jd(s);
    let m = (d ? Xl(i.width) : i.width) / u,
        p = (d ? Xl(i.height) : i.height) / c;
    return (!m || !Number.isFinite(m)) && (m = 1), (!p || !Number.isFinite(p)) && (p = 1), {
        x: m,
        y: p
    }
}
const zg = bt(0);

function Dd(r) {
    const s = vt(r);
    return !Ma() || !s.visualViewport ? zg : {
        x: s.visualViewport.offsetLeft,
        y: s.visualViewport.offsetTop
    }
}

function jg(r, s, i) {
    return s === void 0 && (s = !1), !i || s && i !== vt(r) ? !1 : s
}

function Kn(r, s, i, u) {
    s === void 0 && (s = !1), i === void 0 && (i = !1);
    const c = r.getBoundingClientRect(),
        d = Aa(r);
    let m = bt(1);
    s && (u ? Lt(u) && (m = kr(u)) : m = kr(r));
    const p = jg(d, i, u) ? Dd(d) : bt(0);
    let h = (c.left + p.x) / m.x,
        y = (c.top + p.y) / m.y,
        S = c.width / m.x,
        C = c.height / m.y;
    if (d) {
        const R = vt(d),
            _ = u && Lt(u) ? vt(u) : u;
        let A = R,
            w = ya(A);
        for (; w && u && _ !== A;) {
            const N = kr(w),
                M = w.getBoundingClientRect(),
                O = Ot(w),
                z = M.left + (w.clientLeft + parseFloat(O.paddingLeft)) * N.x,
                F = M.top + (w.clientTop + parseFloat(O.paddingTop)) * N.y;
            h *= N.x, y *= N.y, S *= N.x, C *= N.y, h += z, y += F, A = vt(w), w = ya(A)
        }
    }
    return ql({
        width: S,
        height: C,
        x: h,
        y
    })
}

function za(r, s) {
    const i = ri(r).scrollLeft;
    return s ? s.left + i : Kn(Bt(r)).left + i
}

function Fd(r, s, i) {
    i === void 0 && (i = !1);
    const u = r.getBoundingClientRect(),
        c = u.left + s.scrollLeft - (i ? 0 : za(r, u)),
        d = u.top + s.scrollTop;
    return {
        x: c,
        y: d
    }
}

function Dg(r) {
    let {
        elements: s,
        rect: i,
        offsetParent: u,
        strategy: c
    } = r;
    const d = c === "fixed",
        m = Bt(u),
        p = s ? ni(s.floating) : !1;
    if (u === m || p && d) return i;
    let h = {
            scrollLeft: 0,
            scrollTop: 0
        },
        y = bt(1);
    const S = bt(0),
        C = Ut(u);
    if ((C || !C && !d) && ((_r(u) !== "body" || Po(m)) && (h = ri(u)), Ut(u))) {
        const _ = Kn(u);
        y = kr(u), S.x = _.x + u.clientLeft, S.y = _.y + u.clientTop
    }
    const R = m && !C && !d ? Fd(m, h, !0) : bt(0);
    return {
        width: i.width * y.x,
        height: i.height * y.y,
        x: i.x * y.x - h.scrollLeft * y.x + S.x + R.x,
        y: i.y * y.y - h.scrollTop * y.y + S.y + R.y
    }
}

function Fg(r) {
    return Array.from(r.getClientRects())
}

function bg(r) {
    const s = Bt(r),
        i = ri(r),
        u = r.ownerDocument.body,
        c = ht(s.scrollWidth, s.clientWidth, u.scrollWidth, u.clientWidth),
        d = ht(s.scrollHeight, s.clientHeight, u.scrollHeight, u.clientHeight);
    let m = -i.scrollLeft + za(r);
    const p = -i.scrollTop;
    return Ot(u).direction === "rtl" && (m += ht(s.clientWidth, u.clientWidth) - c), {
        width: c,
        height: d,
        x: m,
        y: p
    }
}

function Ug(r, s) {
    const i = vt(r),
        u = Bt(r),
        c = i.visualViewport;
    let d = u.clientWidth,
        m = u.clientHeight,
        p = 0,
        h = 0;
    if (c) {
        d = c.width, m = c.height;
        const y = Ma();
        (!y || y && s === "fixed") && (p = c.offsetLeft, h = c.offsetTop)
    }
    return {
        width: d,
        height: m,
        x: p,
        y: h
    }
}

function Bg(r, s) {
    const i = Kn(r, !0, s === "fixed"),
        u = i.top + r.clientTop,
        c = i.left + r.clientLeft,
        d = Ut(r) ? kr(r) : bt(1),
        m = r.clientWidth * d.x,
        p = r.clientHeight * d.y,
        h = c * d.x,
        y = u * d.y;
    return {
        width: m,
        height: p,
        x: h,
        y
    }
}

function td(r, s, i) {
    let u;
    if (s === "viewport") u = Ug(r, i);
    else if (s === "document") u = bg(Bt(r));
    else if (Lt(s)) u = Bg(s, i);
    else {
        const c = Dd(r);
        u = {
            x: s.x - c.x,
            y: s.y - c.y,
            width: s.width,
            height: s.height
        }
    }
    return ql(u)
}

function bd(r, s) {
    const i = _n(r);
    return i === s || !Lt(i) || Nr(i) ? !1 : Ot(i).position === "fixed" || bd(i, s)
}

function Vg(r, s) {
    const i = s.get(r);
    if (i) return i;
    let u = Eo(r, [], !1).filter(p => Lt(p) && _r(p) !== "body"),
        c = null;
    const d = Ot(r).position === "fixed";
    let m = d ? _n(r) : r;
    for (; Lt(m) && !Nr(m);) {
        const p = Ot(m),
            h = Oa(m);
        !h && p.position === "fixed" && (c = null), (d ? !h && !c : !h && p.position === "static" && !!c && ["absolute", "fixed"].includes(c.position) || Po(m) && !h && bd(r, m)) ? u = u.filter(S => S !== m) : c = p, m = _n(m)
    }
    return s.set(r, u), u
}

function Wg(r) {
    let {
        element: s,
        boundary: i,
        rootBoundary: u,
        strategy: c
    } = r;
    const m = [...i === "clippingAncestors" ? ni(s) ? [] : Vg(s, this._c) : [].concat(i), u],
        p = m[0],
        h = m.reduce((y, S) => {
            const C = td(s, S, c);
            return y.top = ht(C.top, y.top), y.right = Tn(C.right, y.right), y.bottom = Tn(C.bottom, y.bottom), y.left = ht(C.left, y.left), y
        }, td(s, p, c));
    return {
        width: h.right - h.left,
        height: h.bottom - h.top,
        x: h.left,
        y: h.top
    }
}

function Hg(r) {
    const {
        width: s,
        height: i
    } = jd(r);
    return {
        width: s,
        height: i
    }
}

function $g(r, s, i) {
    const u = Ut(s),
        c = Bt(s),
        d = i === "fixed",
        m = Kn(r, !0, d, s);
    let p = {
        scrollLeft: 0,
        scrollTop: 0
    };
    const h = bt(0);

    function y() {
        h.x = za(c)
    }
    if (u || !u && !d)
        if ((_r(s) !== "body" || Po(c)) && (p = ri(s)), u) {
            const _ = Kn(s, !0, d, s);
            h.x = _.x + s.clientLeft, h.y = _.y + s.clientTop
        } else c && y();
    d && !u && c && y();
    const S = c && !u && !d ? Fd(c, p) : bt(0),
        C = m.left + p.scrollLeft - h.x - S.x,
        R = m.top + p.scrollTop - h.y - S.y;
    return {
        x: C,
        y: R,
        width: m.width,
        height: m.height
    }
}

function sa(r) {
    return Ot(r).position === "static"
}

function nd(r, s) {
    if (!Ut(r) || Ot(r).position === "fixed") return null;
    if (s) return s(r);
    let i = r.offsetParent;
    return Bt(r) === i && (i = i.ownerDocument.body), i
}

function Ud(r, s) {
    const i = vt(r);
    if (ni(r)) return i;
    if (!Ut(r)) {
        let c = _n(r);
        for (; c && !Nr(c);) {
            if (Lt(c) && !sa(c)) return c;
            c = _n(c)
        }
        return i
    }
    let u = nd(r, s);
    for (; u && Mg(u) && sa(u);) u = nd(u, s);
    return u && Nr(u) && sa(u) && !Oa(u) ? i : u || Ag(r) || i
}
const Kg = async function(r) {
    const s = this.getOffsetParent || Ud,
        i = this.getDimensions,
        u = await i(r.floating);
    return {
        reference: $g(r.reference, await s(r.floating), r.strategy),
        floating: {
            x: 0,
            y: 0,
            width: u.width,
            height: u.height
        }
    }
};

function Qg(r) {
    return Ot(r).direction === "rtl"
}
const Gg = {
    convertOffsetParentRelativeRectToViewportRelativeRect: Dg,
    getDocumentElement: Bt,
    getClippingRect: Wg,
    getOffsetParent: Ud,
    getElementRects: Kg,
    getClientRects: Fg,
    getDimensions: Hg,
    getScale: kr,
    isElement: Lt,
    isRTL: Qg
};

function Bd(r, s) {
    return r.x === s.x && r.y === s.y && r.width === s.width && r.height === s.height
}

function Yg(r, s) {
    let i = null,
        u;
    const c = Bt(r);

    function d() {
        var p;
        clearTimeout(u), (p = i) == null || p.disconnect(), i = null
    }

    function m(p, h) {
        p === void 0 && (p = !1), h === void 0 && (h = 1), d();
        const y = r.getBoundingClientRect(),
            {
                left: S,
                top: C,
                width: R,
                height: _
            } = y;
        if (p || s(), !R || !_) return;
        const A = jl(C),
            w = jl(c.clientWidth - (S + R)),
            N = jl(c.clientHeight - (C + _)),
            M = jl(S),
            z = {
                rootMargin: -A + "px " + -w + "px " + -N + "px " + -M + "px",
                threshold: ht(0, Tn(1, h)) || 1
            };
        let F = !0;

        function W(G) {
            const K = G[0].intersectionRatio;
            if (K !== h) {
                if (!F) return m();
                K ? m(!1, K) : u = setTimeout(() => {
                    m(!1, 1e-7)
                }, 1e3)
            }
            K === 1 && !Bd(y, r.getBoundingClientRect()) && m(), F = !1
        }
        try {
            i = new IntersectionObserver(W, {
                ...z,
                root: c.ownerDocument
            })
        } catch {
            i = new IntersectionObserver(W, z)
        }
        i.observe(r)
    }
    return m(!0), d
}

function Xg(r, s, i, u) {
    u === void 0 && (u = {});
    const {
        ancestorScroll: c = !0,
        ancestorResize: d = !0,
        elementResize: m = typeof ResizeObserver == "function",
        layoutShift: p = typeof IntersectionObserver == "function",
        animationFrame: h = !1
    } = u, y = Aa(r), S = c || d ? [...y ? Eo(y) : [], ...Eo(s)] : [];
    S.forEach(M => {
        c && M.addEventListener("scroll", i, {
            passive: !0
        }), d && M.addEventListener("resize", i)
    });
    const C = y && p ? Yg(y, i) : null;
    let R = -1,
        _ = null;
    m && (_ = new ResizeObserver(M => {
        let [O] = M;
        O && O.target === y && _ && (_.unobserve(s), cancelAnimationFrame(R), R = requestAnimationFrame(() => {
            var z;
            (z = _) == null || z.observe(s)
        })), i()
    }), y && !h && _.observe(y), _.observe(s));
    let A, w = h ? Kn(r) : null;
    h && N();

    function N() {
        const M = Kn(r);
        w && !Bd(w, M) && i(), w = M, A = requestAnimationFrame(N)
    }
    return i(), () => {
        var M;
        S.forEach(O => {
            c && O.removeEventListener("scroll", i), d && O.removeEventListener("resize", i)
        }), C == null || C(), (M = _) == null || M.disconnect(), _ = null, h && cancelAnimationFrame(A)
    }
}
const Zg = _g,
    qg = Ig,
    Jg = Ng,
    ey = Og,
    ty = Rg,
    rd = Pg,
    ny = Lg,
    ry = (r, s, i) => {
        const u = new Map,
            c = {
                platform: Gg,
                ...i
            },
            d = {
                ...c.platform,
                _c: u
            };
        return kg(r, s, {
            ...c,
            platform: d
        })
    };
var $l = typeof document < "u" ? g.useLayoutEffect : g.useEffect;

function Jl(r, s) {
    if (r === s) return !0;
    if (typeof r != typeof s) return !1;
    if (typeof r == "function" && r.toString() === s.toString()) return !0;
    let i, u, c;
    if (r && s && typeof r == "object") {
        if (Array.isArray(r)) {
            if (i = r.length, i !== s.length) return !1;
            for (u = i; u-- !== 0;)
                if (!Jl(r[u], s[u])) return !1;
            return !0
        }
        if (c = Object.keys(r), i = c.length, i !== Object.keys(s).length) return !1;
        for (u = i; u-- !== 0;)
            if (!{}.hasOwnProperty.call(s, c[u])) return !1;
        for (u = i; u-- !== 0;) {
            const d = c[u];
            if (!(d === "_owner" && r.$$typeof) && !Jl(r[d], s[d])) return !1
        }
        return !0
    }
    return r !== r && s !== s
}

function Vd(r) {
    return typeof window > "u" ? 1 : (r.ownerDocument.defaultView || window).devicePixelRatio || 1
}

function od(r, s) {
    const i = Vd(r);
    return Math.round(s * i) / i
}

function aa(r) {
    const s = g.useRef(r);
    return $l(() => {
        s.current = r
    }), s
}

function oy(r) {
    r === void 0 && (r = {});
    const {
        placement: s = "bottom",
        strategy: i = "absolute",
        middleware: u = [],
        platform: c,
        elements: {
            reference: d,
            floating: m
        } = {},
        transform: p = !0,
        whileElementsMounted: h,
        open: y
    } = r, [S, C] = g.useState({
        x: 0,
        y: 0,
        strategy: i,
        placement: s,
        middlewareData: {},
        isPositioned: !1
    }), [R, _] = g.useState(u);
    Jl(R, u) || _(u);
    const [A, w] = g.useState(null), [N, M] = g.useState(null), O = g.useCallback(j => {
        j !== G.current && (G.current = j, w(j))
    }, []), z = g.useCallback(j => {
        j !== K.current && (K.current = j, M(j))
    }, []), F = d || A, W = m || N, G = g.useRef(null), K = g.useRef(null), re = g.useRef(S), pe = h != null, se = aa(h), ve = aa(c), Z = aa(y), ae = g.useCallback(() => {
        if (!G.current || !K.current) return;
        const j = {
            placement: s,
            strategy: i,
            middleware: R
        };
        ve.current && (j.platform = ve.current), ry(G.current, K.current, j).then($ => {
            const V = {
                ...$,
                isPositioned: Z.current !== !1
            };
            fe.current && !Jl(re.current, V) && (re.current = V, ko.flushSync(() => {
                C(V)
            }))
        })
    }, [R, s, i, ve, Z]);
    $l(() => {
        y === !1 && re.current.isPositioned && (re.current.isPositioned = !1, C(j => ({
            ...j,
            isPositioned: !1
        })))
    }, [y]);
    const fe = g.useRef(!1);
    $l(() => (fe.current = !0, () => {
        fe.current = !1
    }), []), $l(() => {
        if (F && (G.current = F), W && (K.current = W), F && W) {
            if (se.current) return se.current(F, W, ae);
            ae()
        }
    }, [F, W, ae, se, pe]);
    const me = g.useMemo(() => ({
            reference: G,
            floating: K,
            setReference: O,
            setFloating: z
        }), [O, z]),
        oe = g.useMemo(() => ({
            reference: F,
            floating: W
        }), [F, W]),
        ee = g.useMemo(() => {
            const j = {
                position: i,
                left: 0,
                top: 0
            };
            if (!oe.floating) return j;
            const $ = od(oe.floating, S.x),
                V = od(oe.floating, S.y);
            return p ? {
                ...j,
                transform: "translate(" + $ + "px, " + V + "px)",
                ...Vd(oe.floating) >= 1.5 && {
                    willChange: "transform"
                }
            } : {
                position: i,
                left: $,
                top: V
            }
        }, [i, p, oe.floating, S.x, S.y]);
    return g.useMemo(() => ({
        ...S,
        update: ae,
        refs: me,
        elements: oe,
        floatingStyles: ee
    }), [S, ae, me, oe, ee])
}
const ly = r => {
        function s(i) {
            return {}.hasOwnProperty.call(i, "current")
        }
        return {
            name: "arrow",
            options: r,
            fn(i) {
                const {
                    element: u,
                    padding: c
                } = typeof r == "function" ? r(i) : r;
                return u && s(u) ? u.current != null ? rd({
                    element: u.current,
                    padding: c
                }).fn(i) : {} : u ? rd({
                    element: u,
                    padding: c
                }).fn(i) : {}
            }
        }
    },
    iy = (r, s) => ({
        ...Zg(r),
        options: [r, s]
    }),
    sy = (r, s) => ({
        ...qg(r),
        options: [r, s]
    }),
    ay = (r, s) => ({
        ...ny(r),
        options: [r, s]
    }),
    uy = (r, s) => ({
        ...Jg(r),
        options: [r, s]
    }),
    cy = (r, s) => ({
        ...ey(r),
        options: [r, s]
    }),
    fy = (r, s) => ({
        ...ty(r),
        options: [r, s]
    }),
    dy = (r, s) => ({
        ...ly(r),
        options: [r, s]
    });
var py = "Arrow",
    Wd = g.forwardRef((r, s) => {
        const {
            children: i,
            width: u = 10,
            height: c = 5,
            ...d
        } = r;
        return P.jsx(ze.svg, {
            ...d,
            ref: s,
            width: u,
            height: c,
            viewBox: "0 0 30 10",
            preserveAspectRatio: "none",
            children: r.asChild ? i : P.jsx("polygon", {
                points: "0,0 30,0 15,10"
            })
        })
    });
Wd.displayName = py;
var my = Wd;

function hy(r) {
    const [s, i] = g.useState(void 0);
    return ct(() => {
        if (r) {
            i({
                width: r.offsetWidth,
                height: r.offsetHeight
            });
            const u = new ResizeObserver(c => {
                if (!Array.isArray(c) || !c.length) return;
                const d = c[0];
                let m, p;
                if ("borderBoxSize" in d) {
                    const h = d.borderBoxSize,
                        y = Array.isArray(h) ? h[0] : h;
                    m = y.inlineSize, p = y.blockSize
                } else m = r.offsetWidth, p = r.offsetHeight;
                i({
                    width: m,
                    height: p
                })
            });
            return u.observe(r, {
                box: "border-box"
            }), () => u.unobserve(r)
        } else i(void 0)
    }, [r]), s
}
var ja = "Popper",
    [Hd, $d] = Ra(ja),
    [vy, Kd] = Hd(ja),
    Qd = r => {
        const {
            __scopePopper: s,
            children: i
        } = r, [u, c] = g.useState(null);
        return P.jsx(vy, {
            scope: s,
            anchor: u,
            onAnchorChange: c,
            children: i
        })
    };
Qd.displayName = ja;
var Gd = "PopperAnchor",
    Yd = g.forwardRef((r, s) => {
        const {
            __scopePopper: i,
            virtualRef: u,
            ...c
        } = r, d = Kd(Gd, i), m = g.useRef(null), p = Ye(s, m);
        return g.useEffect(() => {
            d.onAnchorChange((u == null ? void 0 : u.current) || m.current)
        }), u ? null : P.jsx(ze.div, {
            ...c,
            ref: p
        })
    });
Yd.displayName = Gd;
var Da = "PopperContent",
    [gy, yy] = Hd(Da),
    Xd = g.forwardRef((r, s) => {
        var Q, ne, ye, xe, Ce, Pe;
        const {
            __scopePopper: i,
            side: u = "bottom",
            sideOffset: c = 0,
            align: d = "center",
            alignOffset: m = 0,
            arrowPadding: p = 0,
            avoidCollisions: h = !0,
            collisionBoundary: y = [],
            collisionPadding: S = 0,
            sticky: C = "partial",
            hideWhenDetached: R = !1,
            updatePositionStrategy: _ = "optimized",
            onPlaced: A,
            ...w
        } = r, N = Kd(Da, i), [M, O] = g.useState(null), z = Ye(s, Ve => O(Ve)), [F, W] = g.useState(null), G = hy(F), K = (G == null ? void 0 : G.width) ?? 0, re = (G == null ? void 0 : G.height) ?? 0, pe = u + (d !== "center" ? "-" + d : ""), se = typeof S == "number" ? S : {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            ...S
        }, ve = Array.isArray(y) ? y : [y], Z = ve.length > 0, ae = {
            padding: se,
            boundary: ve.filter(xy),
            altBoundary: Z
        }, {
            refs: fe,
            floatingStyles: me,
            placement: oe,
            isPositioned: ee,
            middlewareData: j
        } = oy({
            strategy: "fixed",
            placement: pe,
            whileElementsMounted: (...Ve) => Xg(...Ve, {
                animationFrame: _ === "always"
            }),
            elements: {
                reference: N.anchor
            },
            middleware: [iy({
                mainAxis: c + re,
                alignmentAxis: m
            }), h && sy({
                mainAxis: !0,
                crossAxis: !1,
                limiter: C === "partial" ? ay() : void 0,
                ...ae
            }), h && uy({
                ...ae
            }), cy({
                ...ae,
                apply: ({
                    elements: Ve,
                    rects: rt,
                    availableWidth: tn,
                    availableHeight: nn
                }) => {
                    const {
                        width: Vt,
                        height: No
                    } = rt.reference, rn = Ve.floating.style;
                    rn.setProperty("--radix-popper-available-width", `${tn}px`), rn.setProperty("--radix-popper-available-height", `${nn}px`), rn.setProperty("--radix-popper-anchor-width", `${Vt}px`), rn.setProperty("--radix-popper-anchor-height", `${No}px`)
                }
            }), F && dy({
                element: F,
                padding: p
            }), Sy({
                arrowWidth: K,
                arrowHeight: re
            }), R && fy({
                strategy: "referenceHidden",
                ...ae
            })]
        }), [$, V] = Jd(oe), E = $n(A);
        ct(() => {
            ee && (E == null || E())
        }, [ee, E]);
        const D = (Q = j.arrow) == null ? void 0 : Q.x,
            ce = (ne = j.arrow) == null ? void 0 : ne.y,
            ue = ((ye = j.arrow) == null ? void 0 : ye.centerOffset) !== 0,
            [ge, he] = g.useState();
        return ct(() => {
            M && he(window.getComputedStyle(M).zIndex)
        }, [M]), P.jsx("div", {
            ref: fe.setFloating,
            "data-radix-popper-content-wrapper": "",
            style: {
                ...me,
                transform: ee ? me.transform : "translate(0, -200%)",
                minWidth: "max-content",
                zIndex: ge,
                "--radix-popper-transform-origin": [(xe = j.transformOrigin) == null ? void 0 : xe.x, (Ce = j.transformOrigin) == null ? void 0 : Ce.y].join(" "),
                ...((Pe = j.hide) == null ? void 0 : Pe.referenceHidden) && {
                    visibility: "hidden",
                    pointerEvents: "none"
                }
            },
            dir: r.dir,
            children: P.jsx(gy, {
                scope: i,
                placedSide: $,
                onArrowChange: W,
                arrowX: D,
                arrowY: ce,
                shouldHideArrow: ue,
                children: P.jsx(ze.div, {
                    "data-side": $,
                    "data-align": V,
                    ...w,
                    ref: z,
                    style: {
                        ...w.style,
                        animation: ee ? void 0 : "none"
                    }
                })
            })
        })
    });
Xd.displayName = Da;
var Zd = "PopperArrow",
    wy = {
        top: "bottom",
        right: "left",
        bottom: "top",
        left: "right"
    },
    qd = g.forwardRef(function(s, i) {
        const {
            __scopePopper: u,
            ...c
        } = s, d = yy(Zd, u), m = wy[d.placedSide];
        return P.jsx("span", {
            ref: d.onArrowChange,
            style: {
                position: "absolute",
                left: d.arrowX,
                top: d.arrowY,
                [m]: 0,
                transformOrigin: {
                    top: "",
                    right: "0 0",
                    bottom: "center 0",
                    left: "100% 0"
                } [d.placedSide],
                transform: {
                    top: "translateY(100%)",
                    right: "translateY(50%) rotate(90deg) translateX(-50%)",
                    bottom: "rotate(180deg)",
                    left: "translateY(50%) rotate(-90deg) translateX(50%)"
                } [d.placedSide],
                visibility: d.shouldHideArrow ? "hidden" : void 0
            },
            children: P.jsx(my, {
                ...c,
                ref: i,
                style: {
                    ...c.style,
                    display: "block"
                }
            })
        })
    });
qd.displayName = Zd;

function xy(r) {
    return r !== null
}
var Sy = r => ({
    name: "transformOrigin",
    options: r,
    fn(s) {
        var N, M, O;
        const {
            placement: i,
            rects: u,
            middlewareData: c
        } = s, m = ((N = c.arrow) == null ? void 0 : N.centerOffset) !== 0, p = m ? 0 : r.arrowWidth, h = m ? 0 : r.arrowHeight, [y, S] = Jd(i), C = {
            start: "0%",
            center: "50%",
            end: "100%"
        } [S], R = (((M = c.arrow) == null ? void 0 : M.x) ?? 0) + p / 2, _ = (((O = c.arrow) == null ? void 0 : O.y) ?? 0) + h / 2;
        let A = "",
            w = "";
        return y === "bottom" ? (A = m ? C : `${R}px`, w = `${-h}px`) : y === "top" ? (A = m ? C : `${R}px`, w = `${u.floating.height+h}px`) : y === "right" ? (A = `${-h}px`, w = m ? C : `${_}px`) : y === "left" && (A = `${u.floating.width+h}px`, w = m ? C : `${_}px`), {
            data: {
                x: A,
                y: w
            }
        }
    }
});

function Jd(r) {
    const [s, i = "center"] = r.split("-");
    return [s, i]
}
var Cy = Qd,
    Ey = Yd,
    ky = Xd,
    Py = qd,
    Ny = "Portal",
    ep = g.forwardRef((r, s) => {
        var p;
        const {
            container: i,
            ...u
        } = r, [c, d] = g.useState(!1);
        ct(() => d(!0), []);
        const m = i || c && ((p = globalThis == null ? void 0 : globalThis.document) == null ? void 0 : p.body);
        return m ? zv.createPortal(P.jsx(ze.div, {
            ...u,
            ref: s
        }), m) : null
    });
ep.displayName = Ny;
var Ry = md[" useInsertionEffect ".trim().toString()] || ct;

function ld({
    prop: r,
    defaultProp: s,
    onChange: i = () => {},
    caller: u
}) {
    const [c, d, m] = Ty({
        defaultProp: s,
        onChange: i
    }), p = r !== void 0, h = p ? r : c;
    {
        const S = g.useRef(r !== void 0);
        g.useEffect(() => {
            const C = S.current;
            C !== p && console.warn(`${u} is changing from ${C?"controlled":"uncontrolled"} to ${p?"controlled":"uncontrolled"}. Components should not switch from controlled to uncontrolled (or vice versa). Decide between using a controlled or uncontrolled value for the lifetime of the component.`), S.current = p
        }, [p, u])
    }
    const y = g.useCallback(S => {
        var C;
        if (p) {
            const R = _y(S) ? S(r) : S;
            R !== r && ((C = m.current) == null || C.call(m, R))
        } else d(S)
    }, [p, r, d, m]);
    return [h, y]
}

function Ty({
    defaultProp: r,
    onChange: s
}) {
    const [i, u] = g.useState(r), c = g.useRef(i), d = g.useRef(s);
    return Ry(() => {
        d.current = s
    }, [s]), g.useEffect(() => {
        var m;
        c.current !== i && ((m = d.current) == null || m.call(d, i), c.current = i)
    }, [i, c]), [i, u, d]
}

function _y(r) {
    return typeof r == "function"
}

function Iy(r) {
    const s = g.useRef({
        value: r,
        previous: r
    });
    return g.useMemo(() => (s.current.value !== r && (s.current.previous = s.current.value, s.current.value = r), s.current.previous), [r])
}
var tp = Object.freeze({
        position: "absolute",
        border: 0,
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: "hidden",
        clip: "rect(0, 0, 0, 0)",
        whiteSpace: "nowrap",
        wordWrap: "normal"
    }),
    Ly = "VisuallyHidden",
    Oy = g.forwardRef((r, s) => P.jsx(ze.span, {
        ...r,
        ref: s,
        style: {
            ...tp,
            ...r.style
        }
    }));
Oy.displayName = Ly;
var My = function(r) {
        if (typeof document > "u") return null;
        var s = Array.isArray(r) ? r[0] : r;
        return s.ownerDocument.body
    },
    xr = new WeakMap,
    Dl = new WeakMap,
    Fl = {},
    ua = 0,
    np = function(r) {
        return r && (r.host || np(r.parentNode))
    },
    Ay = function(r, s) {
        return s.map(function(i) {
            if (r.contains(i)) return i;
            var u = np(i);
            return u && r.contains(u) ? u : (console.error("aria-hidden", i, "in not contained inside", r, ". Doing nothing"), null)
        }).filter(function(i) {
            return !!i
        })
    },
    zy = function(r, s, i, u) {
        var c = Ay(s, Array.isArray(r) ? r : [r]);
        Fl[i] || (Fl[i] = new WeakMap);
        var d = Fl[i],
            m = [],
            p = new Set,
            h = new Set(c),
            y = function(C) {
                !C || p.has(C) || (p.add(C), y(C.parentNode))
            };
        c.forEach(y);
        var S = function(C) {
            !C || h.has(C) || Array.prototype.forEach.call(C.children, function(R) {
                if (p.has(R)) S(R);
                else try {
                    var _ = R.getAttribute(u),
                        A = _ !== null && _ !== "false",
                        w = (xr.get(R) || 0) + 1,
                        N = (d.get(R) || 0) + 1;
                    xr.set(R, w), d.set(R, N), m.push(R), w === 1 && A && Dl.set(R, !0), N === 1 && R.setAttribute(i, "true"), A || R.setAttribute(u, "true")
                } catch (M) {
                    console.error("aria-hidden: cannot operate on ", R, M)
                }
            })
        };
        return S(s), p.clear(), ua++,
            function() {
                m.forEach(function(C) {
                    var R = xr.get(C) - 1,
                        _ = d.get(C) - 1;
                    xr.set(C, R), d.set(C, _), R || (Dl.has(C) || C.removeAttribute(u), Dl.delete(C)), _ || C.removeAttribute(i)
                }), ua--, ua || (xr = new WeakMap, xr = new WeakMap, Dl = new WeakMap, Fl = {})
            }
    },
    jy = function(r, s, i) {
        i === void 0 && (i = "data-aria-hidden");
        var u = Array.from(Array.isArray(r) ? r : [r]),
            c = My(r);
        return c ? (u.push.apply(u, Array.from(c.querySelectorAll("[aria-live]"))), zy(u, c, i, "aria-hidden")) : function() {
            return null
        }
    },
    Ft = function() {
        return Ft = Object.assign || function(s) {
            for (var i, u = 1, c = arguments.length; u < c; u++) {
                i = arguments[u];
                for (var d in i) Object.prototype.hasOwnProperty.call(i, d) && (s[d] = i[d])
            }
            return s
        }, Ft.apply(this, arguments)
    };

function rp(r, s) {
    var i = {};
    for (var u in r) Object.prototype.hasOwnProperty.call(r, u) && s.indexOf(u) < 0 && (i[u] = r[u]);
    if (r != null && typeof Object.getOwnPropertySymbols == "function")
        for (var c = 0, u = Object.getOwnPropertySymbols(r); c < u.length; c++) s.indexOf(u[c]) < 0 && Object.prototype.propertyIsEnumerable.call(r, u[c]) && (i[u[c]] = r[u[c]]);
    return i
}

function Dy(r, s, i) {
    if (i || arguments.length === 2)
        for (var u = 0, c = s.length, d; u < c; u++)(d || !(u in s)) && (d || (d = Array.prototype.slice.call(s, 0, u)), d[u] = s[u]);
    return r.concat(d || Array.prototype.slice.call(s))
}
var Kl = "right-scroll-bar-position",
    Ql = "width-before-scroll-bar",
    Fy = "with-scroll-bars-hidden",
    by = "--removed-body-scroll-bar-size";

function ca(r, s) {
    return typeof r == "function" ? r(s) : r && (r.current = s), r
}

function Uy(r, s) {
    var i = g.useState(function() {
        return {
            value: r,
            callback: s,
            facade: {
                get current() {
                    return i.value
                },
                set current(u) {
                    var c = i.value;
                    c !== u && (i.value = u, i.callback(u, c))
                }
            }
        }
    })[0];
    return i.callback = s, i.facade
}
var By = typeof window < "u" ? g.useLayoutEffect : g.useEffect,
    id = new WeakMap;

function Vy(r, s) {
    var i = Uy(null, function(u) {
        return r.forEach(function(c) {
            return ca(c, u)
        })
    });
    return By(function() {
        var u = id.get(i);
        if (u) {
            var c = new Set(u),
                d = new Set(r),
                m = i.current;
            c.forEach(function(p) {
                d.has(p) || ca(p, null)
            }), d.forEach(function(p) {
                c.has(p) || ca(p, m)
            })
        }
        id.set(i, r)
    }, [r]), i
}

function Wy(r) {
    return r
}

function Hy(r, s) {
    s === void 0 && (s = Wy);
    var i = [],
        u = !1,
        c = {
            read: function() {
                if (u) throw new Error("Sidecar: could not `read` from an `assigned` medium. `read` could be used only with `useMedium`.");
                return i.length ? i[i.length - 1] : r
            },
            useMedium: function(d) {
                var m = s(d, u);
                return i.push(m),
                    function() {
                        i = i.filter(function(p) {
                            return p !== m
                        })
                    }
            },
            assignSyncMedium: function(d) {
                for (u = !0; i.length;) {
                    var m = i;
                    i = [], m.forEach(d)
                }
                i = {
                    push: function(p) {
                        return d(p)
                    },
                    filter: function() {
                        return i
                    }
                }
            },
            assignMedium: function(d) {
                u = !0;
                var m = [];
                if (i.length) {
                    var p = i;
                    i = [], p.forEach(d), m = i
                }
                var h = function() {
                        var S = m;
                        m = [], S.forEach(d)
                    },
                    y = function() {
                        return Promise.resolve().then(h)
                    };
                y(), i = {
                    push: function(S) {
                        m.push(S), y()
                    },
                    filter: function(S) {
                        return m = m.filter(S), i
                    }
                }
            }
        };
    return c
}

function $y(r) {
    r === void 0 && (r = {});
    var s = Hy(null);
    return s.options = Ft({
        async: !0,
        ssr: !1
    }, r), s
}
var op = function(r) {
    var s = r.sideCar,
        i = rp(r, ["sideCar"]);
    if (!s) throw new Error("Sidecar: please provide `sideCar` property to import the right car");
    var u = s.read();
    if (!u) throw new Error("Sidecar medium not found");
    return g.createElement(u, Ft({}, i))
};
op.isSideCarExport = !0;

function Ky(r, s) {
    return r.useMedium(s), op
}
var lp = $y(),
    fa = function() {},
    oi = g.forwardRef(function(r, s) {
        var i = g.useRef(null),
            u = g.useState({
                onScrollCapture: fa,
                onWheelCapture: fa,
                onTouchMoveCapture: fa
            }),
            c = u[0],
            d = u[1],
            m = r.forwardProps,
            p = r.children,
            h = r.className,
            y = r.removeScrollBar,
            S = r.enabled,
            C = r.shards,
            R = r.sideCar,
            _ = r.noIsolation,
            A = r.inert,
            w = r.allowPinchZoom,
            N = r.as,
            M = N === void 0 ? "div" : N,
            O = r.gapMode,
            z = rp(r, ["forwardProps", "children", "className", "removeScrollBar", "enabled", "shards", "sideCar", "noIsolation", "inert", "allowPinchZoom", "as", "gapMode"]),
            F = R,
            W = Vy([i, s]),
            G = Ft(Ft({}, z), c);
        return g.createElement(g.Fragment, null, S && g.createElement(F, {
            sideCar: lp,
            removeScrollBar: y,
            shards: C,
            noIsolation: _,
            inert: A,
            setCallbacks: d,
            allowPinchZoom: !!w,
            lockRef: i,
            gapMode: O
        }), m ? g.cloneElement(g.Children.only(p), Ft(Ft({}, G), {
            ref: W
        })) : g.createElement(M, Ft({}, G, {
            className: h,
            ref: W
        }), p))
    });
oi.defaultProps = {
    enabled: !0,
    removeScrollBar: !0,
    inert: !1
};
oi.classNames = {
    fullWidth: Ql,
    zeroRight: Kl
};
var Qy = function() {
    if (typeof __webpack_nonce__ < "u") return __webpack_nonce__
};

function Gy() {
    if (!document) return null;
    var r = document.createElement("style");
    r.type = "text/css";
    var s = Qy();
    return s && r.setAttribute("nonce", s), r
}

function Yy(r, s) {
    r.styleSheet ? r.styleSheet.cssText = s : r.appendChild(document.createTextNode(s))
}

function Xy(r) {
    var s = document.head || document.getElementsByTagName("head")[0];
    s.appendChild(r)
}
var Zy = function() {
        var r = 0,
            s = null;
        return {
            add: function(i) {
                r == 0 && (s = Gy()) && (Yy(s, i), Xy(s)), r++
            },
            remove: function() {
                r--, !r && s && (s.parentNode && s.parentNode.removeChild(s), s = null)
            }
        }
    },
    qy = function() {
        var r = Zy();
        return function(s, i) {
            g.useEffect(function() {
                return r.add(s),
                    function() {
                        r.remove()
                    }
            }, [s && i])
        }
    },
    ip = function() {
        var r = qy(),
            s = function(i) {
                var u = i.styles,
                    c = i.dynamic;
                return r(u, c), null
            };
        return s
    },
    Jy = {
        left: 0,
        top: 0,
        right: 0,
        gap: 0
    },
    da = function(r) {
        return parseInt(r || "", 10) || 0
    },
    e0 = function(r) {
        var s = window.getComputedStyle(document.body),
            i = s[r === "padding" ? "paddingLeft" : "marginLeft"],
            u = s[r === "padding" ? "paddingTop" : "marginTop"],
            c = s[r === "padding" ? "paddingRight" : "marginRight"];
        return [da(i), da(u), da(c)]
    },
    t0 = function(r) {
        if (r === void 0 && (r = "margin"), typeof window > "u") return Jy;
        var s = e0(r),
            i = document.documentElement.clientWidth,
            u = window.innerWidth;
        return {
            left: s[0],
            top: s[1],
            right: s[2],
            gap: Math.max(0, u - i + s[2] - s[0])
        }
    },
    n0 = ip(),
    Pr = "data-scroll-locked",
    r0 = function(r, s, i, u) {
        var c = r.left,
            d = r.top,
            m = r.right,
            p = r.gap;
        return i === void 0 && (i = "margin"), `
  .`.concat(Fy, ` {
   overflow: hidden `).concat(u, `;
   padding-right: `).concat(p, "px ").concat(u, `;
  }
  body[`).concat(Pr, `] {
    overflow: hidden `).concat(u, `;
    overscroll-behavior: contain;
    `).concat([s && "position: relative ".concat(u, ";"), i === "margin" && `
    padding-left: `.concat(c, `px;
    padding-top: `).concat(d, `px;
    padding-right: `).concat(m, `px;
    margin-left:0;
    margin-top:0;
    margin-right: `).concat(p, "px ").concat(u, `;
    `), i === "padding" && "padding-right: ".concat(p, "px ").concat(u, ";")].filter(Boolean).join(""), `
  }
  
  .`).concat(Kl, ` {
    right: `).concat(p, "px ").concat(u, `;
  }
  
  .`).concat(Ql, ` {
    margin-right: `).concat(p, "px ").concat(u, `;
  }
  
  .`).concat(Kl, " .").concat(Kl, ` {
    right: 0 `).concat(u, `;
  }
  
  .`).concat(Ql, " .").concat(Ql, ` {
    margin-right: 0 `).concat(u, `;
  }
  
  body[`).concat(Pr, `] {
    `).concat(by, ": ").concat(p, `px;
  }
`)
    },
    sd = function() {
        var r = parseInt(document.body.getAttribute(Pr) || "0", 10);
        return isFinite(r) ? r : 0
    },
    o0 = function() {
        g.useEffect(function() {
            return document.body.setAttribute(Pr, (sd() + 1).toString()),
                function() {
                    var r = sd() - 1;
                    r <= 0 ? document.body.removeAttribute(Pr) : document.body.setAttribute(Pr, r.toString())
                }
        }, [])
    },
    l0 = function(r) {
        var s = r.noRelative,
            i = r.noImportant,
            u = r.gapMode,
            c = u === void 0 ? "margin" : u;
        o0();
        var d = g.useMemo(function() {
            return t0(c)
        }, [c]);
        return g.createElement(n0, {
            styles: r0(d, !s, c, i ? "" : "!important")
        })
    },
    wa = !1;
if (typeof window < "u") try {
    var bl = Object.defineProperty({}, "passive", {
        get: function() {
            return wa = !0, !0
        }
    });
    window.addEventListener("test", bl, bl), window.removeEventListener("test", bl, bl)
} catch {
    wa = !1
}
var Sr = wa ? {
        passive: !1
    } : !1,
    i0 = function(r) {
        return r.tagName === "TEXTAREA"
    },
    sp = function(r, s) {
        if (!(r instanceof Element)) return !1;
        var i = window.getComputedStyle(r);
        return i[s] !== "hidden" && !(i.overflowY === i.overflowX && !i0(r) && i[s] === "visible")
    },
    s0 = function(r) {
        return sp(r, "overflowY")
    },
    a0 = function(r) {
        return sp(r, "overflowX")
    },
    ad = function(r, s) {
        var i = s.ownerDocument,
            u = s;
        do {
            typeof ShadowRoot < "u" && u instanceof ShadowRoot && (u = u.host);
            var c = ap(r, u);
            if (c) {
                var d = up(r, u),
                    m = d[1],
                    p = d[2];
                if (m > p) return !0
            }
            u = u.parentNode
        } while (u && u !== i.body);
        return !1
    },
    u0 = function(r) {
        var s = r.scrollTop,
            i = r.scrollHeight,
            u = r.clientHeight;
        return [s, i, u]
    },
    c0 = function(r) {
        var s = r.scrollLeft,
            i = r.scrollWidth,
            u = r.clientWidth;
        return [s, i, u]
    },
    ap = function(r, s) {
        return r === "v" ? s0(s) : a0(s)
    },
    up = function(r, s) {
        return r === "v" ? u0(s) : c0(s)
    },
    f0 = function(r, s) {
        return r === "h" && s === "rtl" ? -1 : 1
    },
    d0 = function(r, s, i, u, c) {
        var d = f0(r, window.getComputedStyle(s).direction),
            m = d * u,
            p = i.target,
            h = s.contains(p),
            y = !1,
            S = m > 0,
            C = 0,
            R = 0;
        do {
            var _ = up(r, p),
                A = _[0],
                w = _[1],
                N = _[2],
                M = w - N - d * A;
            (A || M) && ap(r, p) && (C += M, R += A), p instanceof ShadowRoot ? p = p.host : p = p.parentNode
        } while (!h && p !== document.body || h && (s.contains(p) || s === p));
        return (S && Math.abs(C) < 1 || !S && Math.abs(R) < 1) && (y = !0), y
    },
    Ul = function(r) {
        return "changedTouches" in r ? [r.changedTouches[0].clientX, r.changedTouches[0].clientY] : [0, 0]
    },
    ud = function(r) {
        return [r.deltaX, r.deltaY]
    },
    cd = function(r) {
        return r && "current" in r ? r.current : r
    },
    p0 = function(r, s) {
        return r[0] === s[0] && r[1] === s[1]
    },
    m0 = function(r) {
        return `
  .block-interactivity-`.concat(r, ` {pointer-events: none;}
  .allow-interactivity-`).concat(r, ` {pointer-events: all;}
`)
    },
    h0 = 0,
    Cr = [];

function v0(r) {
    var s = g.useRef([]),
        i = g.useRef([0, 0]),
        u = g.useRef(),
        c = g.useState(h0++)[0],
        d = g.useState(ip)[0],
        m = g.useRef(r);
    g.useEffect(function() {
        m.current = r
    }, [r]), g.useEffect(function() {
        if (r.inert) {
            document.body.classList.add("block-interactivity-".concat(c));
            var w = Dy([r.lockRef.current], (r.shards || []).map(cd), !0).filter(Boolean);
            return w.forEach(function(N) {
                    return N.classList.add("allow-interactivity-".concat(c))
                }),
                function() {
                    document.body.classList.remove("block-interactivity-".concat(c)), w.forEach(function(N) {
                        return N.classList.remove("allow-interactivity-".concat(c))
                    })
                }
        }
    }, [r.inert, r.lockRef.current, r.shards]);
    var p = g.useCallback(function(w, N) {
            if ("touches" in w && w.touches.length === 2 || w.type === "wheel" && w.ctrlKey) return !m.current.allowPinchZoom;
            var M = Ul(w),
                O = i.current,
                z = "deltaX" in w ? w.deltaX : O[0] - M[0],
                F = "deltaY" in w ? w.deltaY : O[1] - M[1],
                W, G = w.target,
                K = Math.abs(z) > Math.abs(F) ? "h" : "v";
            if ("touches" in w && K === "h" && G.type === "range") return !1;
            var re = ad(K, G);
            if (!re) return !0;
            if (re ? W = K : (W = K === "v" ? "h" : "v", re = ad(K, G)), !re) return !1;
            if (!u.current && "changedTouches" in w && (z || F) && (u.current = W), !W) return !0;
            var pe = u.current || W;
            return d0(pe, N, w, pe === "h" ? z : F)
        }, []),
        h = g.useCallback(function(w) {
            var N = w;
            if (!(!Cr.length || Cr[Cr.length - 1] !== d)) {
                var M = "deltaY" in N ? ud(N) : Ul(N),
                    O = s.current.filter(function(W) {
                        return W.name === N.type && (W.target === N.target || N.target === W.shadowParent) && p0(W.delta, M)
                    })[0];
                if (O && O.should) {
                    N.cancelable && N.preventDefault();
                    return
                }
                if (!O) {
                    var z = (m.current.shards || []).map(cd).filter(Boolean).filter(function(W) {
                            return W.contains(N.target)
                        }),
                        F = z.length > 0 ? p(N, z[0]) : !m.current.noIsolation;
                    F && N.cancelable && N.preventDefault()
                }
            }
        }, []),
        y = g.useCallback(function(w, N, M, O) {
            var z = {
                name: w,
                delta: N,
                target: M,
                should: O,
                shadowParent: g0(M)
            };
            s.current.push(z), setTimeout(function() {
                s.current = s.current.filter(function(F) {
                    return F !== z
                })
            }, 1)
        }, []),
        S = g.useCallback(function(w) {
            i.current = Ul(w), u.current = void 0
        }, []),
        C = g.useCallback(function(w) {
            y(w.type, ud(w), w.target, p(w, r.lockRef.current))
        }, []),
        R = g.useCallback(function(w) {
            y(w.type, Ul(w), w.target, p(w, r.lockRef.current))
        }, []);
    g.useEffect(function() {
        return Cr.push(d), r.setCallbacks({
                onScrollCapture: C,
                onWheelCapture: C,
                onTouchMoveCapture: R
            }), document.addEventListener("wheel", h, Sr), document.addEventListener("touchmove", h, Sr), document.addEventListener("touchstart", S, Sr),
            function() {
                Cr = Cr.filter(function(w) {
                    return w !== d
                }), document.removeEventListener("wheel", h, Sr), document.removeEventListener("touchmove", h, Sr), document.removeEventListener("touchstart", S, Sr)
            }
    }, []);
    var _ = r.removeScrollBar,
        A = r.inert;
    return g.createElement(g.Fragment, null, A ? g.createElement(d, {
        styles: m0(c)
    }) : null, _ ? g.createElement(l0, {
        gapMode: r.gapMode
    }) : null)
}

function g0(r) {
    for (var s = null; r !== null;) r instanceof ShadowRoot && (s = r.host, r = r.host), r = r.parentNode;
    return s
}
const y0 = Ky(lp, v0);
var cp = g.forwardRef(function(r, s) {
    return g.createElement(oi, Ft({}, r, {
        ref: s,
        sideCar: y0
    }))
});
cp.classNames = oi.classNames;
var w0 = [" ", "Enter", "ArrowUp", "ArrowDown"],
    x0 = [" ", "Enter"],
    Qn = "Select",
    [li, ii, S0] = Yv(Qn),
    [Ir, lw] = Ra(Qn, [S0, $d]),
    si = $d(),
    [C0, In] = Ir(Qn),
    [E0, k0] = Ir(Qn),
    fp = r => {
        const {
            __scopeSelect: s,
            children: i,
            open: u,
            defaultOpen: c,
            onOpenChange: d,
            value: m,
            defaultValue: p,
            onValueChange: h,
            dir: y,
            name: S,
            autoComplete: C,
            disabled: R,
            required: _,
            form: A
        } = r, w = si(s), [N, M] = g.useState(null), [O, z] = g.useState(null), [F, W] = g.useState(!1), G = Zv(y), [K, re] = ld({
            prop: u,
            defaultProp: c ?? !1,
            onChange: d,
            caller: Qn
        }), [pe, se] = ld({
            prop: m,
            defaultProp: p,
            onChange: h,
            caller: Qn
        }), ve = g.useRef(null), Z = N ? A || !!N.closest("form") : !0, [ae, fe] = g.useState(new Set), me = Array.from(ae).map(oe => oe.props.value).join(";");
        return P.jsx(Cy, {
            ...w,
            children: P.jsxs(C0, {
                required: _,
                scope: s,
                trigger: N,
                onTriggerChange: M,
                valueNode: O,
                onValueNodeChange: z,
                valueNodeHasChildren: F,
                onValueNodeHasChildrenChange: W,
                contentId: Ta(),
                value: pe,
                onValueChange: se,
                open: K,
                onOpenChange: re,
                dir: G,
                triggerPointerDownPosRef: ve,
                disabled: R,
                children: [P.jsx(li.Provider, {
                    scope: s,
                    children: P.jsx(E0, {
                        scope: r.__scopeSelect,
                        onNativeOptionAdd: g.useCallback(oe => {
                            fe(ee => new Set(ee).add(oe))
                        }, []),
                        onNativeOptionRemove: g.useCallback(oe => {
                            fe(ee => {
                                const j = new Set(ee);
                                return j.delete(oe), j
                            })
                        }, []),
                        children: i
                    })
                }), Z ? P.jsxs(zp, {
                    "aria-hidden": !0,
                    required: _,
                    tabIndex: -1,
                    name: S,
                    autoComplete: C,
                    value: pe,
                    onChange: oe => se(oe.target.value),
                    disabled: R,
                    form: A,
                    children: [pe === void 0 ? P.jsx("option", {
                        value: ""
                    }) : null, Array.from(ae)]
                }, me) : null]
            })
        })
    };
fp.displayName = Qn;
var dp = "SelectTrigger",
    pp = g.forwardRef((r, s) => {
        const {
            __scopeSelect: i,
            disabled: u = !1,
            ...c
        } = r, d = si(i), m = In(dp, i), p = m.disabled || u, h = Ye(s, m.onTriggerChange), y = ii(i), S = g.useRef("touch"), [C, R, _] = Dp(w => {
            const N = y().filter(z => !z.disabled),
                M = N.find(z => z.value === m.value),
                O = Fp(N, w, M);
            O !== void 0 && m.onValueChange(O.value)
        }), A = w => {
            p || (m.onOpenChange(!0), _()), w && (m.triggerPointerDownPosRef.current = {
                x: Math.round(w.pageX),
                y: Math.round(w.pageY)
            })
        };
        return P.jsx(Ey, {
            asChild: !0,
            ...d,
            children: P.jsx(ze.button, {
                type: "button",
                role: "combobox",
                "aria-controls": m.contentId,
                "aria-expanded": m.open,
                "aria-required": m.required,
                "aria-autocomplete": "none",
                dir: m.dir,
                "data-state": m.open ? "open" : "closed",
                disabled: p,
                "data-disabled": p ? "" : void 0,
                "data-placeholder": jp(m.value) ? "" : void 0,
                ...c,
                ref: h,
                onClick: be(c.onClick, w => {
                    w.currentTarget.focus(), S.current !== "mouse" && A(w)
                }),
                onPointerDown: be(c.onPointerDown, w => {
                    S.current = w.pointerType;
                    const N = w.target;
                    N.hasPointerCapture(w.pointerId) && N.releasePointerCapture(w.pointerId), w.button === 0 && w.ctrlKey === !1 && w.pointerType === "mouse" && (A(w), w.preventDefault())
                }),
                onKeyDown: be(c.onKeyDown, w => {
                    const N = C.current !== "";
                    !(w.ctrlKey || w.altKey || w.metaKey) && w.key.length === 1 && R(w.key), !(N && w.key === " ") && w0.includes(w.key) && (A(), w.preventDefault())
                })
            })
        })
    });
pp.displayName = dp;
var mp = "SelectValue",
    hp = g.forwardRef((r, s) => {
        const {
            __scopeSelect: i,
            className: u,
            style: c,
            children: d,
            placeholder: m = "",
            ...p
        } = r, h = In(mp, i), {
            onValueNodeHasChildrenChange: y
        } = h, S = d !== void 0, C = Ye(s, h.onValueNodeChange);
        return ct(() => {
            y(S)
        }, [y, S]), P.jsx(ze.span, {
            ...p,
            ref: C,
            style: {
                pointerEvents: "none"
            },
            children: jp(h.value) ? P.jsx(P.Fragment, {
                children: m
            }) : d
        })
    });
hp.displayName = mp;
var P0 = "SelectIcon",
    vp = g.forwardRef((r, s) => {
        const {
            __scopeSelect: i,
            children: u,
            ...c
        } = r;
        return P.jsx(ze.span, {
            "aria-hidden": !0,
            ...c,
            ref: s,
            children: u || "▼"
        })
    });
vp.displayName = P0;
var N0 = "SelectPortal",
    gp = r => P.jsx(ep, {
        asChild: !0,
        ...r
    });
gp.displayName = N0;
var Gn = "SelectContent",
    yp = g.forwardRef((r, s) => {
        const i = In(Gn, r.__scopeSelect),
            [u, c] = g.useState();
        if (ct(() => {
                c(new DocumentFragment)
            }, []), !i.open) {
            const d = u;
            return d ? ko.createPortal(P.jsx(wp, {
                scope: r.__scopeSelect,
                children: P.jsx(li.Slot, {
                    scope: r.__scopeSelect,
                    children: P.jsx("div", {
                        children: r.children
                    })
                })
            }), d) : null
        }
        return P.jsx(xp, {
            ...r,
            ref: s
        })
    });
yp.displayName = Gn;
var It = 10,
    [wp, Ln] = Ir(Gn),
    R0 = "SelectContentImpl",
    T0 = Yl("SelectContent.RemoveScroll"),
    xp = g.forwardRef((r, s) => {
        const {
            __scopeSelect: i,
            position: u = "item-aligned",
            onCloseAutoFocus: c,
            onEscapeKeyDown: d,
            onPointerDownOutside: m,
            side: p,
            sideOffset: h,
            align: y,
            alignOffset: S,
            arrowPadding: C,
            collisionBoundary: R,
            collisionPadding: _,
            sticky: A,
            hideWhenDetached: w,
            avoidCollisions: N,
            ...M
        } = r, O = In(Gn, i), [z, F] = g.useState(null), [W, G] = g.useState(null), K = Ye(s, Q => F(Q)), [re, pe] = g.useState(null), [se, ve] = g.useState(null), Z = ii(i), [ae, fe] = g.useState(!1), me = g.useRef(!1);
        g.useEffect(() => {
            if (z) return jy(z)
        }, [z]), ig();
        const oe = g.useCallback(Q => {
                const [ne, ...ye] = Z().map(Pe => Pe.ref.current), [xe] = ye.slice(-1), Ce = document.activeElement;
                for (const Pe of Q)
                    if (Pe === Ce || (Pe == null || Pe.scrollIntoView({
                            block: "nearest"
                        }), Pe === ne && W && (W.scrollTop = 0), Pe === xe && W && (W.scrollTop = W.scrollHeight), Pe == null || Pe.focus(), document.activeElement !== Ce)) return
            }, [Z, W]),
            ee = g.useCallback(() => oe([re, z]), [oe, re, z]);
        g.useEffect(() => {
            ae && ee()
        }, [ae, ee]);
        const {
            onOpenChange: j,
            triggerPointerDownPosRef: $
        } = O;
        g.useEffect(() => {
            if (z) {
                let Q = {
                    x: 0,
                    y: 0
                };
                const ne = xe => {
                        var Ce, Pe;
                        Q = {
                            x: Math.abs(Math.round(xe.pageX) - (((Ce = $.current) == null ? void 0 : Ce.x) ?? 0)),
                            y: Math.abs(Math.round(xe.pageY) - (((Pe = $.current) == null ? void 0 : Pe.y) ?? 0))
                        }
                    },
                    ye = xe => {
                        Q.x <= 10 && Q.y <= 10 ? xe.preventDefault() : z.contains(xe.target) || j(!1), document.removeEventListener("pointermove", ne), $.current = null
                    };
                return $.current !== null && (document.addEventListener("pointermove", ne), document.addEventListener("pointerup", ye, {
                    capture: !0,
                    once: !0
                })), () => {
                    document.removeEventListener("pointermove", ne), document.removeEventListener("pointerup", ye, {
                        capture: !0
                    })
                }
            }
        }, [z, j, $]), g.useEffect(() => {
            const Q = () => j(!1);
            return window.addEventListener("blur", Q), window.addEventListener("resize", Q), () => {
                window.removeEventListener("blur", Q), window.removeEventListener("resize", Q)
            }
        }, [j]);
        const [V, E] = Dp(Q => {
            const ne = Z().filter(Ce => !Ce.disabled),
                ye = ne.find(Ce => Ce.ref.current === document.activeElement),
                xe = Fp(ne, Q, ye);
            xe && setTimeout(() => xe.ref.current.focus())
        }), D = g.useCallback((Q, ne, ye) => {
            const xe = !me.current && !ye;
            (O.value !== void 0 && O.value === ne || xe) && (pe(Q), xe && (me.current = !0))
        }, [O.value]), ce = g.useCallback(() => z == null ? void 0 : z.focus(), [z]), ue = g.useCallback((Q, ne, ye) => {
            const xe = !me.current && !ye;
            (O.value !== void 0 && O.value === ne || xe) && ve(Q)
        }, [O.value]), ge = u === "popper" ? xa : Sp, he = ge === xa ? {
            side: p,
            sideOffset: h,
            align: y,
            alignOffset: S,
            arrowPadding: C,
            collisionBoundary: R,
            collisionPadding: _,
            sticky: A,
            hideWhenDetached: w,
            avoidCollisions: N
        } : {};
        return P.jsx(wp, {
            scope: i,
            content: z,
            viewport: W,
            onViewportChange: G,
            itemRefCallback: D,
            selectedItem: re,
            onItemLeave: ce,
            itemTextRefCallback: ue,
            focusSelectedItem: ee,
            selectedItemText: se,
            position: u,
            isPositioned: ae,
            searchRef: V,
            children: P.jsx(cp, {
                as: T0,
                allowPinchZoom: !0,
                children: P.jsx(Ld, {
                    asChild: !0,
                    trapped: O.open,
                    onMountAutoFocus: Q => {
                        Q.preventDefault()
                    },
                    onUnmountAutoFocus: be(c, Q => {
                        var ne;
                        (ne = O.trigger) == null || ne.focus({
                            preventScroll: !0
                        }), Q.preventDefault()
                    }),
                    children: P.jsx(_d, {
                        asChild: !0,
                        disableOutsidePointerEvents: !0,
                        onEscapeKeyDown: d,
                        onPointerDownOutside: m,
                        onFocusOutside: Q => Q.preventDefault(),
                        onDismiss: () => O.onOpenChange(!1),
                        children: P.jsx(ge, {
                            role: "listbox",
                            id: O.contentId,
                            "data-state": O.open ? "open" : "closed",
                            dir: O.dir,
                            onContextMenu: Q => Q.preventDefault(),
                            ...M,
                            ...he,
                            onPlaced: () => fe(!0),
                            ref: K,
                            style: {
                                display: "flex",
                                flexDirection: "column",
                                outline: "none",
                                ...M.style
                            },
                            onKeyDown: be(M.onKeyDown, Q => {
                                const ne = Q.ctrlKey || Q.altKey || Q.metaKey;
                                if (Q.key === "Tab" && Q.preventDefault(), !ne && Q.key.length === 1 && E(Q.key), ["ArrowUp", "ArrowDown", "Home", "End"].includes(Q.key)) {
                                    let xe = Z().filter(Ce => !Ce.disabled).map(Ce => Ce.ref.current);
                                    if (["ArrowUp", "End"].includes(Q.key) && (xe = xe.slice().reverse()), ["ArrowUp", "ArrowDown"].includes(Q.key)) {
                                        const Ce = Q.target,
                                            Pe = xe.indexOf(Ce);
                                        xe = xe.slice(Pe + 1)
                                    }
                                    setTimeout(() => oe(xe)), Q.preventDefault()
                                }
                            })
                        })
                    })
                })
            })
        })
    });
xp.displayName = R0;
var _0 = "SelectItemAlignedPosition",
    Sp = g.forwardRef((r, s) => {
        const {
            __scopeSelect: i,
            onPlaced: u,
            ...c
        } = r, d = In(Gn, i), m = Ln(Gn, i), [p, h] = g.useState(null), [y, S] = g.useState(null), C = Ye(s, K => S(K)), R = ii(i), _ = g.useRef(!1), A = g.useRef(!0), {
            viewport: w,
            selectedItem: N,
            selectedItemText: M,
            focusSelectedItem: O
        } = m, z = g.useCallback(() => {
            if (d.trigger && d.valueNode && p && y && w && N && M) {
                const K = d.trigger.getBoundingClientRect(),
                    re = y.getBoundingClientRect(),
                    pe = d.valueNode.getBoundingClientRect(),
                    se = M.getBoundingClientRect();
                if (d.dir !== "rtl") {
                    const Ce = se.left - re.left,
                        Pe = pe.left - Ce,
                        Ve = K.left - Pe,
                        rt = K.width + Ve,
                        tn = Math.max(rt, re.width),
                        nn = window.innerWidth - It,
                        Vt = Wf(Pe, [It, Math.max(It, nn - tn)]);
                    p.style.minWidth = rt + "px", p.style.left = Vt + "px"
                } else {
                    const Ce = re.right - se.right,
                        Pe = window.innerWidth - pe.right - Ce,
                        Ve = window.innerWidth - K.right - Pe,
                        rt = K.width + Ve,
                        tn = Math.max(rt, re.width),
                        nn = window.innerWidth - It,
                        Vt = Wf(Pe, [It, Math.max(It, nn - tn)]);
                    p.style.minWidth = rt + "px", p.style.right = Vt + "px"
                }
                const ve = R(),
                    Z = window.innerHeight - It * 2,
                    ae = w.scrollHeight,
                    fe = window.getComputedStyle(y),
                    me = parseInt(fe.borderTopWidth, 10),
                    oe = parseInt(fe.paddingTop, 10),
                    ee = parseInt(fe.borderBottomWidth, 10),
                    j = parseInt(fe.paddingBottom, 10),
                    $ = me + oe + ae + j + ee,
                    V = Math.min(N.offsetHeight * 5, $),
                    E = window.getComputedStyle(w),
                    D = parseInt(E.paddingTop, 10),
                    ce = parseInt(E.paddingBottom, 10),
                    ue = K.top + K.height / 2 - It,
                    ge = Z - ue,
                    he = N.offsetHeight / 2,
                    Q = N.offsetTop + he,
                    ne = me + oe + Q,
                    ye = $ - ne;
                if (ne <= ue) {
                    const Ce = ve.length > 0 && N === ve[ve.length - 1].ref.current;
                    p.style.bottom = "0px";
                    const Pe = y.clientHeight - w.offsetTop - w.offsetHeight,
                        Ve = Math.max(ge, he + (Ce ? ce : 0) + Pe + ee),
                        rt = ne + Ve;
                    p.style.height = rt + "px"
                } else {
                    const Ce = ve.length > 0 && N === ve[0].ref.current;
                    p.style.top = "0px";
                    const Ve = Math.max(ue, me + w.offsetTop + (Ce ? D : 0) + he) + ye;
                    p.style.height = Ve + "px", w.scrollTop = ne - ue + w.offsetTop
                }
                p.style.margin = `${It}px 0`, p.style.minHeight = V + "px", p.style.maxHeight = Z + "px", u == null || u(), requestAnimationFrame(() => _.current = !0)
            }
        }, [R, d.trigger, d.valueNode, p, y, w, N, M, d.dir, u]);
        ct(() => z(), [z]);
        const [F, W] = g.useState();
        ct(() => {
            y && W(window.getComputedStyle(y).zIndex)
        }, [y]);
        const G = g.useCallback(K => {
            K && A.current === !0 && (z(), O == null || O(), A.current = !1)
        }, [z, O]);
        return P.jsx(L0, {
            scope: i,
            contentWrapper: p,
            shouldExpandOnScrollRef: _,
            onScrollButtonChange: G,
            children: P.jsx("div", {
                ref: h,
                style: {
                    display: "flex",
                    flexDirection: "column",
                    position: "fixed",
                    zIndex: F
                },
                children: P.jsx(ze.div, {
                    ...c,
                    ref: C,
                    style: {
                        boxSizing: "border-box",
                        maxHeight: "100%",
                        ...c.style
                    }
                })
            })
        })
    });
Sp.displayName = _0;
var I0 = "SelectPopperPosition",
    xa = g.forwardRef((r, s) => {
        const {
            __scopeSelect: i,
            align: u = "start",
            collisionPadding: c = It,
            ...d
        } = r, m = si(i);
        return P.jsx(ky, {
            ...m,
            ...d,
            ref: s,
            align: u,
            collisionPadding: c,
            style: {
                boxSizing: "border-box",
                ...d.style,
                "--radix-select-content-transform-origin": "var(--radix-popper-transform-origin)",
                "--radix-select-content-available-width": "var(--radix-popper-available-width)",
                "--radix-select-content-available-height": "var(--radix-popper-available-height)",
                "--radix-select-trigger-width": "var(--radix-popper-anchor-width)",
                "--radix-select-trigger-height": "var(--radix-popper-anchor-height)"
            }
        })
    });
xa.displayName = I0;
var [L0, Fa] = Ir(Gn, {}), Sa = "SelectViewport", Cp = g.forwardRef((r, s) => {
    const {
        __scopeSelect: i,
        nonce: u,
        ...c
    } = r, d = Ln(Sa, i), m = Fa(Sa, i), p = Ye(s, d.onViewportChange), h = g.useRef(0);
    return P.jsxs(P.Fragment, {
        children: [P.jsx("style", {
            dangerouslySetInnerHTML: {
                __html: "[data-radix-select-viewport]{scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;}[data-radix-select-viewport]::-webkit-scrollbar{display:none}"
            },
            nonce: u
        }), P.jsx(li.Slot, {
            scope: i,
            children: P.jsx(ze.div, {
                "data-radix-select-viewport": "",
                role: "presentation",
                ...c,
                ref: p,
                style: {
                    position: "relative",
                    flex: 1,
                    overflow: "hidden auto",
                    ...c.style
                },
                onScroll: be(c.onScroll, y => {
                    const S = y.currentTarget,
                        {
                            contentWrapper: C,
                            shouldExpandOnScrollRef: R
                        } = m;
                    if (R != null && R.current && C) {
                        const _ = Math.abs(h.current - S.scrollTop);
                        if (_ > 0) {
                            const A = window.innerHeight - It * 2,
                                w = parseFloat(C.style.minHeight),
                                N = parseFloat(C.style.height),
                                M = Math.max(w, N);
                            if (M < A) {
                                const O = M + _,
                                    z = Math.min(A, O),
                                    F = O - z;
                                C.style.height = z + "px", C.style.bottom === "0px" && (S.scrollTop = F > 0 ? F : 0, C.style.justifyContent = "flex-end")
                            }
                        }
                    }
                    h.current = S.scrollTop
                })
            })
        })]
    })
});
Cp.displayName = Sa;
var Ep = "SelectGroup",
    [O0, M0] = Ir(Ep),
    A0 = g.forwardRef((r, s) => {
        const {
            __scopeSelect: i,
            ...u
        } = r, c = Ta();
        return P.jsx(O0, {
            scope: i,
            id: c,
            children: P.jsx(ze.div, {
                role: "group",
                "aria-labelledby": c,
                ...u,
                ref: s
            })
        })
    });
A0.displayName = Ep;
var kp = "SelectLabel",
    Pp = g.forwardRef((r, s) => {
        const {
            __scopeSelect: i,
            ...u
        } = r, c = M0(kp, i);
        return P.jsx(ze.div, {
            id: c.id,
            ...u,
            ref: s
        })
    });
Pp.displayName = kp;
var ei = "SelectItem",
    [z0, Np] = Ir(ei),
    Rp = g.forwardRef((r, s) => {
        const {
            __scopeSelect: i,
            value: u,
            disabled: c = !1,
            textValue: d,
            ...m
        } = r, p = In(ei, i), h = Ln(ei, i), y = p.value === u, [S, C] = g.useState(d ?? ""), [R, _] = g.useState(!1), A = Ye(s, O => {
            var z;
            return (z = h.itemRefCallback) == null ? void 0 : z.call(h, O, u, c)
        }), w = Ta(), N = g.useRef("touch"), M = () => {
            c || (p.onValueChange(u), p.onOpenChange(!1))
        };
        if (u === "") throw new Error("A <Select.Item /> must have a value prop that is not an empty string. This is because the Select value can be set to an empty string to clear the selection and show the placeholder.");
        return P.jsx(z0, {
            scope: i,
            value: u,
            disabled: c,
            textId: w,
            isSelected: y,
            onItemTextChange: g.useCallback(O => {
                C(z => z || ((O == null ? void 0 : O.textContent) ?? "").trim())
            }, []),
            children: P.jsx(li.ItemSlot, {
                scope: i,
                value: u,
                disabled: c,
                textValue: S,
                children: P.jsx(ze.div, {
                    role: "option",
                    "aria-labelledby": w,
                    "data-highlighted": R ? "" : void 0,
                    "aria-selected": y && R,
                    "data-state": y ? "checked" : "unchecked",
                    "aria-disabled": c || void 0,
                    "data-disabled": c ? "" : void 0,
                    tabIndex: c ? void 0 : -1,
                    ...m,
                    ref: A,
                    onFocus: be(m.onFocus, () => _(!0)),
                    onBlur: be(m.onBlur, () => _(!1)),
                    onClick: be(m.onClick, () => {
                        N.current !== "mouse" && M()
                    }),
                    onPointerUp: be(m.onPointerUp, () => {
                        N.current === "mouse" && M()
                    }),
                    onPointerDown: be(m.onPointerDown, O => {
                        N.current = O.pointerType
                    }),
                    onPointerMove: be(m.onPointerMove, O => {
                        var z;
                        N.current = O.pointerType, c ? (z = h.onItemLeave) == null || z.call(h) : N.current === "mouse" && O.currentTarget.focus({
                            preventScroll: !0
                        })
                    }),
                    onPointerLeave: be(m.onPointerLeave, O => {
                        var z;
                        O.currentTarget === document.activeElement && ((z = h.onItemLeave) == null || z.call(h))
                    }),
                    onKeyDown: be(m.onKeyDown, O => {
                        var F;
                        ((F = h.searchRef) == null ? void 0 : F.current) !== "" && O.key === " " || (x0.includes(O.key) && M(), O.key === " " && O.preventDefault())
                    })
                })
            })
        })
    });
Rp.displayName = ei;
var xo = "SelectItemText",
    Tp = g.forwardRef((r, s) => {
        const {
            __scopeSelect: i,
            className: u,
            style: c,
            ...d
        } = r, m = In(xo, i), p = Ln(xo, i), h = Np(xo, i), y = k0(xo, i), [S, C] = g.useState(null), R = Ye(s, M => C(M), h.onItemTextChange, M => {
            var O;
            return (O = p.itemTextRefCallback) == null ? void 0 : O.call(p, M, h.value, h.disabled)
        }), _ = S == null ? void 0 : S.textContent, A = g.useMemo(() => P.jsx("option", {
            value: h.value,
            disabled: h.disabled,
            children: _
        }, h.value), [h.disabled, h.value, _]), {
            onNativeOptionAdd: w,
            onNativeOptionRemove: N
        } = y;
        return ct(() => (w(A), () => N(A)), [w, N, A]), P.jsxs(P.Fragment, {
            children: [P.jsx(ze.span, {
                id: h.textId,
                ...d,
                ref: R
            }), h.isSelected && m.valueNode && !m.valueNodeHasChildren ? ko.createPortal(d.children, m.valueNode) : null]
        })
    });
Tp.displayName = xo;
var _p = "SelectItemIndicator",
    Ip = g.forwardRef((r, s) => {
        const {
            __scopeSelect: i,
            ...u
        } = r;
        return Np(_p, i).isSelected ? P.jsx(ze.span, {
            "aria-hidden": !0,
            ...u,
            ref: s
        }) : null
    });
Ip.displayName = _p;
var Ca = "SelectScrollUpButton",
    Lp = g.forwardRef((r, s) => {
        const i = Ln(Ca, r.__scopeSelect),
            u = Fa(Ca, r.__scopeSelect),
            [c, d] = g.useState(!1),
            m = Ye(s, u.onScrollButtonChange);
        return ct(() => {
            if (i.viewport && i.isPositioned) {
                let p = function() {
                    const y = h.scrollTop > 0;
                    d(y)
                };
                const h = i.viewport;
                return p(), h.addEventListener("scroll", p), () => h.removeEventListener("scroll", p)
            }
        }, [i.viewport, i.isPositioned]), c ? P.jsx(Mp, {
            ...r,
            ref: m,
            onAutoScroll: () => {
                const {
                    viewport: p,
                    selectedItem: h
                } = i;
                p && h && (p.scrollTop = p.scrollTop - h.offsetHeight)
            }
        }) : null
    });
Lp.displayName = Ca;
var Ea = "SelectScrollDownButton",
    Op = g.forwardRef((r, s) => {
        const i = Ln(Ea, r.__scopeSelect),
            u = Fa(Ea, r.__scopeSelect),
            [c, d] = g.useState(!1),
            m = Ye(s, u.onScrollButtonChange);
        return ct(() => {
            if (i.viewport && i.isPositioned) {
                let p = function() {
                    const y = h.scrollHeight - h.clientHeight,
                        S = Math.ceil(h.scrollTop) < y;
                    d(S)
                };
                const h = i.viewport;
                return p(), h.addEventListener("scroll", p), () => h.removeEventListener("scroll", p)
            }
        }, [i.viewport, i.isPositioned]), c ? P.jsx(Mp, {
            ...r,
            ref: m,
            onAutoScroll: () => {
                const {
                    viewport: p,
                    selectedItem: h
                } = i;
                p && h && (p.scrollTop = p.scrollTop + h.offsetHeight)
            }
        }) : null
    });
Op.displayName = Ea;
var Mp = g.forwardRef((r, s) => {
        const {
            __scopeSelect: i,
            onAutoScroll: u,
            ...c
        } = r, d = Ln("SelectScrollButton", i), m = g.useRef(null), p = ii(i), h = g.useCallback(() => {
            m.current !== null && (window.clearInterval(m.current), m.current = null)
        }, []);
        return g.useEffect(() => () => h(), [h]), ct(() => {
            var S;
            const y = p().find(C => C.ref.current === document.activeElement);
            (S = y == null ? void 0 : y.ref.current) == null || S.scrollIntoView({
                block: "nearest"
            })
        }, [p]), P.jsx(ze.div, {
            "aria-hidden": !0,
            ...c,
            ref: s,
            style: {
                flexShrink: 0,
                ...c.style
            },
            onPointerDown: be(c.onPointerDown, () => {
                m.current === null && (m.current = window.setInterval(u, 50))
            }),
            onPointerMove: be(c.onPointerMove, () => {
                var y;
                (y = d.onItemLeave) == null || y.call(d), m.current === null && (m.current = window.setInterval(u, 50))
            }),
            onPointerLeave: be(c.onPointerLeave, () => {
                h()
            })
        })
    }),
    j0 = "SelectSeparator",
    Ap = g.forwardRef((r, s) => {
        const {
            __scopeSelect: i,
            ...u
        } = r;
        return P.jsx(ze.div, {
            "aria-hidden": !0,
            ...u,
            ref: s
        })
    });
Ap.displayName = j0;
var ka = "SelectArrow",
    D0 = g.forwardRef((r, s) => {
        const {
            __scopeSelect: i,
            ...u
        } = r, c = si(i), d = In(ka, i), m = Ln(ka, i);
        return d.open && m.position === "popper" ? P.jsx(Py, {
            ...c,
            ...u,
            ref: s
        }) : null
    });
D0.displayName = ka;
var F0 = "SelectBubbleInput",
    zp = g.forwardRef(({
        __scopeSelect: r,
        value: s,
        ...i
    }, u) => {
        const c = g.useRef(null),
            d = Ye(u, c),
            m = Iy(s);
        return g.useEffect(() => {
            const p = c.current;
            if (!p) return;
            const h = window.HTMLSelectElement.prototype,
                S = Object.getOwnPropertyDescriptor(h, "value").set;
            if (m !== s && S) {
                const C = new Event("change", {
                    bubbles: !0
                });
                S.call(p, s), p.dispatchEvent(C)
            }
        }, [m, s]), P.jsx(ze.select, {
            ...i,
            style: {
                ...tp,
                ...i.style
            },
            ref: d,
            defaultValue: s
        })
    });
zp.displayName = F0;

function jp(r) {
    return r === "" || r === void 0
}

function Dp(r) {
    const s = $n(r),
        i = g.useRef(""),
        u = g.useRef(0),
        c = g.useCallback(m => {
            const p = i.current + m;
            s(p),
                function h(y) {
                    i.current = y, window.clearTimeout(u.current), y !== "" && (u.current = window.setTimeout(() => h(""), 1e3))
                }(p)
        }, [s]),
        d = g.useCallback(() => {
            i.current = "", window.clearTimeout(u.current)
        }, []);
    return g.useEffect(() => () => window.clearTimeout(u.current), []), [i, c, d]
}

function Fp(r, s, i) {
    const c = s.length > 1 && Array.from(s).every(y => y === s[0]) ? s[0] : s,
        d = i ? r.indexOf(i) : -1;
    let m = b0(r, Math.max(d, 0));
    c.length === 1 && (m = m.filter(y => y !== i));
    const h = m.find(y => y.textValue.toLowerCase().startsWith(c.toLowerCase()));
    return h !== i ? h : void 0
}

function b0(r, s) {
    return r.map((i, u) => r[(s + u) % r.length])
}
var U0 = fp,
    bp = pp,
    B0 = hp,
    V0 = vp,
    W0 = gp,
    Up = yp,
    H0 = Cp,
    Bp = Pp,
    Vp = Rp,
    $0 = Tp,
    K0 = Ip,
    Wp = Lp,
    Hp = Op,
    $p = Ap;
/**
 * @license lucide-react v0.364.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var Q0 = {
    xmlns: "http://www.w3.org/2000/svg",
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round"
};
/**
 * @license lucide-react v0.364.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const G0 = r => r.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
/**
 * @license lucide-react v0.364.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const ba = (r, s) => {
    const i = g.forwardRef(({
        color: u = "currentColor",
        size: c = 24,
        strokeWidth: d = 2,
        absoluteStrokeWidth: m,
        className: p = "",
        children: h,
        ...y
    }, S) => g.createElement("svg", {
        ref: S,
        ...Q0,
        width: c,
        height: c,
        stroke: u,
        strokeWidth: m ? Number(d) * 24 / Number(c) : d,
        className: ["lucide", `lucide-${G0(r)}`, p].join(" "),
        ...y
    }, [...s.map(([C, R]) => g.createElement(C, R)), ...Array.isArray(h) ? h : [h]]));
    return i.displayName = `${r}`, i
};
/**
 * @license lucide-react v0.364.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Y0 = ba("Check", [
    ["path", {
        d: "M20 6 9 17l-5-5",
        key: "1gmf2c"
    }]
]);
/**
 * @license lucide-react v0.364.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Kp = ba("ChevronDown", [
    ["path", {
        d: "m6 9 6 6 6-6",
        key: "qrunsl"
    }]
]);
/**
 * @license lucide-react v0.364.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const X0 = ba("ChevronUp", [
        ["path", {
            d: "m18 15-6-6-6 6",
            key: "153udz"
        }]
    ]),
    Z0 = U0,
    q0 = B0,
    Qp = g.forwardRef(({
        className: r,
        children: s,
        ...i
    }, u) => P.jsxs(bp, {
        ref: u,
        className: et("flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 dark:border-zinc-800 dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus:ring-zinc-300", r),
        ...i,
        children: [s, P.jsx(V0, {
            asChild: !0,
            children: P.jsx(Kp, {
                className: "h-4 w-4 opacity-50"
            })
        })]
    }));
Qp.displayName = bp.displayName;
const Gp = g.forwardRef(({
    className: r,
    ...s
}, i) => P.jsx(Wp, {
    ref: i,
    className: et("flex cursor-default items-center justify-center py-1", r),
    ...s,
    children: P.jsx(X0, {
        className: "h-4 w-4"
    })
}));
Gp.displayName = Wp.displayName;
const Yp = g.forwardRef(({
    className: r,
    ...s
}, i) => P.jsx(Hp, {
    ref: i,
    className: et("flex cursor-default items-center justify-center py-1", r),
    ...s,
    children: P.jsx(Kp, {
        className: "h-4 w-4"
    })
}));
Yp.displayName = Hp.displayName;
const Xp = g.forwardRef(({
    className: r,
    children: s,
    position: i = "popper",
    ...u
}, c) => P.jsx(W0, {
    children: P.jsxs(Up, {
        ref: c,
        className: et("relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border border-zinc-200 bg-white text-zinc-950 shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50", i === "popper" && "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1", r),
        position: i,
        ...u,
        children: [P.jsx(Gp, {}), P.jsx(H0, {
            className: et("p-1", i === "popper" && "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"),
            children: s
        }), P.jsx(Yp, {})]
    })
}));
Xp.displayName = Up.displayName;
const J0 = g.forwardRef(({
    className: r,
    ...s
}, i) => P.jsx(Bp, {
    ref: i,
    className: et("px-2 py-1.5 text-sm font-semibold", r),
    ...s
}));
J0.displayName = Bp.displayName;
const Gl = g.forwardRef(({
    className: r,
    children: s,
    ...i
}, u) => P.jsxs(Vp, {
    ref: u,
    className: et("relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-zinc-100 focus:text-zinc-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 dark:focus:bg-zinc-800 dark:focus:text-zinc-50", r),
    ...i,
    children: [P.jsx("span", {
        className: "absolute right-2 flex h-3.5 w-3.5 items-center justify-center",
        children: P.jsx(K0, {
            children: P.jsx(Y0, {
                className: "h-4 w-4"
            })
        })
    }), P.jsx($0, {
        children: s
    })]
}));
Gl.displayName = Vp.displayName;
const ew = g.forwardRef(({
    className: r,
    ...s
}, i) => P.jsx($p, {
    ref: i,
    className: et("-mx-1 my-1 h-px bg-zinc-100 dark:bg-zinc-800", r),
    ...s
}));
ew.displayName = $p.displayName;
const fd = {
        "SATURN 2": {
            tempoImpressaoHoras: 0,
            tempoImpressaoMinutos: 0,
            materialUtilizado: 0,
            numImpressoes: 0,
            precoMaterialKg: 125,
            precoKWH: 1.2,
            potenciaW: 400,
            valorMaquina: 2600,
            tempoDepreciacaoHoras: 2e3,
            taxaFalhaPercent: 20,
            impostoPercent: 10,
            taxaLucroPercent: 150,
            materialConsumoValor: 2,
            precoSTL: 0,
            stlPecas: 1
        },
        K1M: {
            tempoImpressaoHoras: 0,
            tempoImpressaoMinutos: 0,
            materialUtilizado: 0,
            numImpressoes: 0,
            precoMaterialKg: 64,
            precoKWH: 1.2,
            potenciaW: 650,
            valorMaquina: 4600,
            tempoDepreciacaoHoras: 6e3,
            taxaFalhaPercent: 20,
            impostoPercent: 10,
            taxaLucroPercent: 150,
            materialConsumoValor: 0,
            precoSTL: 0,
            stlPecas: 5
        },
        K1: {
            tempoImpressaoHoras: 0,
            tempoImpressaoMinutos: 0,
            materialUtilizado: 0,
            numImpressoes: 0,
            precoMaterialKg: 126,
            precoKWH: 1.2,
            potenciaW: 400,
            valorMaquina: 2600,
            tempoDepreciacaoHoras: 6e3,
            taxaFalhaPercent: 20,
            impostoPercent: 10,
            taxaLucroPercent: 150,
            materialConsumoValor: 0,
            precoSTL: 0,
            stlPecas: 5
        }
    },
    So = ["tempoImpressaoHoras", "tempoImpressaoMinutos", "materialUtilizado", "numImpressoes"],
    Zp = r => `custoImpressao3D_${r}`,
    dd = r => {
        try {
            const s = localStorage.getItem(Zp(r));
            if (s) {
                const i = JSON.parse(s);
                return So.forEach(u => delete i[u]), i
            }
            return {}
        } catch (s) {
            return console.error("Error loading from localStorage:", s), {}
        }
    },
    tw = (r, s) => {
        try {
            const i = {
                ...s
            };
            So.forEach(u => delete i[u]), localStorage.setItem(Zp(r), JSON.stringify(i))
        } catch (i) {
            console.error("Error saving to localStorage:", i)
        }
    },
    Ge = r => r.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    }),
    nw = (r, s = 2) => r.toLocaleString("pt-BR", {
        minimumFractionDigits: s,
        maximumFractionDigits: s
    }),
    rw = () => {
        const [r, s] = g.useState("SATURN 2"), [i, u] = g.useState(() => {
            const y = dd("SATURN 2"),
                S = {
                    ...fd["SATURN 2"],
                    ...y
                };
            return So.forEach(C => {
                S[C] = 0
            }), S
        }), [c, d] = g.useState(null), m = g.useCallback(y => {
            const {
                name: S,
                value: C
            } = y.target, R = parseFloat(C) || 0;
            u(_ => {
                const A = {
                    ..._,
                    [S]: R
                };
                return So.includes(S) || tw(r, A), A
            })
        }, [r]), p = g.useCallback(y => {
            const S = y;
            s(S);
            const C = dd(S),
                R = {
                    ...fd[S],
                    ...C
                };
            So.forEach(_ => {
                R[_] = 0
            }), u(R)
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
                    valorFrete // Adicionado para ler o valor do frete
                } = i;
                let pe = S + C / 60,
                    se = 0;
                r === "SATURN 2" ? se = R / 1e3 * 1 : se = R / 1e3;
                const ve = N / 1e3 * pe * w,
                    Z = O > 0 ? M / O * pe : 0,
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
                    materialAComprarKg: n                    materialAComprarKgFormatado: ne.toFixed(3) + " Kg",
                    orcamentoCliente: ge + (parseFloat(i.valorFrete) || 0),
                    orcamentoClienteFormatado: Ge(ge + (parseFloat(i.valorFrete) || 0))
                });           })()
        }, [i, r]);
        const h = (y, S, C, R = "0.01", _ = "0") => P.jsxs("div", {
            className: "space-y-1",
            children: [P.jsxs(Rd, {
                htmlFor: y,
                children: [S, " ", P.jsxs("span", {
                    className: "text-xs text-muted-foreground",
                    children: ["(", C, ")"]
                })]
            }), P.jsx(Ed, {
                id: y,
                name: y,
                type: "number",
                value: i[y],
                onChange: m,
                step: R,
                min: _,
                className: "w-full"
            })]
        });
        return P.jsxs("div", {
            className: "container mx-auto p-4 md:p-8",
            children: [P.jsx("h1", {
                className: "text-3xl font-bold mb-6 text-center",
                children: "Calculadora de Custos de Impressão 3D"
            }), P.jsxs(Bl, {
                className: "mb-6",
                children: [P.jsx(Vl, {
                    children: P.jsx(Wl, {
                        children: "Selecionar Impressora"
                    })
                }), P.jsx(Hl, {
                    children: P.jsxs(Z0, {
                        onValueChange: p,
                        value: r,
                        children: [P.jsx(Qp, {
                            className: "w-full md:w-[280px]",
                            children: P.jsx(q0, {
                                placeholder: "Selecione a impressora"
                            })
                        }), P.jsxs(Xp, {
                            children: [P.jsx(Gl, {
                                value: "SATURN 2",
                                children: "SATURN 2 (Resina)"
                            }), P.jsx(Gl, {
                                value: "K1M",
                                children: "K1M (Filamento)"
                            }), P.jsx(Gl, {
                                value: "K1",
                                children: "K1 (Filamento)"
                            })]
                        })]
                    })
                })]
            }), P.jsxs("div", {
                className: "grid grid-cols-1 md:grid-cols-3 gap-6",
                children: [P.jsxs(Bl, {
                    children: [P.jsxs(Vl, {
                        children: [P.jsx(Wl, {
                            children: "Parâmetros de Entrada"
                        }), P.jsx(ma, {
                            children: "Ajuste os valores. Tempo, material e quantidade iniciam zerados."
                        })]
                    }), P.jsxs(Hl, {
                        className: "space-y-4",
                        children: [P.jsxs("div", {
                            className: "grid grid-cols-1 sm:grid-cols-2 gap-4",
                            children: [h("tempoImpressaoHoras", "Tempo de Impressão", "Horas", "0.1"), h("tempoImpressaoMinutos", "Tempo de Impressão", "Minutos", "1", "0"), h("materialUtilizado", "Material Utilizado", r === "SATURN 2" ? "ML" : "Gramas", "1"), h("numImpressoes", "Número de Impressões", "Unidades", "1", "0")]
                        }), P.jsx("hr", {}), P.jsxs("div", {
                            className: "grid grid-cols-1 sm:grid-cols-2 gap-4",
                            children: [h("precoMaterialKg", "Preço Material", "R$/Kg"), h("precoKWH", "Preço KWH", "R$"), h("potenciaW", "Potência da Máquina", "Watt", "1"), h("valorMaquina", "Valor da Máquina", "R$"), h("tempoDepreciacaoHoras", "Tempo de Depreciação", "Horas", "100")]
                        }), P.jsx("hr", {}), P.jsxs("div", {
                            className: "grid grid-cols-1 sm:grid-cols-2 gap-4",
                            children: [h("taxaFalhaPercent", "Taxa de Falha", "%", "1"), h("impostoPercent", "Imposto", "%", "0.1"), h("taxaLucroPercent", "Taxa de Lucro", "%", "1"), r === "SATURN 2" && h("materialConsumoValor", "Custo Consumíveis", "R$"), (r === "K1M" || r === "K1") && h("precoSTL", "Preço do STL", "R$"), (r === "K1M" || r === "K1") && h("stlPecas", "Diluir STL em Peças", "Unidades", "1", "1"), h("valorFrete", "Valor do Frete", "R$", "1", "0")]
                        })]
                    })]
                }), P.jsxs(Bl, {
                    children: [P.jsxs(Vl, {
                        children: [P.jsx(Wl, {
                            children: "Resultados Calculados"
                        }), P.jsx(ma, {
                            children: "Custos, preços e lucros baseados nos parâmetros."
                        })]
                    }), P.jsx(Hl, {
                        className: "space-y-4",
                        children: c ? P.jsxs(P.Fragment, {
                            children: [P.jsx("h3", {
                                className: "font-semibold text-lg mb-2",
                                children: "Por Unidade:"
                            }), P.jsxs("div", {
                                className: "grid grid-cols-2 gap-x-4 gap-y-2 text-sm",
                                children: [P.jsx("span", {
                                    children: "Custo Material Base:"
                                }), " ", P.jsx("span", {
                                    className: "text-right font-medium",
                                    children: c.custoMaterialUnidadeBaseFormatado
                                }), P.jsx("span", {
                                    children: "Custo Luz:"
                                }), " ", P.jsx("span", {
                                    className: "text-right font-medium",
                                    children: c.custoLuzUnidadeFormatado
                                }), P.jsx("span", {
                                    children: "Custo Depreciação:"
                                }), " ", P.jsx("span", {
                                    className: "text-right font-medium",
                                    children: c.custoDepreciacaoUnidadeFormatado
                                }), (r === "K1M" || r === "K1") && P.jsxs(P.Fragment, {
                                    children: [P.jsx("span", {
                                        children: "Custo STL:"
                                    }), " ", P.jsx("span", {
                                        className: "text-right font-medium",
                                        children: c.custoSTLUnidadeFormatado
                                    })]
                                }), r === "SATURN 2" && P.jsxs(P.Fragment, {
                                    children: [P.jsx("span", {
                                        children: "Custo Consumíveis:"
                                    }), " ", P.jsx("span", {
                                        className: "text-right font-medium",
                                        children: Ge(i.materialConsumoValor)
                                    })]
                                }), P.jsx("span", {
                                    className: "font-bold",
                                    children: "Custo Base Total:"
                                }), " ", P.jsx("span", {
                                    className: "text-right font-bold",
                                    children: c.custoBaseUnidadeFormatado
                                }), P.jsx("span", {
                                    className: "font-bold text-blue-600",
                                    children: "Preço Produção (c/ Falha):"
                                }), " ", P.jsx("span", {
                                    className: "text-right font-bold text-blue-600",
                                    children: c.precoProducaoUnidadeFormatado
                                }), P.jsx("span", {
                                    className: "font-bold text-green-600",
                                    children: "Valor Venda (s/ Imposto):"
                                }), " ", P.jsx("span", {
                                    className: "text-right font-bold text-green-600",
                                    children: c.valorUnidadeSemImpostoFormatado
                                }), P.jsx("span", {
                                    className: "font-bold text-green-700",
                                    children: "Valor Venda (c/ Imposto):"
                                }), " ", P.jsx("span", {
                                    className: "text-right font-bold text-green-700",
                                    children: c.valorUnidadeComImpostoFormatado
                                }), P.jsx("span", {
                                    children: "Lucro (s/ Imposto):"
                                }), " ", P.jsx("span", {
                                    className: "text-right font-medium",
                                    children: c.lucroSemImpostoUnidadeFormatado
                                }), P.jsx("span", {
                                    children: "Lucro Bruto (c/ Imposto):"
                                }), " ", P.jsx("span", {
                                    className: "text-right font-medium",
                                    children: c.lucroComImpostoUnidadeFormatado
                                })]
                            }), P.jsx("hr", {
                                className: "my-4"
                            }), P.jsxs("h3", {
                                className: "font-semibold text-lg mb-2",
                                children: ["Para o Lote (", i.numImpressoes, " unidades):"]
                            }), P.jsxs("div", {
                                className: "grid grid-cols-2 gap-x-4 gap-y-2 text-sm",
                                children: [P.jsx("span", {
                                    children: "Custo Luz Total:"
                                }), " ", P.jsx("span", {
                                    className: "text-right font-medium",
                                    children: c.custoLuzTotalFormatado
                                }), P.jsx("span", {
                                    className: "font-bold text-blue-600",
                                    children: "Preço Produção Total:"
                                }), " ", P.jsx("span", {
                                    className: "text-right font-bold text-blue-600",
                                    children: c.precoProducaoTotalFormatado
                                }), P.jsx("span", {
                                    className: "font-bold text-green-600",
                                    children: "Valor Total (s/ Imposto):"
                                }), " ", P.jsx("span", {
                                    className: "text-right font-bold text-green-600",
                                    children: c.valorTotalSemImpostoFormatado
                                }), P.jsx("span", {
                                    className: "font-bold text-green-700",
                                    children: "Valor Total (c/ Imposto):"
                                }), " ", P.jsx("span", {
                                    className: "text-right font-bold text-green-700",
                                    children: c.valorTotalComImpostoFormatado
                                }), P.jsx("span", {
                                    children: "Lucro Total (s/ Imposto):"
                                }), " ", P.jsx("span", {
                                    className: "text-right font-medium",
                                    children: c.lucroTotalSemImpostoFormatado
                                }), P.jsx("span", {
                                    children: "Lucro Bruto Total (c/ Imposto):"
                                }), " ", P.jsx("span", {
                                    className: "text-right font-medium",
                                    children: c.lucroTotalComImpostoFormatado
                                })]
                            }), P.jsx("hr", {
                                className: "my-4"
                            }), P.jsx("h3", {
                                className: "font-semibold text-lg mb-2",
                                children: "Outros:"
                            }), P.jsxs("div", {
                                className: "grid grid-cols-2 gap-x-4 gap-y-2 text-sm",
                                children: [P.jsx("span", {
                                    children: "Material a Comprar:"
                                }), " ", P.jsx("span", {
                                    className: "text-right font-medium",
                                    children: c.materialAComprarKgFormatado
                                })]
                            })]
                        }) : P.jsx("p", {
                            children: "Calculando..."
                        })
                    })]
                })]
            }), // Closes ResultadosCalculados Card P.jsxs(Bl,...) call
            ,
            P.jsxs(Bl, { children: [ P.jsxs(Vl, { children: [ P.jsx(Wl, { children: "Orçamento para o cliente" }), P.jsx(ma, { children: "Valor total de venda para o cliente." }) ] }), P.jsx(Hl, { className: "space-y-4", children: c ? P.jsxs("div", { className: "grid grid-cols-1 gap-x-4 gap-y-2 text-sm", children: [ P.jsx("span", { className: "text-lg font-semibold", children: "Valor total:" }), P.jsx("span", { className: "text-right text-lg font-bold text-green-600", children: c.orcamentoClienteFormatado }) ] }) : P.jsx("p", { children: "Aguardando cálculo..." }) }) ] })
            ]
        })
    };

function ow() {
    return P.jsx(rw, {})
}
nv.createRoot(document.getElementById("root")).render(P.jsx(g.StrictMode, {
    children: P.jsx(ow, {})
}));
