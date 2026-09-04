(function () {
  "use strict";

  var ACCOUNT_ID = "12903";
  var AFFILIATE_ID = "14686";
  var PRODUCTS = "PP_VPC2UNITS_AFF,PP_VPC3UNITS_AFF,PP_VPC6UNITS_AFF";
  var CONVERSION_TOKEN = "55f6ef467759a24ee738ffa4f1585c7f";
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
    return sourceParams.get(primary) || (fallback ? sourceParams.get(fallback) : "") || "";
  }

  function normalizeCheckoutLinks() {
    var sid = getSourceValue("subid", "sid");
    var sid2 = getSourceValue("subid2", "sid2");

    document.querySelectorAll('a[href*="buygoods.com/secure/checkout.html"]').forEach(function (link) {
      try {
        var checkout = new URL(link.href, window.location.href);
        if (checkout.hostname !== "buygoods.com" || checkout.pathname !== "/secure/checkout.html") return;
        if (checkout.searchParams.get("account_id") !== ACCOUNT_ID) return;

        checkout.searchParams.set("aff_id", AFFILIATE_ID);
        if (sid) checkout.searchParams.set("sid", sid);
        if (sid2) checkout.searchParams.set("sid2", sid2);
        link.href = checkout.toString();
      } catch (error) {
        // Leave the original checkout link untouched if URL parsing fails.
      }
    });
  }

  function getSessionId() {
    var cookieSession = readCookie("sessid2");
    if (cookieSession) return cookieSession;

    var checkoutLink = document.querySelector('a[href*="buygoods.com/secure/checkout.html"]');
    if (!checkoutLink) return "";
    try {
      return new URL(checkoutLink.href, window.location.href).searchParams.get("sessid2") || "";
    } catch (error) {
      return "";
    }
  }

  function insertConversionIframe() {
    if (conversionInserted) return;
    var sessionId = getSessionId();
    if (!sessionId) return;

    var iframe = document.createElement("iframe");
    iframe.async = true;
    iframe.style.display = "none";
    iframe.src =
      "https://buygoods.com/affiliates/go/conversion/iframe/bg?a=" + ACCOUNT_ID +
      "&t=" + CONVERSION_TOKEN +
      "&s=" + encodeURIComponent(sessionId);
    document.body.appendChild(iframe);
    conversionInserted = true;
  }

  var callerUrl = new URL(window.location.href);
  callerUrl.searchParams.set("aff_id", AFFILIATE_ID);

  var trackingSource =
    "https://tracking.buygoods.com/track/?a=" + ACCOUNT_ID +
    "&firstcookie=0" +
    "&tracking_redirect=" +
    "&referrer=" + encodeURIComponent(document.referrer) +
    "&sessid2=" + encodeURIComponent(readCookie("sessid2")) +
    "&product=" + encodeURIComponent(PRODUCTS) +
    "&vid1=&vid2=&vid3=" +
    "&caller_url=" + encodeURIComponent(callerUrl.toString());

  if (typeof window.add_to_cart !== "undefined") {
    trackingSource += "&add_to_cart=" + encodeURIComponent(window.add_to_cart);
  }

  var trackingScript = document.createElement("script");
  trackingScript.type = "text/javascript";
  trackingScript.defer = true;
  trackingScript.src = trackingSource;
  trackingScript.onload = function () {
    normalizeCheckoutLinks();
    insertConversionIframe();
  };
  trackingScript.onerror = normalizeCheckoutLinks;
  document.head.appendChild(trackingScript);

  normalizeCheckoutLinks();
  window.addEventListener("load", normalizeCheckoutLinks);
  document.addEventListener("pointerdown", normalizeCheckoutLinks, true);
  document.addEventListener("click", normalizeCheckoutLinks, true);

  window.setTimeout(function () {
    normalizeCheckoutLinks();
    insertConversionIframe();
  }, 3000);
})();
