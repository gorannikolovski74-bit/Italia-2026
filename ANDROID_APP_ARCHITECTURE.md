# AI Tourist Agent — Android App Архитектура

> **Цел на овој документ:** Handoff за нова Claude Code сесија. Содржи сè што е потребно
> за да се изгради Android апликација „AI Tourist Agent" врз основа на постоечкиот
> Italia-2026 web dashboard. Новата сесија треба да го прочита ова ПРВО.

---

## 1. Контекст — што постои сега

### 1.1 Постоечки систем (web dashboard)
- **Repo:** `gorannikolovski74-bit/Italia-2026` (GitHub)
- **Production сервер:** DigitalOcean droplet `CloudPC2`, Reserved IP `146.190.202.161:3000`
  (пред `157.245.207.38` — ephemeral IP, заменета со Reserved IP за да преживее droplet snapshot/recreate)
- **Stack:** Node.js + Express (`server.js`), еден HTML фајл (`public/index.html`) со inline CSS/JS
- **Process manager:** PM2, процес `italia-2026`
- **Auto-deploy:** GitHub webhook → POST `http://146.190.202.161:3000/webhook`
  (HMAC-SHA256, secret env `WEBHOOK_SECRET`, default `italia2026deploy`) → `git pull origin main` + `pm2 restart italia-2026`
- **Работен тек:** Claude Code (web) → push на `main` → авто-деплој. Без SSH, без VSCode.

### 1.2 Постоечки API endpoints (сите на портата 3000)
| Метод | Патека | Опис |
|---|---|---|
| POST | `/api/chat` | Proxy кон Anthropic API (Claude). Body = Anthropic Messages формат. API клучот е на серверот (`ANTHROPIC_API_KEY` env). |
| GET/POST/DELETE | `/api/bookmarks` | Bookmarks (JSON фајл `bookmarks.json`) |
| GET/POST/DELETE | `/api/expenses` | Реални трошоци (`expenses.json`) — полиња: id, date, category, label, amount |
| GET/POST/DELETE | `/api/chat-history` | Синхронизирана chat историја меѓу уреди (`chat.json`, поле `updatedAt` за polling) |
| POST | `/webhook` | GitHub auto-deploy (НЕ го чепкај — мора да остане ПРЕД `express.json()`) |

- `express.json({ limit: '20mb' })` — поддржува base64 слики во chat.
- Сите податоци се чуваат како JSON фајлови на дроплетот (нема база).

