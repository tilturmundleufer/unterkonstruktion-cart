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
   * Speichert die Session-ID in localStorage
   */
  function saveSessionId(sessionId) {
    if (!sessionId) return;
    
    try {
      localStorage.setItem(STORAGE_KEY, sessionId);
      localStorage.setItem(STORAGE_EXPIRY_KEY, Date.now() + SESSION_LIFETIME);
      console.log('[FoxyCart] Session gespeichert:', sessionId);
    } catch(e) {
      console.warn('[FoxyCart] Konnte Session nicht speichern:', e);
    }
  }
  
  /**
   * Holt die Session-ID aus localStorage
   */
  function getSessionId() {
    try {
      var expiry = parseInt(localStorage.getItem(STORAGE_EXPIRY_KEY) || '0', 10);
      
      // Session abgelaufen?
      if (expiry < Date.now()) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_EXPIRY_KEY);
        console.log('[FoxyCart] Session abgelaufen');
        return null;
      }
      
      return localStorage.getItem(STORAGE_KEY);
    } catch(e) {
      console.warn('[FoxyCart] Konnte Session nicht lesen:', e);
      return null;
    }
  }
  
  /**
   * Extrahiert Session-ID aus verschiedenen Quellen
   */
  function extractSessionId() {
    // 1. Aus URL-Parametern
    var urlParams = new URLSearchParams(window.location.search);
    var sessionId = urlParams.get('fssid') || urlParams.get('fc_sid');
    if (sessionId) {
      console.log('[FoxyCart] Session aus URL:', sessionId);
      return sessionId;
    }
    
    // 2. Aus Cookies
    var match = document.cookie.match(/(?:^|; )(?:fssid|fc_sid)=([^;]+)/);
    if (match) {
      console.log('[FoxyCart] Session aus Cookie:', match[1]);
      return match[1];
    }
    
    // 3. Aus FoxyCart Object (falls geladen)
    if (window.FC && FC.sid) {
      console.log('[FoxyCart] Session aus FC.sid:', FC.sid);
      return FC.sid;
    }
    
    // 4. Aus localStorage
    var storedSession = getSessionId();
    if (storedSession) {
      console.log('[FoxyCart] Session aus localStorage:', storedSession);
      return storedSession;
    }
    
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
        element.setAttribute('href', href + separator + 'fssid=' + sessionId);
      }
    } else if (tagName === 'form') {
      // Form: Hidden Input hinzufügen
      if (!element.querySelector('input[name="fssid"], input[name="fc_sid"]')) {
        var input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'fssid';
        input.value = sessionId;
        element.appendChild(input);
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
      return;
    }
    
    console.log('[FoxyCart] Verwende Session:', sessionId);
    
    // Session-ID zu allen Add-to-Cart Links/Forms hinzufügen
    var addToCartLinks = document.querySelectorAll('a[href*="foxycart.com/cart"]');
    addToCartLinks.forEach(function(link) {
      addSessionToElement(link, sessionId);
    });
    
    var addToCartForms = document.querySelectorAll('form[action*="foxycart.com/cart"]');
    addToCartForms.forEach(function(form) {
      addSessionToElement(form, sessionId);
    });
    
    // FoxyCart Event Listener für neue Cart-Actions
    document.addEventListener('click', function(e) {
      var target = e.target.closest('a[href*="foxycart.com"], button[data-foxy-product]');
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

