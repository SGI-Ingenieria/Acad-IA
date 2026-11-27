# Console-only setup for Windows PowerShell 5.1 and PowerShell 7.
# Google SDK packages only; no database changes, AVD wipes, or system feature changes.
[CmdletBinding()]
param(
    [string]$SdkRoot,
    [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
if (-not $SdkRoot) { $SdkRoot = $env:ANDROID_HOME }
if (-not $SdkRoot) { $SdkRoot = $env:ANDROID_SDK_ROOT }
if (-not $SdkRoot) { $SdkRoot = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$SdkRoot = [IO.Path]::GetFullPath($SdkRoot)
$adb = Join-Path $SdkRoot 'platform-tools\adb.exe'
$emulator = Join-Path $SdkRoot 'emulator\emulator.exe'
$androidCli = Join-Path $SdkRoot 'cmdline-tools\latest\bin\android.exe'
$avdName = if ($env:ANDROID_AVD) { $env:ANDROID_AVD } else { 'Acad_IA_API_37_2' }
$imagePackage = 'system-images;android-37.2;google_apis_playstore_ps16k;x86_64'

Write-Host "Equipo: $env:COMPUTERNAME | Usuario: $env:USERNAME"
Write-Host "SDK de ESTA terminal: $SdkRoot"
if ($CheckOnly) {
    $paths = @($adb, $emulator, $androidCli)
    $paths | ForEach-Object { [pscustomobject]@{ Archivo = $_; Existe = (Test-Path -LiteralPath $_ -PathType Leaf) } } | Format-Table -AutoSize
    if (@($paths | Where-Object { -not (Test-Path -LiteralPath $_ -PathType Leaf) }).Count) { exit 1 }
    exit 0
}

# MSIX redirects AppData writes made by Codex into its private LocalCache.
# A normal terminal must copy those tools into its real SDK before it can use them.
# Only recover into a wholly absent target; never overwrite a user's existing SDK.
$codexSdk = Join-Path $env:LOCALAPPDATA 'Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Local\Android\Sdk'
if (-not (Test-Path -LiteralPath $SdkRoot) -and (Test-Path -LiteralPath (Join-Path $codexSdk 'platform-tools\adb.exe') -PathType Leaf)) {
    Write-Host 'Recuperando el SDK de la cache MSIX de Codex. Copiando varios GB sin volver a descargarlos...'
    New-Item -ItemType Directory -Path (Split-Path -Parent $SdkRoot) -Force | Out-Null
    Copy-Item -LiteralPath $codexSdk -Destination $SdkRoot -Recurse
}

$javaCandidates = @(
    $env:ANDROID_JAVA_HOME,
    (Join-Path $env:ProgramFiles 'Android\Android Studio\jbr'),
    $env:JAVA_HOME
)
$androidJdk = $javaCandidates | Where-Object { $_ -and (Test-Path -LiteralPath (Join-Path $_ 'bin\javac.exe') -PathType Leaf) } | Select-Object -First 1
if (-not $androidJdk) {
    throw 'Falta un JDK. Instala Android Studio con: winget install --exact --id Google.AndroidStudio --source winget. Despues repite bun run android:instalar.'
}
$env:JAVA_HOME = $androidJdk
$env:ANDROID_HOME = $SdkRoot
$env:ANDROID_SDK_ROOT = $SdkRoot

# Resolve the stable bootstrap from Google's live SDK metadata, not a stale download URL.
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
[xml]$repository = (Invoke-WebRequest -UseBasicParsing 'https://dl.google.com/android/repository/repository2-3.xml').Content
$package = $repository.SelectSingleNode('//*[local-name()="remotePackage" and @path="cmdline-tools;latest"]')
if (-not $package -or $package.channelRef.ref -ne 'channel-0') { throw 'Google no devolvio herramientas estables verificables.' }
$archive = $package.archives.archive | Where-Object { $_.'host-os' -eq 'windows' } | Select-Object -First 1
$archiveName = [string]$archive.complete.url
if ($archiveName -notmatch '^commandlinetools-win-[0-9]+_latest\.zip$') { throw 'Archivo de descarga inesperado.' }
$latestVersion = '{0}.{1}' -f $package.revision.major, $package.revision.minor
$properties = Join-Path $SdkRoot 'cmdline-tools\latest\source.properties'
$installedVersion = if (Test-Path -LiteralPath $properties) {
    Get-Content -LiteralPath $properties | Where-Object { $_ -match '^Pkg.Revision=' } | ForEach-Object { ($_ -split '=', 2)[1].Trim() }
}
$needsBootstrap = -not (Test-Path -LiteralPath $androidCli -PathType Leaf)
if ($installedVersion) { $needsBootstrap = $needsBootstrap -or ([version]$installedVersion -lt [version]$latestVersion) }
else { $needsBootstrap = $true }
$scratch = $null
try {
    if ($needsBootstrap) {
        $scratch = Join-Path ([IO.Path]::GetTempPath()) ('acadia-sdk-setup-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $scratch | Out-Null
        $zip = Join-Path $scratch 'tools.zip'
        Write-Host "Descargando herramientas estables $latestVersion de Google..."
        Invoke-WebRequest -UseBasicParsing "https://dl.google.com/android/repository/$archiveName" -OutFile $zip
        $algorithm = ([string]$archive.complete.checksum.type).ToUpperInvariant()
        if ($algorithm -notin @('SHA1', 'SHA256')) { throw 'Algoritmo de checksum no admitido.' }
        $expectedHash = ([string]$archive.complete.checksum.InnerText).Trim()
        if ((Get-FileHash -LiteralPath $zip -Algorithm $algorithm).Hash -ine $expectedHash) { throw 'La descarga no coincide con el checksum de Google.' }
        Expand-Archive -LiteralPath $zip -DestinationPath $scratch
        $androidCli = Join-Path $scratch 'cmdline-tools\bin\android.exe'
    }
    New-Item -ItemType Directory -Path $SdkRoot -Force | Out-Null
    Write-Host 'Instalando SDK, adb, emulador e imagen Android 17. La descarga puede ocupar varios GB.'
    Write-Host 'Lee las licencias que solicite la herramienta para continuar.'
    # CLI 23's Windows native SDK installer currently crashes with 0xc0000409.
    # Invoke Google's Java SDK manager INCLUDED IN THE SAME LATEST PACKAGE, not older tools.
    # Enumerating its bundled jars avoids relying on the removed sdkmanager-classpath.jar.
    $toolsDirectory = Split-Path -Parent (Split-Path -Parent $androidCli)
    $classpath = (Get-ChildItem -LiteralPath (Join-Path $toolsDirectory 'lib') -Filter '*.jar' -Recurse | ForEach-Object FullName) -join ';'
    $packages = @('cmdline-tools;latest', 'platform-tools', 'emulator', 'platforms;android-37.2', 'build-tools;37.0.0', $imagePackage)
    & (Join-Path $androidJdk 'bin\java.exe') "-Dcom.android.sdkmanager.toolsdir=$toolsDirectory" -classpath $classpath com.android.sdklib.tool.sdkmanager.SdkManagerCli "--sdk_root=$SdkRoot" '--channel=0' @packages
    if ($LASTEXITCODE -ne 0) { throw "SDK Manager termino con codigo $LASTEXITCODE." }
    foreach ($required in @($adb, $emulator, (Join-Path $SdkRoot 'cmdline-tools\latest\bin\android.exe'), (Join-Path $SdkRoot 'platforms\android-37.2\android.jar'), (Join-Path $SdkRoot 'build-tools\37.0.0\aapt2.exe'), (Join-Path $SdkRoot 'system-images\android-37.2\google_apis_playstore_ps16k\x86_64\system.img'))) {
        if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Instalacion incompleta: falta $required. Repite el comando y acepta las licencias necesarias." }
    }
    $avds = @(& $emulator -list-avds)
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar la lista de emuladores.' }
    if ($avds -notcontains $avdName) {
        $avdManager = Join-Path $SdkRoot 'cmdline-tools\latest\bin\avdmanager.bat'
        # android emulator is not yet supported on Windows; use the bundled Java AVD manager.
        # Never force or overwrite an existing AVD.
        'no' | & $avdManager create avd -n $avdName -k $imagePackage -d pixel_10
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el dispositivo virtual.' }
    }
    if (@(& $emulator -list-avds) -notcontains $avdName) { throw 'El dispositivo virtual no aparece despues de crearlo.' }
    [Environment]::SetEnvironmentVariable('ANDROID_HOME', $SdkRoot, 'User')
    [Environment]::SetEnvironmentVariable('ANDROID_SDK_ROOT', $SdkRoot, 'User')
    & $adb version
    if ($LASTEXITCODE -ne 0) { throw 'adb se instalo, pero no se puede ejecutar.' }
    Write-Host "Verificado en esta terminal: adb + emulator + $avdName. Ejecuta bun run android:preview."
}
finally {
    if ($scratch -and (Test-Path -LiteralPath $scratch)) {
        $resolvedScratch = (Resolve-Path -LiteralPath $scratch).Path
        $tempParent = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
        if ($resolvedScratch.StartsWith($tempParent, [StringComparison]::OrdinalIgnoreCase) -and (Split-Path -Leaf $resolvedScratch) -match '^acadia-sdk-setup-[a-f0-9]{32}$') {
            Remove-Item -LiteralPath $resolvedScratch -Recurse -Force
        }
    }
}
