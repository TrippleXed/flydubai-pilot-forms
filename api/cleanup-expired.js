import { list, del } from '@vercel/blob';

export default async function handler(req, res) {
  // Only allow POST requests for security
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Simple authentication - could be enhanced with API keys
  const { cleanupKey } = req.body;
  if (cleanupKey !== process.env.CLEANUP_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // List all blobs in the pilot-docs folder
    const { blobs } = await list({
      prefix: 'pilot-docs/',
      limit: 1000
    });

    const now = Date.now();
    const maxAge = 48 * 60 * 60 * 1000; // 48 hours
    let deletedCount = 0;
    let totalSize = 0;

    // Process each blob
    for (const blob of blobs) {
      const uploadTime = new Date(blob.uploadedAt).getTime();
      const age = now - uploadTime;

      // Delete if older than 48 hours
      if (age > maxAge) {
        try {
          await del(blob.url);
          deletedCount++;
          totalSize += blob.size;
          console.log(`Deleted expired document: ${blob.pathname}`);
        } catch (deleteError) {
          console.error(`Failed to delete ${blob.pathname}:`, deleteError);
        }
      }
    }

    // Log cleanup results
    console.log(`Cleanup completed: ${deletedCount} files deleted, ${Math.round(totalSize / 1024 / 1024)}MB freed`);

    res.status(200).json({
      success: true,
      message: `Cleanup completed: ${deletedCount} expired documents deleted`,
      deletedFiles: deletedCount,
      freedSpace: Math.round(totalSize / 1024 / 1024) + 'MB',
      totalChecked: blobs.length
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({
      success: false,
      error: 'Cleanup failed. Please check logs.'
    });
  }
}