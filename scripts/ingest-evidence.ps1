param(
  [string]$Archive = 'C:\Users\iyert\Downloads\drive-download-20261010T222306Z-1-001.zip',
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

  $contextPayload = [ordered]@{ generatedAt = (Get-Date).ToUniversalTime().ToString('o'); manifest = $manifest; sales = $sales; studies = $studies }
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
  Write-Output "Wrote $($sales.Count) sales rows, $($studies.Count) study rows, and $($manifest.Count) source files to data\context.json"
} finally {
  $outer.Dispose()
}
