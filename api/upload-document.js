import { put } from '@vercel/blob';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { file, sessionId, documentType, fileName } = req.body;
    
    // Validate required fields
    if (!file || !sessionId || !documentType || !fileName) {
      return res.status(400).json({ 
        error: 'Missing required fields: file, sessionId, documentType, fileName' 
      });
    }

    // File size limit: 10MB
    const maxSize = 10 * 1024 * 1024;
    if (file.length > maxSize) {
      return res.status(413).json({ 
        error: 'File too large. Maximum size is 10MB.' 
      });
    }

    // Convert base64 to buffer
    const fileBuffer = Buffer.from(file.split(',')[1], 'base64');
    
    // Create unique file path
    const timestamp = Date.now();
    const filePath = `pilot-docs/${sessionId}/${documentType}/${timestamp}_${fileName}`;
    
    // Upload to Vercel Blob
    const blob = await put(filePath, fileBuffer, {
      access: 'public',
      addRandomSuffix: false,
    });

    // Log upload for monitoring
    console.log(`Document uploaded: ${filePath}, Size: ${blob.size} bytes`);

    res.status(200).json({
      success: true,
      url: blob.url,
      size: blob.size,
      uploadedAt: new Date().toISOString(),
      documentType,
      fileName
    });

  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload document. Please try again.'
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb', // Allow larger payloads for file uploads
    },
  },
};