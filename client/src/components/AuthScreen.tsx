import React, { useState } from 'react';
import { Card, Button } from '../design-system';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Phone, User, Eye, EyeOff, ArrowLeft, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface AuthScreenProps {
  onSuccess: () => void;
  onBackToHome?: () => void;
  initialMode?: 'login' | 'register' | 'otp';
  lang?: 'en' | 'bn';
  onToggleLang?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onSuccess,
  onBackToHome,
  initialMode = 'login',
  lang = 'en',
  onToggleLang
}) => {
  const { login, register, requestOtp, verifyOtp, completeOnboarding } = useAuth();

  // Mode: strictly 'login' by default, or 'register', 'otp', 'onboarding'
  const [mode, setMode] = useState<'login' | 'register' | 'otp' | 'onboarding'>(initialMode);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Password visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // OTP state
  const [otpDestination, setOtpDestination] = useState('');
  const [otpCode, setOtpCode] = useState('');

  // Onboarding state
  const [targetBank, setTargetBank] = useState('Bangladesh Bank');
  const [customBank, setCustomBank] = useState('');
  const [targetPosition, setTargetPosition] = useState('Assistant Director');
  const [customPosition, setCustomPosition] = useState('');
  const [targetDate, setTargetDate] = useState('2026-12-15');

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  // -------------------------------------------------------------
  // LOGIN SUBMIT (STUDENT, INSTRUCTOR, ADMIN)
  // -------------------------------------------------------------
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const identifier = email.trim();
      await login(identifier, password);
      onSuccess();
    } catch (err: any) {
      if (err.response?.data?.requiresVerification) {
        setOtpDestination(err.response?.data?.identifier || email.trim());
        setMode('otp');
        setInfo(lang === 'en' ? 'Your account requires email verification. Please enter the OTP sent to your email.' : 'আপনার অ্যাকাউন্ট সক্রিয় করতে ইমেইল ওটিপি কোড লিখুন।');
      } else {
        setError(err.response?.data?.error || err.message || (lang === 'en' ? 'Login failed. Please check credentials.' : 'লগইন ব্যর্থ হয়েছে। তথ্য যাচাই করুন।'));
      }
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // STUDENT REGISTRATION SUBMIT
  // -------------------------------------------------------------
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');

    // Strict front-end validation
    if (!name.trim()) {
      setError(lang === 'en' ? 'Full name is required.' : 'পূর্ণ নাম আবশ্যক।');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError(lang === 'en' ? 'Valid email address is required.' : 'সঠিক ইমেইল ঠিকানা দিন।');
      return;
    }
    if (!phone.trim()) {
      setError(lang === 'en' ? 'Bangladeshi mobile number is required as contact information.' : 'বাংলাদেশি মোবাইল নম্বর আবশ্যক।');
      return;
    }

    // BD Phone regex
    const bdPhoneRegex = /^(?:\+8801|01)[3-9]\d{8}$/;
    if (!bdPhoneRegex.test(phone.trim())) {
      setError(lang === 'en' ? 'Invalid Bangladesh mobile number format (e.g. 017XXXXXXXX or +8801XXXXXXXXX).' : 'সঠিক বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।');
      return;
    }

    if (password.length < 6) {
      setError(lang === 'en' ? 'Password must be at least 6 characters.' : 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।');
      return;
    }
    if (password !== confirmPassword) {
      setError(lang === 'en' ? 'Passwords do not match.' : 'পাসওয়ার্ড দুটি মেলেনি।');
      return;
    }

    setLoading(true);
    try {
      // Role is fixed to STUDENT for public registration
      const regRes: any = await register({
        email: email.trim(),
        password,
        name: name.trim(),
        role: 'STUDENT',
        phone: phone.trim()
      });

      if (regRes && regRes.requiresVerification) {
        setOtpDestination(regRes.email || email.trim());
        setMode('otp');
        setInfo(regRes.message || (lang === 'en' ? `Verification code dispatched to ${email}. Enter the 6-digit code below to activate your account.` : `ভেরিফিকেশন কোড পাঠানো হয়েছে ${email} ঠিকানায়। সক্রিয় করতে ৬ ডিজিটের কোড দিন।`));
      } else {
        setMode('onboarding');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || (lang === 'en' ? 'Registration failed. Please try again.' : 'নিবন্ধন ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।'));
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // RESEND OTP REQUEST
  // -------------------------------------------------------------
  const handleResendOtp = async () => {
    if (!otpDestination) {
      setError(lang === 'en' ? 'Destination email is missing.' : 'ইমেইল ঠিকানা পাওয়া যায়নি।');
      return;
    }
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const msg = await requestOtp(otpDestination, 'EMAIL');
      setInfo(msg || (lang === 'en' ? 'A fresh verification code has been dispatched to your email.' : 'একটি নতুন ভেরিফিকেশন কোড আপনার ইমেইলে পাঠানো হয়েছে।'));
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || (lang === 'en' ? 'Failed to dispatch verification code.' : 'ওটিপি কোড পাঠাতে ব্যর্থ হয়েছে।'));
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // VERIFY OTP SUBMIT
  // -------------------------------------------------------------
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!otpCode || otpCode.trim().length !== 6) {
      setError(lang === 'en' ? 'Please enter the 6-digit code sent to your email.' : 'অনুগ্রহ করে ৬ ডিজিটের ওটিপি কোডটি লিখুন।');
      return;
    }

    setLoading(true);
    try {
      const res = await verifyOtp(otpDestination, otpCode.trim());
      if (res.success) {
        if (res.activated) {
          setInfo(lang === 'en' ? 'Verification successful! Your student account is now active.' : 'ইমেইল যাচাই সফল হয়েছে! আপনার অ্যাকাউন্ট সক্রিয় হয়েছে।');
          setMode('onboarding');
        } else {
          setInfo(lang === 'en' ? 'Verification successful! Please log in.' : 'যাচাই সফল হয়েছে! অনুগ্রহ করে লগইন করুন।');
          setMode('login');
        }
      } else {
        setError(res.message || (lang === 'en' ? 'Invalid or expired OTP code.' : 'ভুল বা মেয়াদোত্তীর্ণ ওটিপি কোড।'));
      }
    } catch (err: any) {
      setError(err.response?.data?.error || (lang === 'en' ? 'Verification failed.' : 'যাচাই প্রক্রিয়া ব্যর্থ হয়েছে।'));
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // ONBOARDING SUBMIT
  // -------------------------------------------------------------
  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const effectiveBank = targetBank === 'OTHER' ? customBank.trim() : targetBank;
    const effectivePosition = targetPosition === 'CUSTOM' ? customPosition.trim() : targetPosition;

    if (!effectiveBank) {
      setError(lang === 'en' ? 'Please specify your Target Bank.' : 'টার্গেট ব্যাংক নির্বাচন করুন।');
      return;
    }
    if (!effectivePosition) {
      setError(lang === 'en' ? 'Please specify your Target Position.' : 'টার্গেট পদবী নির্বাচন করুন।');
      return;
    }

    setLoading(true);
    try {
      await completeOnboarding({
        targetBank: effectiveBank,
        targetPosition: effectivePosition,
        targetExam: `${effectiveBank} ${effectivePosition}`,
        targetDate: targetDate || undefined
      });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || (lang === 'en' ? 'Onboarding update failed.' : 'অনবোর্ডিং তথ্য সংরক্ষণ ব্যর্থ হয়েছে।'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 20px', color: '#0f172a' }}>
      <div style={{ maxWidth: '460px', width: '100%', margin: '0 auto' }}>
        {/* Top Back to Home and Language Toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          {onBackToHome && (
            <button
              onClick={onBackToHome}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'transparent',
                border: 'none',
                color: '#2563eb',
                fontSize: '0.88rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={16} />
              <span>{lang === 'en' ? 'Back to Home' : 'হোম পেজে ফিরুন'}</span>
            </button>
          )}

          {onToggleLang && (
            <button
              onClick={onToggleLang}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                marginLeft: 'auto'
              }}
            >
              {lang === 'en' ? 'বাংলা' : 'English'}
            </button>
          )}
        </div>

        {/* Main Card */}
        <Card elevated>
          {/* Header Brand */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                margin: '0 auto 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '22px',
                color: '#ffffff',
                boxShadow: '0 2px 6px rgba(37,99,235,0.25)'
              }}
            >
              ৳
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
              {mode === 'login'
                ? lang === 'en'
                  ? 'Sign in to Bank Exam LMS'
                  : 'ব্যাংক এক্সাম এলএমএস লগইন'
                : mode === 'register'
                ? lang === 'en'
                  ? 'Create Student Account'
                  : 'স্টুডেন্ট অ্যাকাউন্ট তৈরি করুন'
                : mode === 'otp'
                ? lang === 'en'
                  ? 'Verify Your Email'
                  : 'ইমেইল ভেরিফিকেশন'
                : lang === 'en'
                ? 'Candidate Goal Setup'
                : 'আপনার লক্ষ্য নির্ধারণ'}
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
              {mode === 'login'
                ? lang === 'en'
                  ? 'Enter credentials to access your dashboard'
                  : 'ড্যাশবোর্ডে প্রবেশ করতে তথ্য দিন'
                : mode === 'register'
                ? lang === 'en'
                  ? 'Join candidate preparation for banking exams'
                  : 'ব্যাংক নিয়োগ প্রস্তুতির জন্য যুক্ত হোন'
                : mode === 'otp'
                ? lang === 'en'
                  ? `Enter the 6-digit code sent to ${otpDestination}`
                  : `${otpDestination} ঠিকানায় পাঠানো ৬ ডিজিটের কোড দিন`
                : lang === 'en'
                ? 'Personalize your preparation timeline and exam goal'
                : 'আপনার টার্গেট ব্যাংক ও পদের তথ্য দিন'}
            </p>
          </div>

          {/* Feedback messages */}
          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: '0.85rem',
                marginBottom: '16px'
              }}
            >
              {error}
            </div>
          )}
          {info && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#15803d',
                fontSize: '0.85rem',
                marginBottom: '16px'
              }}
            >
              {info}
            </div>
          )}

          {/* ======================================================== */}
          {/* 1. LOGIN FORM (DEFAULT)                                  */}
          {/* ======================================================== */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  {lang === 'en' ? 'Email or Mobile Number' : 'ইমেইল অথবা মোবাইল নম্বর'}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={lang === 'en' ? 'candidate@banklms.ac.bd or 017XXXXXXXX' : 'ইমেইল অথবা মোবাইল নম্বর লিখুন'}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a',
                      fontSize: '0.92rem',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  {lang === 'en' ? 'Password' : 'পাসওয়ার্ড'}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={lang === 'en' ? 'Enter your password' : 'পাসওয়ার্ড লিখুন'}
                    style={{
                      width: '100%',
                      padding: '10px 40px 10px 12px',
                      borderRadius: '8px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a',
                      fontSize: '0.92rem',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px'
                    }}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '11px',
                  borderRadius: '8px',
                  background: '#2563eb',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  boxShadow: '0 2px 4px rgba(37,99,235,0.2)',
                  marginTop: '4px'
                }}
              >
                {loading
                  ? lang === 'en'
                    ? 'Signing in...'
                    : 'লগইন হচ্ছে...'
                  : lang === 'en'
                  ? 'Sign In to Portal'
                  : 'পোর্টাল লগইন'}
              </button>

              {/* Navigation link to Register */}
              <div style={{ textAlign: 'center', marginTop: '12px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  {lang === 'en' ? "Don't have a student account? " : 'এখনও কোনো অ্যাকাউন্ট নেই? '}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError('');
                    setInfo('');
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#2563eb',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  {lang === 'en' ? 'Create Student Account' : 'স্টুডেন্ট অ্যাকাউন্ট তৈরি করুন'}
                </button>
              </div>
            </form>
          )}

          {/* ======================================================== */}
          {/* 2. STUDENT REGISTRATION FORM                             */}
          {/* ======================================================== */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  {lang === 'en' ? 'Full Name *' : 'পূর্ণ নাম *'}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={lang === 'en' ? 'e.g. Mohammad Rahman' : 'আপনার পূর্ণ নাম লিখুন'}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#0f172a',
                    fontSize: '0.92rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  {lang === 'en' ? 'Email Address (for OTP verification) *' : 'ইমেইল ঠিকানা (ওটিপি যাচাইয়ের জন্য) *'}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="candidate@banklms.ac.bd"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#0f172a',
                    fontSize: '0.92rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  {lang === 'en' ? 'Phone Number (Contact Information) *' : 'মোবাইল নম্বর (যোগাযোগের জন্য) *'}
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="017XXXXXXXX or +8801XXXXXXXXX"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#0f172a',
                    fontSize: '0.92rem',
                    outline: 'none'
                  }}
                />
                <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginTop: '3px' }}>
                  {lang === 'en' ? 'Mandatory contact information; verification uses email.' : 'যোগাযোগের জন্য আবশ্যক; ওটিপি যাচাই ইমেইলে সম্পন্ন হবে।'}
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  {lang === 'en' ? 'Password (min 6 characters) *' : 'পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর) *'}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={lang === 'en' ? 'Create a secure password' : 'পাসওয়ার্ড দিন'}
                    style={{
                      width: '100%',
                      padding: '10px 40px 10px 12px',
                      borderRadius: '8px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a',
                      fontSize: '0.92rem',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px'
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  {lang === 'en' ? 'Confirm Password *' : 'পাসওয়ার্ড নিশ্চিত করুন *'}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={lang === 'en' ? 'Re-type password' : 'পাসওয়ার্ড পুনরায় লিখুন'}
                    style={{
                      width: '100%',
                      padding: '10px 40px 10px 12px',
                      borderRadius: '8px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a',
                      fontSize: '0.92rem',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px'
                    }}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '11px',
                  borderRadius: '8px',
                  background: '#2563eb',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  boxShadow: '0 2px 4px rgba(37,99,235,0.2)',
                  marginTop: '6px'
                }}
              >
                {loading
                  ? lang === 'en'
                    ? 'Registering...'
                    : 'নিবন্ধন হচ্ছে...'
                  : lang === 'en'
                  ? 'Register & Receive Email OTP'
                  : 'নিবন্ধন ও ইমেইল ওটিপি গ্রহণ'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '12px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  {lang === 'en' ? 'Already have an account? ' : 'ইতিমধ্যে অ্যাকাউন্ট আছে? '}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                    setInfo('');
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#2563eb',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  {lang === 'en' ? 'Back to Login' : 'লগইনে ফিরুন'}
                </button>
              </div>
            </form>
          )}

          {/* ======================================================== */}
          {/* 3. SEPARATE EMAIL OTP VERIFICATION PAGE                  */}
          {/* ======================================================== */}
          {mode === 'otp' && (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: '#eff6ff', padding: '14px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e40af', fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px' }}>
                  <ShieldCheck size={18} />
                  <span>{lang === 'en' ? 'Email OTP Dispatch' : 'ইমেইল ভেরিফিকেশন'}</span>
                </div>
                <p style={{ fontSize: '0.82rem', color: '#334155', lineHeight: 1.5 }}>
                  {lang === 'en'
                    ? `A single-use 6-digit verification code was generated for ${otpDestination}. Check your inbox or terminal log.`
                    : `${otpDestination} ঠিকানায় ৬ ডিজিটের ওটিপি কোড পাঠানো হয়েছে। কোডটি নিচে লিখুন।`}
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '8px', textAlign: 'center' }}>
                  {lang === 'en' ? 'Enter 6-Digit OTP Code' : '৬ ডিজিটের ওটিপি কোড লিখুন'}
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    background: '#ffffff',
                    border: '2px solid #2563eb',
                    color: '#0f172a',
                    fontSize: '1.4rem',
                    fontWeight: 700,
                    textAlign: 'center',
                    letterSpacing: '0.3em',
                    outline: 'none',
                    fontFamily: 'monospace'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading || otpCode.trim().length !== 6}
                style={{
                  width: '100%',
                  padding: '11px',
                  borderRadius: '8px',
                  background: '#2563eb',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  border: 'none',
                  cursor: (loading || otpCode.trim().length !== 6) ? 'not-allowed' : 'pointer',
                  opacity: (loading || otpCode.trim().length !== 6) ? 0.6 : 1,
                  boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
                }}
              >
                {loading
                  ? lang === 'en'
                    ? 'Verifying...'
                    : 'যাচাই হচ্ছে...'
                  : lang === 'en'
                  ? 'Verify OTP & Activate'
                  : 'ওটিপি যাচাই ও সক্রিয় করুন'}
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '0.85rem' }}>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#2563eb',
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {lang === 'en' ? 'Resend OTP' : 'পুনরায় ওটিপি পাঠান'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                    setInfo('');
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {lang === 'en' ? 'Back to Login' : 'লগইনে ফিরুন'}
                </button>
              </div>
            </form>
          )}

          {/* ======================================================== */}
          {/* 4. ONBOARDING (STUDENT TARGET SETUP)                     */}
          {/* ======================================================== */}
          {mode === 'onboarding' && (
            <form onSubmit={handleOnboardingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#dcfce7', padding: '12px 14px', borderRadius: '8px', border: '1px solid #86efac', display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontSize: '0.85rem', fontWeight: 600 }}>
                <CheckCircle2 size={18} />
                <span>{lang === 'en' ? 'Account Activated! Set your preparation target.' : 'অ্যাকাউন্ট সক্রিয় হয়েছে! লক্ষ্য নির্ধারণ করুন।'}</span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  {lang === 'en' ? 'Target Bank *' : 'টার্গেট ব্যাংক *'}
                </label>
                <select
                  value={targetBank}
                  onChange={(e) => setTargetBank(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#0f172a',
                    outline: 'none'
                  }}
                >
                  <option value="Bangladesh Bank">Bangladesh Bank (Central Bank)</option>
                  <option value="Sonali Bank">Sonali Bank PLC</option>
                  <option value="Janata Bank">Janata Bank PLC</option>
                  <option value="Agrani Bank">Agrani Bank PLC</option>
                  <option value="Rupali Bank">Rupali Bank PLC</option>
                  <option value="Bangladesh Krishi Bank">Bangladesh Krishi Bank</option>
                  <option value="Combined 8 Banks">Combined 8/9 Senior Officer & Officer</option>
                  <option value="OTHER">Other Bank / Financial Institution</option>
                </select>
                {targetBank === 'OTHER' && (
                  <input
                    type="text"
                    placeholder="Enter Institution Name..."
                    value={customBank}
                    onChange={(e) => setCustomBank(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      marginTop: '8px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: '#ffffff',
                      border: '1px solid #2563eb',
                      color: '#0f172a'
                    }}
                  />
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  {lang === 'en' ? 'Target Position / Cadre *' : 'টার্গেট পদবী *'}
                </label>
                <select
                  value={targetPosition}
                  onChange={(e) => setTargetPosition(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#0f172a',
                    outline: 'none'
                  }}
                >
                  <option value="Assistant Director">Assistant Director (AD)</option>
                  <option value="Senior Officer">Senior Officer (SO)</option>
                  <option value="Officer">Officer (General)</option>
                  <option value="Officer Cash">Officer (Cash)</option>
                  <option value="Officer IT">Officer (IT / Programmer)</option>
                  <option value="CUSTOM">Custom Position / Special Cadre</option>
                </select>
                {targetPosition === 'CUSTOM' && (
                  <input
                    type="text"
                    placeholder="e.g. Research Officer, Assistant Programmer..."
                    value={customPosition}
                    onChange={(e) => setCustomPosition(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      marginTop: '8px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: '#ffffff',
                      border: '1px solid #2563eb',
                      color: '#0f172a'
                    }}
                  />
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  {lang === 'en' ? 'Target Exam Date (Estimated)' : 'সম্ভাব্য পরীক্ষার তারিখ'}
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#0f172a'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '11px',
                  borderRadius: '8px',
                  background: '#2563eb',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 4px rgba(37,99,235,0.2)',
                  marginTop: '8px'
                }}
              >
                {loading
                  ? lang === 'en'
                    ? 'Entering Portal...'
                    : 'প্রবেশ হচ্ছে...'
                  : lang === 'en'
                  ? 'Complete & Go to Dashboard'
                  : 'সম্পূর্ণ করুন ও ড্যাশবোর্ডে যান'}
              </button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
};
