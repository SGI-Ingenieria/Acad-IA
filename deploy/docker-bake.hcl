variable "TAG" {
  default = "local"
}

group "default" {
  targets = ["migrator", "backup"]
}

target "migrator" {
  context = "."
  dockerfile = "supabase/migrator/Dockerfile"
  tags = ["acad-ia-migrator:${TAG}"]
  labels = {
    "org.opencontainers.image.source" = "https://github.com/SGI-Ingenieria/Acad-IA"
    "org.opencontainers.image.description" = "Supabase migration runner for Acad-IA"
  }
}

target "backup" {
  context = "."
  dockerfile = "supabase/backup/Dockerfile"
  tags = ["acad-ia-backup:${TAG}"]
  labels = {
    "org.opencontainers.image.source" = "https://github.com/SGI-Ingenieria/Acad-IA"
    "org.opencontainers.image.description" = "Supabase backup runner for Acad-IA"
  }
}
