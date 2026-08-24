{{- define "acad-ia-backend.labels" -}}
app.kubernetes.io/part-of: acad-ia-backend
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | quote }}
{{- end }}

{{- define "acad-ia-backend.secretName" -}}
{{- required "global.secretName is required" .Values.global.secretName -}}
{{- end }}

{{- define "acad-ia-backend.storagePvcName" -}}
{{- printf "%s-storage-data" .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end }}
