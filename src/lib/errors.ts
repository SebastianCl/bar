export type AppErrorCode =
  | 'ACCOUNT_CLOSED'
  | 'ALREADY_CLOSED'
  | 'AUTH_REQUIRED'
  | 'CONFLICT'
  | 'CONFIGURATION'
  | 'FORBIDDEN'
  | 'INACTIVE_USER'
  | 'INVALID_CREDENTIALS'
  | 'NOT_FOUND'
  | 'OFFLINE'
  | 'OUT_OF_STOCK'
  | 'RATE_LIMITED'
  | 'VALIDATION'
  | 'UNKNOWN';

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly cause?: unknown;
  readonly details?: string;

  constructor(
    code: AppErrorCode,
    message: string,
    options?: { cause?: unknown; details?: string },
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.cause = options?.cause;
    this.details = options?.details;
  }
}

type ErrorLike = {
  code?: string;
  message?: string;
  details?: string;
  status?: number;
};

const knownMessages: Array<{ pattern: RegExp; code: AppErrorCode; message: string }> = [
  {
    pattern:
      /insufficient[_\s-]?stock|stock[_\s-]?insufficient|sin existencias|out[_\s-]?of[_\s-]?stock/i,
    code: 'OUT_OF_STOCK',
    message: 'No hay existencias suficientes para completar la operación.',
  },
  {
    pattern: /tab[_\s-]?closed|account[_\s-]?closed|cuenta cerrada/i,
    code: 'ACCOUNT_CLOSED',
    message: 'La cuenta ya está cerrada y no admite más cambios.',
  },
  {
    pattern: /already[_\s-]?closed|ya (fue|está) cerrada/i,
    code: 'ALREADY_CLOSED',
    message: 'La cuenta ya había sido cerrada.',
  },
  {
    pattern: /duplicate|unique|23505|duplicate_open_table|idempotency_conflict/i,
    code: 'CONFLICT',
    message: 'La operación ya fue registrada o entra en conflicto con otro dato.',
  },
  {
    pattern: /\bvalidation\b|validation[_\s-]?error|invalid[_\s-]?input/i,
    code: 'VALIDATION',
    message: 'Revisa los datos e inténtalo nuevamente.',
  },
  {
    pattern: /balance[_\s-]?(due|exceeded)|saldo pendiente|abono supera/i,
    code: 'VALIDATION',
    message: 'El abono supera el saldo pendiente o la cuenta aún tiene saldo.',
  },
  {
    pattern: /unauthenticated|authentication[_\s-]?required/i,
    code: 'AUTH_REQUIRED',
    message: 'Tu sesión venció. Vuelve a iniciar sesión.',
  },
  {
    pattern: /invalid login credentials|invalid credentials/i,
    code: 'INVALID_CREDENTIALS',
    message: 'El correo o la contraseña no son correctos.',
  },
  {
    pattern: /row-level security|permission denied|42501|forbidden/i,
    code: 'FORBIDDEN',
    message: 'No tienes permisos para realizar esta operación.',
  },
  {
    pattern: /rate limit|too many requests|over_email_send_rate_limit/i,
    code: 'RATE_LIMITED',
    message: 'Se hicieron demasiados intentos. Espera un momento y vuelve a probar.',
  },
];

export function normalizeError(
  error: unknown,
  fallback = 'No fue posible completar la operación.',
): AppError {
  if (error instanceof AppError) return error;

  const candidate = (
    typeof error === 'object' && error !== null ? error : {}
  ) as ErrorLike;
  const searchable = [candidate.code, candidate.message, candidate.details]
    .filter(Boolean)
    .join(' ');
  const known = knownMessages.find((entry) => entry.pattern.test(searchable));

  if (known) {
    return new AppError(known.code, known.message, {
      cause: error,
      details: candidate.details,
    });
  }

  if (candidate.status === 401 || candidate.code === 'PGRST301') {
    return new AppError('AUTH_REQUIRED', 'Tu sesión venció. Vuelve a iniciar sesión.', {
      cause: error,
    });
  }

  if (candidate.status === 404 || candidate.code === 'PGRST116') {
    return new AppError('NOT_FOUND', 'El registro solicitado no existe.', {
      cause: error,
    });
  }

  return new AppError('UNKNOWN', fallback, {
    cause: error,
    details: candidate.message,
  });
}

export function requireOnline(): void {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new AppError(
      'OFFLINE',
      'Necesitas conexión a Internet para guardar cambios.',
    );
  }
}

export function errorReference(): string {
  return `ERR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}
