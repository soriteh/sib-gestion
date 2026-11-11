FROM nginx:stable-alpine

# Nginx configuration for the static single-page application.
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf

# SIB Gestion is a static HTML/CSS/JavaScript application.
COPY --chown=nginx:nginx . /usr/share/nginx/html

# Run unprivileged; Nginx listens on 8080 inside the container.
USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
