import express, { Request, Response } from 'express';
import multer from 'multer';
import { visionProcessor } from '../lib/visionProcessor.js';
import { arisParser } from '../lib/arisParser.js';
import { markdownParser } from '../lib/markdownParser.js';
import { exportEngine } from '../lib/exportEngine.js';
import { connectionManager } from '../services/connectionManager.js';
import { piiDetector } from '../lib/piiDetector.js';

const router = express.Router();

// Configure Multer for file uploads (memory storage for processing)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (_req, file, cb) => {
    // Allowed file types
    const allowedMimes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/gif',
      'image/webp',
      'application/xml',
      'text/xml',
      'text/plain',
      'text/markdown',
      'application/octet-stream', // For .aml files
    ];

    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.xml', '.aml', '.md', '.txt'];
    const fileExt = file.originalname.toLowerCase().match(/\.[^.]+$/)?.[0];

    if (allowedMimes.includes(file.mimetype) || (fileExt && allowedExtensions.includes(fileExt))) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed types: ${allowedExtensions.join(', ')}`));
    }
  },
});

/**
 * POST /api/files/upload
 * Upload and process a file (ARIS XML/AML, image, or markdown)
 * Routes to appropriate processor based on file type
 */
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
    }

    const file = req.file;
    const fileName = file.originalname;
    const fileType = detectFileType(fileName, file.mimetype);

    console.log(`Processing uploaded file: ${fileName} (type: ${fileType})`);

    let result;

    // Route to appropriate processor
    switch (fileType) {
      case 'image':
        result = await visionProcessor.processImage(file.buffer, fileName);
        break;

      case 'xml':
        const xmlContent = file.buffer.toString('utf-8');
        result = await arisParser.processXML(xmlContent, fileName);
        break;

      case 'markdown':
        const mdContent = file.buffer.toString('utf-8');
        result = await markdownParser.processMarkdown(mdContent, fileName);
        break;

      default:
        return res.status(400).json({
          success: false,
          error: `Unsupported file type: ${fileType}`,
        });
    }

    // Perform PII detection on extracted content
    const piiConfig = (req.session as any)?.piiConfig;
    let piiDetection: any = null;

    if (piiConfig && piiConfig.mode !== 'disabled') {
      // Check all extracted text content for PII
      const contentToCheck = JSON.stringify(result);
      piiDetection = piiDetector.detectPII(
        contentToCheck,
        piiConfig.sensitivityLevel,
        piiConfig.enabledTypes
      );

      // If PII found and mode is 'block', return error
      if (piiDetection.hasPII && piiConfig.mode === 'block') {
        console.warn(`[PII] Blocked file upload due to PII detection: ${fileName}`);
        return res.status(400).json({
          success: false,
          piiBlocked: true,
          error: `File contains sensitive information and cannot be processed (mode: block)`,
          piiDetection: {
            hasPII: piiDetection.hasPII,
            severity: piiDetection.severity,
            summary: piiDetection.summary,
            detections: piiDetection.detections.slice(0, 10), // Limit to first 10
          },
        });
      }

      // If mask mode, use masked version
      if (piiDetection.hasPII && piiConfig.mode === 'mask') {
        console.log(`[PII] Masking detected PII in file: ${fileName}`);
        // Reparse result with masked content if needed
        // For now, include PII info in response for frontend to handle
      }
    }

    return res.json({
      success: true,
      data: result,
      fileInfo: {
        name: fileName,
        size: file.size,
        type: fileType,
        mimeType: file.mimetype,
      },
      ...(piiDetection && { piiDetection }),
    });
  } catch (error: any) {
    console.error('File upload processing error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to process uploaded file',
    });
  }
});

/**
 * POST /api/files/upload-batch
 * Upload and process multiple files
 */
router.post('/upload-batch', upload.array('files', 10), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded',
      });
    }

    console.log(`Processing ${files.length} uploaded files`);

    const results = [];
    const errors = [];

    for (const file of files) {
      try {
        const fileName = file.originalname;
        const fileType = detectFileType(fileName, file.mimetype);

        let result;

        switch (fileType) {
          case 'image':
            result = await visionProcessor.processImage(file.buffer, fileName);
            break;

          case 'xml':
            const xmlContent = file.buffer.toString('utf-8');
            result = await arisParser.processXML(xmlContent, fileName);
            break;

          case 'markdown':
            const mdContent = file.buffer.toString('utf-8');
            result = await markdownParser.processMarkdown(mdContent, fileName);
            break;

          default:
            throw new Error(`Unsupported file type: ${fileType}`);
        }

        results.push({
          fileName,
          fileType,
          success: true,
          data: result,
        });
      } catch (error: any) {
        errors.push({
          fileName: file.originalname,
          error: error.message,
        });
      }
    }

    return res.json({
      success: true,
      processed: results.length,
      failed: errors.length,
      results,
      errors,
    });
  } catch (error: any) {
    console.error('Batch file upload error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to process uploaded files',
    });
  }
});

/**
 * GET /api/files/supported-types
 * Return supported file types and processors
 */
router.get('/supported-types', (_req: Request, res: Response) => {
  res.json({
    success: true,
    supportedTypes: {
      images: {
        extensions: ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
        mimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
        processor: 'Vision Processor (GPT-4o)',
        description: 'Process flowcharts and diagrams using Vision-Language Models',
      },
      xml: {
        extensions: ['.xml', '.aml'],
        mimeTypes: ['application/xml', 'text/xml'],
        processor: 'ARIS Parser',
        description: 'Navigate ARIS XML hierarchies and extract process models',
      },
      markdown: {
        extensions: ['.md', '.txt'],
        mimeTypes: ['text/markdown', 'text/plain'],
        processor: 'Markdown Parser',
        description: 'Parse structured markdown documents and plain text',
      },
    },
    limits: {
      maxFileSize: '10MB',
      maxBatchFiles: 10,
    },
  });
});

/**
 * GET /api/files/processors/status
 * Check processor health and configuration
 */
router.get('/processors/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    processors: {
      visionProcessor: {
        name: 'Vision Processor',
        status: visionProcessor.isConfigured() ? 'ready' : 'not-configured',
        provider: visionProcessor.getProvider(),
        model: visionProcessor.getModel(),
      },
      arisParser: {
        name: 'ARIS XML Parser',
        status: 'ready',
        backend: 'fast-xml-parser',
      },
      markdownParser: {
        name: 'Markdown Parser',
        status: 'ready',
        backend: 'marked',
      },
    },
  });
});

/**
 * GET /api/files/integration-config
 * Get configured integration platform from environment
 */
router.get('/integration-config', (_req: Request, res: Response) => {
  const state = connectionManager.getState();
  const defaultIntegration = process.env.DEFAULT_INTEGRATION || 'jira';
  
  res.json({
    success: true,
    data: {
      defaultPlatform: defaultIntegration,
      jira: {
        configured: state.jira.isConnected,
        baseUrl: state.jira.baseUrl,
        email: state.jira.email,
      },
      servicenow: {
        configured: state.servicenow.isConnected,
        instanceUrl: state.servicenow.instanceUrl,
        username: state.servicenow.username,
      },
    },
  });
});

/**
 * POST /api/files/export/jira
 * Export epics and stories to Jira
 * If credentials not provided, uses default connection from env
 */
router.post('/export/jira', async (req: Request, res: Response) => {
  try {
    const { epics, credentials, projectKey } = req.body;

    if (!epics || !Array.isArray(epics) || epics.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No epics provided. Expected array of epics.',
      });
    }

    // Use provided credentials or fall back to default connection
    let jiraCredentials = credentials;
    
    if (!credentials) {
      const defaultConnection = connectionManager.getJiraConnection();
      
      if (!defaultConnection) {
        return res.status(400).json({
          success: false,
          error: 'No Jira credentials provided and no default connection configured in environment',
        });
      }

      if (!projectKey) {
        return res.status(400).json({
          success: false,
          error: 'Project key is required when using default Jira connection',
        });
      }

      jiraCredentials = {
        ...defaultConnection,
        projectKey,
      };
      
      console.log(`Using default Jira connection for project ${projectKey}`);
    } else {
      // Validate provided credentials
      if (!credentials.baseUrl || !credentials.email || !credentials.apiToken || !credentials.projectKey) {
        return res.status(400).json({
          success: false,
          error: 'Missing Jira credentials. Required: baseUrl, email, apiToken, projectKey',
        });
      }
      jiraCredentials = credentials;
    }

    console.log(`Exporting ${epics.length} epics to Jira project ${jiraCredentials.projectKey}`);

    // Validate credentials
    const isValid = await exportEngine.validateJiraCredentials(jiraCredentials);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid Jira credentials or unable to connect',
      });
    }

    // Export to Jira
    const result = await exportEngine.exportToJira(epics, jiraCredentials);

    return res.json({
      success: result.success,
      data: result,
    });
  } catch (error: any) {
    console.error('Jira export error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to export to Jira',
    });
  }
});

/**
 * POST /api/files/export/servicenow
 * Export epics and stories to ServiceNow
 * If credentials not provided, uses default connection from env
 */
router.post('/export/servicenow', async (req: Request, res: Response) => {
  try {
    const { epics, credentials } = req.body;

    if (!epics || !Array.isArray(epics) || epics.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No epics provided. Expected array of epics.',
      });
    }

    // Use provided credentials or fall back to default connection
    let snowCredentials = credentials;
    
    if (!credentials) {
      const defaultConnection = connectionManager.getServiceNowConnection();
      
      if (!defaultConnection) {
        return res.status(400).json({
          success: false,
          error: 'No ServiceNow credentials provided and no default connection configured in environment',
        });
      }

      snowCredentials = defaultConnection;
      console.log(`Using default ServiceNow connection`);
    } else {
      // Validate provided credentials
      if (!credentials.instanceUrl || !credentials.username || !credentials.password) {
        return res.status(400).json({
          success: false,
          error: 'Missing ServiceNow credentials. Required: instanceUrl, username, password',
        });
      }
      snowCredentials = credentials;
    }

    console.log(`Exporting ${epics.length} epics to ServiceNow`);

    // Validate credentials
    const isValid = await exportEngine.validateServiceNowCredentials(snowCredentials);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid ServiceNow credentials or unable to connect',
      });
    }

    // Export to ServiceNow
    const result = await exportEngine.exportToServiceNow(epics, snowCredentials);

    return res.json({
      success: result.success,
      data: result,
    });
  } catch (error: any) {
    console.error('ServiceNow export error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to export to ServiceNow',
    });
  }
});

/**
 * Detect file type based on extension and MIME type
 */
function detectFileType(fileName: string, mimeType: string): 'image' | 'xml' | 'markdown' | 'unknown' {
  const ext = fileName.toLowerCase().match(/\.[^.]+$/)?.[0];

  // Check by extension first
  if (ext && ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
    return 'image';
  }

  if (ext && ['.xml', '.aml'].includes(ext)) {
    return 'xml';
  }

  if (ext && ['.md', '.txt'].includes(ext)) {
    return 'markdown';
  }

  // Check by MIME type
  if (mimeType.startsWith('image/')) {
    return 'image';
  }

  if (mimeType.includes('xml')) {
    return 'xml';
  }

  if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
    return 'markdown';
  }

  return 'unknown';
}

export default router;
