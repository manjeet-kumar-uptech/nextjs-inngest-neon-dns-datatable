# Vercel Blob Storage Setup Guide

## Required Steps to Enable File Uploads

### 1. Create Vercel Blob Store

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Navigate to **Storage** tab
4. Click **Create New** → **Blob**
5. Name your store (e.g., "csv-uploads")
6. Click **Create**

### 2. Get Environment Variables

After creating the blob store, Vercel will automatically add:
- `BLOB_READ_WRITE_TOKEN` - Your blob storage access token

### 3. Set Up Inngest (Optional but Recommended)

1. Go to [Inngest Dashboard](https://app.inngest.com/)
2. Create a new app
3. Get your keys from the dashboard

### 4. Set Up Local Environment

Create a `.env.local` file in your project root:

```env
# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token_here

# Database (for storing domains)
DATABASE_URL=your_database_url_here

# Inngest Configuration (for background CSV processing)
INNGEST_EVENT_KEY=your_inngest_event_key_here
INNGEST_SIGNING_KEY=your_inngest_signing_key_here
```

### 5. Pull Environment Variables

Install Vercel CLI and pull your environment variables:

```bash
npm i -g vercel
vercel env pull .env.local
```

### 6. Test the Upload

1. Start your development server: `npm run dev`
2. Go to `http://localhost:3000`
3. Upload a CSV file to test the functionality

## Current Implementation

The app is already configured with:
- ✅ Multipart chunked upload (5MB chunks)
- ✅ Vercel Blob storage integration
- ✅ Progress tracking
- ✅ Error handling
- ✅ File validation (CSV only)
- ✅ Inngest background processing
- ✅ CSV parsing and analysis

## API Endpoints

- `POST /api/upload/initiate` - Initialize multipart upload
- `POST /api/upload/chunk` - Upload individual chunks
- `POST /api/upload/complete` - Complete upload and save to Vercel Blob
- `GET/POST /api/inngest` - Inngest webhook endpoint for function serving
- `PUT /api/inngest` - Manual trigger for CSV processing

## Inngest Functions

- `parseCsv` - Processes uploaded CSV files with steps:
  1. Download and validate CSV from Vercel Blob
  2. Parse CSV headers and identify domain columns
  3. Process CSV data in chunks of 10 rows, ignoring empty rows
  4. Extract and normalize domains using DNS utilities
  5. Run DNS lookups (MX, SPF, DMARC) in parallel using Promise.all
  6. Store domain data in database with all DNS information

## Troubleshooting

### Common Issues:

1. **"Missing required fields" error**
   - Ensure `BLOB_READ_WRITE_TOKEN` is set in `.env.local`

2. **Upload fails silently**
   - Check browser console for errors
   - Verify blob store is created in Vercel dashboard

3. **Files not appearing in Vercel Blob**
   - Check the blob store in Vercel dashboard
   - Verify the upload completed successfully

### Testing:

1. Check upload progress in the UI
2. Look for "File uploaded successfully" message
3. Click "View file" link to verify blob URL works
4. Check Vercel dashboard → Storage → Your blob store
