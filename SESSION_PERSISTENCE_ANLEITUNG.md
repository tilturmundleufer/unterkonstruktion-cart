# FoxyCart Session Persistence - Anleitung

## Problem
Der Warenkorb wird bei Seitenwechsel oder Refresh auf unterkonstruktion.de als leer angezeigt, weil die FoxyCart Session-ID verloren geht.

## Lösung
Das Script `foxy-session-persistence.js` speichert die Session-ID persistent und stellt sicher, dass sie bei jedem Add-to-Cart und Seitenwechsel erhalten bleibt.

---

## Installation

### Schritt 1: Script einbinden

Füge **NACH** dem FoxyCart Loader Script auf **unterkonstruktion.de** folgendes hinzu:

```html
<!-- FoxyCart Loader (bereits vorhanden) -->
<script src="https://cdn.foxycart.com/unterkonstruktion/loader.js" async></script>

<!-- Session Persistence Fix (NEU HINZUFÜGEN) -->
<script src="https://unterkonstruktion-cart.vercel.app/foxy-session-persistence.min.js" async></script>
```

**Wichtig:** Das Script muss auf **ALLEN Seiten** eingebunden werden, auf denen:
- Der FoxyCart Loader läuft
- Add-to-Cart Buttons vorhanden sind
- Der Warenkorb angezeigt wird

---

### Schritt 2: Testen

1. **Produkt zum Warenkorb hinzufügen**
2. **Seite refreshen** (F5) → Warenkorb sollte noch voll sein ✅
3. **Zu anderer Seite navigieren** → Warenkorb bleibt erhalten ✅
4. **Browser komplett schließen und neu öffnen** → Session ist 24h gültig ✅

---

## Wie es funktioniert

### 1. Session-ID Erkennung
Das Script sucht die Session-ID in folgender Reihenfolge:
1. **URL-Parameter** (`?fssid=...` oder `?fc_sid=...`)
2. **Cookies** (`fssid` oder `fc_sid`)
3. **FoxyCart Object** (`FC.sid`)
4. **localStorage** (gespeicherte Session)

### 2. Persistente Speicherung
```javascript
localStorage.setItem('foxy_session_id', sessionId);
localStorage.setItem('foxy_session_expiry', Date.now() + 24h);
```

### 3. Automatische Anhängung
Das Script fügt die Session-ID automatisch hinzu an:
- **Add-to-Cart Links**: `href="...?fssid=SESSION_ID"`
- **Add-to-Cart Forms**: `<input name="fssid" value="SESSION_ID">`
- **Dynamisch hinzugefügte Elemente** (via MutationObserver)

### 4. Event Listening
Das Script lauscht auf FoxyCart Events:
- `foxy-loaded` → Session speichern
- `foxy-cart-updated` → Session aktualisieren

---

## Debug / Testing

### Console Debug
Führe in der Browser-Console aus:
```javascript
foxyDebugSession()
```

**Output:**
```
=== FoxyCart Session Debug ===
Session ID: abc123xyz...
Expires: Thu Nov 28 2025 20:25:00 GMT+0100
FC Object: {...}
FC.sid: abc123xyz...
```

### Session manuell löschen (zum Testen)
```javascript
localStorage.removeItem('foxy_session_id');
localStorage.removeItem('foxy_session_expiry');
```

---

## Session Lifetime

**Standard:** 24 Stunden

Um die Lifetime zu ändern, editiere in `foxy-session-persistence.js`:
```javascript
var SESSION_LIFETIME = 24 * 60 * 60 * 1000; // 24 Stunden in Millisekunden
```

**Beispiele:**
- 1 Stunde: `1 * 60 * 60 * 1000`
- 7 Tage: `7 * 24 * 60 * 60 * 1000`
- 30 Tage: `30 * 24 * 60 * 60 * 1000`

---

## Troubleshooting

### Warenkorb ist immer noch leer
1. **Prüfe, ob Script geladen wird:**
   ```javascript
   // In Browser Console:
   typeof foxyDebugSession
   // Sollte "function" zurückgeben
   ```

2. **Prüfe localStorage:**
   ```javascript
   localStorage.getItem('foxy_session_id')
   // Sollte eine Session-ID zeigen
   ```

3. **Browser-Console öffnen:**
   - Schaue nach `[FoxyCart]` Log-Meldungen
   - Sollte zeigen: "Session gespeichert" oder "Verwende Session"

### Session wird nicht gespeichert
**Mögliche Ursachen:**
- **Private Browsing Mode** → localStorage wird blockiert
- **Browser Settings** → localStorage disabled
- **AdBlocker** → Blockiert möglicherweise localStorage

**Lösung:** Prüfe Browser-Settings oder teste in normalem (non-private) Modus

### Session läuft zu früh ab
- **Browser schließt localStorage** nach X Tagen
- **Lösung:** Erhöhe `SESSION_LIFETIME` oder verwende zusätzlich Cookies

---

## Alternative: Cookie-basierte Session

Falls localStorage nicht funktioniert, kann das Script auch Cookies nutzen.
Füge diese Funktion hinzu:

```javascript
function saveSessionIdToCookie(sessionId) {
  document.cookie = 'ukc_foxy_session=' + sessionId + 
    '; path=/; max-age=' + (SESSION_LIFETIME / 1000) + 
    '; SameSite=Lax; Secure';
}
```

---

## Deployment

### Production Hosting
Das Script ist bereits auf Vercel gehostet:
```
https://unterkonstruktion-cart.vercel.app/foxy-session-persistence.min.js
```

### Self-Hosting (optional)
Falls du es auf eigenem Server hosten möchtest:
1. Upload `foxy-session-persistence.min.js` zu deinem Server
2. Ändere den Script-Tag:
   ```html
   <script src="https://deine-domain.de/path/to/foxy-session-persistence.min.js"></script>
   ```

---

## Browser-Kompatibilität

✅ **Unterstützt:**
- Chrome/Edge 80+
- Firefox 75+
- Safari 13+
- Mobile Safari (iOS 13+)
- Chrome Mobile (Android)

⚠️ **Limitiert:**
- Internet Explorer (kein localStorage)
- Sehr alte Browser (kein MutationObserver)

---

## Support

Bei Problemen:
1. Console-Logs prüfen (`[FoxyCart]` Messages)
2. `foxyDebugSession()` ausführen
3. Browser Network Tab prüfen (foxycart.com Requests)
4. FoxyCart Support kontaktieren für spezifische Store-Settings

