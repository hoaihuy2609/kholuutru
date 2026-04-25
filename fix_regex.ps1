$file = "components\VoiceGrader.tsx"
$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
$bad  = "/s" + [char]0x1ed1 + "\s*(\d{2,})[,.]( \d+)/gi"
$good = "/s" + [char]0x1ed1 + "\s*(\d{2,})[,.](\d+)/gi"
if ($content.Contains($bad)) {
    $fixed = $content.Replace($bad, $good)
    [System.IO.File]::WriteAllText($file, $fixed, [System.Text.Encoding]::UTF8)
    Write-Host "FIXED: removed stray space from regex"
} else {
    Write-Host "Pattern not found - checking raw bytes..."
    $idx = $content.IndexOf("( \d+)/gi")
    Write-Host "Index of '( \d+)/gi': $idx"
    $idx2 = $content.IndexOf("(\d+)/gi")
    Write-Host "Index of '(\d+)/gi': $idx2"
}
