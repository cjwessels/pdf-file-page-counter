# PDF Page Counter

A modern web application built with React and TypeScript for analyzing and managing PDF files. This application helps users count pages in PDF files based on their types (WIDE, A3, A4) and provides an interactive interface for viewing and managing PDF documents.

## Features

- 📁 Bulk PDF file analysis
- 📊 Page counting by document type (WIDE, A3, A4)
- 🔍 PDF preview functionality
- 📑 Pagination for large file lists
- 🔎 Real-time search functionality
- 📈 Excel export of analysis results
- 🎯 Memory-optimized batch processing
- 💾 Network path support for enterprise environments

## Technology Stack

- React 18
- TypeScript
- Vite
- PDF.js
- XLSX
- Tailwind CSS
- Lucide React Icons

## Environment Variables

The application uses the following environment variables:

```env
VITE_DOCS_PATH=\\devops\BulkScan\DocItIn
VITE_BACKUP_PATH=\\devops\BulkScan\ScanBackupRepo
BATCH_SIZE=2
```

## Configuration

The application can be configured through the `config.ts` file with the following options:

- `useDocsPath`: Enable/disable using the predefined documents path
- `useBackupRepo`: Enable/disable using the backup repository
- `canDelete`: Enable/disable file deletion functionality
- `docsPath`: Default path for document storage
- `backupPath`: Default path for backup storage

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `src` directory with the required environment variables
4. Start the development server:
   ```bash
   npm run dev
   ```

## Usage

### Analyzing PDFs

1. Click the "Select Folder" button
2. Choose a directory containing PDF files
3. The application will analyze the PDFs in batches to optimize memory usage
4. View the results in the file list and summary sections

### Viewing PDFs

- Click on any file name in the list to open the PDF viewer
- Use the navigation buttons to move between pages
- Close the viewer using the X button in the top right

### Exporting Data

Click the "Download Excel" button to export:
- Page counts by document type
- Complete file list with details

### Searching and Sorting

- Use the search bar to filter files by name, type, pages, or date
- Click column headers to sort the file list
- Sort direction toggles between ascending and descending

## Memory Optimization

The application implements several memory optimization strategies:

1. Batch Processing
   - Files are processed in small batches
   - Configurable batch size through environment variables
   - Delays between batches for memory cleanup

2. Resource Management
   - Automatic PDF document cleanup
   - URL object revocation
   - Garbage collection hints

3. Progressive Loading
   - Pagination of file lists
   - On-demand PDF page rendering

## Browser Compatibility

The application requires modern browser features:
- File System Access API
- Canvas API
- ES2020+ JavaScript features

## Development

### Building for Production

```bash
npm run build
```

### Linting

```bash
npm run lint
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
├── src/
│   ├── App.tsx           # Main application component
│   ├── config.ts         # Application configuration
│   ├── main.tsx         # Application entry point
│   └── .env             # Environment variables
├── public/              # Static assets
└── package.json         # Project dependencies and scripts
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
