# GAPAK — современный, безопасный starter (Go + React)

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![Go](https://img.shields.io/badge/Go-1.20+-00ADD8?logo=go)](https://go.dev) [![Node](https://img.shields.io/badge/Node-18+-3C873A?logo=node.js)](https://nodejs.org) [![Status](https://img.shields.io/badge/status-dev-brightgreen)]()

Коротко: GAPAK — современное приложение с авторизацией, пример best-practices на Go (backend) и React (Vite) (frontend). Предназначено как стартовый шаблон для безопасных веб-приложений.

---

## 🔭 Быстрый старт (рекомендуется)

Требования:
- Go (>= 1.20)
- Node.js (>= 18)
- PostgreSQL (локально или в контейнере)

Рекомендуемый одношаговый запуск (Windows PowerShell):

```powershell
cd D:\GO-Lessons\pro-go\Gapak
powershell -ExecutionPolicy Bypass -File .\start-gapak.ps1
```

Альтернатива (Batch):

```bat
cd D:\GO-Lessons\pro-go\Gapak
start-gapak.bat
```

Если нужен ручной запуск (2 терминала):

Терминал A — backend:

```powershell
cd backend
# Пример переменной окружения (локально)
$env:DATABASE_URL = "postgresql://postgres:5433@127.0.0.1:5432/gapak?sslmode=disable"
go mod tidy
go run ./cmd/migrate/main.go
go run ./cmd/api/main.go
```

Терминал B — frontend:

```powershell
cd front
npm install
npm run dev
```

После запуска:
- Frontend: http://localhost:3000
- Backend:  http://localhost:8080
- Health:   http://localhost:8080/health/ready

---

## ✨ Возможности
- Современная аутентификация (JWT, защита CSRF, защищённые cookie)
- Хеширование паролей (Argon2/безопасное хранение)
- Разделение frontend / backend для удобной разработки и деплоя
- Миграции базы данных и утилиты для быстрого старта (quick-register)
- **Система чатов**: Прямые сообщения с поддержкой вложений и реального времени

---

## 🧰 Стек технологий
- Backend: Go, chi (или аналог), PostgreSQL
- Frontend: React (Vite)
- Инструменты: Docker (опционально), make / ps1-скрипты для удобства

---

## 🛠 Настройка окружения (самое важное)

Пример переменных для backend (`backend/.env` либо экспорт в окружение):

```env
DATABASE_URL=postgresql://postgres:PASSWORD@127.0.0.1:5432/gapak?sslmode=disable
JWT_SECRET=change_me_to_a_random_value
PASSWORD_PEPPER=change_this_too
COOKIE_DOMAIN=localhost
```

Пример для frontend (`front/.env.local`):

```env
VITE_PUBLIC_API_BASE_URL=http://localhost:8080
```

---

## 🗄 База данных и тестовый пользователь
- Для быстрого создания тестового пользователя запущен скрипт `quick-register.ps1`:

```powershell
# Из корня репозитория
.\quick-register.ps1
# Создаёт: testuser / TestPassword123
```

---

## 🧪 Тесты
Backend:

```powershell
cd backend
go test ./...
```

Frontend (если есть тесты):

```bash
cd front
npm test
```

---

## 💬 Система чатов

### Обзор
Система чатов обеспечивает безопасную прямую переписку между пользователями с поддержкой:
- Прямых сообщений (direct messaging)
- Вложений файлов (изображения, документы)
- Реального времени через event polling
- End-to-end шифрования (поддержка ciphertext, nonce, senderKeyId)
- Отслеживания присутствия участников (presence)

### API Эндпоинты

Все эндпоинты требуют JWT-аутентификацию:

- `GET /chats` — Список чатов пользователя
- `POST /chats/direct` — Создание прямого чата
- `GET /chats/:chatId/messages` — Получение сообщений (с пагинацией)
- `POST /chats/:chatId/messages` — Отправка сообщения
- `GET /chats/:chatId/events` — Получение событий реального времени

### Документация API
Пол документации по API чатов: `backend/docs/CHAT_API_DOCUMENTATION.md`

### Интеграция Frontend
- Компоненты: `ChatList`, `MessageThread`, `MessageAttachment`
- Сервисы: `chat.service.ts` (API клиент)
- Страницы: `/chats` (список чатов), `/chats/[chatId]` (детали чата)
- Все данные загружаются динамически из базы данных (без статических шаблонов)

### Отчёт об интеграции
Подробный отчёт о интеграции системы чатов: `CHAT_INTEGRATION_REPORT.md`

---

## 🚑 Отладка — часто встречающиеся ошибки
Порт занят:

```powershell
netstat -ano | findstr :5432  # Или :8080 или :3000
taskkill /PID <PID> /F
```

`go: command not found` — установить Go: https://go.dev/dl/

`npm: command not found` — установить Node.js: https://nodejs.org/

`PostgreSQL connection error` — проверьте DATABASE_URL, пароль, что DB слушает на нужном порту

`Frontend не видит backend` — проверьте `VITE_PUBLIC_API_BASE_URL` в `front/.env.local` и что backend отвечает на /health/ready

---

## 📦 Docker (опционально)
Можно добавить docker-compose с сервисами: db, backend, frontend. В репозитории пока нет готового compose — можно создать по необходимости.

---

## 🤝 Вклад
Пулл-реквесты приветствуются. Открывайте issue для обсуждения крупных изменений.

Принципы:
- Сначала Issue → обсуждение → PR
- Пишите тесты для новой логики
- Следуйте стилю кодовой базы

---

## ⚖️ Лицензия
MIT — см. файл LICENSE.

---

## 👨‍💻 Автор и контакты
Abdulloh Ashurov — https://github.com/Krekker0101 — krekker882@gmail.com

---

Спасибо за использование GAPAK — радует помогать разработчикам стартовать быстро и безопасно.

---
