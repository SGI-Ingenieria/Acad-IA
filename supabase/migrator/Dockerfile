FROM node:22-alpine

ENV SUPABASE_TELEMETRY_DISABLED=1
ENV PGSSLMODE=disable

RUN apk add --no-cache postgresql17-client \
  && npm install -g supabase@latest \
  && npm cache clean --force

WORKDIR /workspace

CMD ["sh", "-lc", "supabase db push --db-url \"postgresql://postgres:${POSTGRES_PASSWORD}@db:${POSTGRES_PORT}/${POSTGRES_DB}?sslmode=disable\" --yes && psql \"postgresql://postgres:${POSTGRES_PASSWORD}@db:${POSTGRES_PORT}/${POSTGRES_DB}?sslmode=disable\" -v ON_ERROR_STOP=1 -f supabase/seed.stage.sql"]