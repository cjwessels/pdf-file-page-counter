import React, { useState } from 'react';
import {
  FolderOpen,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  X,
  Search,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import { config, checkPathExists } from './config';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

interface PageCounts {
  WIDE: number;
  A3: number;
  A4: number;
}

interface FileInfo {
  name: string;
  pages: number;
  type: 'WIDE' | 'A3' | 'A4';
  createdAt: string;
  fileHandle: FileSystemFileHandle;
}

interface ProgressInfo {
  processed: number;
  total: number;
  currentBatch: number;
  totalBatches: number;
}

type SortField = 'name' | 'type' | 'pages' | 'createdAt';
type SortDirection = 'asc' | 'desc';

const BATCH_SIZE = Number(import.meta.env.VITE_BATCH_SIZE) || 3; // Use environment variable with fallback
function App() {
  const [pageCounts, setPageCounts] = useState<PageCounts>({
    WIDE: 0,
    A3: 0,
    A4: 0,
  });
  const [fileList, setFileList] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [currentPdfPage, setCurrentPdfPage] = useState(1);
  const [totalPdfPages, setTotalPdfPages] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [pdfDocument, setPdfDocument] =
    useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const filesPerPage = 10;

  const formatDate = (date: Date): string => {
    return date
      .toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
      .replace(/\//g, '-');
  };

  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const processPDFFile = async (
    fileHandle: FileSystemFileHandle,
    counts: PageCounts
  ): Promise<FileInfo | null> => {
    if (fileHandle.kind === 'file' && fileHandle.name.endsWith('.pdf')) {
      const fileName = fileHandle.name.toUpperCase();
      const file = await fileHandle.getFile();

      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let type: 'WIDE' | 'A3' | 'A4';

        if (fileName.includes('-WIDE')) {
          type = 'WIDE';
          counts.WIDE += pdf.numPages;
        } else if (fileName.includes('-A3')) {
          type = 'A3';
          counts.A3 += pdf.numPages;
        } else if (fileName.includes('-A4')) {
          type = 'A4';
          counts.A4 += pdf.numPages;
        } else {
          await pdf.destroy();
          return null;
        }

        const result: FileInfo = {
          name: fileHandle.name,
          pages: pdf.numPages,
          type,
          createdAt: formatDate(new Date(file.lastModified)),
          fileHandle,
        };

        await pdf.destroy(); // Clean up PDF document
        return result;
      } catch (error) {
        console.error(`Error processing file ${fileName}:`, error);
        return null;
      }
    }
    return null;
  };

  const processPDFBatch = async (
    pdfFiles: Array<FileSystemFileHandle>,
    counts: PageCounts,
    processedFiles: FileInfo[],
    currentBatch: number,
    totalBatches: number
  ) => {
    for (const fileHandle of pdfFiles) {
      const result = await processPDFFile(fileHandle, counts);
      if (result) {
        processedFiles.push(result);
        setFileList([...processedFiles]);
        setPageCounts({ ...counts });
      }

      // Small delay between files to prevent memory buildup
      await delay(100);
    }

    setProgress({
      processed: processedFiles.length,
      total: totalBatches * BATCH_SIZE,
      currentBatch,
      totalBatches,
    });

    // Force garbage collection if available
    if (typeof window.gc === 'function') {
      window.gc();
    }
  };

  const analysePDFs = async () => {
    try {
      setLoading(true);
      setProgress(null);

      let dirHandle: FileSystemDirectoryHandle;

      if (!config.useDocsPath) {
        dirHandle = await window.showDirectoryPicker();
      } else {
        dirHandle = await window.showDirectoryPicker();

        const pathAccessible = await checkPathExists(
          config.useBackupRepo ? config.backupPath : config.docsPath
        );

        if (!pathAccessible) {
          throw new Error(
            'Selected path is not accessible. Please check your network connection and try again.'
          );
        }
      }

      const counts: PageCounts = { WIDE: 0, A3: 0, A4: 0 };
      const processedFiles: FileInfo[] = [];

      // Collect all PDF files first
      const pdfFiles: FileSystemFileHandle[] = [];
      for await (const [_, handle] of dirHandle.entries()) {
        if (
          handle.kind === 'file' &&
          handle.name.toLowerCase().endsWith('.pdf')
        ) {
          pdfFiles.push(handle);
        }
      }

      const totalBatches = Math.ceil(pdfFiles.length / BATCH_SIZE);

      // Process files in smaller batches with delays between batches
      for (let i = 0; i < pdfFiles.length; i += BATCH_SIZE) {
        const batch = pdfFiles.slice(i, i + BATCH_SIZE);
        const currentBatch = Math.floor(i / BATCH_SIZE) + 1;

        await processPDFBatch(
          batch,
          counts,
          processedFiles,
          currentBatch,
          totalBatches
        );

        // Add delay between batches to allow memory cleanup
        await delay(200);
      }

      setCurrentPage(1);
    } catch (error) {
      console.error('Error analysing PDFs:', error);
      alert(
        'Error analysing PDFs: ' +
          (error instanceof Error ? error.message : 'Unknown error')
      );
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderPdfPage = async (pageNumber: number) => {
    if (!pdfDocument) return;

    try {
      const page = await pdfDocument.getPage(pageNumber);
      const canvas = document.getElementById('pdf-canvas') as HTMLCanvasElement;
      const context = canvas.getContext('2d');

      if (context) {
        const viewport = page.getViewport({ scale: 1.5 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;
      }
    } catch (error) {
      console.error('Error rendering PDF page:', error);
    }
  };

  const openPdfViewer = async (file: FileInfo) => {
    try {
      setSelectedFile(file);
      const fileData = await file.fileHandle.getFile();
      const url = URL.createObjectURL(fileData);
      setPdfUrl(url);

      // Initialize PDF.js and render first page
      const pdf = await pdfjsLib.getDocument(url).promise;
      setPdfDocument(pdf);
      setTotalPdfPages(pdf.numPages);
      setCurrentPdfPage(1);

      // Render the first page immediately
      await renderPdfPage(1);
    } catch (error) {
      console.error('Error opening PDF:', error);
      alert('Error opening PDF. Please check the console for details.');
    }
  };

  const closeModal = () => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }
    if (pdfDocument) {
      pdfDocument.destroy();
    }
    setSelectedFile(null);
    setPdfUrl(null);
    setPdfDocument(null);
    setCurrentPdfPage(1);
    setTotalPdfPages(0);
  };

  const changePage = async (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPdfPages) {
      setCurrentPdfPage(newPage);
      await renderPdfPage(newPage);
    }
  };

  React.useEffect(() => {
    if (pdfDocument && currentPdfPage) {
      renderPdfPage(currentPdfPage);
    }

    return () => {
      // Cleanup when component unmounts
      if (pdfDocument) {
        pdfDocument.destroy();
      }
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfDocument, currentPdfPage]);

  const filteredFiles = fileList.filter((file) => {
    const query = searchQuery.toLowerCase();
    return (
      file.name.toLowerCase().includes(query) ||
      file.type.toLowerCase().includes(query) ||
      file.pages.toString().includes(query) ||
      file.createdAt.toLowerCase().includes(query)
    );
  });

  const sortedFiles = [...filteredFiles].sort((a, b) => {
    const direction = sortDirection === 'asc' ? 1 : -1;

    switch (sortField) {
      case 'name':
        return a.name.localeCompare(b.name) * direction;
      case 'type':
        return a.type.localeCompare(b.type) * direction;
      case 'pages':
        return (a.pages - b.pages) * direction;
      case 'createdAt':
        return a.createdAt.localeCompare(b.createdAt) * direction;
      default:
        return 0;
    }
  });

  const totalPages = Math.ceil(sortedFiles.length / filesPerPage);
  const startIndex = (currentPage - 1) * filesPerPage;
  const visibleFiles = sortedFiles.slice(startIndex, startIndex + filesPerPage);

  const SortableHeader = ({
    field,
    label,
  }: {
    field: SortField;
    label: string;
  }) => (
    <button
      onClick={() => handleSort(field)}
      className='flex items-center gap-1 text-gray-700 hover:text-gray-900'
    >
      {label}
      <ArrowUpDown
        size={14}
        className={`
        transition-transform
        ${sortField === field && sortDirection === 'desc' ? 'rotate-180' : ''}
        ${sortField === field ? 'opacity-100' : 'opacity-50'}
      `}
      />
    </button>
  );

  const downloadExcel = () => {
    // Prepare data for the "Page Counter" sheet
    const pageCounterData = Object.entries(pageCounts).map(([type, count]) => ({
      Type: type,
      Pages: count,
    }));

    // Prepare data for the "Completed Files" sheet
    const completedFilesData = fileList.map((file) => ({
      Name: file.name,
      Type: file.type,
      Pages: file.pages,
      Created: file.createdAt,
    }));

    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    // Add "Page Counter" sheet
    const pageCounterSheet = XLSX.utils.json_to_sheet(pageCounterData);
    XLSX.utils.book_append_sheet(workbook, pageCounterSheet, 'Page Counter');

    // Add "Completed Files" sheet
    const completedFilesSheet = XLSX.utils.json_to_sheet(completedFilesData);
    XLSX.utils.book_append_sheet(
      workbook,
      completedFilesSheet,
      'Completed Files'
    );

    // Generate and download the Excel file
    XLSX.writeFile(workbook, 'PDF_Data.xlsx');
  };

  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4'>
      <div className='flex gap-4 max-w-6xl w-full'>
        {/* Summary Card */}
        <div className='bg-white rounded-xl shadow-lg p-8 w-96'>
          <div className='text-center mb-8'>
            <h1 className='text-2xl font-bold text-gray-800 mb-2'>
              PDF Page Counter
            </h1>
            <p className='text-gray-600'>
              Analyse PDF files in a folder and count pages by type
            </p>
          </div>

          <button
            onClick={analysePDFs}
            disabled={loading}
            className='w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg 
              flex items-center justify-center gap-2 transition-colors disabled:bg-indigo-400'
          >
            <FolderOpen size={20} />
            {loading ? 'Analysing...' : 'Select Folder'}
          </button>

          {/* Progress Bar */}
          {progress && (
            <div className='mt-4'>
              <div className='flex justify-between text-sm text-gray-600 mb-1'>
                <span>Processing files...</span>
                <span>
                  {progress.processed} / {progress.total} files
                </span>
              </div>
              <div className='w-full bg-gray-200 rounded-full h-2'>
                <div
                  className='bg-indigo-600 h-2 rounded-full transition-all duration-300'
                  style={{
                    width: `${(progress.processed / progress.total) * 100}%`,
                  }}
                />
              </div>
              <div className='text-xs text-gray-500 mt-1'>
                Batch {progress.currentBatch} of {progress.totalBatches}
              </div>
            </div>
          )}

          {/* Download Excel Button */}
          <button
            onClick={downloadExcel}
            disabled={fileList.length === 0 || loading}
            className='w-full mt-4 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg 
              flex items-center justify-center gap-2 transition-colors disabled:bg-green-400'
          >
            <FileSpreadsheet size={20} />
            Download Excel
          </button>

          <div className='mt-8'>
            <h2 className='text-lg font-semibold text-gray-800 mb-4'>
              Total Pages by Type
            </h2>
            <div className='space-y-4'>
              {Object.entries(pageCounts).map(([type, count]) => (
                <div
                  key={type}
                  className='bg-gray-50 p-4 rounded-lg flex items-center justify-between'
                >
                  <div className='flex items-center gap-3'>
                    <FileSpreadsheet className='text-indigo-600' size={20} />
                    <span className='font-medium text-gray-700'>{type}</span>
                  </div>
                  <span className='text-lg font-semibold text-gray-900'>
                    {count} pages
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* File List Card */}
        <div className='bg-white rounded-xl shadow-lg p-8 flex-1'>
          <div className='flex items-center justify-between mb-6'>
            <h2 className='text-lg font-semibold text-gray-800'>
              File Details
            </h2>
            <div className='relative'>
              <input
                type='text'
                placeholder='Search files...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
              />
              <Search
                className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400'
                size={18}
              />
            </div>
          </div>

          {fileList.length > 0 ? (
            <>
              {/* Table Header */}
              <div className='grid grid-cols-4 gap-4 mb-4 px-4 py-2 bg-gray-50 rounded-lg'>
                <SortableHeader field='name' label='File Name' />
                <SortableHeader field='type' label='Type' />
                <SortableHeader field='pages' label='Pages' />
                <SortableHeader field='createdAt' label='Created Date' />
              </div>

              {/* File List */}
              <div className='space-y-3'>
                {visibleFiles.map((file, index) => (
                  <div
                    key={index}
                    className='grid grid-cols-4 gap-4 px-4 py-3 bg-gray-50 rounded-lg items-center'
                  >
                    <div className='flex items-center gap-3 min-w-0'>
                      <FileSpreadsheet
                        className={`${
                          file.type === 'WIDE'
                            ? 'text-blue-600'
                            : file.type === 'A3'
                            ? 'text-green-600'
                            : 'text-purple-600'
                        } flex-shrink-0`}
                        size={20}
                      />
                      <button
                        onClick={() => openPdfViewer(file)}
                        className='font-medium text-gray-700 hover:text-indigo-600 truncate text-left'
                      >
                        {file.name}
                      </button>
                    </div>
                    <span className='text-gray-600'>{file.type}</span>
                    <span className='text-gray-900 font-semibold'>
                      {file.pages}
                    </span>
                    <span className='text-gray-600'>{file.createdAt}</span>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className='flex items-center justify-between mt-6 border-t pt-4'>
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className='flex items-center gap-1 text-gray-600 hover:text-gray-900 disabled:text-gray-400'
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>
                  <span className='text-sm text-gray-600'>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className='flex items-center gap-1 text-gray-600 hover:text-gray-900 disabled:text-gray-400'
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className='text-center text-gray-500 py-8'>
              No files analysed yet. Click "Select Folder" to begin.
            </div>
          )}
        </div>
      </div>

      {/* PDF Viewer Modal */}
      {selectedFile && pdfUrl && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'>
          <div className='bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col'>
            <div className='flex items-center justify-between p-4 border-b'>
              <h3 className='text-lg font-semibold text-gray-800 truncate'>
                {selectedFile.name}
              </h3>
              <button
                onClick={closeModal}
                className='text-gray-500 hover:text-gray-700'
              >
                <X size={20} />
              </button>
            </div>
            <div className='flex-1 overflow-auto p-4 flex flex-col items-center'>
              <canvas id='pdf-canvas' className='max-w-full' />
            </div>
            <div className='border-t p-4 flex items-center justify-center gap-4'>
              <button
                onClick={() => changePage(currentPdfPage - 1)}
                disabled={currentPdfPage <= 1}
                className='text-gray-600 hover:text-gray-900 disabled:text-gray-400'
              >
                <ChevronLeft size={20} />
              </button>
              <span className='text-sm text-gray-600'>
                Page {currentPdfPage} of {totalPdfPages}
              </span>
              <button
                onClick={() => changePage(currentPdfPage + 1)}
                disabled={currentPdfPage >= totalPdfPages}
                className='text-gray-600 hover:text-gray-900 disabled:text-gray-400'
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
