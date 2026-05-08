FROM alpine:3.20

ARG SUPABASE_CLI_VERSION=2.98.2

ENV SUPABASE_TELEMETRY_DISABLED=1
ENV PGSSLMODE=disable

RUN apk add --no-cache curl ca-certificates postgresql17-client \
  && curl -L \
    "https://github.com/supabase/cli/releases/download/v${SUPABASE_CLI_VERSION}/supabase_${SUPABASE_CLI_VERSION}_linux_amd64.apk" \
    -o /tmp/supabase.apk \
  && apk add --allow-untrusted /tmp/supabase.apk \
  && rm -f /tmp/supabase.apk

WORKDIR /workspace

CMD ["sh", "-lc", "supabase db push --db-url \"postgresql://postgres:${POSTGRES_PASSWORD}@db:${POSTGRES_PORT}/${POSTGRES_DB}?sslmode=disable\" --yes && psql \"postgresql://postgres:${POSTGRES_PASSWORD}@db:${POSTGRES_PORT}/${POSTGRES_DB}?sslmode=disable\" -v ON_ERROR_STOP=1 -f supabase/seed.stage.sql"]