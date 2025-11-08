Руководство по запуску:

1. Клонировать репозиторий
```
git clone https://github.com/Zerferrous/TestTask.git
```
2. Перейти в папку приложения
```
cd TestTask
```
3. Редактировать docker-compose.yml: Подставить корректный CloudPub-токен
4. Перейти в папку с сервером
```
cd Server
```
5. Переименовать example.env в .env, а также подставить корректные значения переменных (Логин и пароль Авито, имя прослушаемого пользователя)
6. Запустить docker-compose
```
cd ..
docker-compose up -d
```

После запуска приложение будет доступно локально по адресу
[http://localhost:5173](http://localhost:5173)

Для корректной работы приложения вне локальной среды (Через CloudPub) необходимо также изменить TestTask/Client/App.jsx

```
const socket = io('АДРЕС ВЫДАННЫЙ CloudPub', {
      transports: ['websocket'],
    });
```
