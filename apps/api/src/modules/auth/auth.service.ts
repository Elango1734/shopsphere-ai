import type { RegisterInput, LoginInput } from '@shopsphere/validation';
import {
  registerCustomerAccount,
  findByEmail,
  findByPhone,
  findById,
  verifyPassword,
  hashPassword,
  recordFailedLogin,
  recordSuccessfulLogin
} from '../../repositories/user.repository.js';
import {
  createRefreshSession,
  rotateRefreshSession,
  revokeRefreshSession,
  revokeAllSessionsForUser,
  type DeviceContext
} from '../../repositories/refreshSession.repository.js';
import { UserModel, type UserDocument } from '../../models/user.model.js';
import { signAccessToken } from './jwt.js';
import { AppError, UnauthorizedError, ConflictError } from '../../http/errors.js';
import { toUserDto } from './dto.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export class AccountLockedError extends AppError {
  constructor() {
    super(423, 'ACCOUNT_LOCKED', 'This account is temporarily locked due to repeated failed sign-in attempts');
  }
}

export class AccountNotActiveError extends AppError {
  constructor() {
    super(403, 'ACCOUNT_NOT_ACTIVE', 'This account cannot sign in');
  }
}

async function issueTokens(user: UserDocument, device: DeviceContext) {
  const accessToken = signAccessToken({ sub: user._id.toString(), roles: user.roles });
  const refreshToken = await createRefreshSession(user._id.toString(), device);
  return { accessToken, refreshToken, user: toUserDto(user) };
}

export async function register(input: RegisterInput, device: DeviceContext) {
  if (input.email && (await findByEmail(input.email))) {
    throw new ConflictError('EMAIL_IN_USE', 'An account with this email already exists');
  }
  if (input.phone && (await findByPhone(input.phone))) {
    throw new ConflictError('PHONE_IN_USE', 'An account with this phone number already exists');
  }

  const user = await registerCustomerAccount({
    ...(input.email ? { email: input.email } : {}),
    ...(input.phone ? { phone: input.phone } : {}),
    plainPassword: input.password,
    ...(input.displayName ? { displayName: input.displayName } : {})
  });
  return issueTokens(user, device);
}

export async function login(input: LoginInput, device: DeviceContext) {
  const user = input.email ? await findByEmail(input.email) : await findByPhone(input.phone!);
  if (!user) {
    throw new UnauthorizedError('Incorrect email/phone or password');
  }

  if (user.security?.lockedUntil && user.security.lockedUntil.getTime() > Date.now()) {
    throw new AccountLockedError();
  }

  const valid = await verifyPassword(user.passwordHash, input.password);
  if (!valid) {
    const attempts = (user.security?.failedLoginAttempts ?? 0) + 1;
    const lockUntil = attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS) : undefined;
    await recordFailedLogin(user._id.toString(), lockUntil);
    throw new UnauthorizedError('Incorrect email/phone or password');
  }

  if (user.status === 'suspended' || user.status === 'deleted') {
    throw new AccountNotActiveError();
  }

  await recordSuccessfulLogin(user._id.toString());
  return issueTokens(user, device);
}

export async function refresh(rawRefreshToken: string, device: DeviceContext) {
  const { userId, rawToken } = await rotateRefreshSession(rawRefreshToken, device);
  const user = await findById(userId);
  if (!user || user.status === 'suspended' || user.status === 'deleted') {
    throw new AccountNotActiveError();
  }
  const accessToken = signAccessToken({ sub: user._id.toString(), roles: user.roles });
  return { accessToken, refreshToken: rawToken, user: toUserDto(user) };
}

export async function logout(rawRefreshToken: string): Promise<void> {
  await revokeRefreshSession(rawRefreshToken);
}

export async function getProfile(userId: string) {
  const user = await findById(userId);
  if (!user) throw new UnauthorizedError();
  return toUserDto(user);
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await UserModel.findById(userId).select('+passwordHash');
  if (!user) throw new UnauthorizedError();

  const valid = await verifyPassword(user.passwordHash, currentPassword);
  if (!valid) throw new UnauthorizedError('Current password is incorrect');

  user.passwordHash = await hashPassword(newPassword);
  await user.save();
  // Changing a password invalidates every existing session except the one making this request's next refresh.
  await revokeAllSessionsForUser(userId, 'password changed');
}
