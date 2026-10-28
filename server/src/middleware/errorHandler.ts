import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  public statusCode: number;
  public details?: any;

  constructor(message: string, statusCode: number = 400, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const statusCode = err.statusCode || (err.status ? Number(err.status) : 500);
  const message = err.message || 'Internal Server Error';

  if (statusCode >= 500) {
    console.error(`[Server Error] ${req.method} ${req.url}:`, err);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      statusCode,
      details: err.details || undefined,
      timestamp: new Date().toISOString()
    }
  });
}
