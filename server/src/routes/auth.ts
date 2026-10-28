import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { db } from '../db/schema';
import { config } from '../config/env';
import { authenticateToken } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import { otpService } from '../services/otpService';
import { isValidBangladeshPhone, normalizeBangladeshPhone } from '../utils/phoneUtils';

export const authRouter = Router();

const ACCESS_TOKEN_EXPIRY = '15m'; // Short-lived 15 min access token
const REFRESH_TOKEN_DAYS = 7;     // 7 days rotating refresh token

// ==========================================
// Zod Validation Schemas
// ==========================================
const registerSchema = z.object({
  email: z.string().email('Valid email address is required.'),
  phone: z.string().optional().refine(val => !val || isValidBangladeshPhone(val), {
    message: 'Invalid Bangladesh mobile number format (expected +8801XXXXXXXXX or 01XXXXXXXXX).'
  }),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  role: z.enum(['STUDENT', 'INSTRUCTOR', 'ADMIN']).default('STUDENT'),
  targetExam: z.string().optional(),
  targetDate: z.string().optional()
});

const registerPhoneSchema = z.object({
  phone: z.string().refine(isValidBangladeshPhone, {
    message: 'Invalid Bangladesh mobile number. Expected format: +8801XXXXXXXXX or 01XXXXXXXXX.'
  }),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Optional email must be valid if provided.').optional().or(z.literal('')),
  role: z.enum(['STUDENT', 'INSTRUCTOR', 'ADMIN']).default('STUDENT'),
  targetExam: z.string().optional(),
  targetDate: z.string().optional()
});

const loginSchema = z.object({
  identifier: z.string().min(1, 'Email or phone number is required.').optional(),
  email: z.string().optional(),
  password: z.string().min(1, 'Password is required.')
}).refine(data => data.identifier || data.email, {
  message: 'Email or phone number identifier is required.'
});

const onboardingSchema = z.object({
  targetExam: z.string().optional(),
  targetBank: z.string().min(2, 'Target bank is required.').optional(),
  targetPosition: z.string().min(2, 'Target position is required.').optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Target date must be in YYYY-MM-DD format.').optional().or(z.literal('')),
  phone: z.string().optional()
}).refine(data => data.targetExam || (data.targetBank && data.targetPosition), {
  message: 'Either targetExam or both targetBank and targetPosition are required.'
});

const goalUpdateSchema = z.object({
  targetBank: z.string().min(2, 'Target bank is required (min 2 chars).'),
  targetPosition: z.string().min(2, 'Target position is required (min 2 chars).'),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected exam date must be in YYYY-MM-DD format.').optional().nullable()
});

