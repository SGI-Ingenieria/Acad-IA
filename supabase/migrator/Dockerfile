FROM debian:bookworm-slim

ARG SUPABASE_CLI_VERSION=2.98.2

ENV SUPABASE_TELEMETRY_DISABLED=1
ENV PGSSLMODE=disable
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    postgresql-client \
  && curl -fL \
    "https://github.com/supabase/cli/releases/download/v${SUPABASE_CLI_VERSION}/supabase_${SUPABASE_CLI_VERSION}_linux_amd64.deb" \
    -o /tmp/supabase.deb \
  && apt-get install -y /tmp/supabase.deb \
  && rm -rf /var/lib/apt/lists/* /tmp/supabase.deb

WORKDIR /workspace

CMD ["sh", "-lc", "supabase db push --db-url \"postgresql://postgres:${POSTGRES_PASSWORD}@db:${POSTGRES_PORT}/${POSTGRES_DB}?sslmode=disable\" --yes && psql \"postgresql://postgres:${POSTGRES_PASSWORD}@db:${POSTGRES_PORT}/${POSTGRES_DB}?sslmode=disable\" -v ON_ERROR_STOP=1 -f supabase/seed.stage.sql"]
