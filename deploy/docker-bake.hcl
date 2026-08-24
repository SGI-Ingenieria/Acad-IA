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
}

target "backup" {
  context = "."
  dockerfile = "supabase/backup/Dockerfile"
  tags = ["acad-ia-backup:${TAG}"]
}
