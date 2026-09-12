
      (function() {
        try {
          const atomiStaticPageMeta = {"pageId":"pmi7vNPmSNgkyuUpviSi","pageName":"Clear Gaze VSL","pageDomain":null};
          const ATOMI_PLATFORM_NOTIFY_URL = "https://apido.atomicat-api.com/platform/notify/s/fe";

          function atomiSerializeError(error) {
            try {
              if (!error) return { message: "Unknown error" };
              if (typeof error === "string") return { message: error };
              if (error instanceof Error) {
                return {
                  name: error.name,
                  message: error.message,
                  stack: error.stack,
                };
              }
              return {
                message: error?.message || "Non-Error exception",
                raw: JSON.stringify(error),
              };
            } catch (serializationError) {
              return {
                message: "Failed to serialize error",
                serializationError: serializationError?.message,
              };
            }
          }

          function atomiReportError(error, extra = {}) {
            try {
              const payload = {
                domain: window?.location?.hostname || atomiStaticPageMeta?.pageDomain || "",
                pageUrl: window?.location?.href || "",
                pagePath: window?.location?.pathname || "",
                referrer: document?.referrer || "",
                userAgent: navigator?.userAgent || "",
                language: navigator?.language || "",
                viewport: {
                  width: window?.innerWidth,
                  height: window?.innerHeight,
                },
                timestamp: new Date().toISOString(),
                pageMeta: atomiStaticPageMeta,
                error: atomiSerializeError(error),
                extra,
              };

              const payloadString = JSON.stringify(payload);
              if (navigator?.sendBeacon) {
                const blob = new Blob([payloadString], { type: "text/plain;charset=UTF-8" });
                navigator.sendBeacon(ATOMI_PLATFORM_NOTIFY_URL, blob);
                return;
              }

              fetch(ATOMI_PLATFORM_NOTIFY_URL, {
                method: "POST",
                mode: "no-cors",
                keepalive: true,
                headers: {
                  "Content-Type": "text/plain;charset=UTF-8",
                },
                body: payloadString,
              }).catch(() => {});
            } catch (reportingError) {
              console.log(reportingError);
            }
          }

          if (typeof window !== "undefined") {
            window.atomiReportError = atomiReportError;
          }
        } catch (error) {
          console.log(error);
        }
      })();
    
      function atomiNormalizeRevealEntries(items) {
        if (!items || !items.length) return [];
        const def = 100;
        return items.map(function (entry) {
          if (typeof entry === "string") {
            var s = entry.trim();
            return s ? { value: s, showAtPercent: def } : null;
          }
          if (entry && typeof entry === "object") {
            var v = entry.value != null ? entry.value : (entry.id != null ? entry.id : entry.className);
            v = v != null ? String(v).trim() : "";
            if (!v) return null;
            var p = entry.showAtPercent != null ? Number(entry.showAtPercent) : def;
            if (isNaN(p)) p = def;
            p = Math.max(0, Math.min(100, p));
            return { value: v, showAtPercent: p };
          }
          return null;
        }).filter(Boolean);
      }
      function atomiShowItems({items}) {
      try {
        (items || []).forEach((item) => {
          const key = typeof item === "string" ? item : (item && (item.value != null ? item.value : (item.id != null ? item.id : item.className)));
          if (key == null || key === "") return;
          const token = String(key).trim();
          if (!token) return;
          const hiddenItem = [...document.querySelectorAll(`#${token}`), ...document.querySelectorAll(`.${token}`)];
          console.log("hiddenItem", hiddenItem)
          if (hiddenItem?.length > 0) {
            hiddenItem.forEach(item => item.classList.remove("atomicat-delay"));
          }
        })
      } catch (error) {
        console.log(error);
      }
      }
    
      function runDelayedFunctions(data) {
        try {
          document.querySelectorAll('.atomicat-delay').forEach(el => el.classList.remove('atomicat-delay'));
          if(data?.setDisplayed){
            localStorage.setItem(data?.setDisplayed, true);
          }
          
        } catch (error) {
          console.log(error);
        }
      }
    (function() {
          try {
              const clickeventList = [{"compKey":"5f06f29","misc":{"type":"image"}},{"compKey":"d652d3d","misc":{"type":"image"}},{"compKey":"624570b","misc":{"type":"image"}},{"compKey":"3861e79","misc":{"type":"image"}},{"compKey":"2077461","misc":{"type":"image"}},{"compKey":"2b0d54e","misc":{"type":"image"}},{"compKey":"c9088f7","misc":{"type":"button"}},{"compKey":"5a9b8f4","misc":{"type":"text"}},{"compKey":"7c41ce2","misc":{"type":"text"}},{"compKey":"60db3e0","misc":{"type":"text"}},{"compKey":"927c180","misc":{"type":"text"}},{"compKey":"78602b6","misc":{"type":"text"}},{"compKey":"3fb1500","misc":{"type":"text"}},{"compKey":"66f8ddf","misc":{"type":"text"}}];
    
    
              clickeventList.forEach((comp, index) => {
                  const compKey = comp?.compKey;
                  const eleType = comp?.misc?.type;
                  
                  
                  
                  
              });
    
          } catch (error) {
              return error;
          }
      })();
  (function() {
    try {
      const digitsClass = "a-cd-d";
      const list = [{"compKey":"a83c648a-34a0-4dfc-bd8d-76bd7584b2d3","misc":{"type":"countdown","countdownType":"evergreen","dateTime":"10:00","hideLabel":true,"labelTag":"span","separator":{"active":false,"type":"atomicat-countdown-separator-dotted"},"items":[{"text":"Days","show":false},{"text":"Hours","show":false},{"text":"Minutes","show":true},{"text":"Seconds","show":false}],"boundingBox":{"desktop":{"top":1424.12,"left":632.66,"width":153.34,"height":105.97,"timestamp":1787689003200},"mobile":{"top":1424.12,"left":632.66,"width":153.34,"height":105.97,"timestamp":1787689003309}}},"style":{"countdown":{"gap":{"desktop":"0px"},"container":{"paddingTop":{"desktop":"0px"},"paddingRight":{"desktop":"0px"},"paddingBottom":{"desktop":"0px"},"paddingLeft":{"desktop":"0px"},"background":{"desktop":"rgba(0,0,0,0)"}},"digits":{"color":"#FFDC17","fontFamily":"Montserrat","fontSize":{"desktop":"54px"},"fontWeight":{"desktop":"700"}},"label":{"color":"#FFDC17"},"maxWidth":{"mobile":"100%"}},"topCont":{"alignSelf":{"desktop":"center"}},"outer":{"width":{"mobile":"20%"}}}},{"compKey":"16361a7c-95f1-4120-89f6-9c0e888df053","misc":{"type":"countdown","countdownType":"evergreen","dateTime":"10:00","hideLabel":true,"labelTag":"span","separator":{"active":false,"type":"atomicat-countdown-separator-dotted"},"items":[{"text":"Days","show":false},{"text":"Hours","show":false},{"text":"Minutes","show":false},{"text":"Seconds","show":true}],"boundingBox":{"desktop":{"top":1424.12,"left":805.99,"width":153.34,"height":105.97,"timestamp":1787689003200},"mobile":{"top":1424.12,"left":805.99,"width":153.34,"height":105.97,"timestamp":1787689003309}}},"style":{"countdown":{"gap":{"desktop":"0px"},"container":{"paddingTop":{"desktop":"0px"},"paddingRight":{"desktop":"0px"},"paddingBottom":{"desktop":"0px"},"paddingLeft":{"desktop":"0px"},"background":{"desktop":"rgba(0,0,0,0)"}},"digits":{"color":"#FFDC17","fontFamily":"Montserrat","fontSize":{"desktop":"54px"},"fontWeight":{"desktop":"700"}},"label":{"color":"#FFDC17"}},"topCont":{"alignSelf":{"desktop":"center"}},"outer":{"width":{"mobile":"20%"}}}},{"compKey":"20233818-124a-40c0-b347-c921550c229b","misc":{"type":"countdown","countdownType":"evergreen","dateTime":"10:00","hideLabel":true,"labelTag":"span","separator":{"active":false,"type":"atomicat-countdown-separator-dotted"},"items":[{"text":"Days","show":false},{"text":"Hours","show":false},{"text":"Minutes","show":true},{"text":"Seconds","show":false}],"boundingBox":{"desktop":{"top":3279.56,"left":632.66,"width":153.34,"height":105.97,"timestamp":1787689003202},"mobile":{"top":3279.56,"left":632.66,"width":153.34,"height":105.97,"timestamp":1787689003311}}},"style":{"countdown":{"gap":{"desktop":"0px"},"container":{"paddingTop":{"desktop":"0px"},"paddingRight":{"desktop":"0px"},"paddingBottom":{"desktop":"0px"},"paddingLeft":{"desktop":"0px"},"background":{"desktop":"rgba(0,0,0,0)"}},"digits":{"color":"#FFDC17","fontFamily":"Montserrat","fontSize":{"desktop":"54px"},"fontWeight":{"desktop":"700"}},"label":{"color":"#FFDC17"}},"topCont":{"alignSelf":{"desktop":"center"}},"outer":{"width":{"mobile":"20%"}}}},{"compKey":"291bc704-bbb4-4153-be7a-8ea6926f4886","misc":{"type":"countdown","countdownType":"evergreen","dateTime":"10:00","hideLabel":true,"labelTag":"span","separator":{"active":false,"type":"atomicat-countdown-separator-dotted"},"items":[{"text":"Days","show":false},{"text":"Hours","show":false},{"text":"Minutes","show":false},{"text":"Seconds","show":true}],"boundingBox":{"desktop":{"top":3279.56,"left":805.99,"width":153.34,"height":105.97,"timestamp":1787689003202},"mobile":{"top":3279.56,"left":805.99,"width":153.34,"height":105.97,"timestamp":1787689003311}}},"style":{"countdown":{"gap":{"desktop":"0px"},"container":{"paddingTop":{"desktop":"0px"},"paddingRight":{"desktop":"0px"},"paddingBottom":{"desktop":"0px"},"paddingLeft":{"desktop":"0px"},"background":{"desktop":"rgba(0,0,0,0)"}},"digits":{"color":"#FFDC17","fontFamily":"Montserrat","fontSize":{"desktop":"54px"},"fontWeight":{"desktop":"700"}},"label":{"color":"#FFDC17"}},"topCont":{"alignSelf":{"desktop":"center"}},"outer":{"width":{"mobile":"20%"}}}}];
      const pad = (n) => String(n).padStart(2, "0");
      list.forEach((c) => {
        const key = c?.compKey?.slice(0, 7);
        const m = c?.misc || {};
        const type = m.countdownType;
        const dateTime = m.dateTime;
        const intervalKey = "atomicat_countdown_interval_" + key;
        const el = document.querySelector(".atomicat-countdown-" + key);
        if (!el) return;
        const daysEl = el.querySelector(".atomicat-countdown-days");
        const hoursEl = el.querySelector(".atomicat-countdown-hours");
        const minutesEl = el.querySelector(".atomicat-countdown-minutes");
        const secondsEl = el.querySelector(".atomicat-countdown-seconds");
        window[intervalKey] = setInterval(() => {
          if (el.closest(".atomicat-delay") || el.closest(".atomicat-hidden")) return;
          let target;
          if (type === "evergreen") {
            const sk = "atomicat_countdown_start_" + key;
            let start = sessionStorage.getItem(sk);
            if (!start) { start = Date.now(); sessionStorage.setItem(sk, start); }
            const [h, min] = (dateTime || "0:0").split(":").map(Number);
            target = new Date(+start);
            target.setHours(target.getHours() + (h || 0));
            target.setMinutes(target.getMinutes() + (min || 0));
          } else {
            target = new Date(dateTime || 0);
          }
          const dist = target - Date.now();
          if (dist <= 0) {
            clearInterval(window[intervalKey]);
            el.querySelectorAll("." + digitsClass).forEach((d) => d.textContent = "00");
            return;
          }
          const d = Math.floor(dist / 864e5);
          const h = Math.floor((dist % 864e5) / 36e5);
          const min = Math.floor((dist % 36e5) / 6e4);
          const s = Math.floor((dist % 6e4) / 1e3);
          if (daysEl) daysEl.textContent = pad(d);
          if (hoursEl) hoursEl.textContent = pad(h);
          if (minutesEl) minutesEl.textContent = pad(min);
          if (secondsEl) secondsEl.textContent = pad(s);
        }, 1000);
      });
    } catch (e) {}
  })();