/**
 * Chrome Session Debug Script
 * Füge dieses Script temporär ein um herauszufinden, warum Chrome die Session verliert
 */

(function() {
  'use strict';
  
  console.log('=== CHROME SESSION DEBUG START ===');
  
  // 1. Browser Info
  console.log('Browser:', navigator.userAgent);
  console.log('Platform:', navigator.platform);
  
  // 2. Cookie Settings
  console.log('\n=== COOKIES ===');
  console.log('Alle Cookies:', document.cookie);
  console.log('Cookie enabled:', navigator.cookieEnabled);
  
  // 3. localStorage Test
  console.log('\n=== LOCALSTORAGE ===');
  try {
    localStorage.setItem('test_storage', 'test');
    console.log('localStorage write:', localStorage.getItem('test_storage'));
    localStorage.removeItem('test_storage');
    console.log('localStorage enabled: YES');
  } catch(e) {
    console.error('localStorage ERROR:', e);
  }
  
  // 4. FoxyCart Session suchen
  console.log('\n=== FOXYCART SESSION ===');
  
  // URL Parameter
  var urlParams = new URLSearchParams(window.location.search);
  console.log('URL fssid:', urlParams.get('fssid'));
  console.log('URL fc_sid:', urlParams.get('fc_sid'));
  
  // Hidden Inputs
  var sessionInputs = document.querySelectorAll('input[name*="fssid"], input[name*="fc_sid"], input[name*="session"]');
  console.log('Hidden Inputs gefunden:', sessionInputs.length);
  sessionInputs.forEach(function(input, i) {
    console.log('  Input ' + i + ':', input.name, '=', input.value ? input.value.substring(0, 15) + '...' : 'leer');
  });
  
  // FC Object
  console.log('FC Object:', typeof window.FC !== 'undefined' ? 'vorhanden' : 'nicht vorhanden');
  if (window.FC) {
    console.log('FC.sid:', FC.sid || 'nicht gesetzt');
    console.log('FC.cart:', typeof FC.cart !== 'undefined' ? 'vorhanden' : 'nicht vorhanden');
    if (FC.cart) {
      console.log('FC.cart Items:', FC.cart.items_in_cart || 0);
    }
  }
  
  // localStorage FoxyCart Session
  console.log('localStorage ukc_foxy_session:', localStorage.getItem('ukc_foxy_session'));
  console.log('localStorage foxy_session_id:', localStorage.getItem('foxy_session_id'));
  
  // 5. Fetch Credentials Test
  console.log('\n=== FETCH TEST ===');
  fetch('https://unterkonstruktion.foxycart.com/cart?output=json', {
    method: 'GET',
    credentials: 'include',
    mode: 'cors'
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    console.log('Fetch erfolgreich!');
    console.log('Cart Items:', data.items_in_cart || 0);
    console.log('Session aus Response:', data.fc_sid || data.fssid || 'nicht vorhanden');
  })
  .catch(function(e) {
    console.error('Fetch Error:', e);
  });
  
  // 6. Chrome-spezifische Checks
  console.log('\n=== CHROME SPEZIFISCH ===');
  
  // Third-Party Cookie Check
  var testFrame = document.createElement('iframe');
  testFrame.style.display = 'none';
  testFrame.src = 'https://unterkonstruktion.foxycart.com/cart';
  document.body.appendChild(testFrame);
  
  setTimeout(function() {
    try {
      var iframeDoc = testFrame.contentDocument || testFrame.contentWindow.document;
      console.log('iFrame accessible:', !!iframeDoc);
    } catch(e) {
      console.error('iFrame blocked (Third-Party Cookie blocking):', e.message);
    }
    document.body.removeChild(testFrame);
  }, 1000);
  
  // SameSite Cookie Test
  console.log('Setting test cookie with SameSite=None...');
  document.cookie = 'test_samesite=value; SameSite=None; Secure';
  console.log('Cookie set:', document.cookie.includes('test_samesite') ? 'YES' : 'NO (blocked)');
  
  console.log('\n=== DEBUG END ===');
  console.log('Bitte sende mir die komplette Console-Ausgabe!');
  
})();

