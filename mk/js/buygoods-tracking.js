<script>
(function () {
  "use strict";

  /* =========================================================
     MINDWAKE / BUYGOODS
     ========================================================= */

  var ACCOUNT_ID = "12591";
  var AFFILIATE_ID = "6922";

  /* Pacotes:
     2 Bottles = min2n
     3 Bottles = min3b
     6 Bottles = min6b
  */
  var PRODUCTS = "min2n,min3b,min6b";

  /*
    ATENÇÃO:
    Ainda precisamos do Conversion Token específico do MindWake.
    NÃO use o token antigo do VapoCept.
  */
  var CONVERSION_TOKEN = "";

  var sourceParams = new URLSearchParams(window.location.search);
  var conversionInserted = false;

  function readCookie(name) {
    var prefix = name + "=";
    var parts = document.cookie.split(/;\s*/);

    for (var i = 0; i < parts.length; i += 1) {
      if (parts[i].indexOf(prefix) === 0) {
        return parts[i].substring(prefix.length);
      }
    }

    return "";
  }

  function getSourceValue(primary, fallback) {
    return (
      sourceParams.get(primary) ||
      (fallback ? sourceParams.get(fallback) : "") ||
      ""
    );
  }

  /*
    Garante que todos os links de checkout MindWake
    usem o seu Affiliate ID corretamente.
  */
  function normalizeCheckoutLinks() {
    var sid = getSourceValue("subid", "sid");
    var sid2 = getSourceValue("subid2", "sid2");

    document
      .querySelectorAll('a[href*="buygoods.com/secure/checkout.html"]')
      .forEach(function (link) {
        try {
          var checkout = new URL(link.href, window.location.href);

          if (checkout.hostname !== "buygoods.com") return;
          if (checkout.pathname !== "/secure/checkout.html") return;

          /*
            Só altera checkouts pertencentes ao MindWake.
          */
          if (checkout.searchParams.get("account_id") !== ACCOUNT_ID) return;

          /*
            Remove possível aff_id duplicado
            e deixa apenas o seu.
          */
          checkout.searchParams.delete("aff_id");
          checkout.searchParams.set("aff_id", AFFILIATE_ID);

          /*
            Propaga sub IDs caso existam na URL da página.
          */
          if (sid) {
            checkout.searchParams.set("sid", sid);
          }

          if (sid2) {
            checkout.searchParams.set("sid2", sid2);
          }

          link.href = checkout.toString();
        } catch (error) {
          /*
            Se houver erro ao interpretar o link,
            mantém o link original.
          */
        }
      });
  }

  function getSessionId() {
    /*
      Primeiro tenta pegar a sessão criada pela BuyGoods.
    */
    var cookieSession = readCookie("sessid2");

    if (cookieSession) {
      return cookieSession;
    }

    /*
      Como fallback, procura sessid2 em algum checkout.
    */
    var checkoutLink = document.querySelector(
      'a[href*="buygoods.com/secure/checkout.html"]'
    );

    if (!checkoutLink) {
      return "";
    }

    try {
      return (
        new URL(checkoutLink.href, window.location.href)
          .searchParams.get("sessid2") || ""
      );
    } catch (error) {
      return "";
    }
  }

  /*
    Conversion iframe.
    Só será disparado quando você colocar
    o Conversion Token correto do MindWake.
  */
  function insertConversionIframe() {
    if (conversionInserted) return;

    if (!CONVERSION_TOKEN) {
      return;
    }

    var sessionId = getSessionId();

    if (!sessionId) {
      return;
    }

    var iframe = document.createElement("iframe");

    iframe.async = true;
    iframe.style.display = "none";

    iframe.src =
      "https://buygoods.com/affiliates/go/conversion/iframe/bg" +
      "?a=" +
      encodeURIComponent(ACCOUNT_ID) +
      "&t=" +
      encodeURIComponent(CONVERSION_TOKEN) +
      "&s=" +
      encodeURIComponent(sessionId);

    document.body.appendChild(iframe);

    conversionInserted = true;
  }

  /*
    URL da página utilizada pelo tracking BuyGoods.
  */
  var callerUrl = new URL(window.location.href);

  callerUrl.searchParams.set("aff_id", AFFILIATE_ID);

  var trackingSource =
    "https://tracking.buygoods.com/track/" +
    "?a=" +
    encodeURIComponent(ACCOUNT_ID) +
    "&firstcookie=0" +
    "&tracking_redirect=" +
    "&referrer=" +
    encodeURIComponent(document.referrer) +
    "&sessid2=" +
    encodeURIComponent(readCookie("sessid2")) +
    "&product=" +
    encodeURIComponent(PRODUCTS) +
    "&vid1=&vid2=&vid3=" +
    "&caller_url=" +
    encodeURIComponent(callerUrl.toString());

  if (typeof window.add_to_cart !== "undefined") {
    trackingSource +=
      "&add_to_cart=" +
      encodeURIComponent(window.add_to_cart);
  }

  /*
    Carrega tracking oficial BuyGoods.
  */
  var trackingScript = document.createElement("script");

  trackingScript.type = "text/javascript";
  trackingScript.defer = true;
  trackingScript.src = trackingSource;

  trackingScript.onload = function () {
    normalizeCheckoutLinks();
    insertConversionIframe();
  };

  trackingScript.onerror = function () {
    normalizeCheckoutLinks();
  };

  document.head.appendChild(trackingScript);

  /*
    Garante que os links sejam corrigidos
    mesmo se outros scripts alterarem o DOM depois.
  */
  normalizeCheckoutLinks();

  window.addEventListener("load", normalizeCheckoutLinks);

  document.addEventListener(
    "pointerdown",
    normalizeCheckoutLinks,
    true
  );

  document.addEventListener(
    "click",
    normalizeCheckoutLinks,
    true
  );

  window.setTimeout(function () {
    normalizeCheckoutLinks();
    insertConversionIframe();
  }, 3000);
})();
</script>
