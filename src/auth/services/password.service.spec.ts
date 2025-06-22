import { Test, TestingModule } from '@nestjs/testing';
import { PasswordService } from './password.service';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PasswordService],
    }).compile();

    service = module.get<PasswordService>(PasswordService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'testPassword123';
      const hashedPassword = 'hashedPassword';

      mockedBcrypt.hash.mockResolvedValue(hashedPassword as never);

      const result = await service.hashPassword(password);

      expect(result).toBe(hashedPassword);
      expect(bcrypt.hash).toHaveBeenCalledWith(password, 12);
    });
  });

  describe('validatePassword', () => {
    it('should return true for matching passwords', async () => {
      const password = 'testPassword123';
      const hashedPassword = 'hashedPassword';

      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.validatePassword(password, hashedPassword);

      expect(result).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
    });

    it('should return false for non-matching passwords', async () => {
      const password = 'testPassword123';
      const hashedPassword = 'hashedPassword';

      mockedBcrypt.compare.mockResolvedValue(false as never);

      const result = await service.validatePassword(password, hashedPassword);

      expect(result).toBe(false);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should return valid for strong passwords', () => {
      const strongPasswords = [
        'Password123!',
        'MyStr0ng@Pass',
        'C0mpl3x#Password',
        'Secure$Pass1',
      ];

      strongPasswords.forEach(password => {
        const result = service.validatePasswordStrength(password);
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });
    });

    it('should return invalid for weak passwords', () => {
      const weakPasswords = [
        'password',      // no uppercase, no numbers, no special chars
        'PASSWORD',      // no lowercase, no numbers, no special chars
        '12345678',      // no letters, no special chars
        'Pass1',         // too short
        'Password1',     // no special chars
        'Password!',     // no numbers
        'password1!',    // no uppercase
        'PASSWORD1!',    // no lowercase
      ];

      weakPasswords.forEach(password => {
        const result = service.validatePasswordStrength(password);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    it('should handle edge cases', () => {
      expect(service.validatePasswordStrength('').isValid).toBe(false);
      expect(service.validatePasswordStrength(' ').isValid).toBe(false);
      expect(service.validatePasswordStrength('       ').isValid).toBe(false);
    });
  });

  describe('generateRandomPassword', () => {
    it('should generate a random password', () => {
      const password = service.generateRandomPassword();
      
      expect(password).toBeDefined();
      expect(typeof password).toBe('string');
      expect(password.length).toBe(12); // default length
    });

    it('should generate passwords with custom length', () => {
      const password = service.generateRandomPassword(16);
      expect(password.length).toBe(16);
    });

    it('should generate unique passwords', () => {
      const password1 = service.generateRandomPassword();
      const password2 = service.generateRandomPassword();
      
      expect(password1).not.toBe(password2);
    });
  });
});