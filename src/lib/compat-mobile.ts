/**
 * Compatibilité WebView Android (Polyfills & Correctifs).
 * 
 * Ce fichier est conçu pour fonctionner même sur des moteurs JS anciens 
 * (Chrome 60+) et doit être exécuté AVANT tout autre import ESM.
 */

// 1. Polyfill globalThis (Chrome < 71)
if (typeof globalThis === "undefined") {
  (function () {
    if (typeof self !== "undefined") {
      (self as any).globalThis = self;
    } else if (typeof window !== "undefined") {
      (window as any).globalThis = window;
    }
  })();
}

const g = globalThis as any;

/**
 * Installation des API manquantes.
 * N'utilise AUCUNE syntaxe moderne (pas de ?., ??, ou let/const si on veut être parano, 
 * mais ES6 est supporté par Chrome 60+).
 */
export function installerCompatibiliteMobile() {
  // crypto.randomUUID (Chrome < 92)
  if (!g.crypto) {
    g.crypto = {};
  }
  if (typeof g.crypto.randomUUID !== "function") {
    g.crypto.randomUUID = function () {
      var alea = function () { return Math.floor(Math.random() * 16).toString(16); };
      var sortie = "";
      for (var i = 0; i < 36; i++) {
        if (i === 8 || i === 13 || i === 18 || i === 23) sortie += "-";
        else if (i === 14) sortie += "4";
        else if (i === 19) sortie += ((Math.floor(Math.random() * 4) + 8) & 0xf).toString(16);
        else sortie += alea();
      }
      return sortie;
    };
  }

  // structuredClone (Chrome < 98)
  if (typeof g.structuredClone !== "function") {
    g.structuredClone = function (v: any) {
      return JSON.parse(JSON.stringify(v));
    };
  }

  // Array.prototype.at (Chrome < 92)
  if (typeof Array.prototype.at !== "function") {
    Object.defineProperty(Array.prototype, "at", {
      value: function (n: number) {
        var i = Math.trunc(n) || 0;
        var idx = i < 0 ? this.length + i : i;
        return idx < 0 || idx >= this.length ? undefined : this[idx];
      },
      writable: true,
      configurable: true,
    });
  }

  // String.prototype.at (Chrome < 92)
  if (typeof String.prototype.at !== "function") {
    Object.defineProperty(String.prototype, "at", {
      value: function (n: number) {
        var i = Math.trunc(n) || 0;
        var idx = i < 0 ? this.length + i : i;
        return idx < 0 || idx >= this.length ? undefined : this[idx];
      },
      writable: true,
      configurable: true,
    });
  }

  // String.prototype.replaceAll (Chrome < 85)
  if (typeof String.prototype.replaceAll !== "function") {
    Object.defineProperty(String.prototype, "replaceAll", {
      value: function (recherche: string | RegExp, remplacement: string) {
        if (recherche instanceof RegExp) return this.replace(recherche, remplacement);
        return this.split(recherche).join(remplacement);
      },
      writable: true,
      configurable: true,
    });
  }

  // Object.hasOwn (Chrome < 93)
  if (typeof Object.hasOwn !== "function") {
    Object.hasOwn = function (o: object, k: PropertyKey) {
      return Object.prototype.hasOwnProperty.call(o, k);
    };
  }

  // Object.fromEntries (Chrome < 73)
  if (typeof Object.fromEntries !== "function") {
    Object.fromEntries = function (entries: any) {
      var obj = {} as any;
      for (var i = 0; i < entries.length; i++) {
        var pair = entries[i];
        obj[pair[0]] = pair[1];
      }
      return obj;
    };
  }

  // Array.prototype.flat (Chrome < 69)
  if (typeof Array.prototype.flat !== "function") {
    Object.defineProperty(Array.prototype, "flat", {
      value: function (depth: number) {
        var d = depth || 1;
        return this.reduce(function (acc: any, val: any) {
          return acc.concat(Array.isArray(val) && d > 1 ? val.flat(d - 1) : val);
        }, []);
      },
      writable: true,
      configurable: true,
    });
  }

  // Promise.allSettled (Chrome < 76)
  if (typeof Promise.allSettled !== "function") {
    Promise.allSettled = function (promises: any[]) {
      return Promise.all(
        promises.map(function (p) {
          return Promise.resolve(p).then(
            function (value) { return { status: "fulfilled", value: value }; },
            function (reason) { return { status: "rejected", reason: reason }; }
          );
        })
      );
    };
  }

  // requestIdleCallback (Chrome < 47, mais parfois absent/bogué)
  if (typeof g.requestIdleCallback !== "function") {
    g.requestIdleCallback = function (cb: any) {
      return setTimeout(cb, 1);
    };
  }
}

// Auto-exécution immédiate lors du chargement du module
installerCompatibiliteMobile();
