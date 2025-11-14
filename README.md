# CyberGuard Kids

Eine umfassende Web-Anwendung zum Schutz von Kindern und Jugendlichen vor Cybergrooming.

## 🎯 Funktionen

- **Chat-Check**: Analysiert Nachrichten auf Cybergrooming-Risiken mit KI-Unterstützung
- **Lernhub**: Interaktive Lerninhalte über Online-Sicherheit
- **Melden & Hilfe**: Anonymes Meldesystem mit Sicherheits-Checkliste
- **Simulator**: Trainingsumgebung für den sicheren Umgang mit verdächtigen Nachrichten
- **Community-Punkte**: Gamification zur Motivation
- **Schnellhilfe**: Notfallkontakte und schneller Zugriff auf Hilfe (110, Vertrauenspersonen)

## 🏗️ Technologie-Stack

### Backend
- **FastAPI**: Modernes, schnelles Python-Web-Framework
- **MongoDB**: NoSQL-Datenbank über Motor (async)
- **OpenAI API**: KI-gestützte Textanalyse
- **Python-docx**: Import von Leitfäden aus .docx-Dateien

### Frontend
- **React 19**: Moderne UI-Bibliothek
- **Tailwind CSS**: Utility-First CSS-Framework
- **Radix UI**: Barrierefreie UI-Komponenten
- **Axios**: HTTP-Client für API-Kommunikation

## 📋 Voraussetzungen

- **Backend**: Python 3.9+
- **Frontend**: Node.js 16+ und Yarn
- **Datenbank**: MongoDB-Instanz
- **Optional**: OpenAI API-Key für erweiterte KI-Funktionen

## 🚀 Installation & Setup

### Backend

```bash
cd backend

# Virtuelle Umgebung erstellen
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Dependencies installieren
pip install -r requirements.txt

# .env-Datei erstellen (siehe .env.example)
cp .env.example .env
# Trage deine Umgebungsvariablen ein

# Server starten
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend

# Dependencies installieren
yarn install

# .env-Datei erstellen
echo "REACT_APP_BACKEND_URL=http://localhost:8000" > .env

# Entwicklungsserver starten
yarn start
```

Die Anwendung läuft dann auf:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API-Dokumentation: http://localhost:8000/docs

## 🔧 Umgebungsvariablen

### Backend (.env)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=cyberguard_kids
CORS_ORIGINS=http://localhost:3000
EMERGENT_LLM_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4
```

### Frontend (.env)
```
REACT_APP_BACKEND_URL=http://localhost:8000
```

## 📦 Deployment

Das Projekt ist für Deployment auf Emergent Agent oder anderen Cloud-Plattformen vorbereitet.

## 🧪 Tests

```bash
# Backend-API Tests
python backend_test.py
```

## 🤝 Beitragen

Contributions sind willkommen! Bitte erstelle einen Pull Request oder öffne ein Issue.

## 📝 Lizenz

Siehe [LICENSE](LICENSE) für Details.

## ⚠️ Wichtiger Hinweis

Diese App ersetzt keine akute Hilfe. **Bei Gefahr immer 110 anrufen!**

## 📞 Hilfe-Ressourcen

- **Polizei Notruf**: 110
- **Nummer gegen Kummer**: 116 111 (Mo-Sa 14-20 Uhr)
- **Online-Beratung**: https://www.nummergegenkummer.de