### 1.3 Функционалности на дашбордот (за пренос во app)
1. **Итинерар по денови** — 29.06–06.07.2026, Салерно, картички со активности, цени, Google Maps линкови
2. **Летови** — WizzAir SKP↔NAP, полетување/поврат картички
3. **Буџет план** — €1,800 за тројца (храна €1,000, Alibus €30, воз €36, Travelmar ~€78, Grasi Junior €180, резерва €476)
4. **Реални трошоци** — внес + споредба со план (потрошено/планирано/преостанато), collapsible
5. **Фери табела** — Travelmar (Амалфи 01.07), Grasi Junior (Позитано+Капри 02.07)
6. **ATM секција** — Google Maps линкови (Салерно центар координати + GPS „кај мене")
7. **AI Chat агент** — Claude (модел `claude-sonnet-4-5`), македонски јазик, systemprompt со детали за патувањето, **слика upload** (превод на менија, знаци), cross-device sync (6s polling)
8. **Корисни линкови** — Travelmar, Alicost, Ferryhopper, Grassi Boat, Trenitalia итн.
9. **Bookmarks** — кориснички зачувани линкови

### 1.4 Дизајн систем (да се пренесе во app тема)
```
Позадина:  #0a0f0d / #111a15 / #1a2820 (картички)
Акцент:    #4eca7f (зелена) / #2a9d5c
Злато:     #d4a843 / #f0c96a (цени, буџет)
Текст:     #e8f5ee / #9bbfaa / #5d8a6e
Црвено:    #e05c5c (пречекорен буџет)
Сино:      #5ba3d9 (фери)
Фонтови:   Cormorant Garamond (наслови), DM Sans (текст)
Стил:      темна тема, тенки бордери rgba(78,202,127,0.12), radius 10-12px
```

---

## 2. Визија за Android апликацијата

**Име:** AI Tourist Agent
**Клучна разлика од дашбордот:** дашбордот е hard-coded за Италија 2026.
Апликацијата е **генеричка** — корисникот сам креира и управува патувања.

### 2.1 Основни функционалности (MVP)
1. **Патувања (Trips)** — корисникот креира патување: дестинација, датуми, број патници, валута
2. **Итинерар builder** — денови + активности (рачно или AI-генерирано)
3. **Буџет план + реални трошоци** — како на дашбордот, но по патување
4. **AI Chat агент** — контекстуален за активното патување (Claude го добива итинерарот/буџетот како system prompt), слика upload (превод менија/знаци), гласовен внес (опционално)
5. **Офлајн режим** — податоците локално (Room), sync кога има мрежа
6. **Локациски алатки** — ATM/аптека/ресторани „кај мене" (Google Maps intents — без API клуч!)

### 2.2 Идни функционалности (пост-MVP)
- Push нотификации (потсетници: „утре фери во 08:30")
- Споделување патување со семејство (multi-user)
- AI автоматско генерирање на цел итинерар од prompt
- Скенирање сметки → автоматски внес на трошок (Claude vision)
- Повеќе јазици

---

## 3. Техничка архитектура

### 3.1 Препорачан stack
| Слој | Избор | Зошто |
|---|---|---|
| UI | **Kotlin + Jetpack Compose** | Модерен стандард, декларативен, брз развој |
| Архитектура | MVVM + Repository pattern | Стандард, тестабилно |
| Локална база | **Room** (SQLite) | Офлајн-прво |
| Мрежа | Retrofit + OkHttp + kotlinx.serialization | Стандард |
| DI | Hilt | Стандард |
| Слики | Coil | Compose-native |
| Async | Coroutines + Flow | Стандард |
| Build | Gradle (Kotlin DSL), min SDK 26, target SDK 35 | Покрива 95%+ уреди |

**Алтернатива ако се сака брз старт:** Capacitor/WebView wrapper на постоечкиот
дашборд — НЕ се препорачува како крајна цел (лош UX, нема офлајн), но може како
фаза 0 демо.

### 3.2 Backend стратегија
Постоечкиот droplet сервер се проширува (истиот `server.js` или нов `api/` дел):

```
СЕГА (dashboard):              ПОТОА (app):
/api/chat                      /api/v1/chat          (исто, + trip context)
/api/expenses  (global)        /api/v1/trips                POST/GET
/api/chat-history (global)     /api/v1/trips/:id            GET/PUT/DELETE
                               /api/v1/trips/:id/days       CRUD
                               /api/v1/trips/:id/expenses   CRUD
                               /api/v1/trips/:id/chat       GET/POST (sync)
                               /api/v1/auth                 (види 3.3)
```

- **Клучна одлука:** JSON фајлови → **SQLite на серверот** (или PostgreSQL ако расте).
  За еден корисник/семејство, SQLite со `better-sqlite3` е сосем доволно.
- Anthropic API клучот ОСТАНУВА на серверот. Апликацијата НИКОГАШ не го содржи.
- Постоечкиот дашборд продолжува да работи непроменето (backward compatible).

### 3.3 Автентикација (минимална, но задолжителна)
Штом app-от е јавен на Play Store, `/api/chat` не смее да е отворен (туѓи луѓе би го
трошеле Anthropic API кредитот).

- MVP: **API token** — при прво стартување корисникот внесува token (или QR од
  дашбордот). Серверот проверува `Authorization: Bearer <token>`.
- Пост-MVP: Firebase Auth / Google Sign-In + per-user податоци.

### 3.4 Sync стратегија (офлајн-прво)
```
Room (локално, source of truth за UI)
   ↕  WorkManager периодичен sync + on-demand
Server SQLite (remote)
```
- Секој запис има `updatedAt` (epoch millis) + `deleted` flag (soft delete)
- Last-write-wins конфликт резолуција (доволно за семејна употреба)
- Chat: append-only, сервер е source of truth (како сегашниот 6s polling, но со
  WorkManager/Flow наместо setInterval)

### 3.5 Структура на Android проектот
```
app/src/main/java/com/goran/aitouristagent/
├── data/
│   ├── local/        Room: TripDao, DayDao, ExpenseDao, ChatDao + entities
│   ├── remote/       Retrofit: ApiService, DTOs
│   └── repository/   TripRepository, ChatRepository, ExpenseRepository
├── domain/           модели (Trip, Day, Activity, Expense, ChatMessage)
├── ui/
│   ├── theme/        Боите од §1.4 → Compose Theme (darkColorScheme)
│   ├── trips/        Листа патувања + креирање
│   ├── itinerary/    Денови/активности (главен екран на активно патување)
│   ├── budget/       План vs. реално, внес трошоци
│   ├── chat/         AI агент (текст + камера/галерија за слики)
│   └── settings/     Token, сервер URL, јазик
└── di/               Hilt модули
```

### 3.6 Модел на податоци (core entities)
```kotlin
Trip(id, name, destination, startDate, endDate, travelers, currency, budgetTotal, updatedAt, deleted)
BudgetItem(id, tripId, label, emoji, planned, updatedAt, deleted)
Day(id, tripId, date, title, subtitle, icon, orderIndex, updatedAt, deleted)
Activity(id, dayId, text, price?, mapsUrl?, orderIndex, updatedAt, deleted)
Expense(id, tripId, date, category, label, amount, updatedAt, deleted)
ChatMessage(id, tripId, role, content, imageBase64?, createdAt)
Link(id, tripId, name, url, desc, updatedAt, deleted)
```

### 3.7 AI Chat дизајн
- System prompt се гради **динамички** од активното патување:
  дестинација, датуми, итинерар, буџет, потрошено досега → Claude секогаш знае контекст
- Слика: камера или галерија → resize/compress на макс ~1568px, JPEG q80 (штеди
  tokens и bandwidth) → base64 → `/api/v1/chat`
- Историја: последните N пораки (не целата), слики се праќаат само еднаш
  (научено од дашбордот — base64 во историја го крши API повикот)
- Јазик: одговара на јазикот на корисникот (за Горан: македонски)

---

## 4. Фазен план за развој

### Фаза 0 — Setup (1 сесија)
- [ ] Нов repo `ai-tourist-agent` (или `android/` дир во постоечкиот)
- [ ] Android Studio проект: Compose + Hilt + Room + Retrofit skeleton
- [ ] Тема со боите од §1.4
- [ ] CI: GitHub Actions за `./gradlew assembleDebug` (APK artifact за тестирање!)

### Фаза 1 — Backend v1 (1 сесија) ✅ завршена (во branch `feature/api-v1-trips-sqlite`, чека merge)
- [x] `server.js`: SQLite + `/api/v1/trips` CRUD + Bearer token auth
- [x] Migration скрипта: сегашните JSON фајлови → SQLite (Italia 2026 станува првото патување)
- [x] Дашбордот продолжува да работи (старите rути и JSON фајлови се непроменети)

### Фаза 2 — App core (2-3 сесии)
- [ ] Trips листа + креирање патување
- [ ] Итинерар екран (денови/активности, read + edit)
- [ ] Room + sync со серверот

### Фаза 3 — Буџет и трошоци (1 сесија)
- [ ] Буџет план екран + внес реални трошоци + споредба (како дашбордот)

### Фаза 4 — AI Chat (1-2 сесии)
- [ ] Chat екран со динамички system prompt
- [ ] Слика upload (камера + галерија, компресија)
- [ ] Chat sync меѓу уреди

### Фаза 5 — Polish (1-2 сесии)
- [ ] Офлајн режим тестиран, Maps intents (ATM/ресторани), икона, splash
- [ ] Signed release APK / Play Store internal testing

---

## 5. Клучни лекции од дашборд-развојот (НЕ повторувај грешки)

1. **Webhook мора ПРЕД `express.json()`** — inaku raw body е потрошен и HMAC паѓа
2. **Никогаш base64 слики во chat историјата** — праќај слика само еднаш, чувај текст placeholder
3. **`express.json` limit** — default 100kb е премал за слики; сега е 20mb
4. **Никогаш не барај/прифаќај password од корисникот** — сè оди преку GitHub push + webhook
5. **Корисникот работи САМО преку Claude Code web** — нема локален development, нема SSH.
   Затоа CI мора да гради APK автоматски (GitHub Actions artifact или Firebase App Distribution)
6. **Тестирање на мобилен во живо** — корисникот тестира на телефон и праќа screenshots;
   секоја промена се деплојира/build-ува и се чека потврда
7. Кориснички јазик: **македонски** (латиница во пишување, кирилица во UI)

## 6. Отворени прашања за новата сесија (праша го Горан)

1. Нов repo или `android/` папка во Italia-2026? (препорака: **нов repo**)
2. Дали app-от е само за семејството или planiran за Play Store? (влијае на auth)
3. Дали да се мигрира постоечкиот дашборд да чита од новото API (unified), или да
   остане замрзнат како што е?
4. Буџет за Anthropic API — дали да се додаде дневен лимит на повици по корисник?

---

*Создадено: 07.07.2026 · Од сесија за Italia-2026 dashboard · Автор: Claude + Горан*
