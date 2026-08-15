export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details: unknown[] = [],
    public isOperational = true,
  ) {
    super(message);
  }
}