// Helper: Issue access & refresh token pair with rotation record
function issueTokenPair(user: { id: string; email: string; role: string; name: string }) {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    config.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refreshToken = uuidv4();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Store refresh token securely in SQLite
  db.prepare(`
    INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(uuidv4(), user.id, refreshToken, expiresAt);

  return { accessToken, refreshToken };
}

function setRefreshTokenCookie(res: Response, token: string) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
  });
}

// ==========================================
// 1. User Registration (Email/Password)
// ==========================================
authRouter.post('/register', rateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 20 }), async (req: Request, res: Response) => {
  const validation = registerSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.errors[0]?.message || 'Invalid registration input'
    });
  }

  const data = validation.data;
  const existing: any = db.prepare('SELECT id, is_active FROM users WHERE email = ?').get(data.email.trim().toLowerCase());
  if (existing) {
    if (existing.is_active === 0) {
      // Re-send verification code if account was registered but unverified
      const otpRes = await otpService.sendOtp(data.email.trim().toLowerCase(), 'EMAIL');
      return res.status(200).json({
        success: true,
        requiresVerification: true,
        email: data.email.trim().toLowerCase(),
        message: 'An unverified account already exists with this email. A fresh verification code has been dispatched to your email.'
      });
    }
    return res.status(400).json({
      success: false,
      error: 'An account with this email address already exists.'
    });
  }

  const normalizedPhone = data.phone ? normalizeBangladeshPhone(data.phone) : null;
  if (normalizedPhone) {
    const existingPhone: any = db.prepare('SELECT id FROM users WHERE phone = ?').get(normalizedPhone);
    if (existingPhone) {
      return res.status(400).json({
        success: false,
        error: 'An account with this phone number already exists.'
      });
    }
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(data.password, salt);
  const userId = uuidv4();
  const normalizedEmail = data.email.trim().toLowerCase();

  // New student candidates are registered as unverified (is_active = 0)
  // Instructors/Admins registered programmatically or in dev keep active = 1
  const isActive = data.role === 'STUDENT' ? 0 : 1;

  db.prepare(`
    INSERT INTO users (id, email, phone, password_hash, name, role, is_active, target_exam, target_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    normalizedEmail,
    normalizedPhone,
    passwordHash,
    data.name,
    data.role,
    isActive,
    data.targetExam || null,
    data.targetDate || null
  );

  // If STUDENT, dispatch real email OTP and require verification before session issuance
  if (isActive === 0) {
    const otpResult = await otpService.sendOtp(normalizedEmail, 'EMAIL');
    return res.status(201).json({
      success: true,
      requiresVerification: true,
      email: normalizedEmail,
      message: otpResult.success
        ? `Registration successful! Verification code sent to ${normalizedEmail}. Please verify your email to activate your account.`
        : `Registration initiated, but OTP dispatch reported: ${otpResult.message}`,
      providerMessage: otpResult.message
    });
  }

  // Instructors/Admins (direct active account)
  const user = { id: userId, email: normalizedEmail, role: data.role, name: data.name };
  const tokens = issueTokenPair(user);
  setRefreshTokenCookie(res, tokens.refreshToken);

  res.status(201).json({
    success: true,
    requiresVerification: false,
    message: 'User registered successfully.',
    user: {
      id: userId,
      email: normalizedEmail,
      name: data.name,
      role: data.role,
      targetExam: data.targetExam || null,
      targetDate: data.targetDate || null
    },
    accessToken: tokens.accessToken
  });
});

