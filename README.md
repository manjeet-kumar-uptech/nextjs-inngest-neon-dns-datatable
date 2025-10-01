# Next.js CSV Upload with Inngest & Vercel Blob

A modern Next.js application featuring CSV file upload with chunked multipart upload to Vercel Blob storage, integrated with Inngest for background processing.

## Features

- 🎯 **Drag & Drop CSV Upload**: Beautiful dropzone interface using shadcn/ui
- 📦 **Chunked Multipart Upload**: Files are uploaded in 5MB chunks for optimal performance
- ☁️ **Vercel Blob Storage**: Secure cloud storage integration
- 🔄 **Background Processing**: Inngest integration for async file processing
- 📊 **Real-time Progress**: Live upload progress tracking
- 🎨 **Modern UI**: Built with shadcn/ui components and Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm, yarn, or pnpm
- Vercel account (for Blob storage)
- Inngest account (for background processing)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd nextjs-inngest-neon-dns-datatable
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your actual values:
```env
# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token_here

# Inngest Configuration  
INNGEST_EVENT_KEY=your_inngest_event_key_here
INNGEST_SIGNING_KEY=your_inngest_signing_key_here
```

### Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Architecture

### Upload Flow

1. **File Selection**: User drags/drops CSV files onto the dropzone
2. **Chunking**: Files are split into 5MB chunks on the client
3. **Initiate Upload**: Server creates a unique upload session
4. **Parallel Upload**: Chunks are uploaded concurrently (max 3 at a time)
5. **Reassembly**: Server combines chunks into complete file
6. **Blob Storage**: File is uploaded to Vercel Blob storage
7. **Background Processing**: Inngest event is triggered for CSV processing

### API Endpoints

- `POST /api/upload/initiate` - Initialize multipart upload
- `POST /api/upload/chunk` - Upload individual chunks  
- `POST /api/upload/complete` - Complete upload and save to Blob storage

## Technologies Used

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Modern React component library
- **Vercel Blob** - Cloud storage for uploaded files
- **Inngest** - Background job processing
- **react-dropzone** - File drop functionality

## Development

### Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/upload/        # Upload API endpoints
│   ├── globals.css        # Global styles with shadcn variables
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main page with dropzone
├── components/
│   ├── ui/                # shadcn/ui components
│   └── csv-dropzone.tsx   # Main upload component
├── inngest/
│   └── client.ts          # Inngest configuration
└── lib/
    └── utils.ts           # Utility functions
```

### Key Components

- **CsvDropzone**: Main upload component with progress tracking
- **Upload API**: Handles multipart upload to Vercel Blob
- **Inngest Client**: Configured for background processing

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Environment Variables for Production

- `BLOB_READ_WRITE_TOKEN`: Your Vercel Blob storage token
- `INNGEST_EVENT_KEY`: Your Inngest event key  
- `INNGEST_SIGNING_KEY`: Your Inngest signing key

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
