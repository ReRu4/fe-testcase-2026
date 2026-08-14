# Источники данных

Своего бэкенда в задании нет и поднимать его не нужно. Все данные — из
публичных источников.

---

## 1. Тайлы карты

Основной вариант — OpenFreeMap, стиль Liberty. Без ключа, без регистрации:

```
https://tiles.openfreemap.org/styles/liberty
```

Запасной, если первый недоступен:

```
https://demotiles.maplibre.org/style.json
```

---

## 2. Основной источник точек — Wikipedia GeoSearch

Достопримечательности с координатами, описаниями и **изображениями**.
Ключ не нужен, CORS работает при параметре `origin=*`.

Эндпоинт

```
https://ru.wikipedia.org/w/api.php
```

### Базовый запрос

Поиск статей вокруг точки, сразу с координатами, миниатюрой и описанием:

```
https://ru.wikipedia.org/w/api.php
  ?action=query
  &format=json
  &origin=*
  &generator=geosearch
  &ggscoord=55.7539|37.6208
  &ggsradius=10000
  &ggslimit=500
  &prop=coordinates|pageimages|description
  &coprop=type|dim
  &piprop=thumbnail
  &pithumbsize=64
```

Есть и вариант по прямоугольнику — `ggsbbox` в порядке `top|left|bottom|right`
вместо пары `ggscoord`/`ggsradius`.


### Редкость

Выводится из поля `coordinates[0].type` (приходит при `coprop=type`) и наличия
миниатюры. Первое совпадение сверху вниз:

| Редкость    | Условие                                      | Очки |
| ----------- | -------------------------------------------- | ---- |
| `legendary` | `type=landmark` и есть `thumbnail`            | 150  |
| `epic`      | `type` ∈ `landmark`, `edu`, `railwaystation`  | 60   |
| `rare`      | есть `thumbnail`, `type` любой                | 25   |
| `common`    | всё остальное                                 | 10   |

Объекты с `type` ∈ `country`, `adm1st`, `adm2nd`, `adm3rd`, `city`, `waterbody`,
`river`, `event` в игру не попадают — это не точки на местности.

### Рекомендуемые центры

| Город            | Координаты центра   |
| ---------------- | ------------------- |
| Москва           | `55.7539, 37.6208`  |
| Санкт-Петербург  | `59.9386, 30.3141`  |

Переключение между пресетами должно работать без перезагрузки страницы.

---


## 4. Запасные варианты

Если основной источник недоступен из вашей сети — можно взять любой из этих источников или собственный. 
Выбор важно отметить в `DECISIONS.md`:

- **Wikidata SPARQL** — `https://query.wikidata.org/sparql?format=json`,
  без ключа, CORS открыт. Позволяет забрать музеи и памятники с координатами и
  изображениями одним запросом. Синтаксис тяжелее, данные чище.
- **OpenTripMap** — `https://api.opentripmap.com/0.1/ru/places/bbox`,
  бесплатный ключ, выборка по bbox и категориям
  (`kinds=museums,architecture,historic`). Основан на OSM и Wikidata.
