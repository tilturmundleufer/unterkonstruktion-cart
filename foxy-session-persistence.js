/**
 * FoxyCart Session Persistence Fix
 * 
 * Problem: FoxyCart Session geht bei Seitenwechsel verloren
 * Lösung: Session-ID in localStorage speichern und bei Add-to-Cart wiederverwenden
 */

(function() {
  'use strict';
  
  var STORAGE_KEY = 'foxy_session_id';
  var STORAGE_EXPIRY_KEY = 'foxy_session_expiry';
  var SESSION_LIFETIME = 24 * 60 * 60 * 1000; // 24 Stunden
  
  /**
   * Speichert die Session-ID in localStorage UND als Cookie (Chrome-Fallback)
   */
  function saveSessionId(sessionId) {
    if (!sessionId) return;
    
    try {
      // 1. localStorage
      localStorage.setItem(STORAGE_KEY, sessionId);
      localStorage.setItem(STORAGE_EXPIRY_KEY, Date.now() + SESSION_LIFETIME);
      
      // 2. First-Party Cookie als Fallback (Chrome-kompatibel)
      var expires = new Date();
      expires.setTime(expires.getTime() + SESSION_LIFETIME);
      
      // Mehrere Cookie-Varianten setzen für maximale Kompatibilität
      var cookieString = 'ukc_foxy_sid=' + sessionId + 
        '; expires=' + expires.toUTCString() +
        '; path=/';
      
      // Chrome: SameSite=Lax funktioniert ohne Secure
      document.cookie = cookieString + '; SameSite=Lax';
      
      // Safari: Auch ohne SameSite versuchen
      document.cookie = cookieString;
      
      console.log('[FoxyCart] Session gespeichert (localStorage + Cookie):', sessionId.substring(0, 10) + '...');
      console.log('[FoxyCart] Cookie gesetzt:', document.cookie.includes('ukc_foxy_sid') ? 'YES' : 'NO');
    } catch(e) {
      console.warn('[FoxyCart] Konnte Session nicht speichern:', e);
    }
  }
  
  /**
   * Holt die Session-ID aus localStorage oder Cookie
   */
  function getSessionId() {
    try {
      // 1. Versuche aus localStorage
      var expiry = parseInt(localStorage.getItem(STORAGE_EXPIRY_KEY) || '0', 10);
      
      // Session abgelaufen?
      if (expiry > 0 && expiry < Date.now()) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_EXPIRY_KEY);
        console.log('[FoxyCart] Session abgelaufen');
        return null;
      }
      
      var sessionFromStorage = localStorage.getItem(STORAGE_KEY);
      if (sessionFromStorage) {
        return sessionFromStorage;
      }
      
      // 2. Fallback: Aus Cookie lesen (Chrome-Fallback)
      var match = document.cookie.match(/(?:^|; )ukc_foxy_sid=([^;]+)/);
      if (match && match[1]) {
        console.log('[FoxyCart] Session aus Cookie gelesen (Chrome-Fallback)');
        // Auch in localStorage speichern für nächstes Mal
        localStorage.setItem(STORAGE_KEY, match[1]);
        localStorage.setItem(STORAGE_EXPIRY_KEY, Date.now() + SESSION_LIFETIME);
        return match[1];
      }
      
      return null;
    } catch(e) {
      console.warn('[FoxyCart] Konnte Session nicht lesen:', e);
      return null;
    }
  }
  
  /**
   * Extrahiert Session-ID aus verschiedenen Quellen
   */
  function extractSessionId() {
    // 1. Aus URL-Parametern (höchste Priorität)
    var urlParams = new URLSearchParams(window.location.search);
    var sessionId = urlParams.get('fssid') || urlParams.get('fc_sid');
    if (sessionId) {
      console.log('[FoxyCart] Session aus URL:', sessionId.substring(0, 10) + '...');
      return sessionId;
    }
    
    // 2. Aus Hidden Inputs im DOM (FoxyCart Templates)
    var sessionInput = document.querySelector('input[name="fssid"], input[name="fc_sid"]');
    if (sessionInput && sessionInput.value) {
      sessionId = sessionInput.value;
      console.log('[FoxyCart] Session aus Hidden Input:', sessionId.substring(0, 10) + '...');
      return sessionId;
    }
    
    // 3. Aus FoxyCart Object (falls geladen)
    if (window.FC && FC.sid) {
      console.log('[FoxyCart] Session aus FC.sid:', FC.sid.substring(0, 10) + '...');
      return FC.sid;
    }
    
    // 4. Aus Cookies (funktioniert nicht bei Third-Party blocking)
    var match = document.cookie.match(/(?:^|; )(?:fssid|fc_sid)=([^;]+)/);
    if (match) {
      console.log('[FoxyCart] Session aus Cookie:', match[1].substring(0, 10) + '...');
      return match[1];
    }
    
    // 5. Aus localStorage (Fallback)
    var storedSession = getSessionId();
    if (storedSession) {
      console.log('[FoxyCart] Session aus localStorage:', storedSession.substring(0, 10) + '...');
      return storedSession;
    }
    
    console.warn('[FoxyCart] Keine Session gefunden!');
    return null;
  }
  
  /**
   * Fügt Session-ID zu einem Link/Form hinzu
   */
  function addSessionToElement(element, sessionId) {
    if (!element || !sessionId) return;
    
    var tagName = element.tagName.toLowerCase();
    
    if (tagName === 'a') {
      // Link: Session-ID an URL anhängen
      var href = element.getAttribute('href') || '';
      if (href && !href.includes('fssid=') && !href.includes('fc_sid=')) {
        var separator = href.includes('?') ? '&' : '?';
        var newHref = href + separator + 'fssid=' + sessionId;
        element.setAttribute('href', newHref);
        console.log('[FoxyCart] Session zu Link hinzugefügt:', href.substring(0, 50) + '...');
      }
    } else if (tagName === 'form') {
      // Form: Hidden Input hinzufügen oder aktualisieren
      var existingInput = element.querySelector('input[name="fssid"], input[name="fc_sid"]');
      if (existingInput) {
        existingInput.value = sessionId;
      } else {
        var input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'fssid';
        input.value = sessionId;
        element.appendChild(input);
        console.log('[FoxyCart] Session zu Form hinzugefügt');
      }
    }
  }
  
  /**
   * Initialisiert Session-Persistence
   */
  function init() {
    // Session-ID extrahieren und speichern
    var sessionId = extractSessionId();
    if (sessionId) {
      saveSessionId(sessionId);
    } else {
      sessionId = getSessionId();
    }
    
    if (!sessionId) {
      console.log('[FoxyCart] Keine Session gefunden - wird bei Add-to-Cart erstellt');
    } else {
      console.log('[FoxyCart] Verwende Session:', sessionId.substring(0, 10) + '...');
    }
    
    // Session-ID zu ALLEN FoxyCart Links/Forms hinzufügen (auch ohne Session)
    function attachSessionToAll() {
      var currentSession = sessionId || getSessionId();
      if (!currentSession) return;
      
      // Add-to-Cart Links
      var addToCartLinks = document.querySelectorAll('a[href*="foxycart.com/cart"], a[href*="foxycart.com"][href*="cart"]');
      addToCartLinks.forEach(function(link) {
        addSessionToElement(link, currentSession);
      });
      
      // Add-to-Cart Forms
      var addToCartForms = document.querySelectorAll('form[action*="foxycart.com/cart"], form[action*="foxycart.com"][action*="cart"]');
      addToCartForms.forEach(function(form) {
        addSessionToElement(form, currentSession);
      });
      
      // Checkout Links
      var checkoutLinks = document.querySelectorAll('a[href*="foxycart.com/checkout"], a[href*="/checkout"]');
      checkoutLinks.forEach(function(link) {
        addSessionToElement(link, currentSession);
      });
      
      console.log('[FoxyCart] Session zu', addToCartLinks.length, 'Links und', addToCartForms.length, 'Forms hinzugefügt');
    }
    
    attachSessionToAll();
    
    // Wiederholt Session anhängen (für dynamische Inhalte)
    setTimeout(attachSessionToAll, 1000);
    setTimeout(attachSessionToAll, 3000);
    
    // FoxyCart Event Listener für neue Cart-Actions
    document.addEventListener('click', function(e) {
      var target = e.target.closest('a[href*="foxycart.com"], button[data-foxy-product], form[action*="foxycart.com"]');
      if (target) {
        var currentSession = getSessionId();
        if (currentSession) {
          addSessionToElement(target, currentSession);
        }
      }
    }, true);
    
    // Observer für dynamisch hinzugefügte Elemente
    if (window.MutationObserver) {
      var observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === 1) { // Element node
              var currentSession = getSessionId();
              if (currentSession) {
                // Links
                if (node.tagName && node.tagName.toLowerCase() === 'a' && 
                    (node.href || '').includes('foxycart.com')) {
                  addSessionToElement(node, currentSession);
                }
                // Forms
                if (node.tagName && node.tagName.toLowerCase() === 'form' && 
                    (node.action || '').includes('foxycart.com')) {
                  addSessionToElement(node, currentSession);
                }
                // Innerhalb des Nodes
                var links = node.querySelectorAll && node.querySelectorAll('a[href*="foxycart.com"]');
                if (links) {
                  links.forEach(function(link) {
                    addSessionToElement(link, currentSession);
                  });
                }
                var forms = node.querySelectorAll && node.querySelectorAll('form[action*="foxycart.com"]');
                if (forms) {
                  forms.forEach(function(form) {
                    addSessionToElement(form, currentSession);
                  });
                }
              }
            }
          });
        });
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }
  
  // Bei FoxyCart Events Session aktualisieren
  document.addEventListener('foxy-loaded', function(e) {
    if (window.FC && FC.sid) {
      saveSessionId(FC.sid);
    }
  });
  
  document.addEventListener('foxy-cart-updated', function(e) {
    if (window.FC && FC.sid) {
      saveSessionId(FC.sid);
    }
  });
  
  // Init nach DOM-Load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Auch nach kurzer Verzögerung (falls FoxyCart später lädt)
  setTimeout(init, 1000);
  
  // Debug-Funktion für Entwickler
  window.foxyDebugSession = function() {
    console.log('=== FoxyCart Session Debug ===');
    console.log('Session ID:', getSessionId());
    console.log('Expires:', new Date(parseInt(localStorage.getItem(STORAGE_EXPIRY_KEY) || '0', 10)));
    console.log('FC Object:', window.FC);
    console.log('FC.sid:', window.FC && FC.sid);
  };
  
})();

