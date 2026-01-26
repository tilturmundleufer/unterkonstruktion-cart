(function(){
  // Laufzeit-Guard: Dieser Block soll den Checkout nicht beeinflussen.
  // Wenn wir nicht im Cart-Kontext sind, brich ab (verhindert Checkout-Fehler).
  var fcRoot = document.querySelector('#fc-cart');
  var __ukc_ctx = fcRoot ? fcRoot.getAttribute('data-context') : null;
  if(__ukc_ctx !== 'cart' && __ukc_ctx !== 'sidecart' && __ukc_ctx !== 'checkout') {
    return; // Nur andere Kontexte ausklammern
  }
  var form = document.getElementById('fc-cart-form');
  var updating = false;
  var pendingUpdate = false;
  // Global flag für Auto-Updater (verhindert Konflikt mit AJAX-Update)
  window.__ukc_ajax_updating = false;
  
  // ===== SESSION PERSISTENCE FIX (nur localStorage, keine Cookies) =====
  // Problem: In Chrome auf Mac geht die Session bei Refresh verloren
  // Lösung: Session in localStorage speichern (Cookies verursachen Duplikate)
  (function sessionPersistence(){
    var STORAGE_KEY = 'ukc_foxy_session';
    var SESSION_NAME_KEY = 'ukc_foxy_session_name';
    
    // Session aus localStorage lesen
    function getStoredSession(){
      try {
        var sessionId = localStorage.getItem(STORAGE_KEY);
        var sessionName = localStorage.getItem(SESSION_NAME_KEY) || 'fcsid';
        
        if(sessionId && sessionId.length > 5) {
          return { id: sessionId, name: sessionName };
        }
      } catch(e) {}
      return null;
    }
    
    // Session aus Template lesen und speichern
    function saveCurrentSession(){
      try {
        var sessionInput = document.querySelector('input[name="fcsid"], input[name="fc_sid"], input[name="fssid"]');
        if(!sessionInput) {
          sessionInput = document.querySelector('input[type="hidden"][name*="sid"]');
        }
        
        if(sessionInput && sessionInput.value){
          var sessionName = sessionInput.name;
          var sessionId = sessionInput.value;
          
          if(sessionId && sessionId.length > 5){
            // Nur in localStorage speichern (keine Cookies = keine Duplikate)
            localStorage.setItem(STORAGE_KEY, sessionId);
            localStorage.setItem(SESSION_NAME_KEY, sessionName);
            
            return { id: sessionId, name: sessionName };
          }
        }
      } catch(e) {
        console.error('[UKC] Session speichern fehlgeschlagen:', e);
      }
      return null;
    }
    
    // Session an FoxyCart Links/Forms anhängen (mit Anti-Duplikat-Prüfung)
    function attachSessionToElements(session){
      if(!session || !session.id) return;
      
      // FoxyCart Links - VERBESSERTE Duplikat-Prüfung
      document.querySelectorAll('a[href*="foxycart.com"]').forEach(function(link){
        var href = link.getAttribute('href') || '';
        // Prüfe auf ALLE möglichen Session-Parameter (fcsid, fc_sid, fssid)
        if(href && !href.includes('fcsid=') && !href.includes('fc_sid=') && !href.includes('fssid=')){
          var separator = href.includes('?') ? '&' : '?';
          link.setAttribute('href', href + separator + session.name + '=' + session.id);
        }
      });
      
      // FoxyCart Forms
      document.querySelectorAll('form[action*="foxycart.com"]').forEach(function(form){
        var existing = form.querySelector('input[name="fcsid"], input[name="fc_sid"], input[name="fssid"]');
        if(!existing) {
          var input = document.createElement('input');
          input.type = 'hidden';
          input.name = session.name;
          input.value = session.id;
          form.appendChild(input);
        } else if(existing.value !== session.id) {
          existing.value = session.id;
        }
      });
    }
    
    // FC.sid setzen (wenn FC Object existiert)
    function injectIntoFC(session){
      if(!session || !window.FC) return;
      try {
        if(!FC.sid || FC.sid === '') {
          FC.sid = session.id;
        }
      } catch(e) {}
    }
    
    // INIT: Beim Page-Load - NUR EINMAL ausführen!
    var stored = getStoredSession();
    var saved = saveCurrentSession();
    var session = saved || stored;
    
    if(session) {
      attachSessionToElements(session);
      setTimeout(function(){ injectIntoFC(session); }, 100);
    } else {
    }
    
    // Nur EINE verzögerte Wiederholung für dynamische Inhalte
    setTimeout(function(){
      var s = getStoredSession() || saveCurrentSession();
      if(s) { 
        attachSessionToElements(s); 
        injectIntoFC(s); 
      }
    }, 1500);
  })();
  function getLocale(){ return document.querySelector('#fc-cart')?.dataset.locale || 'de-DE'; }
  function getCurrency(){ return document.querySelector('#fc-cart')?.dataset.currency || 'EUR'; }
  function getCustomerType(){
    try{ var m = document.cookie.match(/(?:^|; )ukc_customer_type=([^;]+)/); return m ? decodeURIComponent(m[1]) : ''; }catch(_){ return ''; }
  }
  function formatMoney(num){ return new Intl.NumberFormat(getLocale(), { style: 'currency', currency: getCurrency() }).format(num); }
  function recalcSummary(){
    var subtotal = 0;
    document.querySelectorAll('.ukc-row').forEach(function(row){
      var qtyInput = row.querySelector('input[data-fc-id="item-quantity-input"]');
      var qty = parseInt(qtyInput?.value || '0', 10) || 0;
      var each = parseFloat(row.getAttribute('data-price-each') || '0') || 0;
      subtotal += each * qty;
      var totalEl = row.querySelector('.ukc-row__total p');
      if(totalEl){ totalEl.textContent = formatMoney(each * qty); }
    });
    
    // Update Subtotal
    var subEl = document.querySelector('[data-ukc-subtotal]');
    if(subEl) subEl.textContent = formatMoney(subtotal);
    
    // Im Cart-Kontext: Tax und Total auch clientseitig aktualisieren
    // (Server-Response überschreibt diese später mit korrekten Werten)
    var context = document.querySelector('#fc-cart')?.getAttribute('data-context');
    if(context === 'cart') {
      var taxEl = document.querySelector('[data-ukc-tax-total]');
      var totalEl = document.querySelector('[data-ukc-total-order]');
      
      // Steuer immer 19% - Subtotal ist Netto, Tax = 19%, Total = Brutto
      var tax = subtotal * 0.19;
      var total = subtotal + tax;
      
      if(taxEl) taxEl.textContent = formatMoney(tax);
      if(totalEl) totalEl.textContent = formatMoney(total);
    }
  }
  // Tax Summary Updates werden komplett von FoxyCart's nativer Lösung übernommen
  // Keine Custom Tax-Berechnungen mehr nötig
  function findQtyInput(itemId){
    return document.querySelector('input[data-fc-id="item-quantity-input"][data-fc-item-id="'+itemId+'"]');
  }
  function requestUpdate(){
    if(updating){
      pendingUpdate = true;
      return;
    }
    ajaxUpdate();
  }
  async function ajaxUpdate(){
    if(!form) return;
    if(updating){
      pendingUpdate = true;
      return;
    }
    
    // Check: Ist das Form im DOM verbunden?
    if(!form.isConnected || !document.body.contains(form)){
      console.warn('[UKC] Form ist nicht im DOM verbunden - Skip AJAX');
      updating = false;
      return;
    }
    
    // CORS-Check: Nur auf FoxyCart-Domain AJAX machen
    var currentDomain = window.location.hostname;
    var formDomain = '';
    try {
      formDomain = new URL(form.action).hostname;
    } catch(e) {}
    
    var isSameOrigin = currentDomain === formDomain || formDomain.includes('foxycart.com') && currentDomain.includes('foxycart.com');
    var currentContext = document.querySelector('#fc-cart')?.getAttribute('data-context');
    
    // Im Sidecart keine eigene AJAX-Logik: FoxyCart übernimmt die Updates
    if(currentContext === 'sidecart'){
      updating = false;
      return;
    }
    
    if(!isSameOrigin){
      // Bei Cross-Origin: kein AJAX, da CORS-Fehler
      // Die Updates werden durch normale Page-Loads gemacht
      updating = false;
      return;
    }
    
    updating = true;
    window.__ukc_ajax_updating = true; // Pausiere Auto-Updater
    try{
      var fd = new FormData(form);
      fd.set('cart','update');
      // Kundentyp aus Cookie in Hidden-Field spiegeln und mitsenden
      try{
        var cookieMatch = document.cookie.match(/(?:^|; )ukc_customer_type=([^;]+)/);
        var val = cookieMatch ? decodeURIComponent(cookieMatch[1]) : '';
        var inp = document.getElementById('ukc-customer-type-input');
        if(inp) inp.value = val;
        if(val) fd.set('customer_type', val);
      }catch(_){}
      // Sofort im UI vorrechnen, damit es flüssig wirkt
      recalcSummary();
      var res = await fetch(form.action, { method:'POST', body: fd, credentials:'include' });
      var html = await res.text();
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var next = doc.querySelector('#fc-cart');
      var current = document.querySelector('#fc-cart');
      if(next && current){ 
        
        // 1. Aktualisiere Items-Liste
        var nextItems = next.querySelector('.ukc-items');
        var currItems = current.querySelector('.ukc-items');
        if(nextItems && currItems){
            currItems.innerHTML = nextItems.innerHTML;
        } else {
            // Fallback: kompletter Replace
            current.replaceWith(next);
            return;
        }
        
        // 2. Aktualisiere die gesamte Sidebar (inkl. Summary-Tabelle)
        var nextSidebar = next.querySelector('[data-ukc-summary-root]');
        var currSidebar = current.querySelector('[data-ukc-summary-root]');
        
        if(nextSidebar && currSidebar) {
          // Ersetze den gesamten Sidebar-Inhalt
          currSidebar.innerHTML = nextSidebar.innerHTML;
        } else {
          // Fallback: versuche nur die Tabelle zu aktualisieren
          var nextSummaryTable = next.querySelector('[data-ukc-summary-table]');
          var currSummaryTable = current.querySelector('[data-ukc-summary-table]');
          if(nextSummaryTable && currSummaryTable) {
            currSummaryTable.innerHTML = nextSummaryTable.innerHTML;
          }
        }
        
        // 3. Item-Count aktualisieren
        var nextCount = next.querySelector('[data-fc-order-quantity-integer]');
        var currCount = current.querySelector('[data-fc-order-quantity-integer]');
        if(nextCount && currCount) currCount.textContent = nextCount.textContent;
        
        return;
      }
      // Fallback: live totals/row calculation ohne kompletten Reflow
      const locale = getLocale();
      const currency = getCurrency();
      // Update subtotals/total wenn vorhanden
      const sub = doc.querySelector('[data-ukc-subtotal]');
      const totalOrder = doc.querySelector('[data-ukc-total-order]');
      const ship = doc.querySelector('[data-ukc-shipping]');
      const nextContext = next?.getAttribute('data-context');
      if(nextContext){ document.querySelectorAll('#fc-cart').forEach(function(el){ el.setAttribute('data-context', nextContext); }); }
      if(sub){ document.querySelectorAll('[data-ukc-subtotal]').forEach(function(el){ el.innerHTML = sub.innerHTML; }); }
      if(totalOrder){ document.querySelectorAll('[data-ukc-total-order]').forEach(function(el){ el.innerHTML = totalOrder.innerHTML; }); }
      // Mehrwertsteuer aus Server-Response ziehen (FoxyCart native Berechnung)
      const tax = doc.querySelector('[data-ukc-tax-total]');
      if(tax){
        const el = document.querySelector('[data-ukc-tax-total]'); 
        if(el) el.innerHTML = tax.innerHTML;
      }
      // Kein Fallback mehr - FoxyCart's Server-Response ist immer korrekt
      if(ship){ const el = document.querySelector('[data-ukc-shipping]'); if(el) el.innerHTML = ship.innerHTML; }

      // Falls Kontext 'cart' ist, alle Versand-Container ausblenden (Defensivmaßnahme)
      var currentContext = document.querySelector('#fc-cart')?.getAttribute('data-context');
      if(currentContext === 'cart'){
        document.querySelectorAll('.fc-transaction__shipping, [data-fc-id="button-toggle-multiship-details"], .fc-transaction__shipping-address').forEach(function(n){ n?.parentElement?.removeChild(n); });
      }
      recalcSummary();
      // updateTaxSummary() entfernt - FoxyCart native Lösung nutzen
      
      // Tax-Berechnung im Checkout und Cart triggern
      if(currentContext === 'checkout' || currentContext === 'cart'){
        var customerType = getCustomerType();
        
        // Customer Type direkt in billing_company setzen (wird immer übertragen)
        if(typeof FC !== 'undefined' && FC.cart) {
          // Speichere ursprünglichen Wert
          if(!FC.cart._original_billing_company) {
            FC.cart._original_billing_company = FC.cart.billing_company || '';
          }
          // Setze customer_type als billing_company
          FC.cart.billing_company = customerType;
        }
        
        // Zusätzlich: Customer Type Input setzen falls vorhanden
        var customerTypeInput = document.getElementById('customer_type');
        if(customerTypeInput){
          customerTypeInput.value = customerType;
        }
        
        // Keine manuellen Steuer-Trigger mehr
        if(currentContext === 'cart') {
          // Im cart Context: Cart-Update triggern, damit der customer_type übertragen wird
          if(typeof FC !== 'undefined' && FC.cart && FC.cart.updateHash) {
            FC.cart.updateHash();
          }
        }
      }
      
      // Bestellnummer nach AJAX-Update wiederherstellen
      setTimeout(function(){
        generatePurchaseOrderNumber();
        // Zusätzliche Sicherheit: Alle PO-Felder im DOM finden und readonly machen
        var allPOInputs = document.querySelectorAll('#purchase_order');
        allPOInputs.forEach(function(input) {
          var storedPONumber = sessionStorage.getItem('ukc_po_number');
          if(storedPONumber) {
            input.value = storedPONumber;
            setPOFieldReadonly(input);
          }
        });
      }, 100);
    }catch(e){
      if(form) form.submit();
    }finally{
      updating = false;
      // Auto-Updater wieder aktivieren OHNE manuellen Trigger
      // WICHTIG: KEIN scheduleUpdate() aufrufen, da FC.cart noch alte Werte hat!
      // Der Auto-Updater läuft automatisch über MutationObserver bei echten FoxyCart-Updates
      setTimeout(function(){
        window.__ukc_ajax_updating = false;
        if(pendingUpdate){
          pendingUpdate = false;
          setTimeout(function(){ ajaxUpdate(); }, 0);
        }
      }, 300);
    }
  }
  // Kundentyp ableiten: Wenn Firmenname gesetzt => firmenkunde, sonst privat
  function getCustomerType(){
    try {
      if (typeof FC !== 'undefined' && FC.cart) {
        var company = (FC.cart.billing_company || FC.cart.shipping_company || '').trim();
        if(company.length > 0) return 'firmenkunde';
      }
    } catch(e) {}
    // Fallback via Cookie (falls vorhanden)
    var cookies = document.cookie.split(';');
    for(var i = 0; i < cookies.length; i++){
      var cookie = cookies[i].trim();
      if(cookie.indexOf('ukc_customer_type=') === 0){
        var value = cookie.substring('ukc_customer_type='.length);
        return value || 'privat';
      }
    }
    return 'privat';
  }
  
  // Firmenname in Foxy setzen (Foxy berechnet Steuern nativ)
  function applyCompanyAndTriggerTax(){
    var currentContext = document.querySelector('#fc-cart')?.getAttribute('data-context');
    if(typeof FC === 'undefined' || !FC.cart) {
      return;
    }
    
    // Erweitere Suche nach Company-Feldern
    var billingSelectors = [
      '#billing_company',
      'input[name="billing_company"]',
      'input[data-fc-name="billing_company"]',
      'input[id*="billing"][id*="company"]',
      'input[name*="billing"][name*="company"]'
    ];
    
    var shippingSelectors = [
      '#shipping_company',
      'input[name="shipping_company"]',
      'input[data-fc-name="shipping_company"]',
      'input[id*="shipping"][id*="company"]',
      'input[name*="shipping"][name*="company"]'
    ];
    
    var billingCompany = '';
    var shippingCompany = '';
    
    // Suche billing company
    for(var i = 0; i < billingSelectors.length; i++) {
      var el = document.querySelector(billingSelectors[i]);
      if(el && el.value) {
        billingCompany = el.value.trim();
        break;
      }
    }
    
    // Suche shipping company
    for(var i = 0; i < shippingSelectors.length; i++) {
      var el = document.querySelector(shippingSelectors[i]);
      if(el && el.value) {
        shippingCompany = el.value.trim();
        break;
      }
    }
    
    
    // Setze beide Felder in FC.cart
    FC.cart.billing_company = billingCompany;
    FC.cart.shipping_company = shippingCompany;
    
    // Zusätzlich: Setze auch in den hidden inputs (falls vorhanden)
    var hiddenBilling = document.querySelector('input[name="billing_company"], input[data-fc-name="billing_company"]');
    var hiddenShipping = document.querySelector('input[name="shipping_company"], input[data-fc-name="shipping_company"]');
    
    if(hiddenBilling) hiddenBilling.value = billingCompany;
    if(hiddenShipping) hiddenShipping.value = shippingCompany;
    
    if(currentContext === 'checkout') { maybeTriggerFoxy(); }
  }
  
  // Kundentyp-Änderung behandeln (ohne eigene Tax-Aufrufe)
  function triggerTaxCalculation(){
    var currentContext = document.querySelector('#fc-cart')?.getAttribute('data-context');
    
    // Tax-Berechnung sowohl im cart als auch im checkout Context
    if(currentContext === 'checkout' || currentContext === 'cart'){
      var customerType = getCustomerType();
      
      // Firmenname aus Eingabe übernehmen (falls Feld vorhanden)
      try { applyCompanyAndTriggerTax(); } catch(e) {}
      
      // Zusätzlich: Customer Type Input (falls vorhanden) nur informativ setzen
      var customerTypeInput = document.getElementById('customer_type');
      if(customerTypeInput){ customerTypeInput.value = customerType; }
      
      // Keine manuellen Steuer-Requests mehr – Foxy aktualisiert die Beträge selbst
      } else {
    }
  }
  
  
  
  
  
  // Sicherstellen dass Billing-Adresse sichtbar ist
  function ensureBillingAddressVisible() {
    var billingBlocks = [
      '[data-fc-id="block-billing-address"]',
      '.fc-transaction__billing',
      '.fc-container__grid--billing',
      '.fc-container__grid--billing-address'
    ];
    
    billingBlocks.forEach(function(selector) {
      var elements = document.querySelectorAll(selector);
      elements.forEach(function(el) {
        if(el) {
          el.style.display = 'block';
          el.style.visibility = 'visible';
        }
      });
    });
    
    // Billing company field sichtbar machen
    var companyFields = [
      'input[name="billing_company"]',
      'input[data-fc-name="billing_company"]',
      '#billing_company'
    ];
    
    companyFields.forEach(function(selector) {
      var field = document.querySelector(selector);
      if(field) {
        field.style.display = 'block';
        field.style.visibility = 'visible';
      }
    });
  }
  
  // Billing-Adresse beim Laden sichtbar machen
  ensureBillingAddressVisible();
  
  // Auch nach AJAX-Updates
  setTimeout(ensureBillingAddressVisible, 1000);
  setTimeout(ensureBillingAddressVisible, 3000);
  
  
  
  
  
  
  
  
  // Checkout: Listener für Firmenname, debounced Tax/Shipping Trigger
  function debounce(fn, wait){ let t; return function(){ clearTimeout(t); t = setTimeout(fn, wait); }; }
  function getVal(sel){ var el = document.querySelector(sel); return (el && el.value ? String(el.value).trim() : ''); }
  function hasValidAddress(){
    var bc = getVal('[data-fc-name="billing_country"], input[name="billing_country"]');
    var bp = getVal('[data-fc-name="billing_postal_code"], input[name="billing_postal_code"]');
    var sc = getVal('[data-fc-name="shipping_country"], input[name="shipping_country"]');
    var sp = getVal('[data-fc-name="shipping_postal_code"], input[name="shipping_postal_code"]');
    return (bc && bp) || (sc && sp);
  }
  var maybeTriggerFoxy = debounce(function(){
    if(typeof FC === 'undefined') return;
    var isCheckout = document.querySelector('#fc-cart')?.getAttribute('data-context') === 'checkout';
    if(!isCheckout) return;
    
    // Bei Company-Änderung auch ohne vollständige Adresse Tax triggern, Foxy darf 0% liefern
    if(!hasValidAddress()){
      return;
    }
    
    // Shipping triggern
    try{ FC.checkout && FC.checkout.shipping && FC.checkout.shipping.get_shipping_and_handling && FC.checkout.shipping.get_shipping_and_handling(); }catch(_){ }
  }, 400);
  // Hilfsfunktion: hidden Inputs für billing_company / shipping_company sicherstellen
  function ensureCompanyHiddenInputs(){
    var form = document.querySelector('[data-fc-id="checkout-form"]') ||
                   document.querySelector('#fc-checkout-form') ||
                   document.querySelector('form[action*="foxy"]') ||
                   document.querySelector('form');
    if(!form) return { billing: null, shipping: null };
    var billing = form.querySelector('input[name="billing_company"], input[data-fc-name="billing_company"]');
    var shipping = form.querySelector('input[name="shipping_company"], input[data-fc-name="shipping_company"]');
    // Falls sichtbares Feld existiert, aber kein data-fc-name/trigger gesetzt ist: ergänzen
    if(billing && !billing.getAttribute('data-fc-name')){
      billing.setAttribute('data-fc-name','billing_company');
      billing.setAttribute('data-fc-tax-trigger','true');
    }
    if(shipping && !shipping.getAttribute('data-fc-name')){
      shipping.setAttribute('data-fc-name','shipping_company');
      shipping.setAttribute('data-fc-tax-trigger','true');
    }
    if(!billing){
      billing = document.createElement('input');
      billing.type='hidden';
      billing.name='billing_company';
      billing.setAttribute('data-fc-name','billing_company');
      billing.setAttribute('data-fc-tax-trigger','true');
      billing.id='ukc_billing_company_hidden';
      form.appendChild(billing);
    }
    if(!shipping){
      shipping = document.createElement('input');
      shipping.type='hidden';
      shipping.name='shipping_company';
      shipping.setAttribute('data-fc-name','shipping_company');
      shipping.setAttribute('data-fc-tax-trigger','true');
      shipping.id='ukc_shipping_company_hidden';
      form.appendChild(shipping);
    }
    return { billing: billing, shipping: shipping };
  }

  // Sync-Funktion: sichtbare Felder -> hidden Inputs -> FC.cart (nur bei echten Änderungen)
  function syncCompanyFields(){
    var refs = ensureCompanyHiddenInputs();
    var visibleBilling = document.querySelector('#billing_company') ||
                         document.querySelector('input[name="billing_company"]') ||
                         document.querySelector('input[data-fc-name="billing_company"]');
    var visibleShipping = document.querySelector('#shipping_company') ||
                          document.querySelector('input[name="shipping_company"]') ||
                          document.querySelector('input[data-fc-name="shipping_company"]');
    var billingVal = (visibleBilling && visibleBilling !== refs.billing) ? (visibleBilling.value||'') : (refs.billing?.value||'');
    var shippingVal = (visibleShipping && visibleShipping !== refs.shipping) ? (visibleShipping.value||'') : (refs.shipping?.value||'');
    var prevBill = window.__ukc_prev_billing_company || '';
    var prevShip = window.__ukc_prev_shipping_company || '';
    var changedBill = String(billingVal||'') !== String(prevBill||'');
    var changedShip = String(shippingVal||'') !== String(prevShip||'');
    
    
    if(refs.billing){ refs.billing.value = billingVal; if(changedBill){ try{ refs.billing.dispatchEvent(new Event('change',{bubbles:true})); }catch(_){ } } }
    if(refs.shipping){ refs.shipping.value = shippingVal; if(changedShip){ try{ refs.shipping.dispatchEvent(new Event('change',{bubbles:true})); }catch(_){ } } }
    if(typeof FC !== 'undefined' && FC.cart){
      if(changedBill) FC.cart.billing_company = billingVal;
      if(changedShip) FC.cart.shipping_company = shippingVal;
    }
    if(changedBill || changedShip){
      window.__ukc_prev_billing_company = billingVal;
      window.__ukc_prev_shipping_company = shippingVal;
      maybeTriggerFoxy();
    }
  }

  // Listener an sichtbare Felder
  (function attachCompanyListeners(){
    var debounced = debounce(function(){
        // Felder zu FC.cart spiegeln
        syncCompanyFields();
        // Sichtbare Felder -> FC.cart & Hidden, evtl. Versand-Refresh
        applyCompanyAndTriggerTax();
      
        // WICHTIG: Steuer-Neuberechnung anstoßen, weil "Firma" alleine kein Tax-Event auslöst
        try {
          if (typeof FC !== 'undefined' && FC.cart && typeof FC.cart.getTaxes === 'function') {
            var address = FC.cart.shipping_address || (FC.json && FC.json.shipping_address) || {};
            FC.cart.getTaxes({ address: address });
            // FoxyCart updated UI automatisch nach getTaxes()
          }
        } catch(e) { /* noop */ }
    }, 250);
    ['#billing_company','input[name="billing_company"]','input[data-fc-name="billing_company"]','#shipping_company','input[name="shipping_company"]','input[data-fc-name="shipping_company"]']
      .forEach(function(sel){
        var el = document.querySelector(sel);
        if(el){ ['input','change','blur'].forEach(function(evt){ el.addEventListener(evt, debounced); }); }
      });
    // Falls Foxy Felder dynamisch rendert: nochmals nach kurzer Zeit anhängen
    setTimeout(function(){
      ['#billing_company','input[name="billing_company"]','input[data-fc-name="billing_company"]']
        .forEach(function(sel){
          var el = document.querySelector(sel);
          if(el){ ['input','change','blur'].forEach(function(evt){ el.addEventListener(evt, debounced); }); }
        });
    }, 800);
  })();

  // Seltener Fallback-Sync gegen DOM-Replacements
  // setInterval(syncCompanyFields, 3000); // Deaktiviert um Console-Spam zu vermeiden
  
  // Tax-Berechnung bei Cookie-Änderungen triggern
  var originalSetCookie = document.cookie;
  setInterval(function(){
    var ctx = document.querySelector('#fc-cart')?.getAttribute('data-context');
    if(ctx !== 'checkout' && ctx !== 'cart') return;
    if(document.cookie !== originalSetCookie){
      originalSetCookie = document.cookie;
      triggerTaxCalculation();
    }
  }, 5000);
  
  // Hilfsfunktion: alle möglichen Purchase-Order-Felder finden (verschiedene Renderpfade)
  function getPOInputs(){
    var nodes = [];
    try{
      ['#purchase_order','[name="purchase_order"]','[data-fc-name="purchase_order"]'].forEach(function(sel){
        document.querySelectorAll(sel).forEach(function(n){ if(n && nodes.indexOf(n) === -1) nodes.push(n); });
      });
    }catch(_){ }
    return nodes;
  }
  
  // Purchase Order Feld permanent readonly machen
  function setPOFieldReadonly(poInput) {
    if(poInput) {
      poInput.readOnly = true;
      try{ poInput.setAttribute('readonly','readonly'); }catch(_){}
      poInput.disabled = false; // disabled = true würde das Feld grau machen, aber wir wollen es nur readonly
      poInput.style.backgroundColor = '#f8f9fa';
      poInput.style.cursor = 'not-allowed';
      poInput.style.color = '#6c757d';
      
      // Zusätzliche Sicherheit: Event-Listener entfernen
      poInput.onclick = function(e) { e.preventDefault(); return false; };
      poInput.onkeydown = function(e) { e.preventDefault(); return false; };
      poInput.onkeyup = function(e) { e.preventDefault(); return false; };
      poInput.onkeypress = function(e) { e.preventDefault(); return false; };
      poInput.oninput = function(e) { e.preventDefault(); return false; };
      poInput.onpaste = function(e) { e.preventDefault(); return false; };
    }
  }
  
  // Automatische Bestellnummer für Purchase Order generieren
  function generatePurchaseOrderNumber(){
    var inputs = getPOInputs();
    var poInput = inputs[0];
    if(poInput){
      // Prüfe ob bereits eine Bestellnummer im Session Storage gespeichert ist
      var storedPONumber = sessionStorage.getItem('ukc_po_number');
      
      if(storedPONumber) {
        // Verwende gespeicherte Bestellnummer
        inputs.forEach(function(input){ input.value = storedPONumber; setPOFieldReadonly(input); });
      } else if(!poInput.value) {
        // Generiere neue Bestellnummer nur wenn keine vorhanden ist
        var now = new Date();
        var year = now.getFullYear();
        var month = String(now.getMonth() + 1).padStart(2, '0');
        var day = String(now.getDate()).padStart(2, '0');
        var hours = String(now.getHours()).padStart(2, '0');
        var minutes = String(now.getMinutes()).padStart(2, '0');
        var seconds = String(now.getSeconds()).padStart(2, '0');
        var random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
        
        // Prüfen ob Nutzer eingeloggt ist und PBI-Attribut hat
        var customerId = document.querySelector('#customer_id')?.value;
        var isLoggedIn = customerId && customerId !== '0';
        var pbiValue = null;
        
        // Versuche PBI-Wert aus Custom Attributes zu holen (nur für eingeloggte Nutzer)
        if(isLoggedIn) {
          try {
            // Prüfe ob Foxy-Daten verfügbar sind
            if(typeof FC !== 'undefined' && FC.cart && FC.cart.customer && FC.cart.customer.attributes) {
              var attributes = FC.cart.customer.attributes;
              for(var i = 0; i < attributes.length; i++) {
                if(attributes[i].name === 'PBI') {
                  pbiValue = attributes[i].value;
                  break;
                }
              }
            }
          } catch(e) {
          }
        }
        
        var poNumber;
        if(isLoggedIn && pbiValue) {
          // Für eingeloggte Nutzer MIT PBI-Attribut: PBI-WERT-YYYYMMDD-HHMMSS-XXXX Format
          poNumber = 'PBI-' + pbiValue + '-' + year + month + day + '-' + hours + minutes + seconds + '-' + random;
        } else {
          // Für alle anderen (Gäste und eingeloggte Nutzer ohne PBI): Standard UKC-Format
          poNumber = 'UKC-' + year + month + day + '-' + hours + minutes + seconds + '-' + random;
        }
        
        // Speichere Bestellnummer im Session Storage
        sessionStorage.setItem('ukc_po_number', poNumber);
        
        // auf alle gefundenen Felder anwenden
        inputs.forEach(function(input){ input.value = poNumber; setPOFieldReadonly(input); });
      }
    }
  }
  
  // Bestellnummer beim Laden generieren
  generatePurchaseOrderNumber();
  // nach kurzem Delay erneut (falls PO erst spät gerendert wird)
  setTimeout(generatePurchaseOrderNumber, 300);
  setTimeout(generatePurchaseOrderNumber, 1000);
  // Observer aktivieren, falls Feld später in den DOM kommt
  setTimeout(function(){ try{ setupPOFieldObserver(); }catch(_){ } }, 200);
  
  // Bestellnummer auch bei Payment-Method-Wechsel generieren
  document.addEventListener('change', function(ev){
    if(ev.target && ev.target.name === 'fc_payment_method' && ev.target.value === 'purchase_order'){
      setTimeout(function(){
        try{ generatePurchaseOrderNumber(); }catch(_){}
        try{ setupPOFieldObserver(); }catch(_){}
      }, 100);
    }
  });
  
  // Direkter Event-Listener für Versandmethoden-Änderungen
  document.addEventListener('change', function(ev){
    // Prüfe ob es ein Versandmethoden-Radio-Button ist
    if(ev.target && ev.target.type === 'radio' && ev.target.name && ev.target.name.includes('shipping')) {
      setTimeout(function(){
        var allPOInputs = getPOInputs();
        allPOInputs.forEach(function(input) {
          var storedPONumber = sessionStorage.getItem('ukc_po_number');
          if(storedPONumber) {
            input.value = storedPONumber;
            setPOFieldReadonly(input);
          }
        });
      }, 200);
    }
  });
  
  // Zusätzlicher Event-Listener für alle Klicks auf Versandoptionen
  document.addEventListener('click', function(ev){
    // Prüfe ob auf eine Versandoption geklickt wurde
    if(ev.target && (ev.target.closest('.fc-shipping-rates__rate') || ev.target.closest('[data-fc-id="shipping-results"]'))) {
      setTimeout(function(){
        var allPOInputs = getPOInputs();
        allPOInputs.forEach(function(input) {
          var storedPONumber = sessionStorage.getItem('ukc_po_number');
          if(storedPONumber) {
            input.value = storedPONumber;
            setPOFieldReadonly(input);
          }
        });
      }, 300);
    }
  });

  // Sobald Foxy Checkout-Section Payment aktiv wird, nochmal setzen
  document.addEventListener('fc:payment:method:ready', function(){
    setTimeout(function(){ try{ generatePurchaseOrderNumber(); setupPOFieldObserver(); }catch(_){ } }, 50);
  });
  // fc:cart:update und fc:cart:change Event Listener entfernt
  // FoxyCart's native UI-Updates werden genutzt
  
  // MutationObserver für Purchase Order Feld - überwacht Änderungen am DOM
  function setupPOFieldObserver() {
    var ctx = document.querySelector('#fc-cart')?.getAttribute('data-context');
    if(ctx !== 'checkout') return;
    var poInput = document.getElementById('purchase_order') || document.querySelector('[name="purchase_order"]') || document.querySelector('[data-fc-name="purchase_order"]');
    if(poInput) {
      // Observer für das spezifische Feld
      var observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          if(mutation.type === 'attributes' && mutation.attributeName === 'readonly') {
            // Falls readonly-Attribut entfernt wurde, wieder hinzufügen
            if(!poInput.readOnly) {
              setPOFieldReadonly(poInput);
            }
          }
        });
      });
      
      // Beobachte Änderungen an Attributen
      observer.observe(poInput, { 
        attributes: true, 
        attributeFilter: ['readonly', 'disabled', 'style'] 
      });
      
      // Zusätzlicher Observer für das gesamte Dokument (falls Feld neu erstellt wird)
      var docObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          if(mutation.type === 'childList') {
            mutation.addedNodes.forEach(function(node) {
              if(node.nodeType === 1) { // Element node
                var newPOInput = null;
                try{
                  newPOInput = node.querySelector ? (node.querySelector('#purchase_order') || node.querySelector('[name="purchase_order"]') || node.querySelector('[data-fc-name="purchase_order"]')) : null;
                }catch(_){ }
                if(newPOInput || node.id === 'purchase_order') {
                  var targetInput = newPOInput || node;
                  setTimeout(function() {
                    var storedPONumber = sessionStorage.getItem('ukc_po_number');
                    if(storedPONumber) {
                      targetInput.value = storedPONumber;
                      setPOFieldReadonly(targetInput);
                    } else {
                      // Noch keine Nummer vorhanden -> jetzt erzeugen
                      try{ generatePurchaseOrderNumber(); }catch(_){ }
                    }
                  }, 50);
                }
              }
            });
          }
        });
      });
      
      // Beobachte das gesamte Dokument
      docObserver.observe(document.body, { 
        childList: true, 
        subtree: true 
      });
    }
  }
  
  // Observer nach kurzer Verzögerung einrichten
  setTimeout(setupPOFieldObserver, 500);
  
  // Kontinuierlicher Check alle 2 Sekunden
  setInterval(function(){
    var allPOInputs = getPOInputs();
    if(allPOInputs.length === 0) return;
    allPOInputs.forEach(function(input) {
      var storedPONumber = sessionStorage.getItem('ukc_po_number');
      if(!storedPONumber){ try{ generatePurchaseOrderNumber(); storedPONumber = sessionStorage.getItem('ukc_po_number'); }catch(_){ } }
      if(storedPONumber && (input.value !== storedPONumber || !input.readOnly || !input.hasAttribute('readonly'))) {
        input.value = storedPONumber;
        setPOFieldReadonly(input);
      }
    });
  }, 5000);
  
  // Event-Listener für direkte Input-Änderungen bei Produktmengen
  // Debounce für input-Event um zu verhindern, dass während dem Tippen der DOM ersetzt wird
  var qtyInputDebounce = null;
  document.addEventListener('input', function(ev){
    var input = ev.target;
    if(input && input.getAttribute('data-fc-id') === 'item-quantity-input'){
      // Im Sidecart: FoxyCart über API anstoßen
      if(isSidecartContext()){
        var sideId = input.getAttribute('data-fc-item-id');
        if(sideId){
          var sideValue = parseInt(input.value || '1', 10) || 1;
          if(sideValue < 1) sideValue = 1;
          input.value = sideValue;
          clearTimeout(qtyInputDebounce);
          qtyInputDebounce = setTimeout(function(){
            updateSidecartQuantity(sideId, sideValue, input);
          }, 400);
        }
        return;
      }
      
      // Nur im Fullpage Cart: Custom Logic
      var id = input.getAttribute('data-fc-item-id');
      if(id){
        // Mindestwert sicherstellen
        var value = parseInt(input.value || '1', 10) || 1;
        if(value < 1) value = 1;
        input.value = value;
        
        // Sofortige UI-Aktualisierung
        recalcSummary();
        
        // Debounced Update nach 800ms
        clearTimeout(qtyInputDebounce);
        qtyInputDebounce = setTimeout(function(){
          requestUpdate();
        }, 800);
      }
    }
  });
  
  // Bei Blur (Fokus verlassen) sofort updaten
  document.addEventListener('blur', function(ev){
    var input = ev.target;
    if(input && input.getAttribute('data-fc-id') === 'item-quantity-input'){
      // Im Sidecart: FoxyCart übernimmt
      if(isSidecartContext()){
        var blurId = input.getAttribute('data-fc-item-id');
        if(blurId){
          var blurValue = parseInt(input.value || '1', 10) || 1;
          if(blurValue < 1) blurValue = 1;
          input.value = blurValue;
          updateSidecartQuantity(blurId, blurValue, input);
        }
        return;
      }
      
      // Nur Fullpage Cart
      clearTimeout(qtyInputDebounce);
      requestUpdate();
    }
  }, true);
  
  // Hilfsfunktion: Sidecart-Kontext erkennen
  function isSidecartContext(){
    var root = document.querySelector('#fc-cart');
    var ctx = root ? root.getAttribute('data-context') : null;
    if(ctx === 'sidecart') return true;
    return !!document.querySelector('[data-fc-sidecart], .fc-sidecart, .fc-sidecart__container, .fc-sidecart__panel');
  }
  
  function updateSidecartQuantity(itemId, nextQty, input){
    var updated = false;
    try{
      if(window.FC && FC.cart){
        if(typeof FC.cart.updateItemQuantity === 'function'){
          FC.cart.updateItemQuantity(itemId, nextQty);
          updated = true;
        } else if(typeof FC.cart.setItemQuantity === 'function'){
          FC.cart.setItemQuantity(itemId, nextQty);
          updated = true;
        } else if(typeof FC.cart.updateItem === 'function'){
          FC.cart.updateItem(itemId, { quantity: nextQty });
          updated = true;
        } else if(typeof FC.cart.update === 'function'){
          FC.cart.update({ id: itemId, quantity: nextQty });
          updated = true;
        }
      }
    }catch(_){}
    
    if(!updated && input){
      try{
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }catch(_){}
    }
    
    // Fallback: FoxyCart-Update anstoßen, falls vorhanden
    if(!updated && window.FC && FC.cart && typeof FC.cart.updateHash === 'function'){
      try{ FC.cart.updateHash(); }catch(_){}
    }
  }
  
  document.addEventListener('click', function(ev){
    var btn = ev.target.closest('.ukc-qty-btn');
    if(btn){
      // Im Sidecart: FoxyCart übernimmt
      if(isSidecartContext()){
        ev.preventDefault(); ev.stopPropagation(); if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        
        var sid = btn.getAttribute('data-fc-item-id');
        var sinput = findQtyInput(sid);
        if(!sinput) return;
        
        var scurrent = parseInt(sinput.value || '1', 10) || 1;
        if(btn.classList.contains('ukc-qty-minus')){
          scurrent = Math.max(1, scurrent - 1);
        }else{
          scurrent = scurrent + 1;
        }
        sinput.value = scurrent;
        updateSidecartQuantity(sid, scurrent, sinput);
        return;
      }
      
      // Nur im Fullpage Cart: Custom Handler
      ev.preventDefault(); ev.stopPropagation(); if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      
      var id = btn.getAttribute('data-fc-item-id');
      var input = findQtyInput(id);
      if(!input) return;
      
      var current = parseInt(input.value || '1', 10) || 1;
      if(btn.classList.contains('ukc-qty-minus')){
        current = Math.max(1, current - 1);
      }else{
        current = current + 1;
      }
      input.value = current;
      recalcSummary();
      requestUpdate();
      return;
    }
    var rm = ev.target.closest('.ukc-remove-btn');
    if(rm){
      ev.preventDefault(); ev.stopPropagation(); if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      var idr = rm.getAttribute('data-fc-item-id');
      var row = document.querySelector('[data-fc-item-id="' + idr + '"]');
      
      // Sofortige visuelle Animation: Element ausblenden
      if(row){
        row.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        row.style.opacity = '0';
        row.style.transform = 'translateX(-20px)';
        
        // Nach Animation entfernen
        setTimeout(function(){
          if(row && row.parentNode){
            row.parentNode.removeChild(row);
          }
        }, 300);
      }
      
      var inp = findQtyInput(idr);
      if(inp){ inp.value = 0; }
      recalcSummary();
      requestUpdate();
      
      // Prüfen, ob noch Items vorhanden sind
      setTimeout(function(){
        var remainingRows = document.querySelectorAll('.ukc-row[data-fc-item-id]');
        if(remainingRows.length === 0){
          showEmptyCartMessage();
        }
      }, 400);
      return;
    }
  }, false);

  // Hilfsfunktion: Session-ID aus localStorage holen
  function getSessionForUrl(){
    try {
      var sessionId = localStorage.getItem('ukc_foxy_session');
      var sessionName = localStorage.getItem('ukc_foxy_session_name') || 'fcsid';
      if(sessionId && sessionId.length > 5) {
        return { id: sessionId, name: sessionName };
      }
    } catch(e) {}
    return null;
  }
  
  // Mobile-Detection und Sidecart-Redirect
  function isMobile(){
    return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
  
  // Wenn auf Mobile das Sidecart geöffnet wird, direkt zum Fullpage-Cart weiterleiten
  if(isMobile()){
    var sidecartRoot = document.querySelector('[data-fc-sidecart]');
    if(sidecartRoot){
      // Redirect zum Fullpage-Cart MIT Session-ID
      var cartUrl = 'https://unterkonstruktion.foxycart.com/cart';
      var session = getSessionForUrl();
      if(session && session.id) {
        cartUrl += '?' + session.name + '=' + session.id;
      }
      
      // Sofortiger Redirect
      try { 
        window.top.location.href = cartUrl; 
      } catch(_){ 
        window.location.href = cartUrl; 
      }
    }
  }
  
  // Sidecart-Only: Footer-Button per JS sanft hinzufügen (nicht in Vorlage injizieren)
  (function(){
    var added = false;
    function addFooter(){
      if(added) return;
      var root = document.querySelector('[data-fc-sidecart]');
      if(!root) return;
      var main = root.querySelector('.fc-cart__main__content.fc-container__grid');
      if(!main) return;
      if(main.querySelector('[data-ukc-go-fullcart]')){ added = true; return; }
      var a = document.createElement('a');
      a.className = 'ukc-btn ukc-btn--alt';
      a.setAttribute('data-ukc-go-fullcart','');
      
      // Link zum Fullpage-Cart MIT Session-ID (einmalig!)
      var cartUrl = 'https://unterkonstruktion.foxycart.com/cart';
      var session = getSessionForUrl();
      if(session && session.id) {
        cartUrl += '?' + session.name + '=' + session.id;
      }
      
      a.href = cartUrl;
      a.target = '_top';
      a.textContent = 'Zum Warenkorb';
      var wrap = document.createElement('div');
      wrap.className = 'ukc-sidecart-footer';
      wrap.style.margin = '16px 16px 24px';
      wrap.appendChild(a);
      main.appendChild(wrap);
      a.addEventListener('click', function(e){
        e.preventDefault(); e.stopPropagation();
        // Session nochmal frisch holen beim Klick (falls zwischenzeitlich aktualisiert)
        var freshSession = getSessionForUrl();
        var finalUrl = 'https://unterkonstruktion.foxycart.com/cart';
        if(freshSession && freshSession.id) {
          finalUrl += '?' + freshSession.name + '=' + freshSession.id;
        }
        try { window.top.location.href = finalUrl; } catch(_){ window.location.href = finalUrl; }
      });
      added = true;
    }
    setTimeout(addFooter, 400);
    document.addEventListener('fc-render-complete', addFooter);
  })();

  // Event-Listener für "Alle entfernen" Button
  document.addEventListener('click', function(ev) {
    var emptyBtn = ev.target.closest('[data-fc-id="cart-empty-link"]');
    if(emptyBtn){
      ev.preventDefault();
      
      // Alle Item-Rows finden und animiert entfernen
      var allRows = document.querySelectorAll('.ukc-row[data-fc-item-id]');
      allRows.forEach(function(row, index){
        setTimeout(function(){
          row.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
          row.style.opacity = '0';
          row.style.transform = 'translateX(-20px)';
          
          setTimeout(function(){
            if(row && row.parentNode){
              row.parentNode.removeChild(row);
            }
          }, 300);
        }, index * 100); // Gestaffelte Animation
      });
      
      // Summary zurücksetzen und leere Nachricht anzeigen
      setTimeout(function(){
        recalcSummary();
        requestUpdate();
        
        // Leere Nachricht anzeigen, wenn alle Items entfernt wurden
        showEmptyCartMessage();
      }, allRows.length * 100 + 400);
    }
  }, false);

  // Funktion zum Anzeigen der leeren Warenkorb-Nachricht
  function showEmptyCartMessage(){
    var itemsContainer = document.querySelector('.ukc-items');
    if(!itemsContainer) return;
    
    // Prüfen, ob bereits eine leere Nachricht vorhanden ist
    var existingEmpty = itemsContainer.querySelector('.ukc-empty');
    if(existingEmpty) return;
    
    // Leere Nachricht erstellen
    var emptyDiv = document.createElement('div');
    emptyDiv.className = 'ukc-empty';
    emptyDiv.innerHTML = '<div class="ukc-empty__content"><p class="ukc-empty__title">Ihr Warenkorb ist leer</p><a class="ukc-btn ukc-btn--primary" href="https://unterkonstruktion.de/">Weiter einkaufen</a></div>';
    
    // Mit Animation einblenden
    emptyDiv.style.opacity = '0';
    emptyDiv.style.transform = 'translateY(20px)';
    itemsContainer.appendChild(emptyDiv);
    
    // Animation starten
    setTimeout(function(){
      emptyDiv.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      emptyDiv.style.opacity = '1';
      emptyDiv.style.transform = 'translateY(0)';
    }, 50);
  }

  // Versand neu laden, wenn im CHECKOUT die Adresse per "Adresse suchen" gesetzt wird
  function triggerShippingRefresh(){
    try{
      var isCheckout = document.querySelector('#fc-cart')?.getAttribute('data-context') === 'checkout';
      if(!isCheckout) return;
      if(!hasValidAddress()) return; // unvollständige Adresse -> nicht triggern (verhindert Flackern)
      if(window.FC && FC.checkout && FC.checkout.shipping && typeof FC.checkout.shipping.get_shipping_and_handling === 'function'){
        maybeTriggerFoxy();
      } else {
        ['shipping_country','shipping_postal_code','shipping_city'].forEach(function(name){
          var el = document.querySelector('[name="'+name+'"]');
          if(el){ el.dispatchEvent(new Event('change', { bubbles:true })); }
        });
      }
    }catch(_){/* noop */}
  }
  // Button "Adresse suchen"
  document.addEventListener('click', function(e){
    if(e.target.closest('.fc-postal-code-entry__submit .fc-button')){
      setTimeout(triggerShippingRefresh, 300);
    }
  });
  // Autocomplete Auswahl-Event
  document.addEventListener('awesomecomplete:select', function(){ setTimeout(triggerShippingRefresh, 200); });
  // Direkte Änderungen an Land/PLZ/Ort
  ['shipping_country','shipping_postal_code','shipping_city'].forEach(function(name){
    var el = document.querySelector('[name="'+name+'"]');
    if(el){ el.addEventListener('change', function(){ setTimeout(triggerShippingRefresh, 100); }); }
  });

  // Pflichtfeld-Validierung: Beim Klick auf Kaufen-Buttons fehlende Werte rot markieren
  function markInvalidRequiredFields(){
    try{
      var form = document.querySelector('#fc-cart-form') || document.querySelector('form[action*="/checkout"]') || document.querySelector('form');
      if(!form) return;
      var requiredSelectors = [
        '[data-fc-required]',
        '[required]'
      ];
      var inputs = form.querySelectorAll(requiredSelectors.join(','));
      inputs.forEach(function(input){
        var val = (input.value || '').trim();
        var isCheckbox = input.type === 'checkbox' || input.type === 'radio';
        var invalid = isCheckbox ? !input.checked : val.length === 0;
        if(invalid){
          input.classList.add('ukc-invalid');
          var group = input.closest('.fc-form-group');
          if(group){ group.classList.add('ukc-has-error'); }
        } else {
          input.classList.remove('ukc-invalid');
          var group2 = input.closest('.fc-form-group');
          if(group2){ group2.classList.remove('ukc-has-error'); }
        }
      });
    }catch(_){ }
  }
  // Auf alle relevanten Submit-/Kaufen-Buttons hängen
  document.addEventListener('click', function(e){
    var submitBtn = e.target.closest('.fc-button--submit, [data-fc-id="cart-continue-button"], [type="submit"], .fc-actions .fc-button--checkout');
    if(submitBtn){ markInvalidRequiredFields(); }
  }, true);

  // Coupon-Discount in ukc-summary-table aktualisieren
  function updateCouponInSummaryTable(){
    try{
      var context = document.querySelector('#fc-cart')?.getAttribute('data-context');
      if(context !== 'checkout') return;
      
      // Falsch platzierte Coupon-Zeile finden
      var wrongCouponRow = document.querySelector('tr.fc-subtotal--row[data-fc-coupon-container-id]');
      if(!wrongCouponRow) return;
      
      // Coupon-Info extrahieren
      var couponName = wrongCouponRow.querySelector('.fc-coupon__name')?.textContent?.trim();
      var couponCode = wrongCouponRow.querySelector('.fc-coupon__code')?.textContent?.trim();
      var couponValue = wrongCouponRow.querySelector('.fc-subtotal__value')?.textContent?.trim();
      
      if(!couponName || !couponValue) return;
      
      // ukc-summary-table finden
      var summaryTable = document.querySelector('.ukc-summary-table tbody');
      if(!summaryTable) return;
      
      // Prüfen ob Coupon-Zeile bereits existiert
      var existingCouponRow = summaryTable.querySelector('.ukc-summary-discount');
      if(existingCouponRow){
        // Bestehende Zeile aktualisieren
        var labelCell = existingCouponRow.querySelector('.ukc-summary-label');
        var valueCell = existingCouponRow.querySelector('.ukc-summary-value');
        if(labelCell) labelCell.textContent = couponName + (couponCode ? ' (' + couponCode + ')' : '');
        if(valueCell) valueCell.textContent = couponValue;
      } else {
        // Neue Coupon-Zeile erstellen und nach Lieferkosten einfügen
        var shippingRow = summaryTable.querySelector('tr:has(.ukc-summary-label:contains("Lieferkosten"))');
        var totalRow = summaryTable.querySelector('.ukc-summary-totalrow');
        
        var newCouponRow = document.createElement('tr');
        newCouponRow.className = 'ukc-summary-discount';
        newCouponRow.innerHTML = '<td class="ukc-summary-label">' + couponName + (couponCode ? ' (' + couponCode + ')' : '') + '</td><td class="ukc-summary-value" data-ukc-discount>' + couponValue + '</td>';
        
        if(totalRow){
          summaryTable.insertBefore(newCouponRow, totalRow);
        } else {
          summaryTable.appendChild(newCouponRow);
        }
      }
      
      // Falsch platzierte Zeile entfernen
      wrongCouponRow.remove();
      
    }catch(e){
    }
  }
  
  // Coupon-Repositionierung bei DOM-Änderungen
  var couponObserver = new MutationObserver(function(mutations){
    var shouldUpdate = false;
    mutations.forEach(function(mutation){
      if(mutation.type === 'childList'){
        mutation.addedNodes.forEach(function(node){
          if(node.nodeType === 1 && node.querySelector && node.querySelector('tr[data-fc-coupon-container-id]')){
            shouldUpdate = true;
          }
        });
      }
    });
    if(shouldUpdate){
      setTimeout(updateCouponInSummaryTable, 100);
    }
  });
  
  // Observer starten
  setTimeout(function(){
    var context = document.querySelector('#fc-cart')?.getAttribute('data-context');
    if(context !== 'checkout') return;
    var target = document.querySelector('ul.fc-transaction') || document.body;
    if(target){
      couponObserver.observe(target, { childList: true, subtree: true });
      updateCouponInSummaryTable(); // Initial ausführen
    }
    
  }, 500);


  // Checkbox "abweichende Rechnungsadresse" für Gäste sicherstellen
  function ensureDifferentBillingCheckbox(){
    try{
      var isCheckout = document.querySelector('#fc-cart')?.getAttribute('data-context') === 'checkout';
      if(!isCheckout) return;
      var shippingSection = document.querySelector('[data-fc-id="block-customer-shipping"]') || document.querySelector('.fc-checkout__section--customer-shipping-address');
      if(!shippingSection) return;
      var existing = document.querySelector('#use_different_addresses') || document.querySelector('[name="use_different_addresses"]');
      if(existing){
        // Sichtbar stellen
        var wrap = existing.closest('.fc-form-group');
        if(wrap){ wrap.style.display = ''; wrap.classList.remove('hidden'); }
        return;
      }
      var container = document.createElement('div');
      container.className = 'fc-form-group fc-checkout__section--customer-billing-address__use-different-address';
      container.innerHTML = '<div class="fc-container__grid--use-different-address">\
        <div class="fc-input-group-container--checkbox">\
          <label for="use_different_addresses" class="fc-form-label fc-form-label--different-address">\
            <input type="hidden" name="use_different_addresses" value="0" />\
            <input type="checkbox" id="use_different_addresses" name="use_different_addresses" value="1" checked />\
            Verwenden Sie eine andere Rechnungsadresse\
          </label>\
        </div>\
      </div>';
      // Einfügen am Ende des Shipping-Blocks
      shippingSection.appendChild(container);
      // Toggle-Logik
      var billingSection = document.querySelector('[data-fc-id="block-customer-billing"]') || document.querySelector('.fc-checkout__section--customer-billing-address');
      var cb = container.querySelector('#use_different_addresses');
      if(cb){
        cb.addEventListener('change', function(){
          if(!billingSection) return;
          billingSection.style.display = cb.checked ? '' : 'none';
        });
        // Initial anwenden
        if(billingSection){ billingSection.style.display = cb.checked ? '' : 'none'; }
      }
    }catch(_){ }
  }
  // beim Laden und nach möglichen DOM-Updates ausführen
  setTimeout(ensureDifferentBillingCheckbox, 100);
  setTimeout(ensureDifferentBillingCheckbox, 600);
  var moDiff = new MutationObserver(function(){ ensureDifferentBillingCheckbox(); });
  try{
    var ctx = document.querySelector('#fc-cart')?.getAttribute('data-context');
    if(ctx === 'checkout'){
      moDiff.observe(document.body, { childList:true, subtree:true });
    }
  }catch(_){ }

  // Wenn Versand-Raten geladen sind, automatisch erste Option wählen (falls keine gewählt)
  function autoSelectFirstShipping(){
    var isCheckout = document.querySelector('#fc-cart')?.getAttribute('data-context') === 'checkout';
    if(!isCheckout) return;
    var container = document.querySelector('[data-fc-id="shipping-results"]');
    if(!container) return;
    var chosen = container.querySelector('input[name="shipping_service_id"]:checked');
    var first = container.querySelector('input[name="shipping_service_id"]');
    if(!chosen && first){
      first.checked = true;
      first.dispatchEvent(new Event('change', { bubbles:true }));
    }
  }
  // Beobachte Änderungen im Versandbereich
  var shipSection = document.querySelector('[data-fc-id="block-shipping-results"]');
  if(shipSection){
    var mo = new MutationObserver(function(){ setTimeout(autoSelectFirstShipping, 50); });
    mo.observe(shipSection, { childList:true, subtree:true });
  }
  // Sicherheitsnetz nach manueller Aktualisierung
  document.addEventListener('click', function(e){
    if(e.target.closest('[data-fc-id="shipping-results"]')){
      setTimeout(autoSelectFirstShipping, 50);
    }
  });
})();

