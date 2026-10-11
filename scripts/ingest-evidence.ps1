param(
  [string]$Archive = 'C:\Users\iyert\Downloads\drive-download-20261010T222306Z-1-001.zip',
  [string]$CompetitorWorkbook = 'C:\Users\iyert\Downloads\competitor_bmw_format.xlsx',
  [string]$Output = 'data\evidence.json'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-CellValue($cell, $shared) {
  if ($cell.t -eq 'inlineStr') {
    if ($cell.is.t) { return [string]$cell.is.t }
    return (($cell.is.r | ForEach-Object { [string]$_.t }) -join '')
  }
  $value = [string]$cell.v
  if ($cell.t -eq 's' -and $value -match '^\d+$') { return $shared[[int]$value] }
  return $value
}

function Read-XlsxSheet($bytes, $sheetPath = 'xl/worksheets/sheet1.xml') {
  $stream = New-Object IO.MemoryStream -ArgumentList (, $bytes)
  $book = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Read, $false)
  try {
    $shared = @()
    $sharedEntry = $book.GetEntry('xl/sharedStrings.xml')
    if ($sharedEntry) {
      $reader = [IO.StreamReader]::new($sharedEntry.Open())
      [xml]$sharedXml = $reader.ReadToEnd()
      $reader.Dispose()
      foreach ($item in $sharedXml.sst.si) {
        if ($item.t) { $shared += [string]$item.t }
        else { $shared += (($item.r | ForEach-Object { [string]$_.t }) -join '') }
      }
    }
    $entry = $book.GetEntry($sheetPath)
    $reader = [IO.StreamReader]::new($entry.Open())
    [xml]$xml = $reader.ReadToEnd()
    $reader.Dispose()
    return @($xml.worksheet.sheetData.row | ForEach-Object {
      $values = @{}
      foreach ($cell in $_.c) {
        $column = ([regex]::Match([string]$cell.r, '^[A-Z]+')).Value
        $values[$column] = Get-CellValue $cell $shared
      }
      [pscustomobject]@{ Row = [int]$_.r; Values = $values }
    })
  } finally {
    $book.Dispose()
    $stream.Dispose()
  }
}

function Get-CompetitorFeature([string]$group, [string]$text) {
  $signal = "$group $text"
  if ($signal -match 'remote smart parking|surround.?view|parking|camera monitor') { return 'Parking assistance' }
  if ($signal -match 'digital key') { return 'Digital Key' }
  if ($signal -match 'head.?up display') { return 'Head-up display' }
  if ($signal -match 'carplay|android auto|smartphone|connectivity|connected') { return 'Smartphone integration / connectivity' }
  if ($signal -match 'infotainment|touchscreen|central screen|instrument cluster|display|interface') { return 'Operating system / infotainment' }
  if ($signal -match 'audio|speaker|sound system') { return 'Audio system' }
  if ($signal -match 'interior satisfaction|interior quality|interior styling') { return 'Interior design' }
  if ($signal -match 'seat|lumbar') { return 'Seating comfort' }
  if ($signal -match 'climate|heating|ventilat|air conditioning') { return 'Cabin climate' }
  if ($signal -match 'sunroof|panoramic roof') { return 'Panoramic roof' }
  if ($signal -match 'wheel|tire') { return 'Wheels / Tires' }
  if ($signal -match 'headlight|taillight|exterior lighting') { return 'Exterior lighting' }
  if ($signal -match 'brake') { return 'Braking' }
  if ($signal -match 'steer|suspension|handling|ride comfort') { return 'Steering and handling' }
  if ($signal -match 'driver assistance|assistance.?alert|collision|lane|cruise|traffic sign|speed limit') { return 'Driver assistance' }
  if ($signal -match 'electric|battery|charging|range') { return 'Electric range and charging' }
  if ($signal -match 'acceleration|drivetrain|transmission|engine|horsepower|powertrain') { return 'Powertrain performance' }
  if ($signal -match 'trunk|cargo|luggage') { return 'Cargo access' }
  if ($signal -match 'warranty|ownership') { return 'Ownership support' }
  return ''
}

