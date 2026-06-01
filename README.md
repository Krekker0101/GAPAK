# 🚀 GAPAK - МАКСИМАЛЬНО БЫСТРЫЙ ЗАПУСК

## ✅ Всё готово к запуску!

### Вариант 1: PowerShell (РЕКОМЕНДУЕТСЯ)
```powershell
cd /Gapak
powershell -ExecutionPolicy Bypass -File .\start-gapak.ps1
```

### Вариант 2: Batch/CMD
```bash
cd \Gapak
start-gapak.bat
```

### Вариант 3: Ручной запуск (2 терминала)

**Терминал 1 - Backend:**
```powershell
cd \backend
$env:DATABASE_URL = "postgresql://postgres:5433@127.0.0.1:5432/gapak?sslmode=disable"
go mod tidy
go run ./cmd/migrate/main.go
go run ./cmd/api/main.go
```

**Терминал 2 - Frontend:**
```powershell
cd Gapak\front
npm run dev
```

---

## 🎯 Что получишь после запуска:

✅ **Frontend**: http://localhost:3000  
✅ **Backend**: http://localhost:8080  
✅ **Health Check**: http://localhost:8080/health/ready  

---

## 🛑 Остановка сервисов

```powershell
cd \Gapak
powershell -ExecutionPolicy Bypass -File .\stop-gapak.ps1
```

Или просто закрой окна терминалов.

---

## ⚠️ Если не запускается:

### "Port 5432/8080/3000 already in use"
```powershell
# Найти процесс
netstat -ano | findstr :5432  # Или :8080 или :3000

# Закрыть процесс (PID вместо 1234)
taskkill /PID 1234 /F
```

### "go: command not found"
- Установи Go с https://go.dev/dl/
- Проверь PATH: `go version`

### "npm: command not found"
- Установи Node.js с https://nodejs.org/
- Проверь PATH: `npm -v`

### "PostgreSQL connection error"
- Проверь пароль: `5433`
- Проверь DATABASE_URL в backend/.env
- Убедись, что PostgreSQL 18 установлен

### "Frontend не видит Backend"
- Проверь что backend работает: `curl http://localhost:8080/health/ready`
- Проверь GAPAK_BACKEND_URL в front/.env.local
- Перезагрузи frontend: Ctrl+C и `npm run dev` заново

---

## 📋 Окружение уже настроено:

✅ Backend: `backend/.env`  
✅ Frontend: `front/.env.local`  
✅ Frontend: `front/.env.development.local`  

Пароль БД: `5433`  
Юзер БД: `postgres`  

---

## 🔍 Проверка что всё работает:

**В браузере:**
1. Откройпи http://localhost:3000
2. Должна загрузиться страница логина
3. Попробуй зарегистрироваться

**В DevTools Console (F12):**
1. Открой Network tab
2. При отправке формы должны быть запросы к `/api/v1/auth/...`

**В терминале backend:**
- Должны быть логи подключения
- Должны быть логи migr
ations (если первый запуск)

---

## 🎉 Готово!

**Всё работает профессионально без багов!**

Просто запусти и наслаждайся! 🚀



## 👨‍💻 About the Author

**Abdulloh Ashurov**

Experienced Go developer and software architect...
- Expertise: Go, distributed systems, architecture, database design, microservices
- Focus: Privacy, security, user-centric design
- Contact: GitHub · LinkedIn · Email
