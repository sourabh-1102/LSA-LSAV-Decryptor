import express from 'express';
import cors from 'cors';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import archiver from 'archiver';
import { FileRecord, SseMessage, FileStatus, ProcessingSummary } from '../../shared/types.js';
import { FileProcessingQueue } from './queue.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Paths relative to server workspace root to handle dev (src) and prod (dist) identically
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const OUTPUTS_DIR = path.resolve(process.cwd(), 'outputs');

// Make sure folders exist
await fs.mkdir(UPLOADS_DIR, { recursive: true });
await fs.mkdir(OUTPUTS_DIR, { recursive: true });

// Configure strict CORS origin limits to prevent third-party website hijacking
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
if (process.env.ALLOWED_ORIGIN) {
  allowedOrigins.push(process.env.ALLOWED_ORIGIN);
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or local testing)
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.some(allowed => origin === allowed || origin.startsWith(allowed + '/'));
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('CORS Policy: Request from this origin is blocked.'));
    }
  },
  credentials: true
}));
app.use(express.json());

// In-Memory Storage for Session States
interface SessionData {
  files: FileRecord[];
  queue: FileProcessingQueue | null;
  startTime: number | null;
  elapsedTime: number; // cached elapsed time
  sseClients: express.Response[];
}

const sessions = new Map<string, SessionData>();

// Helper to get or init a session
function getOrCreateSession(sessionId: string): SessionData {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      files: [],
      queue: null,
      startTime: null,
      elapsedTime: 0,
      sseClients: [],
    });
  }
  return sessions.get(sessionId)!;
}