if (-not (Test-Path -LiteralPath $Archive)) { throw "Archive not found: $Archive" }
$outer = [IO.Compression.ZipFile]::OpenRead($Archive)
try {
  $records = [Collections.Generic.List[object]]::new()
  foreach ($fileName in @('F70_feedback_hackathon.xlsx', 'G60_feedback_hackathon.xlsx', 'G70_feedback_hackathon.xlsx')) {
    $entry = $outer.Entries | Where-Object { $_.Name -eq $fileName }
    $memory = [IO.MemoryStream]::new()
    $source = $entry.Open(); $source.CopyTo($memory); $source.Dispose()
    $rows = Read-XlsxSheet $memory.ToArray()
    $memory.Dispose()
    foreach ($row in $rows | Select-Object -Skip 1) {
      $v = $row.Values
      if (-not $v['A'] -or -not $v['I']) { continue }
      $text = [string]$v['I']
      $generic = $text.Trim().Length -lt 35 -or $text -match '^(really )?(love|great|good|nice) (this|the) car[.! ]*$'
      $records.Add([ordered]@{
        evidenceId = "$($v['F'])-feedback-row-$($row.Row)"
        feedbackId = [string]$v['A']
        sourceFile = $fileName
        sourceType = 'customer_feedback'
        sheet = 'Feedback_Explorer'
        row = $row.Row
        vehicle = [string]$v['F']
        market = [string]$v['E']
        engineType = [string]$v['G']
        feedbackType = [string]$v['H']
        text = $text
        feature = [string]$v['K']
        detail = [string]$v['L']
        quality = $(if ($generic -or $v['K'] -eq 'no_class_found') { 'low' } elseif ($v['H'] -match 'Wants|Difficult|Dislike') { 'high' } else { 'medium' })
      })
    }
  }

  $sourceDirectory = Join-Path (Get-Location) 'data\sources'
  New-Item -ItemType Directory -Force -Path $sourceDirectory | Out-Null
  $manifest = [Collections.Generic.List[object]]::new()
  foreach ($entry in $outer.Entries) {
    $memory = [IO.MemoryStream]::new(); $source = $entry.Open(); $source.CopyTo($memory); $source.Dispose(); $bytes = $memory.ToArray(); $memory.Dispose()
    [IO.File]::WriteAllBytes((Join-Path $sourceDirectory $entry.Name), $bytes)
    $pageCount = $null
    if ($entry.Name -like '*.PDF') {
      $pdfText = [Text.Encoding]::GetEncoding(28591).GetString($bytes)
      $pageCount = ([regex]::Matches($pdfText, '/Type\s*/Page\b')).Count
    }
    $manifest.Add([ordered]@{ file = $entry.Name; bytes = $entry.Length; kind = [IO.Path]::GetExtension($entry.Name).TrimStart('.').ToLower(); pageCount = $pageCount; available = $true })
  }

  $competitors = [Collections.Generic.List[object]]::new()
  $competitorPrices = [Collections.Generic.List[object]]::new()
  if (Test-Path -LiteralPath $CompetitorWorkbook) {
    $competitorFile = [IO.Path]::GetFileName($CompetitorWorkbook)
    $competitorBytes = [IO.File]::ReadAllBytes($CompetitorWorkbook)
    [IO.File]::WriteAllBytes((Join-Path $sourceDirectory $competitorFile), $competitorBytes)
    $manifest.Add([ordered]@{ file = $competitorFile; bytes = $competitorBytes.Length; kind = 'xlsx'; pageCount = $null; available = $true })

    foreach ($row in (Read-XlsxSheet $competitorBytes 'xl/worksheets/sheet2.xml') | Select-Object -Skip 1) {
      $v = $row.Values
      if (-not $v['A'] -or -not $v['I']) { continue }
      $feature = Get-CompetitorFeature ([string]$v['K']) "$($v['S']) $($v['I'])"
      $competitors.Add([ordered]@{
        evidenceId = "competitor-feedback-$($v['A'])"; sourceFile = $competitorFile; sourceType = 'competitor_feedback'; sheet = 'Feedback_Explorer'; row = $row.Row
        vehicle = 'G60'; market = [string]$v['E']; feature = $feature; brand = [string]$v['C']; model = [string]$v['D']; modelYear = [string]$v['M']
        rationale = "$($v['C']) $($v['D']) feedback reports: $($v['I'])"; sourceUrl = [string]$v['P']; sourceLocator = [string]$v['Q']
        classificationBasis = $(if ($feature) { 'Deterministic keyword mapping from the supplied feedback text and source classification.' } else { 'Unclassified; retained for provenance but excluded from requirement generation.' })
      })
    }

    foreach ($row in (Read-XlsxSheet $competitorBytes 'xl/worksheets/sheet4.xml') | Select-Object -Skip 1) {
      $v = $row.Values
      if (-not $v['A'] -or -not $v['I']) { continue }
      $feature = Get-CompetitorFeature ([string]$v['G']) ([string]$v['I'])
      if (-not $feature) { continue }
      $competitors.Add([ordered]@{
        evidenceId = "competitor-option-$($v['A'])"; sourceFile = $competitorFile; sourceType = 'competitor_equipment'; sheet = 'Option_List'; row = $row.Row
        vehicle = 'G60'; market = [string]$v['F']; feature = $feature; brand = [string]$v['B']; model = [string]$v['C']; modelYear = [string]$v['D']; trim = [string]$v['E']
        rationale = "$($v['B']) $($v['C']) $($v['E']) lists $($v['I']) as $($v['J']). $($v['O'])"; sourceUrl = [string]$v['P']; sourceLocator = [string]$v['Q']
        classificationBasis = 'Deterministic mapping from the workbook equipment group and description.'
      })
    }

    foreach ($row in (Read-XlsxSheet $competitorBytes 'xl/worksheets/sheet5.xml') | Select-Object -Skip 1) {
      $v = $row.Values
      if (-not $v['A']) { continue }
      $competitorPrices.Add([ordered]@{
        evidenceId = "competitor-price-$($v['A'])"; sourceFile = $competitorFile; sourceType = 'competitor_price'; sheet = 'Vehicle_Prices'; row = $row.Row
        vehicle = 'G60'; market = [string]$v['F']; brand = [string]$v['B']; model = [string]$v['C']; modelYear = [string]$v['D']; trim = [string]$v['E']
        basePrice = [string]$v['G']; configuredPrice = [string]$v['H']; currency = [string]$v['I']; priceBasis = [string]$v['J']; notes = [string]$v['K']; sourceUrl = [string]$v['L']
      })
    }

    foreach ($row in (Read-XlsxSheet $competitorBytes 'xl/worksheets/sheet8.xml') | Select-Object -Skip 1) {
      $v = $row.Values
      if (-not $v['A'] -or -not $v['D']) { continue }
      $feature = Get-CompetitorFeature '' ([string]$v['D'])
      if (-not $feature) { continue }
      $competitors.Add([ordered]@{
        evidenceId = "industry-study-$($v['A'])"; sourceFile = $competitorFile; sourceType = 'industry_study'; sheet = 'Industry_Study_Context'; row = $row.Row
        vehicle = 'G60'; market = 'US'; feature = $feature; brand = 'Industry aggregate'; model = ''; modelYear = [string]$v['C']
        rationale = "$($v['D']): $($v['E']) $($v['F']). $($v['J'])"; sourceUrl = [string]$v['K']; sourceLocator = "Study-wide sample: $($v['G']); denominator: $($v['I'])"
        classificationBasis = 'Deterministic mapping from the supplied industry study item.'
      })
    }
  }

  $sales = [Collections.Generic.List[object]]::new()
  $salesEntry = $outer.Entries | Where-Object { $_.Name -eq 'sales_volumes.xlsx' }
  $memory = [IO.MemoryStream]::new(); $source = $salesEntry.Open(); $source.CopyTo($memory); $source.Dispose(); $salesBytes = $memory.ToArray(); $memory.Dispose()
  $salesSheets = @(@('F70','xl/worksheets/sheet1.xml'), @('G60_G68','xl/worksheets/sheet2.xml'), @('G70','xl/worksheets/sheet3.xml'))
  foreach ($definition in $salesSheets) {
    foreach ($row in (Read-XlsxSheet $salesBytes $definition[1]) | Select-Object -Skip 1) {
      $v = $row.Values
      if (-not $v['A']) { continue }
      $sales.Add([ordered]@{ evidenceId = "sales-$($definition[0])-row-$($row.Row)"; sourceFile = 'sales_volumes.xlsx'; sourceType = 'sales_volume'; sheet = $definition[0]; row = $row.Row; vehicle = $definition[0]; market = [string]$v['B']; marketName = [string]$v['A']; volume2024 = [int]$v['C']; volume2025 = [int]$v['D']; volume2030 = [int]$v['E'] })
    }
  }

  $studies = [Collections.Generic.List[object]]::new()
  $studyEntry = $outer.Entries | Where-Object { $_.Name -eq 'F70_G60_G68_G70_customer_studies.xlsx' }
  $memory = [IO.MemoryStream]::new(); $source = $studyEntry.Open(); $source.CopyTo($memory); $source.Dispose(); $studyBytes = $memory.ToArray(); $memory.Dispose()
  $studySheets = @(@('CN_EU_2025','xl/worksheets/sheet1.xml'), @('US_2025','xl/worksheets/sheet2.xml'))
  foreach ($definition in $studySheets) {
    foreach ($row in Read-XlsxSheet $studyBytes $definition[1]) {
      $values = [ordered]@{}
      foreach ($key in $row.Values.Keys | Sort-Object) { if ([string]$row.Values[$key]) { $values[$key] = [string]$row.Values[$key] } }
      if ($values.Count -eq 0) { continue }
      $studies.Add([ordered]@{ evidenceId = "study-$($definition[0])-row-$($row.Row)"; sourceFile = 'F70_G60_G68_G70_customer_studies.xlsx'; sourceType = 'customer_study'; sheet = $definition[0]; row = $row.Row; cells = $values })
    }
  }

  $contextPayload = [ordered]@{ generatedAt = (Get-Date).ToUniversalTime().ToString('o'); manifest = $manifest; sales = $sales; studies = $studies; competitors = $competitors; competitorPrices = $competitorPrices }
  $payload = [ordered]@{
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    archive = [IO.Path]::GetFileName($Archive)
    provenance = 'Generated directly from the supplied XLSX files; row locators are preserved.'
    records = $records
  }
  $parent = Split-Path -Parent $Output
  if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
  $json = $payload | ConvertTo-Json -Depth 6 -Compress
  $encoding = New-Object Text.UTF8Encoding($false)
  [IO.File]::WriteAllText((Join-Path (Get-Location) $Output), $json, $encoding)
  [IO.File]::WriteAllText((Join-Path (Get-Location) 'data\context.json'), ($contextPayload | ConvertTo-Json -Depth 8 -Compress), $encoding)
  Write-Output "Wrote $($records.Count) evidence records to $Output"
  Write-Output "Wrote $($sales.Count) sales rows, $($studies.Count) study rows, $($competitors.Count) competitor signals, $($competitorPrices.Count) competitor prices, and $($manifest.Count) source files to data\context.json"
} finally {
  $outer.Dispose()
}
