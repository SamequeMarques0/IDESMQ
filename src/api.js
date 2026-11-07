// Ponte com o Electron (preload.js). Se faltar algum método (preload antigo), a chamada vira um
// "não faz nada" e a IDE avisa na tela, em vez de travar a inicialização inteira.
export const missingApi = new Set();
export const hasBridge = Boolean(window.api);

export const api = new Proxy(window.api ?? {}, {
  get(target, prop) {
    if (typeof prop === "symbol" || prop in target) return target[prop];
    missingApi.add(String(prop));
    return () => Promise.resolve(undefined);
  },
});
