$ErrorActionPreference = 'Stop'

function New-HexSecret([int]$bytes) {
  $buffer = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
  return -join ($buffer | ForEach-Object { $_.ToString('x2') })
}

Write-Output ("NEXTAUTH_SECRET={0}" -f (New-HexSecret 32))
Write-Output ("POSTGRES_PASSWORD={0}" -f (New-HexSecret 24))