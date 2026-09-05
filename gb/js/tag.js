
(function () {
  "use strict";

  const RA_FEATURE_SESSION_TRACKING =
    typeof window._raFeatureSessionTracking === "boolean"
      ? window._raFeatureSessionTracking
      : true;

  function normalizeEventHost(value) {
    const s = String(value ?? "").trim();
    if (!s) return "";
    const base =
      /^https?:\/\//i.test(s) ? s : s.startsWith("//") ? `https:${s}` : `https://${s}`;
    return base.replace(/\/+$/, "");
  }

  function resolveRaTagConfig() {
    const script = document.currentScript;
    const ds = script && script.dataset;

    const tagId =
      (ds && (ds.tagId || ds.apiKey)) ||
      window.raTagId ||
      "";

    const rawEventHost =
      (ds && ds.eventHost) ||
      window.eventHost ||
      "";
    const eventHost = normalizeEventHost(rawEventHost);

    let platParams = [];
    if (ds && ds.platParams != null && String(ds.platParams).trim() !== "") {
      platParams = String(ds.platParams)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (Array.isArray(window.platParams)) {
      platParams = window.platParams.filter(Boolean);
    }

    return { tagId, eventHost, platParams };
  }

  const __raTagCfg = resolveRaTagConfig();
  const RA_TAG_ID = __raTagCfg.tagId;
  const RA_EVENT_HOST = __raTagCfg.eventHost;
  const RA_PLAT_PARAMS = __raTagCfg.platParams;

  const FORWARD_PARAMS = Object.freeze(["rat","raclid", "fbclid", "gclid", "wbraid", "gbraid", "msclkid", "tbl_clickid", "tblci", "nb_clickid", "nb_cid", "ttclid", "ttclickid", "mgid_clickid"]);
  
  function resolvePlataformaParametros(apiParams) {
    if (!RA_PLAT_PARAMS.some(Boolean)) {
      return Array.isArray(apiParams) ? apiParams : [];
    }
    const arr = Array.isArray(apiParams) ? apiParams : [];
    const hasAny = arr.some((p) => p != null && String(p).trim() !== "");
    const first = arr[0];
    const firstOk = first != null && String(first).trim() !== "";
    if (!hasAny || !firstOk) {
      return RA_PLAT_PARAMS;
    }
    return arr;
  }

  function normalizeRedeAdsId(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  }

  function flattenTagConfig(response) {
    if (!response || typeof response !== "object") {
      return {};
    }
    const nested = response.data ?? response.config ?? response.tag;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const { data, config, tag, ...rest } = response;
      return { ...rest, ...nested };
    }
    return { ...response };
  }

  function maybeInjectClickbankHopForDirectCheckout(config, pageViewEventId) {
    if (config.habilitar_direct_to_checkout !== true) return;

    const fromConfig =
      config.page_view_id != null ? String(config.page_view_id).trim() : "";
    const fromEvent =
      pageViewEventId != null ? String(pageViewEventId).trim() : "";
    const pageViewId = fromConfig || fromEvent;
    if (!pageViewId) return;

    const vendor = String(config.vendor ?? "").trim();
    const affiliate = String(config.affiliate ?? "").trim();
    if (!vendor || !affiliate) return;

    if (document.querySelector('script[src*="scripts.clickbank.net/hop"]')) {
      return;
    }

    window.clickbank = {
      vendor: vendor,
      affiliate: affiliate,
      tid: "vSt" + pageViewId,
    };
    var a = document.createElement("script");
    a.setAttribute("defer", "");
    a.setAttribute("src", "https://scripts.clickbank.net/hop.min.js");
    document.head.appendChild(a);
  }

  class Utils {
    static uuid() {
      const c = globalThis.crypto;
      if (c?.randomUUID) return c.randomUUID();
      if (c?.getRandomValues) {
        const b = new Uint8Array(16);
        c.getRandomValues(b);
        b[6] = (b[6] & 0x0f) | 0x40;
        b[8] = (b[8] & 0x3f) | 0x80;
        const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
        return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`.replace(/-/g, "");;
      }
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
        const r = (Math.random() * 16) | 0;
        return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
      }).replace(/-/g, "");
    }

    static _tagIdPrefixForIds() {
      return String(RA_TAG_ID || "").replace(/-/g, "").slice(0, 5);
    }

    static leadId() {
      const hex = this.uuid().replace(/-/g, "");
      const p = this._tagIdPrefixForIds();
      return p + hex.slice(p.length);
    }

    static async sha256(str) {
      const buf = new TextEncoder().encode(str);
      const hash = await crypto.subtle.digest("SHA-256", buf);
      const hex = Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      
      return hex;
    }

    static getCookie(name) {
      const match = document.cookie.match(
        new RegExp("(?:^|;\\s*)" + name + "=([^;]*)")
      );
      return match ? decodeURIComponent(match[1]) : null;
    }

    static timestamp() {
      return Math.floor(Date.now() / 1000);
    }

    
    static getVstOrigemFromUrl(href = location.href) {
      try {
        const u = new URL(href, location.href);
        for (const value of u.searchParams.values()) {
          const v = String(value ?? "").trim();
          if (!v) continue;
          if (/^vst_/i.test(v) || v.startsWith("vSt")) return v;
        }
        return null;
      } catch (_) {
        return null;
      }
    }

    static loadScript(src) {
      
      return new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.onload = () => {
          
          resolve();
        };
        s.onerror = (e) => {
          
          reject(e);
        };
        document.head.appendChild(s);
      });
    }

    
    static clickTargetSnapshot(mouseEvent) {
      const t = mouseEvent?.target;
      if (!t || t.nodeType !== 1) return null;
      let id = t.id || "";
      if (!id && typeof t.closest === "function") {
        const p = t.closest("[id]");
        if (p) id = p.id || "";
      }
      const readClass = (el) => {
        const raw = el?.className;
        if (!raw) return "";
        if (typeof raw === "object" && raw.baseVal != null) {
          return String(raw.baseVal).trim();
        }
        return String(raw).trim();
      };
      let className = readClass(t);
      if (!className && typeof t.closest === "function") {
        const withClass = t.closest("[class]");
        if (withClass) className = readClass(withClass);
      }
      const raw = (t.innerText || t.textContent || "").trim();
      const text = raw.length > 2000 ? raw.slice(0, 2000) : raw;
      return { id, text, class: className };
    }

    
    static mergeClickCustomData(customData, context) {
      const base =
        customData && typeof customData === "object" && !Array.isArray(customData)
          ? { ...customData }
          : {};
      return Object.keys(base).length ? base : null;
    }

    
    static clickDestinationContext(mouseEvent, boundEl) {
      const t = mouseEvent?.target;
      const link =
        t && typeof t.closest === "function" ? t.closest("a[href]") : null;
      if (link) {
        const raw = link.getAttribute("href");
        if (raw == null || String(raw).trim() === "") return null;
        let targetAttr = (link.getAttribute("target") || "_self").trim();
        if (!targetAttr) targetAttr = "_self";
        try {
          const abs = new URL(raw, location.href).href;
          return { url: abs, target: targetAttr };
        } catch (_) {
          return null;
        }
      }
      const el = boundEl;
      const raw =
        el?.getAttribute?.("data-href") || el?.getAttribute?.("href") || null;
      if (raw == null || String(raw).trim() === "") return null;
      let targetAttr = (
        el.getAttribute("target") ||
        el.getAttribute("data-target") ||
        "_self"
      ).trim();
      if (!targetAttr) targetAttr = "_self";
      try {
        const abs = new URL(raw, location.href).href;
        return { url: abs, target: targetAttr };
      } catch (_) {
        return null;
      }
    }

    
    static elementDataSnapshot(mouseEvent, boundEl) {
      const snap = Utils.clickTargetSnapshot(mouseEvent);
      const ctx = Utils.clickDestinationContext(mouseEvent, boundEl);
      return {
        element_id: snap ? snap.id : "",
        element_text: snap ? snap.text : "",
        element_url: ctx ? ctx.url : "",
        element_class: snap ? snap.class : "",
      };
    }

    static _CLICK_TYPES_WITH_ELEMENT_DATA = {
      click: true,
      lead: true,
      add_to_cart: true,
      initiate_checkout: true,
    };

    
    static eventElementDataForContext(eventType, context) {
      if (!Utils._CLICK_TYPES_WITH_ELEMENT_DATA[eventType] || !context?.mouseEvent) {
        return undefined;
      }
      return Utils.elementDataSnapshot(context.mouseEvent, context.element);
    }
  }
  
  class UtmParser {

    static TTL_DAYS = 1;

    static _utmStorageKey(tagId) {
      const id = String(tagId || "").trim();
      return id ? `ra_utms_${id}` : "";
    }

    static resolveNbClickId(searchParams, existing) {
      const direct = String(existing ?? searchParams.get("nb_clickid") ?? "").trim();
      if (direct) return direct;

      for (const [key, value] of searchParams.entries()) {
        if (key === "nb_clickid") continue;
        const v = String(value ?? "").trim();
        if (v.startsWith("nvss_")) return v;
      }

      const nbCid = String(searchParams.get("nb_cid") ?? "").trim();
      if (!nbCid) return null;
      return nbCid.startsWith("nvss_") ? nbCid : `nvss_${nbCid}`;
    }

    static resolveTblClickId(searchParams, existing) {
      const direct = String(existing ?? searchParams.get("tbl_clickid") ?? "").trim();
      if (direct) return direct;

      const tblci = String(searchParams.get("tblci") ?? "").trim();
      return tblci || null;
    }

    static resolveTtClickId(searchParams, existing) {
      const direct = String(
        existing ?? searchParams.get("ttclid") ?? searchParams.get("ttclickid") ?? ""
      ).trim();
      return direct || null;
    }

    static resolveMgidClickId(searchParams, existing) {
      const direct = String(
        existing ?? searchParams.get("mgid_clickid") ?? ""
      ).trim();
      return direct || null;
    }

    static parse(tagId) {
      
      const url = new URL(location.href);
      const p = url.searchParams;
      const resolvedNbClickId = this.resolveNbClickId(p, p.get("nb_clickid"));
      const resolvedTblClickId = this.resolveTblClickId(p, p.get("tbl_clickid"));
      const resolvedTtClickId = this.resolveTtClickId(p, p.get("ttclid"));
      const resolvedMgidClickId = this.resolveMgidClickId(p, p.get("mgid_clickid"));


      const fromUrl = {
        utm_id: p.get("utm_id"),
        utm_source: p.get("utm_source"),
        utm_campaign: p.get("utm_campaign") || p.get("gad_campaignid"),
        utm_medium: p.get("utm_medium"),
        utm_content: p.get("utm_content"),
        utm_term: p.get("utm_term"),
        raclid: p.get("raclid"),
        gclid: p.get("gclid"),
        gbraid: p.get("gbraid"),
        wbraid: p.get("wbraid"),
        fbclid: p.get("fbclid"),
        nb_clickid: resolvedNbClickId,
        tbl_clickid: resolvedTblClickId,
        msclkid: p.get("msclkid"),
        ttclid: resolvedTtClickId,
        mgid_clickid: resolvedMgidClickId,
        network: p.get("network"),
        placement: p.get("placement"),
        rat: p.get("rat"),
      };

      const hasAnyUtm =
        Object.values(fromUrl).some(Boolean) ||
        !!p.get("nb_cid") ||
        !!p.get("tblci");

      if (hasAnyUtm) {
        
        this.save(tagId, fromUrl);
        return fromUrl;
      }

      const stored = this._fromStorage(tagId) || {};
      const storedResolved = this.resolveNbClickId(p, stored.nb_clickid);
      if (storedResolved) {
        stored.nb_clickid = storedResolved;
      }
      const storedTblResolved = this.resolveTblClickId(p, stored.tbl_clickid);
      if (storedTblResolved) {
        stored.tbl_clickid = storedTblResolved;
      }
      const storedTtResolved = this.resolveTtClickId(p, stored.ttclid || stored.ttclickid);
      if (storedTtResolved) {
        stored.ttclid = storedTtResolved;
        stored.ttclickid = storedTtResolved;
      }
      const storedMgidResolved = this.resolveMgidClickId(p, stored.mgid_clickid);
      if (storedMgidResolved) {
        stored.mgid_clickid = storedMgidResolved;
      }
      
      return stored;
    }
    
    static enrichEventParameters(rede_ads_id, utmParams) {
      const base = { ...utmParams };
      const rid = normalizeRedeAdsId(rede_ads_id);
      if (rid === 3 && !String(base.nb_clickid ?? "").trim()) {
        try {
          const resolved = this.resolveNbClickId(
            new URL(location.href).searchParams,
            base.nb_clickid
          );
          if (resolved) base.nb_clickid = resolved;
        } catch (_) {}
      }
      if (rid === 4 && !String(base.tbl_clickid ?? "").trim()) {
        try {
          const resolved = this.resolveTblClickId(
            new URL(location.href).searchParams,
            base.tbl_clickid
          );
          if (resolved) base.tbl_clickid = resolved;
        } catch (_) {}
      }
      if (!String(base.ttclid ?? base.ttclickid ?? "").trim()) {
        try {
          const resolved = this.resolveTtClickId(
            new URL(location.href).searchParams,
            base.ttclid || base.ttclickid
          );
          if (resolved) {
            base.ttclid = resolved;
            base.ttclickid = resolved;
          }
        } catch (_) {}
      }
      if (rid === 6 && !String(base.mgid_clickid ?? "").trim()) {
        try {
          const resolved = this.resolveMgidClickId(
            new URL(location.href).searchParams,
            base.mgid_clickid
          );
          if (resolved) base.mgid_clickid = resolved;
        } catch (_) {}
      }
      const src = (utmParams.utm_source || "").trim().toLowerCase();
      const isGoogle = src === "google";
      const isMeta = src === "meta";
      const isNewsbreak = src === "newsbreak";
      const isTaboola = src === "taboola";
      const isMgid = src === "mgid";
      let ok = false;
      if (rid === 1 && isGoogle) ok = true;
      else if (rid === 2 && isMeta) ok = true;
      else if (rid === 3 && isNewsbreak) ok = true;
      else if (rid === 4 && isTaboola) ok = true;
      else if (rid === 6 && isMgid) ok = true;
      else if (
        (rede_ads_id == null || rede_ads_id === undefined) &&
        utmParams.rat === "ads" &&
        (isGoogle || isMeta)
      ) {
        ok = true;
      }
      if (!ok) return base;
      return {
        ...base,
        campaignId: utmParams.utm_id || null,
        adsetId: utmParams.utm_medium || null,
        adId: utmParams.utm_content || null,
      };
    }

    static save(tagId, params) {
      const key = this._utmStorageKey(tagId);
      if (!key) return;
      try {
        const payload = {
          data: params,
          expiry: Date.now() + this.TTL_DAYS * 86400 * 1000,
        };
        localStorage.setItem(key, JSON.stringify(payload));
        
      } catch (e) {
        
      }
    }

    static _fromStorage(tagId) {
      const key = this._utmStorageKey(tagId);
      if (!key) return null;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) {
          
          return null;
        }
        const obj = JSON.parse(raw);
        if (Date.now() > obj.expiry) {
          
          localStorage.removeItem(key);
          return null;
        }
        
        return obj.data;
      } catch (e) {
        
        return null;
      }
    }
  }

  class Print {
    static async generate() {
      
      const nav = navigator;
      const scr = screen;
      const signals = [
        nav.userAgent,
        nav.language,
        nav.platform,
        `${scr.width}x${scr.height}`,
        `${scr.colorDepth}`,
        `${scr.pixelDepth}`,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        nav.hardwareConcurrency ?? "",
        nav.maxTouchPoints ?? "",
        nav.deviceMemory ?? "",
      ].join("|");
      const hash = await Utils.sha256(signals);
      return hash;
    }
  }
  
  class AppStorage {
    static LEAD_KEY = "ra_lead";
    static CONFIG_KEY_LEGACY = "ra_config";
    static CONFIG_TTL = 3600;

    static _configStorageKey(tagId) {
      const id = String(tagId || "").trim();
      return id ? `ra_config_${id}` : "";
    }
    static saveLead(lead) {
      try {
        localStorage.setItem(this.LEAD_KEY, JSON.stringify(lead));
      } catch (e) {
      }
    }

    static loadLead() {
      try {
        const raw = localStorage.getItem(this.LEAD_KEY);
        const lead = raw ? JSON.parse(raw) : null;
        
        return lead;
      } catch (e) {
        
        return null;
      }
    }

    static saveConfig(tagId, config) {
      const key = this._configStorageKey(tagId);
      if (!key) return;
      try {
        localStorage.setItem(
          key,
          JSON.stringify({
            data: config,
            savedAt: Utils.timestamp(),
          })
        );
      } catch (e) {
      }
    }

    static loadConfig(tagId) {
      const key = this._configStorageKey(tagId);
      if (!key) return null;
      try {
        const readValid = (storageKey) => {
          const raw = localStorage.getItem(storageKey);
          if (!raw) return null;
          const obj = JSON.parse(raw);
          if (Utils.timestamp() - obj.savedAt > this.CONFIG_TTL) {
            localStorage.removeItem(storageKey);
            return null;
          }
          return obj;
        };

        let obj = readValid(key);
        if (obj && obj.data != null) {
          return obj.data;
        }

        obj = readValid(this.CONFIG_KEY_LEGACY);
        if (obj && obj.data != null) {
          try {
            localStorage.setItem(
              key,
              JSON.stringify({
                data: obj.data,
                savedAt: obj.savedAt,
              })
            );
            localStorage.removeItem(this.CONFIG_KEY_LEGACY);
          } catch (e) {
          }
          return obj.data;
        }

        return null;
      } catch (e) {
        return null;
      }
    }

    static getFbc() {
      const v = Utils.getCookie("_fbc") || null;
      return v;
    }

    static getFbp() {
      const v = Utils.getCookie("_fbp") || null;
      return v;
    }

    static ensureFbp() {
      const existing = this.getFbp();
      if (existing) return existing;
      return `fb.1.${Date.now()}.${Math.floor(Math.random() * 2147483647)}`;
    }

    static ensureFbc(fbclid) {
      const clickId = fbclid != null ? String(fbclid).trim() : "";
      const existing = this.getFbc();
      if (!clickId) return existing;
      if (existing && existing.endsWith(`.${clickId}`)) return existing;
      return `fb.1.${Date.now()}.${clickId}`;
    }
  }

  class SessionManager {
    static _sessionKey(tagId, suffix) {
      const id = String(tagId || "").trim();
      return id ? `ra_session_${suffix}_${id}` : "";
    }

    static _currentUrlKey() {
      return `${location.pathname || ""}${location.search || ""}`;
    }

    static ensureSession(tagId) {
      if (!RA_FEATURE_SESSION_TRACKING) {
        return { session_id: null, is_new_session: false };
      }
      const keyId = this._sessionKey(tagId, "id");
      const keyUrl = this._sessionKey(tagId, "url");
      if (!keyId || !keyUrl) {
        return { session_id: null, is_new_session: false };
      }
      try {
        const urlKey = this._currentUrlKey();
        const id = sessionStorage.getItem(keyId);
        const urlStored = sessionStorage.getItem(keyUrl);

        const needsNewSession = !id || urlStored !== urlKey;

        if (needsNewSession) {
          const newId = Utils.uuid();
          sessionStorage.setItem(keyId, newId);
          sessionStorage.setItem(keyUrl, urlKey);
          return { session_id: newId, is_new_session: true };
        }

        return { session_id: id, is_new_session: false };
      } catch (e) {
        return { session_id: null, is_new_session: false };
      }
    }
  }

  function raSessionEventFields(utmParams, isFirstVisit) {
    if (!RA_FEATURE_SESSION_TRACKING) return {};
    const s = SessionManager.ensureSession(RA_TAG_ID);
    return {
      session_id: s.session_id,
      is_new_session: s.is_new_session,
      is_first_visit: isFirstVisit,
    };
  }
  
  class ApiClient {
    
    static get eventsUrl() {
      return `${RA_EVENT_HOST}/v1/tag/events`;
    }
    
    static _eventTimeMs() {
      return Date.now();
    }
    
    static _payloadWithEventTime(payload) {
      if (!payload || typeof payload !== "object") return payload;
      const ev = payload.event;
      if (!ev || typeof ev !== "object") return payload;
      const vstOrigem = ev.vst_origem ?? Utils.getVstOrigemFromUrl();
      const loc =
        typeof window !== "undefined" && window.location ? window.location : null;
      return {
        ...payload,
        event: {
          ...ev,
          event_time: this._eventTimeMs(),
          referrer: document.referrer || null,
          ...(vstOrigem ? { vst_origem: vstOrigem } : {}),
          ...(loc
            ? {
                domain: loc.hostname || null,
                path: `${loc.pathname || ""}${loc.search || ""}` || null,
              }
            : {}),
        },
      };
    }

    
    static async postPageView(tagId, lead, event) {
      const url = this.eventsUrl;
      const bodyObj = this._payloadWithEventTime({ tag_id: tagId, lead, event });
      
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyObj),
        });
        if (!res.ok) {
          
          return null;
        }
        const json = await res.json();
        
        return json;
      } catch (e) {
        
        return null;
      }
    }

    
    static sendEvent(payload) {
      const out = this._payloadWithEventTime(payload);
      const url = this.eventsUrl;
      const body = JSON.stringify(out);
      const ev = out?.event || {};
      

      const blob = new Blob([body], { type: "text/plain;charset=UTF-8" });
      if (navigator.sendBeacon) {
        const sent = navigator.sendBeacon(url, blob);
        if (sent) return;
      }

      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
    }

    
    static async sendEventAsync(payload) {
      const out = this._payloadWithEventTime(payload);
      const url = this.eventsUrl;
      const body = JSON.stringify(out);
      const ev = out?.event || {};
      
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        });
        
        return res.ok;
      } catch (e) {
        
        return false;
      }
    }
  }

  class StampEngine {
    static _lastStampAllLog = 0;

    
    static STAMPED_EVENT_ID_PREFIX = "vSt";

    static _vturbPlayerReadyBound = new WeakSet();
    static _vturbInjectUrlApplied = new WeakSet();
    static _vturbIframeOpenPatched = new WeakSet();

    
    static DEFAULT_PLATAFORMA_UTM_KEYS = Object.freeze([
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
    ]);

    
    static _dropLastPlatParamIfMultiple(list) {
      if (!Array.isArray(list) || list.length <= 1) return list;
      return list.slice(0, -1);
    }

    static collectForwardParams() {
      const out = {};
      try {
        const p = new URL(location.href).searchParams;
        for (let i = 0; i < FORWARD_PARAMS.length; i++) {
          const k = FORWARD_PARAMS[i];
          const v = p.get(k);
          if (v != null && v !== "") out[k] = v;
        }
      } catch (_) {}
      return out;
    }

    static _applyForwardParams(u, stampedParams) {
      const skip = stampedParams && typeof stampedParams === "object" ? stampedParams : {};
      try {
        const p = new URL(location.href).searchParams;
        p.forEach((v, k) => {
          if (v == null || v === "") return;
          if (skip[k] != null) return;
          u.searchParams.set(k, v);
        });
      } catch (_) {}
    }

    
    static buildFallbackPrimaryValue(utmParams) {
      if (!utmParams || utmParams.rat !== "ads") return null;
      const src = (utmParams.utm_source || "").trim().toLowerCase();
      const isMeta = src === "meta";
      const isGoogle = src === "google";
      if (!isMeta && !isGoogle) return null;

      const id = String(utmParams.utm_id ?? "").trim();
      const med = String(utmParams.utm_medium ?? "").trim();
      const cont = String(utmParams.utm_content ?? "").trim();

      let out = isMeta ? "FB" : "GA";
      if (id) out += `::${id}`;
      if (med) out += `::${med}`;
      if (cont) out += `::${cont}`;
      if (isMeta) {
        const fbclid = String(utmParams.fbclid ?? "").trim();
        if (fbclid) out += `::fbclid::${fbclid}`;
      } else {
        const gclid = String(utmParams.gclid ?? "").trim();
        if (gclid) out += `::gclid::${gclid}`;
      }
      return out;
    }

    
    static buildParams(pageViewEventId, platParams, utmParams, primarySlotOverride) {
      const params = {};
      const primary =
        primarySlotOverride != null && String(primarySlotOverride) !== ""
          ? primarySlotOverride
          : pageViewEventId;

      if (platParams[0]) {
        params[platParams[0]] = primary;
      }

      const byPos = [
        utmParams.utm_source,
        utmParams.utm_id,
        utmParams.utm_campaign,
        utmParams.utm_medium,
        utmParams.utm_content,
        utmParams.utm_term,
        utmParams.raclid,
      ];

      for (let i = 1; i < platParams.length; i++) {
        const name = platParams[i];
        if (!name) continue;
        let v = utmParams[name];
        if (v == null || v === "") {
          v = byPos[i - 1];
        }
        if (v != null && v !== "") {
          params[name] = v;
        }
      }

      return params;
    }

    static _injectParams(url, params) {
      try {
        const u = new URL(url, location.href);
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== null) u.searchParams.set(k, v);
        });
        this._applyForwardParams(u, params);
        return u.toString();
      } catch (_) {
        return url;
      }
    }

    
    static _isSamePageHashOnlyNavigation(hrefStr) {
      try {
        const s = String(hrefStr ?? "").trim();
        if (!s) return false;
        const u = new URL(s, location.href);
        if (!u.hash) return false;
        if (u.pathname !== location.pathname) return false;
        if (location.protocol === "file:" && u.protocol === "file:") {
          return true;
        }
        return u.origin === location.origin;
      } catch (_) {
        return false;
      }
    }

    static stampLink(el, params) {
      try {
        const raw = el.getAttribute("href");
        if (raw != null && this._isSamePageHashOnlyNavigation(raw)) {
          return;
        }
        el.href = this._injectParams(el.href, params);
      } catch (_) {}
    }

    static stampButton(el, params) {
      try {
        const attr = el.hasAttribute("data-href") ? "data-href" : "href";
        const current = el.getAttribute(attr);
        if (current && this._isSamePageHashOnlyNavigation(current)) {
          return;
        }
        if (current) el.setAttribute(attr, this._injectParams(current, params));
      } catch (_) {}
    }

    static stampForm(el, params) {
      try {
        const raw = el.getAttribute("action");
        if (raw == null || String(raw).trim() === "") {
          const current = el.action || location.href;
          if (current && !this._isSamePageHashOnlyNavigation(current)) {
            el.setAttribute("action", this._injectParams(current, params));
          }
        } else if (!this._isSamePageHashOnlyNavigation(raw)) {
          el.setAttribute("action", this._injectParams(raw, params));
        }

        Object.entries(params).forEach(([k, v]) => {
          if (v === undefined || v === null) return;
          let input = el.querySelector(`input[name="${CSS.escape(k)}"]`);
          if (!input) {
            input = document.createElement("input");
            input.type = "hidden";
            input.name = k;
            el.appendChild(input);
          }
          input.value = v;
        });

        Object.entries(this.collectForwardParams()).forEach(([k, v]) => {
          let input = el.querySelector(`input[name="${CSS.escape(k)}"]`);
          if (!input) {
            input = document.createElement("input");
            input.type = "hidden";
            input.name = k;
            el.appendChild(input);
          }
          input.value = v;
        });
      } catch (_) {}
    }

    static stampIframe(el, params) {
      try {
        const raw = el.getAttribute("src");
        if (raw != null && this._isSamePageHashOnlyNavigation(raw)) {
          return;
        }
        el.src = this._injectParams(el.src, params);
      } catch (_) {}
    }

    static overrideWindowOpen(params) {
      if (window._raWindowOpenPatched) return;
      window._raWindowOpenPatched = true;
      let lastOpenLog = 0;
      
      const original = window.open.bind(window);
      window.open = function (url, target, features) {
        let stamped = url;
        try {
          if (!StampEngine._isSamePageHashOnlyNavigation(String(url ?? ""))) {
            stamped = StampEngine._injectParams(url, params);
          }
        } catch (_) {}
        const t = Date.now();
        if (t - lastOpenLog > 1500) {
          lastOpenLog = t;
          
        }
        return original(stamped, target, features);
      };
    }

    static stampVturbAnchors(params) {
      const n = document.querySelectorAll("vturb-smartplayer a[href]").length;
      if (n) 
      document.querySelectorAll("vturb-smartplayer a[href]").forEach((el) => {
        this.stampLink(el, params);
      });
    }

    
    static stampVturbAnchorButtons(params) {
      const nodes = document.querySelectorAll("vturb-anchor-button");
      if (nodes.length) {
        
      }

      nodes.forEach((btn) => {
        try {
          const a = btn.querySelector("a[href]");
          const rawHref =
            (a && a.getAttribute("href")) ||
            btn.getAttribute("href") ||
            btn.getAttribute("data-href");
          if (!rawHref) return;
          const normalized = rawHref.replace(/&amp;/g, "&");
          const trimmed = normalized.trim();
          if (trimmed.startsWith("#")) return;
          if (this._isSamePageHashOnlyNavigation(normalized)) return;
          const finalHref = this._injectParams(normalized, params);
          if (!finalHref) return;
          if (a) a.setAttribute("href", finalHref);
          btn.setAttribute("href", finalHref);
        } catch (_) {}
      });
    }

    static _hasVturbInDom() {
      try {
        return !!document.querySelector("vturb-smartplayer, vturb-anchor-button");
      } catch (_) {
        return false;
      }
    }

    static stampVturbSmartPlayer(params) {
      document.querySelectorAll("vturb-smartplayer").forEach((player) => {
        if (!StampEngine._vturbPlayerReadyBound.has(player)) {
          StampEngine._vturbPlayerReadyBound.add(player);
          const onReady = () => {
            if (StampEngine._vturbInjectUrlApplied.has(player)) return;
            if (typeof player.injectUrlUpdater !== "function") return;
            StampEngine._vturbInjectUrlApplied.add(player);
            try {
              player.injectUrlUpdater((originalUrl) => {
                try {
                  const u = new URL(String(originalUrl || ""), location.href);
                  Object.entries(params).forEach(([k, v]) => {
                    if (v !== undefined && v !== null && v !== "") {
                      u.searchParams.set(k, String(v));
                    }
                  });
                  StampEngine._applyForwardParams(u, params);
                  return u.toString();
                } catch (_) {
                  return originalUrl;
                }
              });
              
            } catch (_) {}
          };
          player.addEventListener("player:ready", onReady);
        }

        if (StampEngine._vturbIframeOpenPatched.has(player)) return;

        const iframe =
          player.shadowRoot?.querySelector("iframe") ||
          player.querySelector("iframe");
        if (!iframe) return;

        StampEngine._vturbIframeOpenPatched.add(player);
        

        const patchIframeOpen = () => {
          try {
            const iframeWin = iframe.contentWindow;
            if (!iframeWin) return;
            const origOpen = iframeWin.open?.bind(iframeWin);
            if (!origOpen) return;
            iframeWin.open = function (url, target, features) {
              let stamped = url;
              try {
                if (
                  !StampEngine._isSamePageHashOnlyNavigation(String(url ?? ""))
                ) {
                  stamped = StampEngine._injectParams(url, params);
                }
              } catch (_) {}
              
              return origOpen(stamped, target, features);
            };
          } catch (_) {}
        };

        iframe.addEventListener("load", patchIframeOpen);
        patchIframeOpen();
      });
    }

    
    static stampAll(pageViewEventId, config, utmParams, stampOptions) {
      const opts = stampOptions || {};
      const useApiFailComposite = !!opts.useApiFailedFallback;

      const platParams = this._dropLastPlatParamIfMultiple(
        config?.plataforma_parametros
      );

      let params = {};
      let paramsDom = {};
      if (platParams.some(Boolean)) {
        const primaryComposite =
          useApiFailComposite ? this.buildFallbackPrimaryValue(utmParams) : null;
        params = this.buildParams(
          pageViewEventId,
          platParams,
          utmParams,
          primaryComposite
        );

        const key0 = platParams[0];
        if (key0 && params[key0] != null) {
          if (
            useApiFailComposite &&
            primaryComposite != null &&
            String(primaryComposite) !== ""
          ) {
            paramsDom = { ...params };
          } else {
            paramsDom = { ...params };
            const id = String(pageViewEventId ?? "");
            const stamped =
              id.startsWith(this.STAMPED_EVENT_ID_PREFIX) || /^vst_/i.test(id)
                ? id
                : this.STAMPED_EVENT_ID_PREFIX + pageViewEventId;
            for (let i = 0; i < platParams.length; i++) {
              const name = platParams[i];
              if (name) paramsDom[name] = stamped;
            }
          }
        } else {
          paramsDom = params;
        }
      }

      const nA = document.querySelectorAll("a[href]").length;
      const nB = document.querySelectorAll("button[data-href], button[href]").length;
      const nF = document.querySelectorAll("form").length;
      const nI = document.querySelectorAll("iframe[src]").length;

      document.querySelectorAll("a[href]").forEach((el) => {
        this.stampLink(el, paramsDom);
      });

      document
        .querySelectorAll("button[data-href], button[href]")
        .forEach((el) => {
          this.stampButton(el, paramsDom);
        });

      document.querySelectorAll("form").forEach((el) => {
        this.stampForm(el, paramsDom);
      });

      document.querySelectorAll("iframe[src]").forEach((el) => {
        if (!el.src.includes("vturb")) this.stampIframe(el, paramsDom);
      });

      this.overrideWindowOpen(paramsDom);

      const doVturb = !!config.has_vturb || this._hasVturbInDom();
      if (doVturb) {
        this.stampVturbAnchors(paramsDom);
        this.stampVturbAnchorButtons(paramsDom);
        this.stampVturbSmartPlayer(paramsDom);
      }

      const now = Date.now();
      if (now - this._lastStampAllLog > 1200) {
        this._lastStampAllLog = now;
        
      }
    }
  }

  class TriggerEngine {
    
    static _isDeferredAnyLinkClick(ev) {
      return ev?.rule_detection === "any_link_button_click" && ev.type === "click";
    }

    static setup(events, fireCallback) {
      if (!Array.isArray(events)) {
        
        return;
      }
      
      if (events.some((e) => e?.rule_detection === "page_load")) {
        
      }

      const processEvent = (ev) => {
        if (!ev?.rule_detection) return;

        switch (ev.rule_detection) {
          case "page_load":
            break;

          case "element_id":
            if (ev.rule_detection_value) {
              TriggerEngine._setupDomTrigger(
                `#${CSS.escape(ev.rule_detection_value)}`,
                ev,
                fireCallback
              );
            }
            break;

          case "element_class":
            if (ev.rule_detection_value) {
              TriggerEngine._setupDomTrigger(
                `.${CSS.escape(ev.rule_detection_value)}`,
                ev,
                fireCallback
              );
            }
            break;

          case "element_text":
            TriggerEngine._setupElementTextTrigger(ev, fireCallback);
            break;

          case "url_element":
            TriggerEngine._setupUrlElementTrigger(ev, fireCallback);
            break;

          case "any_link_button_click":
            TriggerEngine._setupAnyLinkButtonTrigger(ev, fireCallback);
            break;

          default:
            
            break;
        }
      };

      events.forEach((ev) => {
        if (TriggerEngine._isDeferredAnyLinkClick(ev)) return;
        processEvent(ev);
      });
      events.forEach((ev) => {
        if (!TriggerEngine._isDeferredAnyLinkClick(ev)) return;
        processEvent(ev);
      });
    }

    static _hrefIsSamePageAnchor(hrefStr) {
      if (hrefStr == null || String(hrefStr).trim() === "") return false;
      const s = String(hrefStr).trim();

      if (s.startsWith("#")) return true;
      try {
        const u = new URL(s, location.href);
        if (!u.hash) return false;
        return (
          u.origin === location.origin && u.pathname === location.pathname
        );
      } catch (_) {
        return false;
      }
    }
    
    static _getNavigationContext(mouseEvent, currentTargetEl) {
      return Utils.clickDestinationContext(mouseEvent, currentTargetEl);
    }

    static _applyNavigation(nav) {
      if (!nav?.url) return;
      const t = String(nav.target || "_self").trim().toLowerCase();
      
      if (t === "_blank") {
        const w = window.open(nav.url, "_blank", "noopener,noreferrer");
        if (w) w.opener = null;
        return;
      }
      if (t === "_top") {
        window.top.location.assign(nav.url);
        return;
      }
      if (t === "_parent") {
        window.parent.location.assign(nav.url);
        return;
      }
      if (t === "_self" || t === "") {
        location.assign(nav.url);
        return;
      }
      window.open(nav.url, nav.target);
    }

    static _shouldSkipTrackedClick(event, currentTarget) {
      const t = event?.target;
      if (!t || typeof t.closest !== "function") return false;

      const link = t.closest("a[href]");
      let raw = null;
      if (link) {
        raw = link.getAttribute("href");
      } else if (currentTarget) {
        raw =
          currentTarget.getAttribute?.("data-href") ||
          currentTarget.getAttribute?.("href") ||
          null;
      }

      if (raw != null && String(raw).trim() !== "") {
        const h = String(raw).trim().toLowerCase();
        if (h.startsWith("#")) {
          
          return true;
        }
        if (TriggerEngine._hrefIsSamePageAnchor(raw)) {
          
          return true;
        }
        const skipSchemes = [
          "mailto:",
          "tel:",
          "sms:",
          "javascript:",
          "data:",
          "ftp:",
        ];
        for (let i = 0; i < skipSchemes.length; i++) {
          if (h.startsWith(skipSchemes[i])) {
            
            return true;
          }
        }
      }

      if (link) {
        try {
          const resolved = link.href;
          if (TriggerEngine._hrefIsSamePageAnchor(resolved)) {
            
            return true;
          }
        } catch (_) {}
      }

      return false;
    }

    
    static _handleTrackedDomClick(eventConfig, el, e, fireCallback) {
      if (TriggerEngine._shouldSkipTrackedClick(e, el)) return;
      const nav = TriggerEngine._getNavigationContext(e, el);
      if (nav) e.preventDefault();
      const delay = eventConfig.delay || 0;
      const ctx = { mouseEvent: e, element: el };
      const run = async () => {
        try {
          await fireCallback(eventConfig, ctx);
        } catch (err) {
          
        }
        if (nav) TriggerEngine._applyNavigation(nav);
      };
      if (delay > 0) {
        setTimeout(() => void run(), delay * 1000);
      } else {
        void run();
      }
    }

    static _scrollY() {
      return Math.max(
        window.scrollY || 0,
        window.pageYOffset || 0,
        document.documentElement?.scrollTop || 0,
        document.body?.scrollTop || 0
      );
    }

    static _setupViewContent(eventConfig, cb) {
      if (window.__raViewContentRegistered) {
        return;
      }
      window.__raViewContentRegistered = true;

      let fired = false;

      const fire = () => {
        if (fired) return;
        fired = true;
        cleanup();
        
        cb(eventConfig);
      };
      
      const timer = setTimeout(fire, 8000);

      const checkScroll = () => {
        if (TriggerEngine._scrollY() >= 200) fire();
      };

      checkScroll();

      const pageHeight = Math.max(
        document.documentElement?.scrollHeight || 0,
        document.body?.scrollHeight || 0
      );
      if (pageHeight > 0 && pageHeight <= window.innerHeight + 200) {
        setTimeout(fire, 1000);
      }
      
      const onScroll = () => checkScroll();
      window.addEventListener("scroll", onScroll, { passive: true, capture: true });
      document.addEventListener("scroll", onScroll, { passive: true, capture: true });

      let wheelCount = 0;
      const onWheel = () => {
        wheelCount++;
        checkScroll();
        if (wheelCount >= 2) fire();
      };
      window.addEventListener("wheel", onWheel, { passive: true, capture: true });

      const onTouchMove = () => {
        checkScroll();
        fire();
      };
      window.addEventListener("touchmove", onTouchMove, { passive: true, capture: true });

      function cleanup() {
        clearTimeout(timer);
        window.removeEventListener("scroll", onScroll, { capture: true });
        document.removeEventListener("scroll", onScroll, { capture: true });
        window.removeEventListener("wheel", onWheel, { capture: true });
        window.removeEventListener("touchmove", onTouchMove, { capture: true });
      }
    }

    static _triggerBindKey(eventConfig) {
      return [
        String(eventConfig?.type || ""),
        String(eventConfig?.rule_detection || ""),
        String(eventConfig?.rule_detection_value || ""),
      ].join("::");
    }

    static _alreadyBound(el, eventConfig) {
      if (!el._raTriggers) el._raTriggers = new Set();
      const key = TriggerEngine._triggerBindKey(eventConfig);
      if (el._raTriggers.has(key)) return true;
      el._raTriggers.add(key);
      return false;
    }

    static _setupDomTrigger(selector, eventConfig, cb) {
      const attach = (el) => {
        // One listener per rule (type+detection+value), so overlapping rules on the
        // same DOM node (e.g. buylink → initiate_checkout + add_to_cart) can all fire.
        if (TriggerEngine._alreadyBound(el, eventConfig)) return;
        el.addEventListener("click", (e) => {
          TriggerEngine._handleTrackedDomClick(
            eventConfig,
            el,
            e,
            cb
          );
        }, { capture: true });
      };

      const tryAttach = () => {
        document.querySelectorAll(selector).forEach(attach);
      };

      tryAttach();
      
      const observer = new MutationObserver(() => tryAttach());
      observer.observe(document.body, { childList: true, subtree: true });
      
      setTimeout(tryAttach, 2000);
      setTimeout(tryAttach, 5000);
      setTimeout(tryAttach, 9000);
    }

    static _setupElementTextTrigger(eventConfig, cb) {
      const targetText = (eventConfig.rule_detection_value || "").toLowerCase();
      if (!targetText) return;

      const attach = (el) => {
        const text = el.textContent?.toLowerCase() || "";
        if (!text.includes(targetText)) return;
        if (TriggerEngine._alreadyBound(el, eventConfig)) return;
        el.addEventListener("click", (e) => {
          TriggerEngine._handleTrackedDomClick(
            eventConfig,
            el,
            e,
            cb
          );
        }, { capture: true });
      };

      const tryAttach = () => {
        document
          .querySelectorAll("a, button, [role='button']")
          .forEach(attach);
      };

      tryAttach();
      
      const observer = new MutationObserver(() => tryAttach());
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(tryAttach, 2000);
      setTimeout(tryAttach, 5000);
      setTimeout(tryAttach, 9000);
    }

    static _urlElementStampQueryKeys() {
      const keys = new Set();
      const add = (k) => {
        if (k) keys.add(String(k).toLowerCase());
      };
      FORWARD_PARAMS.forEach(add);
      StampEngine.DEFAULT_PLATAFORMA_UTM_KEYS.forEach(add);
      add("src");
      add("sck");
      RA_PLAT_PARAMS.forEach(add);
      return keys;
    }

    static _hrefMatchesUrlElement(href, targetUrl) {
      if (href.includes(targetUrl)) return true;
      if (targetUrl.indexOf("?") === -1) return false;

      let configured;
      let actual;
      try {
        configured = new URL(targetUrl);
        actual = new URL(href);
      } catch (_) {
        return false;
      }

      if (configured.origin !== actual.origin) return false;
      if (configured.pathname !== actual.pathname) return false;

      const stampKeys = TriggerEngine._urlElementStampQueryKeys();
      const actualByKey = new Map();
      actual.searchParams.forEach((value, key) => {
        actualByKey.set(key.toLowerCase(), value);
      });

      let matches = true;
      configured.searchParams.forEach((value, key) => {
        if (!matches) return;
        const k = key.toLowerCase();
        if (stampKeys.has(k)) return;
        if (actualByKey.get(k) !== value) matches = false;
      });
      return matches;
    }

    static _setupUrlElementTrigger(eventConfig, cb) {
      const targetUrl = (eventConfig.rule_detection_value || "").toLowerCase();
      if (!targetUrl) return;

      const attach = (el) => {
        const href = (el.href || el.getAttribute("data-href") || "").toLowerCase();
        if (!TriggerEngine._hrefMatchesUrlElement(href, targetUrl)) return;
        if (TriggerEngine._alreadyBound(el, eventConfig)) return;
        el.addEventListener("click", (e) => {
          TriggerEngine._handleTrackedDomClick(
            eventConfig,
            el,
            e,
            cb
          );
        }, { capture: true });
      };

      const tryAttach = () => {
        document
          .querySelectorAll("a[href], button[data-href], button[href]")
          .forEach(attach);
      };

      tryAttach();
      
      const observer = new MutationObserver(() => tryAttach());
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(tryAttach, 2000);
      setTimeout(tryAttach, 5000);
      setTimeout(tryAttach, 9000);
    }

    static _setupAnyLinkButtonTrigger(eventConfig, cb) {
      const attach = (el) => {
        if (TriggerEngine._alreadyBound(el, eventConfig)) return;
        el.addEventListener("click", (e) => {
          TriggerEngine._handleTrackedDomClick(
            eventConfig,
            el,
            e,
            cb
          );
        }, { capture: true });
      };

      const tryAttach = () => {
        document
          .querySelectorAll("a, button, [role='button']")
          .forEach(attach);
      };

      tryAttach();
      
      const observer = new MutationObserver(() => tryAttach());
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(tryAttach, 2000);
      setTimeout(tryAttach, 5000);
      setTimeout(tryAttach, 9000);
    }
  }

  class MetaModule {
    

    static _EVENTS = {
      page_view: "PageView",
      view_content: "ViewContent",
      lead: "Lead",
      add_to_cart: "AddToCart",
      initiate_checkout: "InitiateCheckout",
    };
    
    static _initializedPixelIds = new Set();
    
    static _pixelIds(config) {
      const raw = config?.metaPixels ?? config?.pixel_ids;
      if (Array.isArray(raw) && raw.length) {
        return raw.map(String).filter(Boolean);
      }
      if (config?.pixel_id != null && String(config.pixel_id).trim() !== "") {
        return [String(config.pixel_id).trim()];
      }
      return [];
    }

    
    static async trackBootstrapPageView(config, pageViewEventId) {
      const pixels = MetaModule._pixelIds(config);
      if (!pixels.length) {
        
        return;
      }
      await this._injectPixel();
      this._initPixels(pixels);
      const evOpts = { eventID: pageViewEventId };
      window.fbq("track", "PageView", evOpts, evOpts);
      
    }

    static _createFireHandler(
      config,
      lead,
      utmParams,
      pageViewEventId,
      is_first_visit
    ) {
      return async (eventConfig, context) => {
        if (eventConfig.type === "click") {
          await MetaModule._fireApiOnlyAsync(
            config,
            lead,
            utmParams,
            eventConfig,
            pageViewEventId,
            context,
            is_first_visit
          );
          return;
        }
        const metaName = MetaModule._EVENTS[eventConfig.type];
        if (!metaName) {
          return;
        }
        await MetaModule._fireAsync(
          config,
          lead,
          utmParams,
          eventConfig,
          metaName,
          pageViewEventId,
          context,
          is_first_visit
        );
      };
    }

    static setupViewContent(config, lead, utmParams, pageViewEventId, is_first_visit) {
      const fireMetaEvent = MetaModule._createFireHandler(
        config,
        lead,
        utmParams,
        pageViewEventId,
        is_first_visit
      );

      TriggerEngine._setupViewContent({ type: "view_content" }, (eventConfig) => {
        void fireMetaEvent(eventConfig, undefined);
      });

      return fireMetaEvent;
    }

    static async init(config, lead, utmParams, pageViewEventId, is_first_visit) {
      const pixels = MetaModule._pixelIds(config);

      if (pixels.length) {
        await this._injectPixel();
        this._initPixels(pixels);
      }

      const fireMetaEvent = MetaModule.setupViewContent(
        config,
        lead,
        utmParams,
        pageViewEventId,
        is_first_visit
      );

      if (!config.habilitar_captura_eventos) {
        
        return;
      }

      const events = config.events || [];
      TriggerEngine.setup(events, fireMetaEvent);
    }

    
    static async _yieldPixelFlush() {
      await new Promise((r) => setTimeout(r, 100));
    }

    
    static async _fireApiOnlyAsync(
      config,
      lead,
      utmParams,
      eventConfig,
      pageViewEventId,
      context,
      is_first_visit
    ) {
      const eventId = Utils.leadId();
      const tagId = RA_TAG_ID;
      
      const customMerged = Utils.mergeClickCustomData(
        eventConfig.custom_data,
        context
      );
      const elementData = Utils.eventElementDataForContext(
        eventConfig.type,
        context
      );
      await ApiClient.sendEventAsync({
        tag_id: tagId,
        lead: {
          lead_id: lead.lead_id,
          locale: navigator.language,
          fbc: AppStorage.getFbc(),
          fbp: AppStorage.getFbp(),
        },
        event: {
          event_id: eventId,
          page_view_event_id: pageViewEventId,
          type: eventConfig.type,
          source_url: location.href,
          page_title: document.title,
          timestamp: Utils.timestamp(),
          user_agent: navigator.userAgent,
          parameters: UtmParser.enrichEventParameters(config.rede_ads_id, utmParams),
          custom_data: customMerged,
          ...(elementData !== undefined ? { elementData } : {}),
          send_ip: config.habilitar_envio_ip_eventos ? 1 : 0,
          ...raSessionEventFields(utmParams, is_first_visit),
        },
      });
    }

    static _injectPixel() {
      return new Promise((resolve) => {
        if (window.fbq) {
          return resolve();
        }
        
        (function (f, b, e, v, n, t, s) {
          if (f.fbq) return;
          n = f.fbq = function () {
            n.callMethod
              ? n.callMethod.apply(n, arguments)
              : n.queue.push(arguments);
          };
          if (!f._fbq) f._fbq = n;
          n.push = n;
          n.loaded = true;
          n.version = "2.0";
          n.queue = [];
          t = b.createElement(e);
          t.async = true;
          t.src = v;
          t.onload = () => {
            
            resolve();
          };
          t.onerror = () => {
            
            resolve();
          };
          s = b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t, s);
        })(
          window,
          document,
          "script",
          "https://connect.facebook.net/en_US/fbevents.js"
        );
      });
    }

    static _initPixels(pixels) {
      const orderedUnique = [];
      const seenBatch = new Set();
      for (const raw of pixels) {
        const id = String(raw).trim();
        if (!id || seenBatch.has(id)) continue;
        seenBatch.add(id);
        orderedUnique.push(id);
      }
      for (const pixelId of orderedUnique) {
        if (MetaModule._initializedPixelIds.has(pixelId)) {
          
          continue;
        }
        MetaModule._initializedPixelIds.add(pixelId);
        window.fbq("init", pixelId);
      }
    }

    static async _fireAsync(
      config,
      lead,
      utmParams,
      eventConfig,
      metaName,
      pageViewEventId,
      context,
      is_first_visit
    ) {
      const eventId = Utils.leadId();
      const tagId = RA_TAG_ID;
      

      const fbqData = { eventID: eventId };
      if (eventConfig.custom_data) {
        Object.assign(fbqData, eventConfig.custom_data);
      }
      
      if (typeof window.fbq === "function") {
        window.fbq("track", metaName, fbqData, { eventID: eventId });
      }

      const elementData = Utils.eventElementDataForContext(
        eventConfig.type,
        context
      );

      await ApiClient.sendEventAsync({
        tag_id: tagId,
        lead: {
          lead_id: lead.lead_id,
          locale: navigator.language,
          fbc: AppStorage.getFbc(),
          fbp: AppStorage.getFbp(),
        },
        event: {
          event_id: eventId,
          page_view_event_id: pageViewEventId,
          type: eventConfig.type,
          event_name: metaName,
          source_url: location.href,
          page_title: document.title,
          timestamp: Utils.timestamp(),
          user_agent: navigator.userAgent,
          parameters: UtmParser.enrichEventParameters(config.rede_ads_id, utmParams),
          custom_data: eventConfig.custom_data || null,
          ...(elementData !== undefined ? { elementData } : {}),
          send_ip: config.habilitar_envio_ip_eventos ? 1 : 0,
          ...raSessionEventFields(utmParams, is_first_visit),
        },
      });

      await this._yieldPixelFlush();
    }
    
  }

  class TaboolaModule {
    
    static _EVENTS = {
      view_content: "view_content",
      add_to_cart: "add_to_cart",
      initiate_checkout: "start_checkout",
    };

    static _pixelIds(config) {
      const redeAdsId = normalizeRedeAdsId(config?.rede_ads_id);
      const raw =
        config?.taboolaPixels ??
        config?.taboola_pixels ??
        config?.taboola_pixel_id ??
        (redeAdsId === 4 ? config?.pixel_ids ?? config?.pixel_id : null);
      if (raw == null || raw === "") return [];
      if (Array.isArray(raw)) {
        return raw.map((id) => String(id).trim()).filter(Boolean);
      }
      if (typeof raw === "number") {
        return [String(raw)];
      }
      if (typeof raw === "string") {
        return raw.split(/[,;\s]+/).map((id) => id.trim()).filter(Boolean);
      }
      return [];
    }

    static _track(pixels, eventName) {
      window._tfa = window._tfa || [];
      for (const id of pixels) {
        window._tfa.push({ notify: "event", name: eventName, id });
      }
    }

    static _injectPixel(pixelId) {
      return new Promise((resolve) => {
        const scriptId = `tb_tfa_script_${pixelId}`;
        if (document.getElementById(scriptId)) {
          return resolve();
        }
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          resolve();
        };
        const timeoutId = setTimeout(done, 8000);
        const t = document.createElement("script");
        t.async = true;
        t.src = `//cdn.taboola.com/libtrc/unip/${pixelId}/tfa.js`;
        t.id = scriptId;
        t.onload = done;
        t.onerror = done;
        const f = document.getElementsByTagName("script")[0];
        if (f && f.parentNode) {
          f.parentNode.insertBefore(t, f);
        } else {
          document.head.appendChild(t);
        }
      });
    }

    static async _ensurePixelsReady(pixels) {
      for (const pixelId of pixels) {
        await this._injectPixel(pixelId);
      }
    }

    static async trackBootstrapPageView(config) {
      const pixels = TaboolaModule._pixelIds(config);
      if (!pixels.length) {
        return;
      }
      for (const pixelId of pixels) {
        TaboolaModule._track([pixelId], "page_view");
        await TaboolaModule._injectPixel(pixelId);
      }
    }

    static _createFireHandler(
      config,
      lead,
      utmParams,
      pageViewEventId,
      is_first_visit
    ) {
      return async (eventConfig, context) => {
        if (eventConfig.type === "click") {
          await TaboolaModule._fireApiOnlyAsync(
            config,
            lead,
            utmParams,
            eventConfig,
            pageViewEventId,
            context,
            is_first_visit
          );
          return;
        }
        const taboolaName = TaboolaModule._EVENTS[eventConfig.type];
        if (!taboolaName) {
          return;
        }
        await TaboolaModule._fireAsync(
          config,
          lead,
          utmParams,
          eventConfig,
          taboolaName,
          pageViewEventId,
          context,
          is_first_visit
        );
      };
    }

    static setupViewContent(config, lead, utmParams, pageViewEventId, is_first_visit) {
      const fireTaboolaEvent = TaboolaModule._createFireHandler(
        config,
        lead,
        utmParams,
        pageViewEventId,
        is_first_visit
      );

      TriggerEngine._setupViewContent({ type: "view_content" }, (eventConfig) => {
        void fireTaboolaEvent(eventConfig, undefined);
      });

      return fireTaboolaEvent;
    }

    static async init(config, lead, utmParams, pageViewEventId, is_first_visit) {
      const pixels = TaboolaModule._pixelIds(config);

      if (pixels.length) {
        await TaboolaModule._ensurePixelsReady(pixels);
      }

      const fireTaboolaEvent = TaboolaModule.setupViewContent(
        config,
        lead,
        utmParams,
        pageViewEventId,
        is_first_visit
      );

      if (!config.habilitar_captura_eventos) {
        return;
      }

      const events = config.events || [];
      TriggerEngine.setup(events, fireTaboolaEvent);
    }

    static async _yieldPixelFlush() {
      await new Promise((r) => setTimeout(r, 100));
    }

    static async _fireApiOnlyAsync(
      config,
      lead,
      utmParams,
      eventConfig,
      pageViewEventId,
      context,
      is_first_visit
    ) {
      const eventId = Utils.leadId();
      const tagId = RA_TAG_ID;

      const customMerged = Utils.mergeClickCustomData(
        eventConfig.custom_data,
        context
      );
      const elementData = Utils.eventElementDataForContext(
        eventConfig.type,
        context
      );
      await ApiClient.sendEventAsync({
        tag_id: tagId,
        lead: {
          lead_id: lead.lead_id,
          locale: navigator.language,
        },
        event: {
          event_id: eventId,
          page_view_event_id: pageViewEventId,
          type: eventConfig.type,
          source_url: location.href,
          page_title: document.title,
          timestamp: Utils.timestamp(),
          user_agent: navigator.userAgent,
          parameters: UtmParser.enrichEventParameters(config.rede_ads_id, utmParams),
          custom_data: customMerged,
          ...(elementData !== undefined ? { elementData } : {}),
          send_ip: config.habilitar_envio_ip_eventos ? 1 : 0,
          ...raSessionEventFields(utmParams, is_first_visit),
        },
      });
    }

    static async _fireAsync(
      config,
      lead,
      utmParams,
      eventConfig,
      taboolaName,
      pageViewEventId,
      context,
      is_first_visit
    ) {
      const eventId = Utils.leadId();
      const tagId = RA_TAG_ID;
      const pixels = TaboolaModule._pixelIds(config);

      if (pixels.length) {
        TaboolaModule._track(pixels, taboolaName);
      }

      const elementData = Utils.eventElementDataForContext(
        eventConfig.type,
        context
      );

      await ApiClient.sendEventAsync({
        tag_id: tagId,
        lead: {
          lead_id: lead.lead_id,
          locale: navigator.language,
        },
        event: {
          event_id: eventId,
          page_view_event_id: pageViewEventId,
          type: eventConfig.type,
          taboola_event_name: taboolaName,
          source_url: location.href,
          page_title: document.title,
          timestamp: Utils.timestamp(),
          user_agent: navigator.userAgent,
          parameters: UtmParser.enrichEventParameters(config.rede_ads_id, utmParams),
          custom_data: eventConfig.custom_data || null,
          ...(elementData !== undefined ? { elementData } : {}),
          send_ip: config.habilitar_envio_ip_eventos ? 1 : 0,
          ...raSessionEventFields(utmParams, is_first_visit),
        },
      });

      await this._yieldPixelFlush();
    }
  }

  class NewsbreakModule {
    static _EVENTS = {
      view_content: "view_content",
      add_to_cart: "add_to_cart",
      initiate_checkout: "initiate_checkout",
    };

    static _initializedPixelIds = new Set();

    static _pixelIds(config) {
      const raw = config?.newsbreakPixels ?? config?.newsbreak_pixels;
      if (Array.isArray(raw) && raw.length) {
        return raw.map((id) => String(id).trim()).filter(Boolean);
      }
      return [];
    }

    static _normalizePixelId(id) {
      const s = String(id).trim();
      if (!s) return "";
      return s.startsWith("ID-") ? s : `ID-${s}`;
    }

    static _track(eventName) {
      if (typeof window.nbpix === "function") {
        window.nbpix("event", eventName);
      }
    }

    static _injectPixel() {
      return new Promise((resolve) => {
        if (window.nbpix) {
          return resolve();
        }

        !(function (e, n, t, i, p, a, s) {
          if (e[i]) {
            return resolve();
          }
          p = e[i] = function () {
            p.process ? p.process.apply(p, arguments) : p.queue.push(arguments);
          };
          p.queue = [];
          p.t = +new Date();
          a = n.createElement(t);
          a.async = 1;
          a.src =
            "https://static.newsbreak.com/business/tracking/nbpixel.js?t=" +
            864e5 * Math.ceil(new Date() / 864e5);
          a.onload = () => resolve();
          a.onerror = () => resolve();
          s = n.getElementsByTagName(t)[0];
          s.parentNode.insertBefore(a, s);
        })(window, document, "script", "nbpix");
      });
    }

    static _initPixels(pixels) {
      const orderedUnique = [];
      const seenBatch = new Set();
      for (const raw of pixels) {
        const pixelId = NewsbreakModule._normalizePixelId(raw);
        if (!pixelId || seenBatch.has(pixelId)) continue;
        seenBatch.add(pixelId);
        orderedUnique.push(pixelId);
      }
      for (const pixelId of orderedUnique) {
        if (NewsbreakModule._initializedPixelIds.has(pixelId)) {
          continue;
        }
        NewsbreakModule._initializedPixelIds.add(pixelId);
        if (typeof window.nbpix === "function") {
          window.nbpix("init", pixelId);
        }
      }
    }

    static async trackBootstrapPageView(config) {
      const pixels = NewsbreakModule._pixelIds(config);
      if (!pixels.length) {
        return;
      }
      await this._injectPixel();
      this._initPixels(pixels);
      NewsbreakModule._track("pageload");
    }

    static _createFireHandler(
      config,
      lead,
      utmParams,
      pageViewEventId,
      is_first_visit
    ) {
      return async (eventConfig, context) => {
        if (eventConfig.type === "click") {
          await NewsbreakModule._fireApiOnlyAsync(
            config,
            lead,
            utmParams,
            eventConfig,
            pageViewEventId,
            context,
            is_first_visit
          );
          return;
        }
        const newsbreakName = NewsbreakModule._EVENTS[eventConfig.type];
        if (!newsbreakName) {
          return;
        }
        await NewsbreakModule._fireAsync(
          config,
          lead,
          utmParams,
          eventConfig,
          newsbreakName,
          pageViewEventId,
          context,
          is_first_visit
        );
      };
    }

    static setupViewContent(config, lead, utmParams, pageViewEventId, is_first_visit) {
      const fireNewsbreakEvent = NewsbreakModule._createFireHandler(
        config,
        lead,
        utmParams,
        pageViewEventId,
        is_first_visit
      );

      TriggerEngine._setupViewContent({ type: "view_content" }, (eventConfig) => {
        void fireNewsbreakEvent(eventConfig, undefined);
      });

      return fireNewsbreakEvent;
    }

    static async init(config, lead, utmParams, pageViewEventId, is_first_visit) {
      const pixels = NewsbreakModule._pixelIds(config);

      if (pixels.length) {
        await this._injectPixel();
        this._initPixels(pixels);
      }

      const fireNewsbreakEvent = NewsbreakModule.setupViewContent(
        config,
        lead,
        utmParams,
        pageViewEventId,
        is_first_visit
      );

      if (!config.habilitar_captura_eventos) {
        return;
      }

      const events = config.events || [];
      TriggerEngine.setup(events, fireNewsbreakEvent);
    }

    static async _yieldPixelFlush() {
      await new Promise((r) => setTimeout(r, 100));
    }

    static async _fireApiOnlyAsync(
      config,
      lead,
      utmParams,
      eventConfig,
      pageViewEventId,
      context,
      is_first_visit
    ) {
      const eventId = Utils.leadId();
      const tagId = RA_TAG_ID;

      const customMerged = Utils.mergeClickCustomData(
        eventConfig.custom_data,
        context
      );
      const elementData = Utils.eventElementDataForContext(
        eventConfig.type,
        context
      );
      await ApiClient.sendEventAsync({
        tag_id: tagId,
        lead: {
          lead_id: lead.lead_id,
          locale: navigator.language,
        },
        event: {
          event_id: eventId,
          page_view_event_id: pageViewEventId,
          type: eventConfig.type,
          source_url: location.href,
          page_title: document.title,
          timestamp: Utils.timestamp(),
          user_agent: navigator.userAgent,
          parameters: UtmParser.enrichEventParameters(config.rede_ads_id, utmParams),
          custom_data: customMerged,
          ...(elementData !== undefined ? { elementData } : {}),
          send_ip: config.habilitar_envio_ip_eventos ? 1 : 0,
          ...raSessionEventFields(utmParams, is_first_visit),
        },
      });
    }

    static async _fireAsync(
      config,
      lead,
      utmParams,
      eventConfig,
      newsbreakName,
      pageViewEventId,
      context,
      is_first_visit
    ) {
      const eventId = Utils.leadId();
      const tagId = RA_TAG_ID;

      NewsbreakModule._track(newsbreakName);

      const elementData = Utils.eventElementDataForContext(
        eventConfig.type,
        context
      );

      await ApiClient.sendEventAsync({
        tag_id: tagId,
        lead: {
          lead_id: lead.lead_id,
          locale: navigator.language,
        },
        event: {
          event_id: eventId,
          page_view_event_id: pageViewEventId,
          type: eventConfig.type,
          newsbreak_event_name: newsbreakName,
          source_url: location.href,
          page_title: document.title,
          timestamp: Utils.timestamp(),
          user_agent: navigator.userAgent,
          parameters: UtmParser.enrichEventParameters(config.rede_ads_id, utmParams),
          custom_data: eventConfig.custom_data || null,
          ...(elementData !== undefined ? { elementData } : {}),
          send_ip: config.habilitar_envio_ip_eventos ? 1 : 0,
          ...raSessionEventFields(utmParams, is_first_visit),
        },
      });

      await this._yieldPixelFlush();
    }
  }
  
  class GoogleModule {

    static async init(config, lead, utmParams, pageViewEventId, is_first_visit) {
      if (!config.habilitar_captura_eventos) {
        return;
      }

      const events = config.events || [];

      TriggerEngine.setup(events, async (eventConfig, context) => {
        await this._fireAsync(
          config,
          lead,
          utmParams,
          eventConfig,
          pageViewEventId,
          context,
          is_first_visit
        );
      });
    }

    static async _fireAsync(
      config,
      lead,
      utmParams,
      eventConfig,
      pageViewEventId,
      context,
      is_first_visit
    ) {
      const eventId = Utils.leadId();
      const tagId = RA_TAG_ID;
      

      const customMerged =
        eventConfig.type === "click"
          ? Utils.mergeClickCustomData(eventConfig.custom_data, context)
          : eventConfig.custom_data || null;

      const elementData = Utils.eventElementDataForContext(
        eventConfig.type,
        context
      );

      await ApiClient.sendEventAsync({
        tag_id: tagId,
        lead: {
          lead_id: lead.lead_id,
          locale: navigator.language,
        },
        event: {
          event_id: eventId,
          page_view_event_id: pageViewEventId,
          type: eventConfig.type,
          source_url: location.href,
          page_title: document.title,
          timestamp: Utils.timestamp(),
          parameters: UtmParser.enrichEventParameters(config.rede_ads_id, utmParams),
          user_agent: navigator.userAgent,
          custom_data: customMerged,
          ...(elementData !== undefined ? { elementData } : {}),
          send_ip: config.habilitar_envio_ip_eventos ? 1 : 0,
          ...raSessionEventFields(utmParams, is_first_visit),
        },
      });
    }
  }

  class TiktokModule {
    

    static _EVENTS = {
      view_content: "ViewContent",
      click: "ClickButton",
      lead: "CompleteRegistration",
      add_to_cart: "AddToCart",
      initiate_checkout: "InitiateCheckout",
      purchase: "CompletePayment",
    };
    
    static _initializedPixelIds = new Set();
    
    static _pixelIds(config) {
      const raw = config?.tiktokPixels ?? config?.pixel_ids;
      if (Array.isArray(raw) && raw.length) {
        return raw.map(String).filter(Boolean);
      }
      if (config?.pixel_id != null && String(config.pixel_id).trim() !== "") {
        return [String(config.pixel_id).trim()];
      }
      return [];
    }

    
    static async trackBootstrapPageView(config, pageViewEventId) {
      const pixels = TiktokModule._pixelIds(config);
      if (!pixels.length) {
        return;
      }
      await this._injectPixel();
      this._initPixels(pixels);
      if (window.ttq && typeof window.ttq.page === "function") {
        window.ttq.page({}, { event_id: pageViewEventId });
      }
    }

    static _createFireHandler(
      config,
      lead,
      utmParams,
      pageViewEventId,
      is_first_visit
    ) {
      return async (eventConfig, context) => {
        if (eventConfig.type === "click") {
          await TiktokModule._fireAsync(
            config,
            lead,
            utmParams,
            eventConfig,
            "ClickButton",
            pageViewEventId,
            context,
            is_first_visit
          );
          return;
        }
        const tiktokName = TiktokModule._EVENTS[eventConfig.type];
        if (!tiktokName) {
          return;
        }
        await TiktokModule._fireAsync(
          config,
          lead,
          utmParams,
          eventConfig,
          tiktokName,
          pageViewEventId,
          context,
          is_first_visit
        );
      };
    }

    static setupViewContent(config, lead, utmParams, pageViewEventId, is_first_visit) {
      const fireTiktokEvent = TiktokModule._createFireHandler(
        config,
        lead,
        utmParams,
        pageViewEventId,
        is_first_visit
      );

      TriggerEngine._setupViewContent({ type: "view_content" }, (eventConfig) => {
        void fireTiktokEvent(eventConfig, undefined);
      });

      return fireTiktokEvent;
    }

    static async init(config, lead, utmParams, pageViewEventId, is_first_visit) {
      const pixels = TiktokModule._pixelIds(config);

      if (pixels.length) {
        await this._injectPixel();
        this._initPixels(pixels);
      }

      const fireTiktokEvent = TiktokModule.setupViewContent(
        config,
        lead,
        utmParams,
        pageViewEventId,
        is_first_visit
      );

      if (!config.habilitar_captura_eventos) {
        
        return;
      }

      const events = config.events || [];
      TriggerEngine.setup(events, fireTiktokEvent);
    }

    
    static async _yieldPixelFlush() {
      await new Promise((r) => setTimeout(r, 100));
    }

    
    static async _fireApiOnlyAsync(
      config,
      lead,
      utmParams,
      eventConfig,
      pageViewEventId,
      context,
      is_first_visit
    ) {
      const eventId = Utils.leadId();
      const tagId = RA_TAG_ID;
      
      const customMerged = Utils.mergeClickCustomData(
        eventConfig.custom_data,
        context
      );
      const elementData = Utils.eventElementDataForContext(
        eventConfig.type,
        context
      );
      await ApiClient.sendEventAsync({
        tag_id: tagId,
        lead: {
          lead_id: lead.lead_id,
          locale: navigator.language,
          fbc: AppStorage.getFbc(),
          fbp: AppStorage.getFbp(),
        },
        event: {
          event_id: eventId,
          page_view_event_id: pageViewEventId,
          type: eventConfig.type,
          source_url: location.href,
          page_title: document.title,
          timestamp: Utils.timestamp(),
          user_agent: navigator.userAgent,
          parameters: UtmParser.enrichEventParameters(config.rede_ads_id, utmParams),
          custom_data: customMerged,
          ...(elementData !== undefined ? { elementData } : {}),
          send_ip: config.habilitar_envio_ip_eventos ? 1 : 0,
          ...raSessionEventFields(utmParams, is_first_visit),
        },
      });
    }

    static _injectPixel() {
      return new Promise((resolve) => {
        if (window.ttq && typeof window.ttq.load === "function") {
          return resolve();
        }

        const w = window;
        const d = document;
        const t = "ttq";

        w.TiktokAnalyticsObject = t;
        const ttq = (w[t] = w[t] || []);
        ttq.methods = [
          "page",
          "track",
          "identify",
          "instances",
          "debug",
          "on",
          "off",
          "once",
          "ready",
          "alias",
          "group",
          "enableCookie",
          "disableCookie",
        ];
        ttq.setAndDefer = function (obj, method) {
          obj[method] = function () {
            obj.push([method].concat(Array.prototype.slice.call(arguments, 0)));
          };
        };
        for (let i = 0; i < ttq.methods.length; i++) {
          ttq.setAndDefer(ttq, ttq.methods[i]);
        }
        ttq.instance = function (pixelId) {
          const inst = (ttq._i[pixelId] = ttq._i[pixelId] || []);
          for (let n = 0; n < ttq.methods.length; n++) {
            ttq.setAndDefer(inst, ttq.methods[n]);
          }
          return inst;
        };
        ttq.load = function (pixelId, options) {
          const src = "https://analytics.tiktok.com/i18n/pixel/events.js";
          ttq._i = ttq._i || {};
          ttq._i[pixelId] = [];
          ttq._i[pixelId]._u = src;
          ttq._t = ttq._t || {};
          ttq._t[pixelId] = +new Date();
          ttq._o = ttq._o || {};
          ttq._o[pixelId] = options || {};
          const script = d.createElement("script");
          script.type = "text/javascript";
          script.async = true;
          script.src = src + "?sdkid=" + pixelId + "&lib=" + t;
          script.onload = () => resolve();
          script.onerror = () => resolve();
          const first = d.getElementsByTagName("script")[0];
          first.parentNode.insertBefore(script, first);
        };

        resolve();
      });
    }

    static _initPixels(pixels) {
      const orderedUnique = [];
      const seenBatch = new Set();
      for (const raw of pixels) {
        const id = String(raw).trim();
        if (!id || seenBatch.has(id)) continue;
        seenBatch.add(id);
        orderedUnique.push(id);
      }
      for (const pixelId of orderedUnique) {
        if (TiktokModule._initializedPixelIds.has(pixelId)) {
          continue;
        }
        TiktokModule._initializedPixelIds.add(pixelId);
        window.ttq.load(pixelId);
      }
    }

    static async _fireAsync(
      config,
      lead,
      utmParams,
      eventConfig,
      tiktokName,
      pageViewEventId,
      context,
      is_first_visit
    ) {
      const eventId = Utils.leadId();
      const tagId = RA_TAG_ID;
      

      const ttkData = {};
      if (eventConfig.custom_data) {
        Object.assign(ttkData, eventConfig.custom_data);
      }

      if (window.ttq && typeof window.ttq.track === "function") {
        window.ttq.track(tiktokName, ttkData, { event_id: eventId });
      }

      const elementData = Utils.eventElementDataForContext(
        eventConfig.type,
        context
      );

      await ApiClient.sendEventAsync({
        tag_id: tagId,
        lead: {
          lead_id: lead.lead_id,
          locale: navigator.language,
          fbc: AppStorage.getFbc(),
          fbp: AppStorage.getFbp(),
        },
        event: {
          event_id: eventId,
          page_view_event_id: pageViewEventId,
          type: eventConfig.type,
          event_name: tiktokName,
          source_url: location.href,
          page_title: document.title,
          timestamp: Utils.timestamp(),
          user_agent: navigator.userAgent,
          parameters: UtmParser.enrichEventParameters(config.rede_ads_id, utmParams),
          custom_data: eventConfig.custom_data || null,
          ...(elementData !== undefined ? { elementData } : {}),
          send_ip: config.habilitar_envio_ip_eventos ? 1 : 0,
          ...raSessionEventFields(utmParams, is_first_visit),
        },
      });

      await this._yieldPixelFlush();
    }
    
  }

  class MgidModule {
    static _EVENTS = {
      view_content: "pageview",
      lead: "lead",
      add_to_cart: "addtocart",
      initiate_checkout: "startcheckout",
      purchase: "purchase",
    };

    static _initializedPixelIds = new Set();

    static _pixelIds(config) {
      const raw = config?.mgidPixels ?? config?.mgid_pixels;
      if (Array.isArray(raw) && raw.length) {
        return raw.map((id) => String(id).trim()).filter(Boolean);
      }
      if (config?.pixel_id != null && String(config.pixel_id).trim() !== "") {
        return [String(config.pixel_id).trim()];
      }
      return [];
    }

    static _track(eventName) {
      if (window.MgSensor && typeof window.MgSensor.invoke === "function") {
        window.MgSensor.invoke(eventName);
        return;
      }
      window._mgq = window._mgq || [];
      window._mgq.push(["MgSensorInvoke", eventName]);
    }

    static _initPixels(pixels) {
      window.MgSensorData = window.MgSensorData || [];
      for (const raw of pixels) {
        const cid = String(raw).trim();
        if (!cid || MgidModule._initializedPixelIds.has(cid)) continue;
        MgidModule._initializedPixelIds.add(cid);
        const cidNum = Number(cid);
        window.MgSensorData.push({
          cid: Number.isFinite(cidNum) ? cidNum : cid,
          lng: "us",
          nosafari: true,
          project: "a.mgid.com",
        });
      }
    }

    static _injectPixel() {
      return new Promise((resolve) => {
        if (window.MGIDSensorInjected || document.getElementById("ra-mgsensor")) {
          return resolve();
        }

        const script = document.createElement("script");
        script.id = "ra-mgsensor";
        script.async = true;
        script.src =
          "https://a.mgid.com/mgsensor.js?d=" + Date.now() + "&source=ratoeira";
        script.onload = () => resolve();
        script.onerror = () => resolve();

        const first = document.getElementsByTagName("script")[0];
        if (first && first.parentNode) {
          first.parentNode.insertBefore(script, first);
        } else {
          (document.head || document.documentElement).appendChild(script);
        }
        window.MGIDSensorInjected = 1;
      });
    }

    static async trackBootstrapPageView(config) {
      const pixels = MgidModule._pixelIds(config);
      if (!pixels.length) {
        return;
      }
      this._initPixels(pixels);
      await this._injectPixel();
    }

    static _createFireHandler(
      config,
      lead,
      utmParams,
      pageViewEventId,
      is_first_visit
    ) {
      return async (eventConfig, context) => {
        if (eventConfig.type === "click") {
          await MgidModule._fireApiOnlyAsync(
            config,
            lead,
            utmParams,
            eventConfig,
            pageViewEventId,
            context,
            is_first_visit
          );
          return;
        }
        const mgidName = MgidModule._EVENTS[eventConfig.type];
        if (!mgidName) {
          return;
        }
        await MgidModule._fireAsync(
          config,
          lead,
          utmParams,
          eventConfig,
          mgidName,
          pageViewEventId,
          context,
          is_first_visit
        );
      };
    }

    static setupViewContent(config, lead, utmParams, pageViewEventId, is_first_visit) {
      const fireMgidEvent = MgidModule._createFireHandler(
        config,
        lead,
        utmParams,
        pageViewEventId,
        is_first_visit
      );

      TriggerEngine._setupViewContent({ type: "view_content" }, (eventConfig) => {
        void fireMgidEvent(eventConfig, undefined);
      });

      return fireMgidEvent;
    }

    static async init(config, lead, utmParams, pageViewEventId, is_first_visit) {
      const pixels = MgidModule._pixelIds(config);

      if (pixels.length) {
        this._initPixels(pixels);
        await this._injectPixel();
      }

      const fireMgidEvent = MgidModule.setupViewContent(
        config,
        lead,
        utmParams,
        pageViewEventId,
        is_first_visit
      );

      if (!config.habilitar_captura_eventos) {
        return;
      }

      const events = config.events || [];
      TriggerEngine.setup(events, fireMgidEvent);
    }

    static async _yieldPixelFlush() {
      await new Promise((r) => setTimeout(r, 100));
    }

    static async _fireApiOnlyAsync(
      config,
      lead,
      utmParams,
      eventConfig,
      pageViewEventId,
      context,
      is_first_visit
    ) {
      const eventId = Utils.leadId();
      const tagId = RA_TAG_ID;

      const customMerged = Utils.mergeClickCustomData(
        eventConfig.custom_data,
        context
      );
      const elementData = Utils.eventElementDataForContext(
        eventConfig.type,
        context
      );
      await ApiClient.sendEventAsync({
        tag_id: tagId,
        lead: {
          lead_id: lead.lead_id,
          locale: navigator.language,
        },
        event: {
          event_id: eventId,
          page_view_event_id: pageViewEventId,
          type: eventConfig.type,
          source_url: location.href,
          page_title: document.title,
          timestamp: Utils.timestamp(),
          user_agent: navigator.userAgent,
          parameters: UtmParser.enrichEventParameters(config.rede_ads_id, utmParams),
          custom_data: customMerged,
          ...(elementData !== undefined ? { elementData } : {}),
          send_ip: config.habilitar_envio_ip_eventos ? 1 : 0,
          ...raSessionEventFields(utmParams, is_first_visit),
        },
      });
    }

    static async _fireAsync(
      config,
      lead,
      utmParams,
      eventConfig,
      mgidName,
      pageViewEventId,
      context,
      is_first_visit
    ) {
      const eventId = Utils.leadId();
      const tagId = RA_TAG_ID;

      if (MgidModule._pixelIds(config).length) {
        MgidModule._track(mgidName);
      }

      const elementData = Utils.eventElementDataForContext(
        eventConfig.type,
        context
      );

      await ApiClient.sendEventAsync({
        tag_id: tagId,
        lead: {
          lead_id: lead.lead_id,
          locale: navigator.language,
        },
        event: {
          event_id: eventId,
          page_view_event_id: pageViewEventId,
          type: eventConfig.type,
          source_url: location.href,
          page_title: document.title,
          timestamp: Utils.timestamp(),
          user_agent: navigator.userAgent,
          parameters: UtmParser.enrichEventParameters(config.rede_ads_id, utmParams),
          custom_data: eventConfig.custom_data || null,
          ...(elementData !== undefined ? { elementData } : {}),
          send_ip: config.habilitar_envio_ip_eventos ? 1 : 0,
          ...raSessionEventFields(utmParams, is_first_visit),
        },
      });

      await this._yieldPixelFlush();
    }
  }


  class ModuleRegistry {
    static async init(config, lead, utmParams, pageViewEventId, is_first_visit) {
      const redeAdsId = normalizeRedeAdsId(config.rede_ads_id);
      
      switch (redeAdsId) {
        case 2:
          await MetaModule.init(config, lead, utmParams, pageViewEventId, is_first_visit);
          break;
        case 1:
          await GoogleModule.init(config, lead, utmParams, pageViewEventId, is_first_visit);
          break;
        case 3:
          await NewsbreakModule.init(config, lead, utmParams, pageViewEventId, is_first_visit);
          break;
        case 4:
          await TaboolaModule.init(config, lead, utmParams, pageViewEventId, is_first_visit);
          break;
        case 5:
          await TiktokModule.init(config, lead, utmParams, pageViewEventId, is_first_visit);
          break;
        case 6:
          await MgidModule.init(config, lead, utmParams, pageViewEventId, is_first_visit);
          break;
        default:
          console.warn("rede_ads unknow:", config.rede_ads_id);
      }
    }
  }
  
  class DomScanner {
    static start(pageViewEventId, config, utmParams, stampOptions) {
      StampEngine.stampAll(pageViewEventId, config, utmParams, stampOptions);
      const observer = new MutationObserver(() => {
        StampEngine.stampAll(pageViewEventId, config, utmParams, stampOptions);
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(
        () => StampEngine.stampAll(pageViewEventId, config, utmParams, stampOptions),
        2000
      );
      setTimeout(
        () => StampEngine.stampAll(pageViewEventId, config, utmParams, stampOptions),
        5000
      );
      setTimeout(
        () => StampEngine.stampAll(pageViewEventId, config, utmParams, stampOptions),
        9000
      );
    }
  }

  const RATAG_BOOTSTRAP_DONE_KEY = "__ratagBootstrapDone";
  let ratagBootstrapInFlight = false;

  async function bootstrap() {
    const tagId = RA_TAG_ID;
    if (!tagId) {
      console.warn(
        "raTagId não definido (use data-tag-id, data-api-key ou window.raTagId)."
      );
      return;
    }

    if (window[RATAG_BOOTSTRAP_DONE_KEY]) return;
    if (ratagBootstrapInFlight) return;
    ratagBootstrapInFlight = true;

    try {
    let is_first_visit;
    try {
      is_first_visit = !localStorage.getItem(AppStorage.LEAD_KEY);
    } catch (e) {
      is_first_visit = true;
      
    }
    
    const print = await Print.generate();
    let lead = AppStorage.loadLead();

    if (!lead || lead.print !== print) {
      
      lead = {
        lead_id: Utils.leadId(),
        print,
        created_at: Utils.timestamp(),
      };
      AppStorage.saveLead(lead);
    }
    
    const utmParams = UtmParser.parse(tagId);
    const pageViewEventId = Utils.leadId();
    const stampPrimaryId = Utils.getVstOrigemFromUrl() || pageViewEventId;
    
    const cachedConfig = AppStorage.loadConfig(tagId);
    if (cachedConfig) {
      const cfgCached = {
        ...cachedConfig,
        plataforma_parametros: resolvePlataformaParametros(
          cachedConfig.plataforma_parametros
        ),
      };
      DomScanner.start(stampPrimaryId, cfgCached, utmParams);
    }

    const pageViewPayload = {
      tag_id: tagId,
      lead: {
        lead_id: lead.lead_id,
        locale: navigator.language,
        fbp: AppStorage.ensureFbp(),
        fbc: AppStorage.ensureFbc(utmParams.fbclid),
      },
      event: {
        event_id: pageViewEventId,
        type: "page_view",
        event_name: "PageView",
        source_url: location.href,
        page_title: document.title,
        timestamp: Utils.timestamp(),
        user_agent: navigator.userAgent,
        parameters: UtmParser.enrichEventParameters(null, utmParams),
        ...raSessionEventFields(utmParams, is_first_visit),
      },
    };

    const response = await ApiClient.postPageView(tagId, pageViewPayload.lead, pageViewPayload.event);
    
    if (!response || response.status !== 1) {
      if (RA_PLAT_PARAMS.some(Boolean)) {
        const fallbackConfig = {
          ...(cachedConfig || {}),
          plataforma_parametros: RA_PLAT_PARAMS,
        };
        DomScanner.start(stampPrimaryId, fallbackConfig, utmParams, {
          useApiFailedFallback: true,
        });
      }
      return;
    }

    window[RATAG_BOOTSTRAP_DONE_KEY] = true;

    const flat = flattenTagConfig(response);
    const config = {
      ...flat,
      rede_ads_id: normalizeRedeAdsId(flat.rede_ads_id),
      plataforma_parametros: resolvePlataformaParametros(
        flat.plataforma_parametros
      ),
    };

    maybeInjectClickbankHopForDirectCheckout(config, pageViewEventId);
    
    AppStorage.saveConfig(tagId, config);
    DomScanner.start(stampPrimaryId, config, utmParams);

    const redeAdsId = normalizeRedeAdsId(config.rede_ads_id);
    if (redeAdsId === 2) {
      void MetaModule.trackBootstrapPageView(config, pageViewEventId);
    }

    if (redeAdsId === 3) {
      void NewsbreakModule.trackBootstrapPageView(config);
    }

    if (redeAdsId === 4) {
      void TaboolaModule.trackBootstrapPageView(config);
    }

    if (redeAdsId === 5) {
      void TiktokModule.trackBootstrapPageView(config, pageViewEventId);
    }

    if (redeAdsId === 6) {
      void MgidModule.trackBootstrapPageView(config);
    }

    await ModuleRegistry.init(config, lead, utmParams, pageViewEventId, is_first_visit);
    } finally {
      if (!window[RATAG_BOOTSTRAP_DONE_KEY]) {
        ratagBootstrapInFlight = false;
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      bootstrap();
    });
  } else {
    bootstrap();
  }

  window.addEventListener("pageshow", (e) => {
    if (e.persisted) {
      bootstrap();
    }
  });
})();
