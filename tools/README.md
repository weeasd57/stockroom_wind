# Stockroom App Tools

This directory contains standalone tools for the Stockroom app.

## Post Generator

A tool for generating realistic trading posts with country-specific exchange data.

### Installation

```bash
cd post-generator
npm install
```

### Usage

There are several ways to use the post generator:

#### Using PowerShell

```powershell
.\generate.ps1 -UserId "your-user-id" -Count 20 -Country "USA"
```

#### Using Batch File

```batch
generate.bat your-user-id 20 USA
```

#### Using Node.js Directly

```bash
node generate.js --user your-user-id --count 20 --country USA
```

For more details, see the [Post Generator README](post-generator/README.md). 