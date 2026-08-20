# Интеграция с Яндекс Календарём (360)

Документ описывает, как программно подключаться к календарю по адресу [https://calendar.360.yandex.ru/](https://calendar.360.yandex.ru/) и создавать **встречи** и **задачи**.

---

## Главное: отдельного REST API нет

Веб-интерфейс `calendar.360.yandex.ru` — это UI. Для программного доступа Яндекс предоставляет **протокол CalDAV** (расширение WebDAV для календарей, RFC 4791).

| Что искать | Что реально использовать |
|---|---|
| `calendar.360.yandex.ru` | Веб-интерфейс |
| `calendar.yandex.ru` | Веб-интерфейс (личный аккаунт) |
| **`caldav.yandex.ru`** | **Сервер API для интеграции** |

Данные передаются в формате **iCalendar** (`.ics`): компонент `VEVENT` — встречи, `VTODO` — задачи.

Официальная документация Яндекс 360:
- [Сервисные приложения (корпоративный доступ)](https://yandex.ru/support/yandex-360/business/admin/ru/security-service-applications)
- [Синхронизация CalDAV (настройка клиентов)](https://yandex.ru/support/yandex-360/business/calendar/ru/data-exchange/synchronization/sync-desktop)
- [OAuth Яндекс ID](https://yandex.ru/dev/id/doc/ru/concepts/ya-oauth-intro)

Спецификация протокола: [CalDAV (RFC 4791)](https://datatracker.ietf.org/doc/html/rfc4791).

---

## Что нужно для подключения

### 1. Аккаунт

- Личный: `@yandex.ru`, `@yandex.com` и т.п.
- Корпоративный (Яндекс 360): `user@your-domain.ru` — тот же CalDAV-сервер, но другие сценарии авторизации (см. ниже).

### 2. Способ аутентификации (выбрать один)

#### Вариант A — OAuth-токен (рекомендуется для приложений)

1. Зарегистрировать приложение: [oauth.yandex.ru/client/new](https://oauth.yandex.ru/client/new)
2. Тип: **«Доступ к API»** (не «Авторизация пользователей»)
3. Платформа: **Веб-сервисы**, Redirect URI: `https://oauth.yandex.ru/verification_code` (для отладки)
4. Право доступа: **`calendar:all`** — чтение и запись календарей и списков дел
5. Получить OAuth-токен пользователя:

```
https://oauth.yandex.ru/authorize?response_type=token&client_id=<CLIENT_ID>&scope=calendar:all
```

6. Использовать в заголовке:

```
Authorization: OAuth <access_token>
```

#### Вариант B — Пароль приложения (проще для скриптов и личного использования)

1. [Яндекс ID → Безопасность → Пароли приложений](https://passport.yandex.ru/profile/)
2. Создать пароль типа **«Календарь»** / CalDAV
3. Авторизация Basic:

```
Authorization: Basic base64(email:app_password)
```

> При включённой 2FA обычный пароль аккаунта **не работает** — нужен пароль приложения.

#### Вариант C — Сервисные приложения (корпоративный Яндекс 360)

Для доступа к календарям **сотрудников организации** без личного входа каждого пользователя.

**Требования:**
- Тариф: Основной, Продвинутый, Корпоративный (или старые Оптимальный/Расширенный)
- Настроенный почтовый домен в организации
- Согласие пользователей (п. 3.6 оферты)

**Схема:**
1. Владелец организации регистрирует OAuth-приложение с правами `ya360_security:service_applications_read/write`
2. Активирует сервисные приложения: `POST https://api360.yandex.net/security/v1/org/<org_id>/service_applications/activate`
3. Регистрирует сервисное приложение с scope `calendar:all` (и др.)
4. Получает **временный токен пользователя** (живёт ~1 час) через token exchange:

```bash
curl --location \
  --request POST 'https://oauth.yandex.ru/token' \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'grant_type=urn:ietf:params:oauth:grant-type:token-exchange' \
  --data-urlencode 'client_id=<service_app_client_id>' \
  --data-urlencode 'client_secret=<service_app_client_secret>' \
  --data-urlencode 'subject_token=<user_email>' \
  --data-urlencode 'subject_token_type=urn:yandex:params:oauth:token-type:email'
```

5. Временный токен используется в CalDAV-запросах так же, как обычный OAuth-токен.

Подробнее: [Сервисные приложения](https://yandex.ru/support/yandex-360/business/admin/ru/security-service-applications), [Справочник API 360](https://yandex.ru/dev/api360/doc/ru/).

---

## Базовые URL CalDAV

| Назначение | URL |
|---|---|
| Корень сервера | `https://caldav.yandex.ru/` |
| Principal (пользователь) | `https://caldav.yandex.ru/principals/users/<email>/` |
| Календарь событий по умолчанию | `https://caldav.yandex.ru/calendars/<email>/events-default/` |
| Конкретное событие | `https://caldav.yandex.ru/calendars/<email>/events-default/<uid>.ics` |
| Список задач | `https://caldav.yandex.ru/calendars/<email>/todos-<id>/` |
| Конкретная задача | `https://caldav.yandex.ru/calendars/<email>/todos-<id>/<uid>.ics` |

**Важно:**
- `<email>` — полный адрес: `user@company.ru`, не логин без домена
- У одного пользователя может быть несколько календарей: `events-default`, `events-23342418`, `todos-6109195` и т.д.
- ID календаря можно узнать в UI: **Настройки календаря → Экспорт → поле CalDAV** (скопировать часть после `/calendars/`)
- Либо через PROPFIND (см. раздел «Обнаружение календарей»)

---

## Обнаружение календарей (PROPFIND)

Перед созданием событий/задач полезно получить список доступных коллекций:

```bash
curl -X PROPFIND \
  "https://caldav.yandex.ru/principals/users/user@company.ru/" \
  -H "Authorization: OAuth <token>" \
  -H "Depth: 1" \
  -H "Content-Type: application/xml" \
  --data '<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:displayname/>
    <c:calendar-description/>
    <d:resourcetype/>
  </d:prop>
</d:propfind>'
```

В ответе будут URL вида:
- `.../events-default/` или `.../events-12345678/` — события (встречи)
- `.../todos-12345678/` — задачи

---

## Создание встречи (VEVENT)

### Минимальный пример (curl)

```bash
EVENT_UID="$(uuidgen)"
USER_EMAIL="user@company.ru"
TOKEN="<oauth_token>"

curl -v "https://caldav.yandex.ru/calendars/${USER_EMAIL}/events-default/${EVENT_UID}.ics" \
  -H "Authorization: OAuth ${TOKEN}" \
  -H "Content-Type: text/calendar; charset=utf-8" \
  -X PUT \
  --data-binary "BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//MindMap//Yandex Calendar//RU
BEGIN:VEVENT
UID:${EVENT_UID}
DTSTAMP:$(date -u +%Y%m%dT%H%M%SZ)
DTSTART:20260703T140000Z
DTEND:20260703T150000Z
SUMMARY:Встреча по проекту
DESCRIPTION:Обсуждение интеграции
LOCATION:Офис / онлайн
END:VEVENT
END:VCALENDAR"
```

Успешный ответ: **`HTTP/1.1 201 Created`**

### Поля VEVENT (основные)

| Поле | Описание |
|---|---|
| `UID` | Уникальный ID (должен совпадать с именем `.ics`-файла) |
| `DTSTART` / `DTEND` | Начало и конец (UTC: `...Z` или с TZID) |
| `SUMMARY` | Название встречи |
| `DESCRIPTION` | Описание |
| `LOCATION` | Место |
| `RRULE` | Повторение (`FREQ=WEEKLY;BYDAY=MO`) |
| `ATTENDEE` | Участники (`mailto:user@company.ru`) |

### Встреча с видеоконференцией Телемост

Яндекс поддерживает нестандартное свойство `X-TELEMOST-REQUIRED`. При `PUT` сервер сам создаёт ссылку на Телемост и возвращает её в `X-TELEMOST-CONFERENCE`:

```ics
BEGIN:VEVENT
X-TELEMOST-REQUIRED:TRUE
UID:a5e3e7b0-dd11-11ed
DTSTART:20230417T120000Z
SUMMARY:Совещание
DESCRIPTION:Еженедельный созвон
END:VEVENT
```

Альтернатива — создать конференцию через **Telemost API** (`https://cloud-api.yandex.net/v1/telemost-api/conferences`) и вставить `join_url` в `LOCATION` или `DESCRIPTION`. Scope: `telemost-api:conferences.create`.

### Чтение встреч за период (REPORT)

```bash
curl -X REPORT \
  "https://caldav.yandex.ru/calendars/user@company.ru/events-default/" \
  -H "Authorization: OAuth <token>" \
  -H "Content-Type: application/xml" \
  --data '<?xml version="1.0" encoding="utf-8"?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="20260701T000000Z" end="20260708T000000Z"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>'
```

### Изменение и удаление

| Операция | HTTP-метод |
|---|---|
| Создать / обновить | `PUT` на `.../<uid>.ics` |
| Удалить | `DELETE` на `.../<uid>.ics` |
| Частичное обновление | `PATCH` (поддержка зависит от клиента) |

---

## Создание задачи (VTODO)

Задачи в Яндекс Календаре хранятся в отдельных CalDAV-коллекциях с префиксом **`todos-`**, а не в `events-default`.

### Пример создания задачи

```bash
TASK_UID="$(uuidgen)"
USER_EMAIL="user@company.ru"
TODOS_CALENDAR="todos-6109195"   # узнать через PROPFIND или UI → Экспорт
TOKEN="<oauth_token>"

curl -v "https://caldav.yandex.ru/calendars/${USER_EMAIL}/${TODOS_CALENDAR}/${TASK_UID}.ics" \
  -H "Authorization: OAuth ${TOKEN}" \
  -H "Content-Type: text/calendar; charset=utf-8" \
  -X PUT \
  --data-binary "BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//MindMap//Yandex Calendar//RU
BEGIN:VTODO
UID:${TASK_UID}
DTSTAMP:$(date -u +%Y%m%dT%H%M%SZ)
SUMMARY:Подготовить отчёт
DUE:20260705T180000Z
STATUS:NEEDS-ACTION
PRIORITY:5
END:VTODO
END:VCALENDAR"
```

### Поля VTODO (основные)

| Поле | Описание |
|---|---|
| `SUMMARY` | Текст задачи |
| `DUE` | Срок (дата/время) |
| `STATUS` | `NEEDS-ACTION`, `COMPLETED`, `CANCELLED` |
| `COMPLETED` | Дата выполнения |
| `PRIORITY` | 1 (высокий) — 9 (низкий), 5 — средний |

### Ограничения задач в Яндекс Календаре

По опыту интеграторов (официально не задокументировано подробно):
- Задачи в веб-интерфейсе **минималистичны** — не все поля iCalendar отображаются
- Описание (`DESCRIPTION`) может не синхронизироваться в UI
- Напоминания — с шагом 30 минут
- Для полноценной работы с задачами через CalDAV нужен клиент, поддерживающий VTODO (DAVx⁵, OpenTasks и т.п.)

---

## Рекомендуемые библиотеки

Вместо сырых HTTP-запросов можно использовать готовые CalDAV-клиенты:

| Язык | Библиотека |
|---|---|
| Python | [caldav](https://github.com/python-caldav/caldav) |
| Python | [calendav](https://github.com/samuelvincent/calendav) |
| JavaScript/TS | [ts-caldav](https://www.npmjs.com/package/ts-caldav), [dav](https://www.npmjs.com/package/dav) |
| Java | [ical4j](https://github.com/ical4j/ical4j), [CalDav4J](https://github.com/goodwinuser/CalDav4J) |
| C# | [CalDavYandex](https://github.com/ZettZet/CalDavYandex) |
| PHP | [sabre/dav](https://github.com/sabre-io/dav) |

Пример на Python (из официальной документации Яндекс 360):

```python
import caldav

client = caldav.DAVClient(
    url="https://caldav.yandex.ru/",
    username="user@company.ru",
    password="<oauth_token>",  # OAuth-токен как password
)
principal = client.principal()
calendars = principal.calendars()
```

> Для OAuth в заголовке нужен формат `Authorization: OAuth <token>`, а не Basic. Убедитесь, что библиотека это поддерживает, или делайте запросы напрямую через `curl`/`fetch`.

---

## Схема интеграции для MindMap

```
┌─────────────┐     OAuth / App Password     ┌──────────────────┐
│  MindMap    │ ───────────────────────────► │ caldav.yandex.ru │
│  (backend)  │   CalDAV + iCalendar (.ics)  │                  │
└─────────────┘                              └────────┬─────────┘
                                                      │
                                                      ▼
                                           ┌──────────────────────┐
                                           │ calendar.360.yandex  │
                                           │ .ru (веб-интерфейс)  │
                                           └──────────────────────┘
```

### Предлагаемые шаги реализации

1. **Выбрать сценарий авторизации**
   - Личное использование / прототип → OAuth `calendar:all` или пароль приложения
   - Корпоративная автоматизация → сервисные приложения Яндекс 360

2. **Хранить секреты**
   - `YANDEX_OAUTH_TOKEN` или `YANDEX_CALDAV_APP_PASSWORD`
   - `YANDEX_CALENDAR_EMAIL`
   - Опционально: `YANDEX_EVENTS_CALENDAR_ID` (например `events-default`), `YANDEX_TODOS_CALENDAR_ID` (например `todos-6109195`)

3. **Реализовать тонкий клиент**
   - `discoverCalendars()` — PROPFIND
   - `createEvent(event)` — PUT VEVENT
   - `createTask(task)` — PUT VTODO
   - `listEvents(from, to)` — REPORT calendar-query

4. **Генерировать UID**
   - UUID v4 для каждого нового события/задачи

5. **Обработать ошибки**
   - `401` — невалидный токен / пароль
   - `403` — нет прав `calendar:all`
   - `404` — неверный путь календаря
   - `412` — конфликт etag при обновлении

---

## Чеклист перед стартом

- [ ] Есть аккаунт Яндекс 360 с доступом к календарю
- [ ] Создано OAuth-приложение с scope `calendar:all` **или** пароль приложения «Календарь»
- [ ] Получен и проверен токен (тестовый PROPFIND / GET)
- [ ] Известен email пользователя и ID календарей (`events-default`, `todos-*`)
- [ ] Для корпоративного сценария: активированы сервисные приложения, есть согласие пользователей
- [ ] Для Телемоста: отдельный scope `telemost-api:conferences.*` (если нужны видеовстречи)

---

## Полезные ссылки

| Ресурс | URL |
|---|---|
| Веб-календарь 360 | https://calendar.360.yandex.ru/ |
| CalDAV-сервер | https://caldav.yandex.ru/ |
| Регистрация OAuth-приложения | https://oauth.yandex.ru/client/new |
| Сервисные приложения (админ) | https://yandex.ru/support/yandex-360/business/admin/ru/security-service-applications |
| Синхронизация CalDAV | https://yandex.ru/support/yandex-360/business/calendar/ru/data-exchange/synchronization/sync-desktop |
| OAuth Яндекс ID | https://yandex.ru/dev/id/doc/ru/ |
| API 360 (справочник) | https://yandex.ru/dev/api360/doc/ru/ |
| Telemost API | https://yandex.ru/dev/telemost/doc/ru/ |
| CalDAV RFC 4791 | https://datatracker.ietf.org/doc/html/rfc4791 |
| iCalendar RFC 5545 | https://datatracker.ietf.org/doc/html/rfc5545 |

---

## Итог

| Задача | Как делать |
|---|---|
| Подключиться к календарю | CalDAV на `caldav.yandex.ru`, OAuth (`calendar:all`) или пароль приложения |
| Создать встречу | `PUT` iCalendar `VEVENT` в `.../events-default/<uid>.ics` |
| Создать задачу | `PUT` iCalendar `VTODO` в `.../todos-<id>/<uid>.ics` |
| Видеовстреча Телемост | `X-TELEMOST-REQUIRED:TRUE` в VEVENT или Telemost API |
| Доступ к календарям сотрудников | Сервисные приложения Яндекс 360 + token exchange |

Отдельного публичного REST API по адресу `calendar.360.yandex.ru` **не существует** — вся программная работа идёт через **CalDAV + iCalendar**.
