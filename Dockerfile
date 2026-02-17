FROM node:20-alpine AS frontend-builder
WORKDIR /app
ENV WAYFINDER_SKIP=1
COPY package.json package-lock.json ./
RUN npm ci
COPY resources ./resources
COPY vite.config.ts tsconfig.json ./
RUN npm run build

FROM composer:2 AS composer-builder
WORKDIR /app
ENV COMPOSER_ALLOW_SUPERUSER=1
COPY . .
RUN composer install --no-dev --prefer-dist --no-interaction --no-progress --optimize-autoloader

FROM php:8.3-fpm-alpine AS app
WORKDIR /var/www/html

RUN apk add --no-cache \
        icu-libs \
        libzip \
        oniguruma \
        mysql-client \
    && apk add --no-cache --virtual .build-deps \
        icu-dev \
        libzip-dev \
        oniguruma-dev \
        $PHPIZE_DEPS \
    && docker-php-ext-install \
        bcmath \
        intl \
        mbstring \
        pdo_mysql \
        zip \
    && apk del .build-deps

COPY --from=composer-builder /app /var/www/html
COPY --from=frontend-builder /app/public/build /var/www/html/public/build

RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache

EXPOSE 9000
CMD ["php-fpm"]
