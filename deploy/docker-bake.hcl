variable "TAG" {
  default = "local"
}

group "default" {
  targets = ["functions", "migrator", "backup"]
}

target "functions" {
  context = "supabase/functions"
  dockerfile = "Dockerfile"
  tags = ["acad-ia-functions:${TAG}"]
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
