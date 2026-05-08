FROM node:22-alpine

ENV SUPABASE_TELEMETRY_DISABLED=1
ENV PGSSLMODE=disable
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_AUDIT=false

RUN apk add --no-cache postgresql17-client \
  && mkdir -p /opt/supabase-cli \
  && cd /opt/supabase-cli \
  && npm init -y \
  && npm install supabase@latest --save-dev \
  && npm cache clean --force

ENV PATH="/opt/supabase-cli/node_modules/.bin:${PATH}"

WORKDIR /workspace

CMD ["sh", "-lc", "supabase db push --db-url \"postgresql://postgres:${POSTGRES_PASSWORD}@db:${POSTGRES_PORT}/${POSTGRES_DB}?sslmode=disable\" --yes && psql \"postgresql://postgres:${POSTGRES_PASSWORD}@db:${POSTGRES_PORT}/${POSTGRES_DB}?sslmode=disable\" -v ON_ERROR_STOP=1 -f supabase/seed.stage.sql"]