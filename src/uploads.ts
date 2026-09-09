import path from 'node:path';

export const uploadsDir = process.env.UPLOADS_DIR ?? path.join(process.cwd(), 'uploads');
