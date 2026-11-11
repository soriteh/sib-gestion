# SIB Gestion — image de production (site web statique)
FROM nginx:1.28-alpine

# Configuration Nginx non privilégiée et fichiers publics de l'application.
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY . /usr/share/nginx/html

RUN printf 'ok\\n' > /usr/share/nginx/html/healthz \
    && chown -R 101:101 /usr/share/nginx/html

USER 101:101
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

