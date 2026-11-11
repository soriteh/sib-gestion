FROM nginx:stable-alpine

# Use a custom main configuration so all runtime writes stay in /tmp.
COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf

# SIB Gestion is a static HTML/CSS/JavaScript application.
COPY --chown=nginx:nginx . /usr/share/nginx/html

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
