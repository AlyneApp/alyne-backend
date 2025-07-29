# Mariana Iframe Scraper

A simple Browserless.io scraper for extracting class schedules from Mariana iframe-based URLs.

## Setup

1. Get a Browserless.io token from https://browserless.io
2. Add to your environment variables:
   ```
   BROWSERLESS_TOKEN=your_token_here
   ```

## Usage

### API Endpoint
```
POST /api/scrape-mariana
```

### Request Body
```json
{
  "websiteUrl": "https://slt.marianaiframes.com/iframe/schedule/daily/48541",
  "date": "2025-01-29",
  "studioAddress": "Flatiron"
}
```

### Response
```json
{
  "success": true,
  "data": [
    {
      "id": "class-0-1234567890",
      "name": "SLT Megaformer",
      "instructor": "Sarah Johnson",
      "time": "9:00 AM",
      "date": "2025-01-29",
      "source": "marianaiframes"
    }
  ],
  "count": 1
}
```

## Test

Run the test script:
```bash
node test-mariana.js
```

## Features

- ✅ Extracts class name, instructor, and time
- ✅ Handles date selection
- ✅ Filters by studio address
- ✅ Converts to 50-minute duration
- ✅ Deployable on Vercel
- ✅ Simple error handling 