// Helper to broadcast SSE message
function broadcast(sessionId: string, message: SseMessage) {
  const session = sessions.get(sessionId);
  if (!session || session.sseClients.length === 0) return;

  const data = `data: ${JSON.stringify(message)}\n\n`;
  session.sseClients.forEach((client) => client.write(data));
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const sessionId = req.headers['x-session-id'] as string || 'default';
    const sessionUploadDir = path.join(UPLOADS_DIR, sessionId);
    await fs.mkdir(sessionUploadDir, { recursive: true });
    cb(null, sessionUploadDir);
  },
  filename: (req, file, cb) => {
    const fileId = req.headers['x-file-id'] as string || Date.now().toString();
    cb(null, `${fileId}_${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // Limit size on individual file (2GB)
  },
});

// Calculate Estimated Remaining Time
function calculateSummary(files: FileRecord[], startTime: number | null, cachedElapsed: number): ProcessingSummary {
  const totalFiles = files.length;
  const processed = files.filter(f => f.status === 'Completed').length;
  const failed = files.filter(f => f.status === 'Failed').length;
  const skipped = files.filter(f => f.status === 'Skipped').length;
  const doneCount = processed + failed + skipped;
  const remaining = totalFiles - doneCount;

  let elapsedTime = cachedElapsed;
  if (startTime !== null && remaining > 0 && totalFiles > remaining) {
    elapsedTime = Date.now() - startTime;
  }

  let estimatedRemainingTime = 0;
  if (doneCount > 0 && remaining > 0 && startTime !== null) {
    const currentElapsed = Date.now() - startTime;
    const averageTimePerFile = currentElapsed / doneCount;
    estimatedRemainingTime = Math.round(averageTimePerFile * remaining);
  }

  return {
    totalFiles,
    processed,
    failed,
    remaining,
    elapsedTime,
    estimatedRemainingTime,
  };
}

// API: Multi-file upload
app.post('/api/upload', upload.array('files'), async (req, res) => {
  const sessionId = req.headers['x-session-id'] as string;
  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  const session = getOrCreateSession(sessionId);
  const filesMetadata = JSON.parse(req.body.filesMetadata || '[]') as FileRecord[];

  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  // Validate limits (Max 100 files, Max 2GB total size)
  const currentTotalFiles = session.files.length + filesMetadata.length;
  if (currentTotalFiles > 100) {
    // Delete recently uploaded files
    for (const f of files) {
      await fs.unlink(f.path).catch(() => {});
    }
    return res.status(400).json({ error: 'Max file limit exceeded (Maximum 100 files).' });
  }

  let currentTotalSize = session.files.reduce((sum, f) => sum + f.size, 0);
  for (const m of filesMetadata) {
    currentTotalSize += m.size;
  }

  if (currentTotalSize > 2 * 1024 * 1024 * 1024) {
    // Delete files
    for (const f of files) {
      await fs.unlink(f.path).catch(() => {});
    }
    return res.status(400).json({ error: 'Total size limit exceeded (Maximum 2 GB).' });
  }

  // Add files to session
  for (const meta of filesMetadata) {
    if (meta.extension !== 'lsa' && meta.extension !== 'lsav') {
      return res.status(400).json({ error: 'Only .lsa and .lsav files are accepted.' });
    }
    
    session.files.push({
      id: meta.id,
      name: meta.name,
      size: meta.size,
      extension: meta.extension,
      status: 'Queued',
      progress: 0,
    });
  }

  res.json({ success: true, files: session.files });
});

// API: Remove file before processing
app.delete('/api/remove/:sessionId/:fileId', async (req, res) => {
  const { sessionId, fileId } = req.params;
  const session = sessions.get(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const idx = session.files.findIndex(f => f.id === fileId);
  if (idx !== -1) {
    const file = session.files[idx];
    session.files.splice(idx, 1);

    // Delete the file from upload dir
    const sessionUploadDir = path.join(UPLOADS_DIR, sessionId);
    const fileNameOnDisk = `${file.id}_${file.name}`;
    await fs.unlink(path.join(sessionUploadDir, fileNameOnDisk)).catch(() => {});
    
    // Also delete output if exists
    if (file.outputName) {
      const sessionOutputDir = path.join(OUTPUTS_DIR, sessionId);
      await fs.unlink(path.join(sessionOutputDir, file.outputName)).catch(() => {});
    }

    return res.json({ success: true, files: session.files });
  }

  res.status(404).json({ error: 'File not found' });
});

// API: Get current session files
app.get('/api/files/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  if (!session) {
    return res.json({ files: [] });
  }
  res.json({ files: session.files });
});

// API: Process all files
app.post('/api/process/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  if (!session || session.files.length === 0) {
    return res.status(400).json({ error: 'No files to process. Please upload files first.' });
  }

  if (session.queue) {
    return res.status(400).json({ error: 'Processing is already running' });
  }

  session.startTime = Date.now();
  session.elapsedTime = 0;

  // Reset statuses
  session.files.forEach(f => {
    f.status = 'Queued';
    f.progress = 0;
    f.processingTime = undefined;
    f.error = undefined;
    f.outputName = undefined;
  });

  // Create Output Folder
  const sessionOutputDir = path.join(OUTPUTS_DIR, sessionId);
  await fs.mkdir(sessionOutputDir, { recursive: true });

  // Instantiate Processing Queue
  const queue = new FileProcessingQueue({
    onProgress: (fileId, status, progress, processingTime, error, outputName) => {
      const file = session.files.find(f => f.id === fileId);
      if (file) {
        file.status = status;
        file.progress = progress;
        if (processingTime !== undefined) file.processingTime = processingTime;
        if (error !== undefined) file.error = error;
        if (outputName !== undefined) file.outputName = outputName;

        broadcast(sessionId, {
          type: 'status_update',
          sessionId,
          file,
        });

        broadcast(sessionId, {
          type: 'summary_update',
          sessionId,
          summary: calculateSummary(session.files, session.startTime, session.elapsedTime),
        });
      }
    },
    onFinished: () => {
      session.elapsedTime = session.startTime ? Date.now() - session.startTime : 0;
      session.startTime = null;
      session.queue = null;

      broadcast(sessionId, {
        type: 'finished',
        sessionId,
        summary: calculateSummary(session.files, null, session.elapsedTime),
      });
    },
    onCancelled: () => {
      session.elapsedTime = session.startTime ? Date.now() - session.startTime : 0;
      session.startTime = null;
      session.queue = null;

      broadcast(sessionId, {
        type: 'cancelled',
        sessionId,
        summary: calculateSummary(session.files, null, session.elapsedTime),
      });
    },
  });

  session.queue = queue;

  // Enqueue tasks
  session.files.forEach(file => {
    const sessionUploadDir = path.join(UPLOADS_DIR, sessionId);
    const uploadFilePath = path.join(sessionUploadDir, `${file.id}_${file.name}`);

    queue.enqueue({
      file,
      filePath: uploadFilePath,
      outputDir: sessionOutputDir,
    });
  });

  // Start processing
  queue.start(1500); // 1.5 seconds latency for visual updates

  res.status(202).json({ success: true });
});

// API: Cancel processing
app.post('/api/cancel/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (session && session.queue) {
    session.queue.cancel();
    return res.json({ success: true });
  }

  res.status(400).json({ error: 'No active processing session found' });
});

// API: SSE Events subscription
app.get('/api/events/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = getOrCreateSession(sessionId);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  res.write('retry: 10000\n\n');

  session.sseClients.push(res);

  // Send initial state
  const currentSummary = calculateSummary(session.files, session.startTime, session.elapsedTime);
  res.write(`data: ${JSON.stringify({ type: 'summary_update', sessionId, summary: currentSummary })}\n\n`);

  req.on('close', () => {
    session.sseClients = session.sseClients.filter(c => c !== res);
  });
});

// API: Preview single file
app.get('/api/preview/:sessionId/:fileId', async (req, res) => {
  const { sessionId, fileId } = req.params;
  const session = sessions.get(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const file = session.files.find(f => f.id === fileId);
  if (!file || !file.outputName) return res.status(404).json({ error: 'File output not found' });

  const sessionOutputDir = path.join(OUTPUTS_DIR, sessionId);
  const outPath = path.join(sessionOutputDir, file.outputName);

  if (!existsSync(outPath)) {
    return res.status(404).json({ error: 'Processed output file not found on disk' });
  }

  // Determine media category to decide how to respond
  const ext = path.extname(file.outputName).toLowerCase().substring(1);
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
  const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm'];

  if (imageExts.includes(ext) || videoExts.includes(ext) || ext === 'pdf') {
    let contentType = 'application/octet-stream';
    if (ext === 'pdf') contentType = 'application/pdf';
    else if (imageExts.includes(ext)) contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    else if (videoExts.includes(ext)) contentType = `video/${ext === 'mov' ? 'quicktime' : ext}`;

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Disposition': 'inline',
    });
    
    try {
      const fileBuffer = await fs.readFile(outPath);
      res.end(fileBuffer);
    } catch (err: any) {
      res.status(500).end(`Failed to stream media: ${err.message}`);
    }
  } else {
    // Treat as textual data
    try {
      const text = await fs.readFile(outPath, 'utf8');
      res.json({ content: text });
    } catch (err: any) {
      res.status(500).json({ error: `Failed to read file: ${err.message}` });
    }
  }
});

// API: Download single file
app.get('/api/download/:sessionId/:fileId', (req, res) => {
  const { sessionId, fileId } = req.params;
  const session = sessions.get(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const file = session.files.find(f => f.id === fileId);
  if (!file || !file.outputName) return res.status(404).json({ error: 'File output not found' });

  const sessionOutputDir = path.join(OUTPUTS_DIR, sessionId);
  const outPath = path.join(sessionOutputDir, file.outputName);

  if (!existsSync(outPath)) {
    return res.status(404).json({ error: 'Output file does not exist' });
  }

  // Strip UUID prefix before presenting download name
  const cleanName = file.outputName.replace(/^[a-zA-Z0-9-]+_/, '');
  res.download(outPath, cleanName);
});

// API: Download ZIP of results
app.get('/api/download-zip/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const sessionOutputDir = path.join(OUTPUTS_DIR, sessionId);

  if (!existsSync(sessionOutputDir)) {
    return res.status(404).json({ error: 'No output directory found for this session.' });
  }

  try {
    const files = await fs.readdir(sessionOutputDir);
    if (files.length === 0) {
      return res.status(400).json({ error: 'No processed files to archive.' });
    }

    const archive = archiver('zip', { zlib: { level: 9 } });

    res.attachment(`LSA_Processing_Results_${sessionId}.zip`);
    archive.pipe(res);

    for (const filename of files) {
      const fullPath = path.join(sessionOutputDir, filename);
      const cleanName = filename.replace(/^[a-zA-Z0-9-]+_/, '');
      archive.file(fullPath, { name: cleanName });
    }

    await archive.finalize();
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: `Failed to create ZIP: ${err.message}` });
    }
  }
});

// API: Clear/Reset Session
app.post('/api/clear/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (session) {
    if (session.queue) {
      session.queue.cancel();
    }
    session.files = [];
    session.startTime = null;
    session.elapsedTime = 0;
  }

  const uploadDir = path.join(UPLOADS_DIR, sessionId);
  const outputDir = path.join(OUTPUTS_DIR, sessionId);

  try {
    await fs.rm(uploadDir, { recursive: true, force: true });
    await fs.rm(outputDir, { recursive: true, force: true });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: `Cleanup failed: ${err.message}` });
  }
});

// Start Express - Bind strictly to loopback interface 127.0.0.1 for local offline network security
app.listen(PORT as number, '127.0.0.1', () => {
  console.log(`=========================================`);
  console.log(`LSA Processing Server running offline (secured to localhost)`);
  console.log(`Address: http://localhost:${PORT}`);
  console.log(`=========================================`);
});
