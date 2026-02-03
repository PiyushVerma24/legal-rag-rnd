/**
 * Input validation and security utilities
 * Adapted from case-wise-crm-gemma security patterns
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitized?: string;
}

/**
 * Dangerous SQL keywords that should never appear in user input
 */
const DANGEROUS_SQL_KEYWORDS = [
  'DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'CREATE', 'INSERT', 'UPDATE',
  'EXEC', 'EXECUTE', 'SCRIPT', 'JAVASCRIPT', 'ONERROR', 'ONLOAD',
  'EVAL', 'EXPRESSION', 'VBSCRIPT', 'IFRAME', 'OBJECT', 'EMBED',
  'APPLET', 'LINK', 'STYLE', 'META', 'BASE'
];

/**
 * Dangerous query patterns (regex-based)
 */
const DANGEROUS_QUERY_PATTERNS = [
  /(\bOR\b.*=.*)/i, // SQL injection: OR 1=1
  /(\bAND\b.*=.*)/i, // SQL injection: AND 1=1
  /(\bUNION\b.*\bSELECT\b)/i, // SQL injection: UNION SELECT
  /(--|#|\/\*|\*\/)/,  // SQL comments
  /(<script|<iframe|<object|<embed)/i, // XSS attempts
  /(javascript:|data:text\/html)/i, // XSS via javascript: or data: URLs
  /(on\w+\s*=)/i, // Event handlers like onclick=
  /(\$\{.*\})/,  // Template injection
  /(\.\.\/|\.\.\\)/,  // Path traversal
  /(system|exec|eval|spawn|child_process)/i // System command attempts
];

/**
 * Validate user query for safety
 */
export function validateUserQuery(query: string): ValidationResult {
  if (!query || typeof query !== 'string') {
    return {
      isValid: false,
      error: 'Query must be a non-empty string'
    };
  }

  // Check length
  if (query.length > 5000) {
    return {
      isValid: false,
      error: 'Query exceeds maximum length of 5000 characters'
    };
  }

  if (query.trim().length < 3) {
    return {
      isValid: false,
      error: 'Query must be at least 3 characters'
    };
  }

  // Check for dangerous SQL keywords
  const queryUpper = query.toUpperCase();
  for (const keyword of DANGEROUS_SQL_KEYWORDS) {
    if (queryUpper.includes(keyword)) {
      return {
        isValid: false,
        error: `Query contains forbidden keyword: ${keyword}`
      };
    }
  }

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_QUERY_PATTERNS) {
    if (pattern.test(query)) {
      return {
        isValid: false,
        error: 'Query contains potentially malicious pattern'
      };
    }
  }

  // Sanitize: remove excessive whitespace and control characters
  const sanitized = query
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  return {
    isValid: true,
    sanitized
  };
}

/**
 * Validate file uploads
 */
export function validateFileUpload(
  file: File,
  options: {
    maxSizeMB?: number;
    allowedTypes?: string[];
  } = {}
): ValidationResult {
  const {
    maxSizeMB = 50, // Default 50MB
    allowedTypes = ['application/pdf', 'application/epub+zip', 'text/plain']
  } = options;

  // Check file exists
  if (!file) {
    return {
      isValid: false,
      error: 'No file provided'
    };
  }

  // Check file size
  const maxBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      isValid: false,
      error: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum of ${maxSizeMB}MB`
    };
  }

  // Check file type
  if (!allowedTypes.includes(file.type)) {
    // Also check by file extension
    const extension = file.name.split('.').pop()?.toLowerCase();
    const extensionTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'epub': 'application/epub+zip',
      'txt': 'text/plain'
    };

    if (!extension || !extensionTypes[extension] || !allowedTypes.includes(extensionTypes[extension])) {
      return {
        isValid: false,
        error: `File type '${file.type}' not allowed. Allowed types: ${allowedTypes.join(', ')}`
      };
    }
  }

  // Check filename for malicious patterns
  const filename = file.name;
  if (/[<>:"|?*\x00-\x1F]/.test(filename)) {
    return {
      isValid: false,
      error: 'Filename contains invalid characters'
    };
  }

  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return {
      isValid: false,
      error: 'Filename contains path traversal characters'
    };
  }

  return {
    isValid: true,
    sanitized: filename
  };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || typeof email !== 'string') {
    return {
      isValid: false,
      error: 'Email must be a non-empty string'
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return {
      isValid: false,
      error: 'Invalid email format'
    };
  }

  // Check for suspicious patterns
  if (email.includes('..') || email.includes('--')) {
    return {
      isValid: false,
      error: 'Email contains suspicious patterns'
    };
  }

  return {
    isValid: true,
    sanitized: email.toLowerCase().trim()
  };
}

/**
 * Sanitize HTML to prevent XSS
 */
export function sanitizeHTML(html: string): string {
  if (!html) return '';

  return html
    // Remove script tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove iframe tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    // Remove event handlers
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]*/gi, '')
    // Remove javascript: URLs
    .replace(/javascript:/gi, '')
    // Remove data: URLs
    .replace(/data:text\/html/gi, '')
    .trim();
}

/**
 * Validate and sanitize markdown content
 */
export function validateMarkdown(content: string): ValidationResult {
  if (!content || typeof content !== 'string') {
    return {
      isValid: false,
      error: 'Content must be a non-empty string'
    };
  }

  // Check for XSS attempts in markdown
  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i
  ];

  for (const pattern of xssPatterns) {
    if (pattern.test(content)) {
      return {
        isValid: false,
        error: 'Content contains potentially malicious code'
      };
    }
  }

  return {
    isValid: true,
    sanitized: content.trim()
  };
}

/**
 * Rate limiting helper (simple in-memory)
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  /**
   * Check if request should be allowed
   * @param identifier - Unique identifier (e.g., user ID, IP address)
   * @param maxRequests - Maximum requests allowed
   * @param windowMs - Time window in milliseconds
   */
  checkLimit(identifier: string, maxRequests: number, windowMs: number): {
    allowed: boolean;
    remaining: number;
    resetAt: Date;
  } {
    const now = Date.now();
    const userRequests = this.requests.get(identifier) || [];

    // Remove old requests outside the window
    const recentRequests = userRequests.filter(time => now - time < windowMs);

    if (recentRequests.length >= maxRequests) {
      const oldestRequest = Math.min(...recentRequests);
      const resetAt = new Date(oldestRequest + windowMs);

      return {
        allowed: false,
        remaining: 0,
        resetAt
      };
    }

    // Add current request
    recentRequests.push(now);
    this.requests.set(identifier, recentRequests);

    return {
      allowed: true,
      remaining: maxRequests - recentRequests.length,
      resetAt: new Date(now + windowMs)
    };
  }

  /**
   * Clear rate limit for identifier
   */
  clear(identifier: string): void {
    this.requests.delete(identifier);
  }

  /**
   * Clear all rate limits
   */
  clearAll(): void {
    this.requests.clear();
  }
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Generate safe filename from user input
 */
export function sanitizeFilename(filename: string): string {
  return filename
    // Remove path components
    .replace(/^.*[\\\/]/, '')
    // Remove special characters
    .replace(/[^a-z0-9._-]/gi, '_')
    // Remove leading dots
    .replace(/^\.+/, '')
    // Limit length
    .substring(0, 255);
}
