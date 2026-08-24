FROM postgres:17-bookworm

ARG SUPABASE_CLI_VERSION=2.115.0

ENV SUPABASE_TELEMETRY_DISABLED=1
ENV PGSSLMODE=disable
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
  && curl -fL \
    "https://github.com/supabase/cli/releases/download/v${SUPABASE_CLI_VERSION}/supabase_${SUPABASE_CLI_VERSION}_linux_amd64.deb" \
    -o /tmp/supabase.deb \
  && apt-get install -y /tmp/supabase.deb \
  && rm -rf /var/lib/apt/lists/* /tmp/supabase.deb

WORKDIR /workspace

COPY supabase/config.toml supabase/config.toml
COPY supabase/migrations supabase/migrations
COPY supabase/seed.stage.sql supabase/seed.stage.sql
COPY supabase/migrator/run.sh /usr/local/bin/acad-ia-migrate

RUN chmod 0555 /usr/local/bin/acad-ia-migrate

CMD ["/usr/local/bin/acad-ia-migrate"]
