# Настройка Supabase: защита данных (RLS)

## Зачем это нужно

Приложение синхронизирует склад через общую таблицу `cars` в Supabase.
URL проекта и publishable-ключ зашиты в код — это нормально (ключ публичный),
но **приватность данных держится исключительно на политиках Row Level Security (RLS)**.
Если политики не настроены или настроены как «всем авторизованным», любой человек,
зарегистрировавшийся в приложении, увидит и сможет изменить чужие машины.

## Что уже проверено

- Анонимный запрос (без входа) к `rest/v1/cars` возвращает пустой список — утечки
  для неавторизованных нет (либо RLS включён, либо таблица пуста).
- Доступ к OpenAPI-схеме по публичному ключу закрыт — хорошо.
- **Не проверено** (требует доступа в панель Supabase): видят ли авторизованные
  пользователи чужие строки. Выполните SQL ниже, чтобы гарантировать изоляцию.

## Как проверить текущее состояние

Панель Supabase → ваш проект → **Authentication → Policies** (или Table Editor → cars → RLS).
Должно быть: RLS **enabled**, и политики с условием `user_id = auth.uid()`.
Если политика выглядит как `using (true)` для роли `authenticated` — данные общие, нужно чинить.

## SQL для полной настройки

Выполняйте в **SQL Editor** по шагам.

### Шаг 0. Если таблицы ещё нет — создать сразу правильно

```sql
create table if not exists public.cars (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  user_id uuid not null default auth.uid()
);
```

### Шаг 1. Колонка владельца (если таблица уже существует без неё)

```sql
alter table public.cars add column if not exists user_id uuid default auth.uid();
```

### Шаг 2. Присвоить существующие строки себе

Свой UUID возьмите в **Authentication → Users** (колонка UID).

```sql
update public.cars set user_id = 'ВАШ-USER-UUID' where user_id is null;
```

### Шаг 3. Запретить строки без владельца

```sql
alter table public.cars alter column user_id set not null;
```

### Шаг 4. Включить RLS и политики «каждому — только своё»

```sql
alter table public.cars enable row level security;

drop policy if exists "cars_select_own" on public.cars;
create policy "cars_select_own" on public.cars
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "cars_insert_own" on public.cars;
create policy "cars_insert_own" on public.cars
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "cars_update_own" on public.cars;
create policy "cars_update_own" on public.cars
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "cars_delete_own" on public.cars;
create policy "cars_delete_own" on public.cars
  for delete to authenticated using (user_id = auth.uid());
```

Код приложения менять не нужно: при вставке `user_id` заполняется автоматически
(`default auth.uid()`), при обновлении колонка не трогается.

### Шаг 5. Проверка

1. Войдите в приложение со своего аккаунта — машины на месте, синхронизация работает.
2. Зарегистрируйте тестовый аккаунт (другая почта) — склад должен быть пустым.
3. Запрос без входа (замените ключ на свой publishable):

```bash
curl "https://ВАШ-ПРОЕКТ.supabase.co/rest/v1/cars?select=id" \
  -H "apikey: ВАШ-PUBLISHABLE-KEY"
```

Должен вернуть `[]` или ошибку, но никогда — данные.

## Примечание про общий доступ

Если склад ведёте вдвоём с партнёром — просто заходите под одним аккаунтом
на обоих устройствах. Политики выше изолируют **аккаунты**, не устройства.