// ---- UKC SUMMARY AUTO-UPDATER (moved from Twig) ----
(function(){
  var root = document.querySelector('#fc-cart');
  if(!root) return;

  function currency(){ return (window.FC && FC.cart && FC.cart.currency_code) || 'EUR'; }
  function fmt(v){ try{ return new Intl.NumberFormat('de-DE',{style:'currency',currency:currency()}).format(Number(v||0)); }catch(e){ return (Number(v||0)).toFixed(2)+'\u00a0€'; } }

  var prev = { sub: null, tax: null, ship: null, tot: null };
  var updating = false;
  function readCart(){
    if(!window.FC || !FC.cart) return null;
    var c = FC.cart;
    return {
      sub: Number(c.total_item_price || 0),
      tax: Number(c.total_tax || 0),
      ship: Number(c.total_shipping || c.total_future_shipping || 0),
      tot: Number(c.total_order || (Number(c.total_item_price||0)+Number(c.total_tax||0)+Number(c.total_shipping||0)||Number(c.total_future_shipping||0)))
    };
  }

  function nearlyEqual(a,b){ return Math.abs(Number(a)-Number(b)) < 0.005; }
  function isCartContext(){
    return root.getAttribute('data-context') === 'cart';
  }

  function update(){
    if(updating || window.__ukc_ajax_updating) return;
    // Cart-Kontext NICHT mehr ausschließen - Tax/Total sollen auch hier aktualisiert werden
    var snap = readCart();
    if(!snap) return;
    var subEl = document.querySelector('[data-ukc-subtotal]');
    var taxEl = document.querySelector('[data-ukc-tax-total]');
    var shipEls = document.querySelectorAll('[data-ukc-shipping]');
    var totalEl = document.querySelector('[data-ukc-total-order]');

    updating = true;
    try{
      if(subEl && !nearlyEqual(prev.sub, snap.sub)) subEl.textContent = fmt(snap.sub);
      if(taxEl && !nearlyEqual(prev.tax, snap.tax)) taxEl.textContent = fmt(snap.tax);
      if(shipEls && shipEls.forEach){
        if(!nearlyEqual(prev.ship, snap.ship)) shipEls.forEach(function(el){ el.textContent = fmt(snap.ship); });
      }
      if(totalEl && !nearlyEqual(prev.tot, snap.tot)) totalEl.textContent = fmt(snap.tot);
      prev = snap;
    } finally {
      updating = false;
    }
  }

  var rafScheduled = false; var timeoutId = null;
  function scheduleUpdate(){
    if(rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(function(){
      rafScheduled = false;
      update();
      clearTimeout(timeoutId);
      timeoutId = setTimeout(update, 120);
    });
  }

  if(window.MutationObserver){
    try{
      var mo = new MutationObserver(function(){ scheduleUpdate(); });
      mo.observe(root, { childList:true, subtree:true });
    }catch(_){}
  }

  document.addEventListener('fc:cart:update', scheduleUpdate);
  document.addEventListener('fc:cart:change', scheduleUpdate);

  function kick(){ scheduleUpdate(); setTimeout(update,300); setTimeout(update,800); setTimeout(update,1500); }
  document.addEventListener('DOMContentLoaded', kick);
  if(document.readyState==='complete' || document.readyState==='interactive') kick();
})();