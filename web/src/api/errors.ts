export class ApiError extends Error {
  status: number;
  body: any;
  constructor(message: string, status: number, body: any = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}
