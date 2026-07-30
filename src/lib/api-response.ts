import { NextResponse } from 'next/server';

/**
 * Standardized API Response Helpers for cssberlin.de
 *
 * Usage:
 * ```ts
 * import { ApiResponse } from '@/lib/api-response';
 *
 * return ApiResponse.success(data);
 * return ApiResponse.error('Fehler aufgetreten');
 * return ApiResponse.unauthorized();
 * ```
 */
export class ApiResponse {
  /**
   * 200 OK — Successful response with data
   */
  static success<T>(data: T, status: number = 200) {
    return NextResponse.json(
      { success: true, data },
      { status }
    );
  }

  /**
   * 201 Created — Resource created successfully
   */
  static created<T>(data: T) {
    return NextResponse.json(
      { success: true, data },
      { status: 201 }
    );
  }

  /**
   * 200 OK — Simple success message
   */
  static message(message: string, status: number = 200) {
    return NextResponse.json(
      { success: true, message },
      { status }
    );
  }

  /**
   * 400 Bad Request — Client error
   */
  static error(message: string, status: number = 400) {
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }

  /**
   * 401 Unauthorized — Not authenticated
   */
  static unauthorized(message: string = 'Nicht autorisiert. Bitte logge dich ein.') {
    return NextResponse.json(
      { success: false, error: message },
      { status: 401 }
    );
  }

  /**
   * 403 Forbidden — Not authorized for this action
   */
  static forbidden(message: string = 'Zugriff verweigert.') {
    return NextResponse.json(
      { success: false, error: message },
      { status: 403 }
    );
  }

  /**
   * 404 Not Found — Resource does not exist
   */
  static notFound(message: string = 'Ressource nicht gefunden.') {
    return NextResponse.json(
      { success: false, error: message },
      { status: 404 }
    );
  }

  /**
   * 422 Unprocessable Entity — Validation errors
   */
  static validationError(errors: Record<string, string[]> | string) {
    return NextResponse.json(
      {
        success: false,
        error: typeof errors === 'string' ? errors : 'Validierungsfehler.',
        details: typeof errors === 'object' ? errors : undefined,
      },
      { status: 422 }
    );
  }

  /**
   * 429 Too Many Requests — Rate limited
   */
  static rateLimited(message: string = 'Zu viele Anfragen. Bitte versuche es später erneut.') {
    return NextResponse.json(
      { success: false, error: message },
      { status: 429 }
    );
  }

  /**
   * 500 Internal Server Error — Unexpected error
   */
  static serverError(message: string = 'Ein unerwarteter Fehler ist aufgetreten.') {
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
