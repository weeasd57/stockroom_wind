<#
.SYNOPSIS
    Generates trading posts with realistic data for the Stockroom app
.DESCRIPTION
    This script generates realistic trading posts using country-specific exchange data.
    It allows filtering by country and customizing the number of posts generated.
.PARAMETER UserId
    The Supabase user ID to assign posts to
.PARAMETER Count
    Number of posts to generate (default: 30)
.PARAMETER Country
    Optional country filter
.EXAMPLE
    .\generate.ps1 -UserId "abc123" -Count 20
.EXAMPLE
    .\generate.ps1 -UserId "abc123" -Count 10 -Country "USA"
#>

param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$UserId,
    
    [Parameter(Mandatory=$false, Position=1)]
    [int]$Count = 30,
    
    [Parameter(Mandatory=$false, Position=2)]
    [string]$Country = ""
)

Write-Host "====================================="
Write-Host "Stockroom Trading Post Generator Tool" -ForegroundColor Cyan
Write-Host "====================================="
Write-Host ""

Write-Host "Generating $Count posts for user $UserId..." -ForegroundColor Yellow
Write-Host ""

$params = @("generate.js", "--user", $UserId, "--count", $Count)

if ($Country -ne "") {
    Write-Host "Filtering by country: $Country" -ForegroundColor Yellow
    Write-Host ""
    $params += "--country"
    $params += $Country
}

# Run the generator script
node $params

Write-Host ""
Write-Host "=====================================" 
Write-Host "Press any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 