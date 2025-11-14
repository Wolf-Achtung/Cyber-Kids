# Beitragen zu CyberGuard Kids

Vielen Dank für dein Interesse, zu CyberGuard Kids beizutragen! Dieses Projekt wurde entwickelt, um Kinder und Jugendliche vor Cybergrooming zu schützen.

## 🤝 Wie kann ich beitragen?

### Fehler melden
- Überprüfe zunächst, ob der Fehler bereits gemeldet wurde
- Erstelle ein neues Issue mit einer klaren Beschreibung
- Füge Screenshots oder Fehlermeldungen hinzu, wenn möglich

### Features vorschlagen
- Öffne ein Issue und beschreibe das gewünschte Feature
- Erkläre, warum dieses Feature nützlich wäre
- Diskutiere mit dem Team über die Umsetzung

### Code beitragen

1. **Fork das Repository**
2. **Erstelle einen Feature-Branch**
   ```bash
   git checkout -b feature/dein-feature-name
   ```

3. **Entwickle dein Feature**
   - Halte dich an die bestehenden Code-Konventionen
   - Schreibe aussagekräftige Commit-Messages
   - Teste deine Änderungen gründlich

4. **Commit deine Änderungen**
   ```bash
   git commit -m "feat: Beschreibung deiner Änderung"
   ```

5. **Push zu deinem Fork**
   ```bash
   git push origin feature/dein-feature-name
   ```

6. **Erstelle einen Pull Request**
   - Beschreibe deine Änderungen ausführlich
   - Verlinke relevante Issues
   - Warte auf Code-Review

## 📋 Code-Konventionen

### Backend (Python)
- Verwende **Black** für Code-Formatierung (120 Zeichen pro Zeile)
- Befolge **PEP 8** Richtlinien
- Nutze Type Hints wo sinnvoll
- Schreibe Docstrings für Funktionen und Klassen
- Führe `flake8` und `mypy` vor dem Commit aus

```bash
cd backend
black server.py
flake8 server.py
mypy server.py
```

### Frontend (JavaScript/React)
- Verwende **Prettier** für Code-Formatierung
- Befolge **ESLint**-Regeln
- Nutze funktionale Komponenten mit Hooks
- Schreibe aussagekräftige Kommentare

```bash
cd frontend
yarn prettier --write src/
yarn eslint src/
```

## 🧪 Testing

- Teste alle neuen Features gründlich
- Stelle sicher, dass bestehende Tests weiterhin funktionieren
- Füge Tests für neue Funktionalität hinzu

```bash
# Backend-Tests
python backend_test.py

# Frontend (wenn vorhanden)
cd frontend
yarn test
```

## 📝 Commit-Message-Konventionen

Wir verwenden [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - Neue Features
- `fix:` - Bugfixes
- `docs:` - Dokumentation
- `style:` - Formatierung, fehlende Semikolons, etc.
- `refactor:` - Code-Umstrukturierung
- `test:` - Tests hinzufügen oder korrigieren
- `chore:` - Wartungsaufgaben

Beispiele:
```
feat: Chat-Check Live-Analyse hinzugefügt
fix: Fehler bei der Punktevergabe behoben
docs: README mit Installationsanleitung aktualisiert
```

## 🔒 Sicherheit

- **KEINE** Secrets oder API-Keys committen
- Verwende `.env`-Dateien für sensible Daten
- Melde Sicherheitsprobleme privat an die Maintainer

## ⚖️ Code of Conduct

- Sei respektvoll und inklusiv
- Konstruktive Kritik ist willkommen
- Dieses Projekt dient dem Kinderschutz - handle verantwortungsvoll

## 🙋 Fragen?

Bei Fragen kannst du:
- Ein Issue erstellen
- Die bestehenden Discussions durchsuchen
- Die Dokumentation konsultieren

Vielen Dank für deinen Beitrag! 🎉