// ==========================================
// 1B. User Registration via Phone Number (Bangladeshi Mobile SMS OTP)
// ==========================================
authRouter.post('/register-phone', rateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 20 }), async (req: Request, res: Response) => {
  const validation = registerPhoneSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.errors[0]?.message || 'Invalid phone registration input'
    });
  }

  const data = validation.data;
  const normalizedPhone = normalizeBangladeshPhone(data.phone)!;

  // Check if phone already registered
  const existingPhoneUser: any = db.prepare('SELECT id, is_active FROM users WHERE phone = ?').get(normalizedPhone);
  if (existingPhoneUser) {
    if (existingPhoneUser.is_active === 0) {
      // Re-send verification code if account was registered via phone but unverified
      const otpRes = await otpService.sendOtp(normalizedPhone, 'PHONE');
      return res.status(200).json({
        success: true,
        requiresVerification: true,
        phone: normalizedPhone,
        message: 'An unverified account already exists with this phone number. A fresh verification code has been dispatched via SMS.'
      });
    }
    return res.status(400).json({
      success: false,
      error: 'An account with this phone number already exists.'
    });
  }

  // Determine email: either user-provided (if unique) or synthesized phone identifier
  let accountEmail: string;
  if (data.email && data.email.trim()) {
    accountEmail = data.email.trim().toLowerCase();
    const existingEmail: any = db.prepare('SELECT id FROM users WHERE email = ?').get(accountEmail);
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        error: 'An account with this email address already exists.'
      });
    }
  } else {
    // Standard phone-based user identifier (e.g., +8801712345678@phone.banklms.ac.bd)
    accountEmail = `${normalizedPhone.replace('+', '')}@phone.banklms.ac.bd`;
    const existingSynthetic: any = db.prepare('SELECT id FROM users WHERE email = ?').get(accountEmail);
    if (existingSynthetic) {
      return res.status(400).json({
        success: false,
        error: 'An account with this phone number already exists.'
      });
    }
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(data.password, salt);
  const userId = uuidv4();

  // New students are registered as unverified (is_active = 0)
  const isActive = data.role === 'STUDENT' ? 0 : 1;

  db.prepare(`
    INSERT INTO users (id, email, phone, password_hash, name, role, is_active, target_exam, target_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    accountEmail,
    normalizedPhone,
    passwordHash,
    data.name,
    data.role,
    isActive,
    data.targetExam || null,
    data.targetDate || null
  );

  // If STUDENT, dispatch real SMS OTP and require verification before session issuance
  if (isActive === 0) {
    const otpResult = await otpService.sendOtp(normalizedPhone, 'PHONE');
    return res.status(201).json({
      success: true,
      requiresVerification: true,
      phone: normalizedPhone,
      message: otpResult.success
        ? `Registration successful! Verification code sent to ${normalizedPhone}. Please verify your phone to activate your account.`
        : `Registration initiated, but SMS dispatch reported: ${otpResult.message}`,
      providerMessage: otpResult.message
    });
  }

  // Instructors/Admins (direct active account)
  const user = { id: userId, email: accountEmail, role: data.role, name: data.name };
  const tokens = issueTokenPair(user);
  setRefreshTokenCookie(res, tokens.refreshToken);

  res.status(201).json({
    success: true,
    requiresVerification: false,
    message: 'User registered successfully.',
    user: {
      id: userId,
      email: accountEmail,
      phone: normalizedPhone,
      name: data.name,
      role: data.role,
      targetExam: data.targetExam || null,
      targetDate: data.targetDate || null
    },
    accessToken: tokens.accessToken
  });
});

// ==========================================
// 2. User Login
// ==========================================
// ==========================================
// 2. User Login (Email or Bangladeshi Phone)
// ==========================================
authRouter.post('/login', rateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 15 }), (req: Request, res: Response) => {
  const validation = loginSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.errors[0]?.message || 'Invalid login input'
    });
  }

  const rawIdentifier = (validation.data.identifier || validation.data.email || '').trim();
  const password = validation.data.password;

  let user: any = null;
  // If identifier is a valid Bangladeshi phone number, normalize and query by phone
  if (isValidBangladeshPhone(rawIdentifier)) {
    const normalizedPhone = normalizeBangladeshPhone(rawIdentifier);
    user = db.prepare('SELECT * FROM users WHERE phone = ?').get(normalizedPhone);
  }
  // Otherwise query by email
  if (!user) {
    user = db.prepare('SELECT * FROM users WHERE email = ?').get(rawIdentifier.toLowerCase());
  }

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({
      success: false,
      error: 'Invalid email/phone or password.'
    });
  }

  if (user.is_active === 0) {
    // Check if there is an active OTP pending for this user email or phone
    const pendingOtp: any = db.prepare(`
      SELECT id FROM otps
      WHERE (destination = ? OR destination = ?) AND consumed = 0
      LIMIT 1
    `).get(user.email, user.phone || '');
    const isUnverified = Boolean(pendingOtp);
    return res.status(403).json({
      success: false,
      requiresVerification: isUnverified,
      identifier: user.phone || user.email,
      error: isUnverified
        ? 'Account is unverified. Please complete OTP verification to activate your account.'
        : 'Account has been deactivated. Please contact administrator.'
    });
  }

  const payload = { id: user.id, email: user.email, role: user.role, name: user.name };
  const tokens = issueTokenPair(payload);
  setRefreshTokenCookie(res, tokens.refreshToken);

  res.json({
    success: true,
    message: 'Login successful.',
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      role: user.role,
      targetExam: user.target_exam,
      targetDate: user.target_date,
      targetBank: user.target_bank,
      targetPosition: user.target_position
    },
    accessToken: tokens.accessToken
  });
});

// ==========================================
// 3. Rotating Refresh Token Rotation Endpoint
// ==========================================
authRouter.post('/refresh', (req: Request, res: Response) => {
  const incomingToken = req.cookies?.refreshToken;

  if (!incomingToken) {
    return res.status(401).json({
      success: false,
      error: 'No refresh token provided in secure cookie.'
    });
  }

  // Look up token in database
  const record: any = db.prepare(`
    SELECT r.id, r.user_id, r.token_hash, r.expires_at, r.revoked_at,
           u.id as user_id, u.email, u.phone, u.name, u.role, u.is_active,
           u.target_exam, u.target_date, u.target_bank, u.target_position
    FROM refresh_tokens r
    JOIN users u ON u.id = r.user_id
    WHERE r.token_hash = ?
  `).get(incomingToken);

  if (!record || record.revoked_at || new Date() > new Date(record.expires_at)) {
    res.clearCookie('refreshToken');
    return res.status(401).json({
      success: false,
      error: 'Invalid, revoked, or expired refresh token. Please sign in again.'
    });
  }

  if (record.is_active === 0) {
    res.clearCookie('refreshToken');
    return res.status(403).json({
      success: false,
      error: 'User account is inactive.'
    });
  }

  // Revoke old refresh token (Strict rotation rule)
  db.prepare(`UPDATE refresh_tokens SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`).run(record.id);

  // Issue new token pair
  const user = { id: record.user_id, email: record.email, role: record.role, name: record.name };
  const tokens = issueTokenPair(user);
  setRefreshTokenCookie(res, tokens.refreshToken);

  res.json({
    success: true,
    accessToken: tokens.accessToken,
    user: {
      id: user.id,
      email: user.email,
      phone: record.phone,
      name: user.name,
      role: user.role,
      targetExam: record.target_exam,
      targetDate: record.target_date,
      targetBank: record.target_bank,
      targetPosition: record.target_position
    }
  });
});

// ==========================================
// 4. Logout / Invalidate Session
// ==========================================
authRouter.post('/logout', (req: Request, res: Response) => {
  const incomingToken = req.cookies?.refreshToken;
  if (incomingToken) {
    db.prepare(`UPDATE refresh_tokens SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE token_hash = ?`).run(incomingToken);
  }
  res.clearCookie('refreshToken');
  res.json({
    success: true,
    message: 'Logged out successfully.'
  });
});

// ==========================================
// 5. Request & Verify OTP (Email / Phone)
// ==========================================
authRouter.post('/otp/request', rateLimiter({ windowMs: 5 * 60 * 1000, maxRequests: 5 }), async (req: Request, res: Response) => {
  const { destination, type } = req.body;
  if (!destination || !type || !['EMAIL', 'PHONE'].includes(type)) {
    return res.status(400).json({
      success: false,
      error: 'Valid destination and type (EMAIL or PHONE) are required.'
    });
  }

  let normalizedDestination = destination.trim();
  if (type === 'PHONE') {
    const validPhone = normalizeBangladeshPhone(normalizedDestination);
    if (!validPhone) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Bangladesh mobile number format (expected +8801XXXXXXXXX or 01XXXXXXXXX).'
      });
    }
    normalizedDestination = validPhone;
  } else {
    normalizedDestination = normalizedDestination.toLowerCase();
  }

  const result = await otpService.sendOtp(normalizedDestination, type as 'EMAIL' | 'PHONE');
  res.json(result);
});

authRouter.post('/otp/verify', (req: Request, res: Response) => {
  const { destination, code } = req.body;
  if (!destination || !code) {
    return res.status(400).json({
      success: false,
      error: 'Destination and 6-digit code are required.'
    });
  }

  let normalizedDest = destination.trim();
  if (isValidBangladeshPhone(normalizedDest)) {
    normalizedDest = normalizeBangladeshPhone(normalizedDest)!;
  } else {
    normalizedDest = normalizedDest.toLowerCase();
  }

  const result = otpService.verifyOtp(normalizedDest, code);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: result.error || 'Invalid or expired OTP code.'
    });
  }

  // If this destination belongs to an unverified user, activate the account
  // Security guard: Ensure we ONLY activate accounts that are currently unverified (is_active = 0)
  // and match the verified destination (email or phone).
  const user: any = db.prepare(`
    SELECT id, email, phone, name, role, is_active, target_exam, target_date, target_bank, target_position
    FROM users
    WHERE (email = ? OR phone = ?) AND is_active = 0
  `).get(normalizedDest, normalizedDest);

  if (user) {
    db.prepare(`UPDATE users SET is_active = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`).run(user.id);
    
    // Issue token session so user is logged in immediately after verification
    const tokens = issueTokenPair(user);
    setRefreshTokenCookie(res, tokens.refreshToken);

    return res.json({
      success: true,
      activated: true,
      message: `${user.phone === normalizedDest ? 'Phone' : 'Email'} verified successfully! Your account is now active.`,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        role: user.role,
        targetExam: user.target_exam,
        targetDate: user.target_date,
        targetBank: user.target_bank,
        targetPosition: user.target_position
      },
      accessToken: tokens.accessToken
    });
  }

  res.json({
    success: true,
    activated: false,
    message: 'OTP verified successfully.'
  });
});

// ==========================================
// 6. Current User Info
// ==========================================
authRouter.get('/me', authenticateToken, (req: Request, res: Response) => {
  const user: any = db.prepare(`
    SELECT id, email, name, role, phone, target_exam, target_date, target_bank, target_position, created_at
    FROM users
    WHERE id = ?
  `).get(req.user!.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found.'
    });
  }

  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      targetExam: user.target_exam,
      targetDate: user.target_date,
      targetBank: user.target_bank,
      targetPosition: user.target_position,
      createdAt: user.created_at
    }
  });
});

// ==========================================
// 7. Student Onboarding Setup
// ==========================================
authRouter.post('/onboarding', authenticateToken, (req: Request, res: Response) => {
  const validation = onboardingSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.errors[0]?.message || 'Invalid onboarding information'
    });
  }

  const { targetExam, targetBank, targetPosition, targetDate, phone } = validation.data;
  const resolvedTargetExam = targetExam || (targetBank && targetPosition ? `${targetBank} ${targetPosition}` : null);

  db.prepare(`
    UPDATE users
    SET target_exam = COALESCE(?, target_exam),
        target_bank = COALESCE(?, target_bank),
        target_position = COALESCE(?, target_position),
        target_date = COALESCE(?, target_date),
        phone = COALESCE(?, phone),
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ?
  `).run(
    resolvedTargetExam,
    targetBank || null,
    targetPosition || null,
    targetDate || null,
    phone || null,
    req.user!.id
  );

  const updatedUser: any = db.prepare('SELECT id, email, name, role, target_exam, target_date, target_bank, target_position FROM users WHERE id = ?').get(req.user!.id);

  res.json({
    success: true,
    message: 'Onboarding completed successfully.',
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      targetExam: updatedUser.target_exam,
      targetDate: updatedUser.target_date,
      targetBank: updatedUser.target_bank,
      targetPosition: updatedUser.target_position
    }
  });
});

// ==========================================
// 8. Student Preparation Goal Update (STUDENT-only)
// ==========================================
authRouter.put('/goal', authenticateToken, (req: Request, res: Response) => {
  if (req.user?.role !== 'STUDENT') {
    return res.status(403).json({
      success: false,
      error: 'Preparation goals can only be configured for student candidate accounts.'
    });
  }

  const validation = goalUpdateSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error.errors[0]?.message || 'Invalid goal data provided.'
    });
  }

  const { targetBank, targetPosition, targetDate } = validation.data;
  const combinedTargetExam = `${targetBank.trim()} ${targetPosition.trim()}`;

  db.prepare(`
    UPDATE users
    SET target_bank = ?,
        target_position = ?,
        target_exam = ?,
        target_date = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ?
  `).run(
    targetBank.trim(),
    targetPosition.trim(),
    combinedTargetExam,
    targetDate || null,
    req.user!.id
  );

  const updatedUser: any = db.prepare(`
    SELECT id, email, name, role, target_exam, target_date, target_bank, target_position
    FROM users
    WHERE id = ?
  `).get(req.user!.id);

  // Calculate Days Remaining in Asia/Dhaka time
  let daysRemaining: number | null = null;
  if (updatedUser.target_date) {
    try {
      const dhakaDateString = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date());

      const [tYear, tMonth, tDay] = updatedUser.target_date.split('T')[0].split('-').map(Number);
      const [cYear, cMonth, cDay] = dhakaDateString.split('-').map(Number);

      const targetUtcMidnight = Date.UTC(tYear, tMonth - 1, tDay);
      const currentUtcMidnight = Date.UTC(cYear, cMonth - 1, cDay);

      daysRemaining = Math.round((targetUtcMidnight - currentUtcMidnight) / (1000 * 60 * 60 * 24));
    } catch {
      daysRemaining = null;
    }
  }

  res.json({
    success: true,
    message: 'Preparation goal saved successfully.',
    goal: {
      targetBank: updatedUser.target_bank,
      targetPosition: updatedUser.target_position,
      targetExam: updatedUser.target_exam,
      targetDate: updatedUser.target_date,
      daysRemaining
    },
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      targetExam: updatedUser.target_exam,
      targetDate: updatedUser.target_date,
      targetBank: updatedUser.target_bank,
      targetPosition: updatedUser.target_position
    }
  });
});

