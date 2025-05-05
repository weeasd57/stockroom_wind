# Stockroom Trading Post Generator

A standalone tool for generating realistic trading posts with country-specific exchange data.

## Features

- Generates realistic trading posts with proper exchange symbols and country data
- Creates posts with sensible target and stop-loss prices based on trading strategy
- Supports filtering by specific countries
- Outputs to JSON files for easy import into Supabase

## Prerequisites

- Node.js installed
- Country data file (included in the `data` folder)

## Usage

### Using the PowerShell Script

```powershell
# Generate 20 posts for a user
.\generate.ps1 -UserId "your-user-id" -Count 20

# Generate 10 posts for a specific country
.\generate.ps1 -UserId "your-user-id" -Count 10 -Country "USA"
```

### Using the Batch File

```batch
# Generate 20 posts for a user
generate.bat your-user-id 20

# Generate 10 posts for a specific country
generate.bat your-user-id 10 USA
```

### Using Node.js Directly

```bash
# Generate 20 posts for a user
node generate.js --user your-user-id --count 20

# Generate 10 posts for a specific country
node generate.js --user your-user-id --count 10 --country USA

# Save to custom output file
node generate.js --user your-user-id --output my_posts.json

# Show help
node generate.js --help
```

## Importing Generated Posts

After generating posts, you can import them into your Supabase database:

1. Go to your Supabase dashboard → Table editor → "posts" table
2. Click "Import" button and select the generated JSON file
3. Ensure "Upsert" and "Import References" options are enabled
4. Complete the import

## Generated Post Fields

The generated posts will include the following fields:

- `user_id`: Assigned user ID
- `symbol`: Stock symbol with exchange (e.g., "AAPL:US")
- `company_name`: Generated company name
- `country`: Country name
- `exchange`: Exchange code
- `current_price`: Random price between $5-$300
- `initial_price`: Same as current price at creation
- `target_price`: Higher price based on strategy
- `stop_loss_price`: Lower price based on strategy
- `strategy`: Random trading strategy
- `description`: Generated description
- `content`: Same as description
- `created_at`: Random date within last 90 days
- `updated_at`: Current date
- Various status flags

## Customization

You can modify the following constants in the script:

- `STRATEGIES`: List of trading strategies
- `DESCRIPTION_TEMPLATES`: Templates for post descriptions
- `INDICATORS`: Technical indicators to mention in descriptions
- `COMPANY_NAME_TEMPLATES`: Templates for generating company names 