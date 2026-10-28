import React, { useState } from 'react';
import {
  BookOpen,
  Award,
  CheckCircle,
  Clock,
  Shield,
  BarChart2,
  Search,
  Globe,
  LogIn,
  ArrowRight,
  Play,
  FileText,
  Target,
  ChevronRight,
  Sparkles,
  TrendingUp,
  BrainCircuit,
  Calculator,
  Compass,
  CheckCircle2,
  Flame,
  Star,
  Zap,
  Bookmark
} from 'lucide-react';

interface LandingPageProps {
  onLoginClick: () => void;
  onRegisterClick: () => void;
  lang: 'en' | 'bn';
  onToggleLang: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onLoginClick,
  onRegisterClick,
  lang,
  onToggleLang
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Real, confirmed categories from database with distinctive soft-pastel color schemes
  const categories = [
    {
      id: 'ALL',
      titleEn: 'All Courses',
      titleBn: 'সকল কোর্স',
      icon: BookOpen,
      count: '6 Published',
      color: '#2563EB',
      bgColor: '#EFF6FF',
      borderColor: '#BFDBFE'
    },
    {
      id: 'MATH',
      titleEn: 'Quantitative Aptitude & Math',
      titleBn: 'গণিত ও পারদর্শিতা',
      icon: Calculator,
      count: '2 Courses',
      color: '#D97706',
      bgColor: '#FEF3C7',
      borderColor: '#FDE68A'
    },
    {
      id: 'ENGLISH',
      titleEn: 'English Language & Writing',
      titleBn: 'ইংরেজি ভাষা ও লিখন',
      icon: FileText,
      count: '2 Courses',
      color: '#7C3AED',
      bgColor: '#EDE9FE',
      borderColor: '#DDD6FE'
    },
    {
      id: 'BANKING',
      titleEn: 'Banking Affairs & IT',
      titleBn: 'ব্যাংকিং ও কম্পিউটার',
      icon: Shield,
      count: '1 Course',
      color: '#059669',
      bgColor: '#D1FAE5',
      borderColor: '#A7F3D0'
    },
    {
      id: 'BANGLA',
      titleEn: 'Bangla Grammar & Literature',
      titleBn: 'বাংলা ভাষা ও সাহিত্য',
      icon: Award,
      count: '1 Course',
      color: '#DC2626',
      bgColor: '#FEE2E2',
      borderColor: '#FECACA'
    }
  ];

  // Real published courses with rich educational styling
  const publishedCourses = [
    {
      id: 'bb7fb3d7-0849-4f2d-ac85-e9813156bc65',
      cat: 'MATH',
      categoryEn: 'Quantitative Aptitude & Mathematics',
      categoryBn: 'গণিত ও পারদর্শিতা',
      titleEn: 'Bank Math Foundation: Commercial Arithmetic Mastery',
      titleBn: 'ব্যাংক গণিত ফাউন্ডেশন: বাণিজ্যিক পাটিগণিত দক্ষতা',
      descEn: 'Comprehensive mastery of profit-loss, percentages, compound interest, time & work for bank recruitment exams.',
      descBn: 'লাভ-ক্ষতি, শতকরা, যৌগিক মুনাফা, সময় ও কাজের উপর পূর্ণাঙ্গ প্রস্তুতি।',
      lessons: 2,
      duration: '45 mins',
      tag: 'Core Foundation',
      gradient: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 60%, #38BDF8 100%)',
      accentColor: '#2563EB',
      tagBg: '#EFF6FF',
      tagColor: '#1D4ED8'
    },
    {
      id: 'bbc23305-16a7-4b0d-9795-861986393210',
      cat: 'ENGLISH',
      categoryEn: 'English Language & Comprehension',
      categoryBn: 'ইংরেজি ভাষা ও ব্যাকরণ',
      titleEn: 'English Vocabulary, Analogy & Error Detection for Bank Exams',
      titleBn: 'ব্যাংক পরীক্ষার ইংরেজি শব্দভাণ্ডার, অ্যানালজি ও বাক্য শুদ্ধিকরণ',
      descEn: 'Master high-frequency GRE/Bank vocabulary, verbal analogies, prepositions, and grammar rules for Officer & AD exams.',
      descBn: 'অফিসার ও এডি পরীক্ষার জন্য প্রয়োজনীয় শব্দভাণ্ডার ও গ্রামার রুলস।',
      lessons: 1,
      duration: '25 mins',
      tag: 'High Scoring',
      gradient: 'linear-gradient(135deg, #5B21B6 0%, #7C3AED 60%, #A78BFA 100%)',
      accentColor: '#7C3AED',
      tagBg: '#EDE9FE',
      tagColor: '#6D28D9'
    },
    {
      id: '2e8b0163-05de-4532-88c6-bfcdedc0851b',
      cat: 'BANKING',
      categoryEn: 'Banking Affairs & Computer IT',
      categoryBn: 'ব্যাংকিং ও কম্পিউটার',
      titleEn: 'Central Banking, Monetary Policy & Computer Literacy',
      titleBn: 'সেন্ট্রাল ব্যাংকিং, মুদ্রানীতি ও কম্পিউটার জ্ঞান',
      descEn: 'Covers Bangladesh Bank functions, banking instruments, macroeconomic indicators, and computer hardware & networking.',
      descBn: 'বাংলাদেশ ব্যাংকের কার্যাবলী, মুদ্রানীতি এবং আইটি বিষয়ক প্রশ্নাবলি।',
      lessons: 1,
      duration: '30 mins',
      tag: 'Specialized Cadre',
      gradient: 'linear-gradient(135deg, #065F46 0%, #059669 60%, #34D399 100%)',
      accentColor: '#059669',
      tagBg: '#D1FAE5',
      tagColor: '#047857'
    },
    {
      id: 'e07a1968-31bd-4e80-8713-810356e5538d',
      cat: 'BANGLA',
      categoryEn: 'Bangla Language & Literature',
      categoryBn: 'বাংলা ভাষা ও সাহিত্য',
      titleEn: 'Bangla Grammar, Spelling Rules & Literature for Bank Recruitment',
      titleBn: 'ব্যাংক নিয়োগ পরীক্ষায় বাংলা ব্যাকরণ, শুদ্ধ বানান ও সাহিত্য',
      descEn: 'Covers N-tya/S-tya Vidhan, Sandhi, Samas, and notable modern Bengali literary figures required for preliminary tests.',
      descBn: 'ণ-ত্ব ও ষ-ত্ব বিধান, সন্ধি, সমাস ও গুরুত্বপূর্ণ সাহিত্যিক পরিচিতি।',
      lessons: 1,
      duration: '20 mins',
      tag: 'Preliminary Prep',
      gradient: 'linear-gradient(135deg, #991B1B 0%, #DC2626 60%, #F87171 100%)',
      accentColor: '#DC2626',
      tagBg: '#FEE2E2',
      tagColor: '#B91C1C'
    },
    {
      id: '0cac5215-82ef-46ac-b91d-71960e57a8ae',
      cat: 'ENGLISH',
      categoryEn: 'English Language & Comprehension',
      categoryBn: 'ইংরেজি ভাষা ও লিখন',
      titleEn: 'Bank Written English: Focus Writing, Critical Reading & Translation',
      titleBn: 'ব্যাংক লিখিত ইংরেজি: ফোকাস রাইটিং ও অনুবাদ প্রস্তুতি',
      descEn: 'Detailed structures for editorial essays, arguments, English-to-Bangla translation, and critical précis writing.',
      descBn: 'সম্পাদকীয় প্রবন্ধ, নির্ভুল অনুবাদ ও লিখিত পরীক্ষার কৌশল।',
      lessons: 1,
      duration: '40 mins',
      tag: 'Written Stage',
      gradient: 'linear-gradient(135deg, #4C1D95 0%, #6D28D9 60%, #9333EA 100%)',
      accentColor: '#6D28D9',
      tagBg: '#F3E8FF',
      tagColor: '#581C87'
    },
    {
      id: '47a70bf8-aad9-4a6a-8a82-1011b7198ed0',
      cat: 'MATH',
      categoryEn: 'Quantitative Aptitude & Mathematics',
      categoryBn: 'গণিত ও পারদর্শিতা',
      titleEn: 'Manual QA Course - Admin Approval Test',
      titleBn: 'মডেল কোর্স - প্রশাসনিক অনুমোদন ও রিভিশন',
      descEn: 'Administrative benchmark curriculum testing structured lessons, previews, and module progress verification.',
      descBn: 'অ্যাকাডেমিক কারিকুলাম ও মডিউল প্রোগ্রেস ভেরিফিকেশন কোর্স।',
      lessons: 2,
      duration: '35 mins',
      tag: 'Quality Verified',
      gradient: 'linear-gradient(135deg, #9A3412 0%, #D97706 60%, #FBBF24 100%)',
      accentColor: '#D97706',
      tagBg: '#FEF3C7',
      tagColor: '#B45309'
    }
  ];

  // Filter courses based on search and category
  const filteredCourses = publishedCourses.filter((course) => {
    const matchesCat = selectedCategory === 'ALL' || course.cat === selectedCategory;
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      course.titleEn.toLowerCase().includes(q) ||
      course.titleBn.toLowerCase().includes(q) ||
      course.categoryEn.toLowerCase().includes(q) ||
      course.descEn.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  // Confirmed real features in the LMS with colorful badges and styling
  const features = [
    {
      icon: BookOpen,
      titleEn: 'Structured Learning Materials',
      titleBn: 'পরিকল্পিত লার্নিং ম্যাটেরিয়ালস',
      descEn: 'Multi-module courses with lesson previews, rich text explanation, and downloadable reference resources.',
      descBn: 'পাঠ্যভিত্তিক মডিউল, ফ্রি প্রিভিউ এবং সহায়ক পাঠ্য উপকরণ।',
      color: '#2563EB',
      bgColor: '#EFF6FF',
      badge: 'Curriculum'
    },
    {
      icon: Target,
      titleEn: 'Categorized Question Bank',
      titleBn: 'অধ্যায়ভিত্তিক প্রশ্ন ব্যাংক',
      descEn: 'Over 1,300+ bilingual questions across Mathematics, English, Analytical, General Knowledge, and IT.',
      descBn: 'গণিত, ইংরেজি, তথ্যপ্রযুক্তি ও সাধারণ জ্ঞানের ১,৩০০+ দ্বৈত ভাষার প্রশ্ন।',
      color: '#059669',
      bgColor: '#D1FAE5',
      badge: '1,300+ Questions'
    },
    {
      icon: Clock,
      titleEn: 'Server-Timed Mock Examinations',
      titleBn: 'টাইমারযুক্ত পূর্ণাঙ্গ মক টেস্ট',
      descEn: 'Timed mock exams matching Bangladesh Bank and Combined 8 Banks patterns with real-time countdown.',
      descBn: 'বাংলাদেশ ব্যাংক ও সমন্বিত ৮ ব্যাংকের বাস্তব পরীক্ষার নিয়মে নির্দিষ্ট সময়ের পরীক্ষা।',
      color: '#D97706',
      bgColor: '#FEF3C7',
      badge: 'Live Countdown'
    },
    {
      icon: Shield,
      titleEn: 'Proctoring & Exam Integrity',
      titleBn: 'পরীক্ষার নিরাপত্তা ও প্রক্টরিং',
      descEn: 'Tab-switch detection, fullscreen monitoring, and violation strike tracking to guarantee authentic evaluation.',
      descBn: 'ট্যাব পরিবর্তন প্রতিরোধ ও প্রক্টরিং অ্যালার্ট সিস্টেম।',
      color: '#DC2626',
      bgColor: '#FEE2E2',
      badge: 'Strike Lock'
    },
    {
      icon: BarChart2,
      titleEn: 'Authoritative Instant Grading',
      titleBn: 'স্বয়ংক্রিয় দ্রুত ফলাফল ও মার্কস',
      descEn: 'Instant evaluation with negative marking, percentile ranking, subject-wise accuracy, and pass/fail thresholds.',
      descBn: 'নেগেটিভ মার্কিং হিসাব, পাস/ফেল নির্ধারণ এবং বিষয়ভিত্তিক নির্ভুলতা মূল্যায়ন।',
      color: '#7C3AED',
      bgColor: '#EDE9FE',
      badge: 'Negative Marking'
    },
    {
      icon: Award,
      titleEn: 'Post-Exam Solution Review',
      titleBn: 'বিস্তারিত সমাধান ও সঠিক উত্তর পর্যালোচনা',
      descEn: 'Review full question papers with color-coded answer comparison, LaTeX math formulas, and step-by-step solutions.',
      descBn: 'প্রতিটি প্রশ্নের সঠিক উত্তরের ব্যাখ্যা এবং গাণিতিক সূত্রের ধাপে ধাপে পর্যালোচনা।',
      color: '#0284C7',
      bgColor: '#E0F2FE',
      badge: 'Detailed Explanations'
    }
  ];

  const steps = [
    {
      num: '01',
      titleEn: 'Create a Student Account',
      titleBn: 'স্টুডেন্ট একাউন্ট তৈরি করুন',
      descEn: 'Sign up securely with your email, set your preparation goal, and verify with a single-use OTP.',
      descBn: 'ইমেইল ও পাসওয়ার্ড দিয়ে সহজে একাউন্ট তৈরি করে ওটিপি দিয়ে সক্রিয় করুন।',
      badgeColor: '#2563EB',
      bgColor: '#EFF6FF'
    },
    {
      num: '02',
      titleEn: 'Explore Available Courses',
      titleBn: 'উপযুক্ত কোর্স নির্বাচন করুন',
      descEn: 'Learn syllabus chapters, watch curated lesson lectures, and download vetted preparation notes.',
      descBn: 'অনুমোদিত কোর্সগুলো থেকে আপনার পছন্দের অধ্যায়গুলো অনুশীলন শুরু করুন।',
      badgeColor: '#059669',
      bgColor: '#D1FAE5'
    },
    {
      num: '03',
      titleEn: 'Practice & Track Progress',
      titleBn: 'পরীক্ষা দিন ও অগ্রগতি ট্র্যাক করুন',
      descEn: 'Take timed mock exams, review your mistakes with detailed solutions, and sharpen your speed.',
      descBn: 'লাইভ মক টেস্টে অংশ নিন এবং বিস্তারিত বিশ্লেষণের মাধ্যমে নিজেকে প্রস্তুত করুন।',
      badgeColor: '#D97706',
      bgColor: '#FEF3C7'
    }
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', color: '#0F172A', fontFamily: 'var(--font-sans)', overflowX: 'hidden' }}>
      {/* ============================================================ */}
      {/* SCOPED ANIMATIONS & HOVER STYLES                             */}
      {/* ============================================================ */}
      <style>{`
        @keyframes floatSlow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(0.5deg); }
        }
        @keyframes floatReverse {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(8px) rotate(-0.5deg); }
        }
        @keyframes pulseSoft {
          0%, 100% { opacity: 0.9; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.02); }
        }
        @keyframes shimmerGlow {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .hero-float-1 {
          animation: floatSlow 5s ease-in-out infinite;
        }
        .hero-float-2 {
          animation: floatReverse 6s ease-in-out infinite;
        }
        .card-interactive {
          transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
        }
        .card-interactive:hover {
          transform: translateY(-5px);
          box-shadow: 0 16px 30px -8px rgba(16, 42, 67, 0.1), 0 4px 10px -2px rgba(16, 42, 67, 0.04);
        }
        .btn-interactive {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .btn-interactive:hover {
          transform: translateY(-2px);
          filter: brightness(1.05);
        }
        .category-pill:hover {
          transform: translateY(-3px) scale(1.01);
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-float-1, .hero-float-2, .card-interactive, .btn-interactive {
            animation: none !important;
            transition: none !important;
          }
        }
        @media (max-width: 860px) {
          .nav-search-desktop { display: none !important; }
          .nav-links-desktop { display: none !important; }
        }
      `}</style>

      {/* ============================================================ */}
      {/* SECTION A — ENHANCED RESPONSIVE NAVIGATION BAR               */}
      {/* ============================================================ */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: '#EFF6FF',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid #BFDBFE',
          boxShadow: '0 2px 8px -2px rgba(16, 42, 67, 0.06)'
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px'
          }}
        >
          {/* Left: Brand Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 50%, #38BDF8 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '22px',
                  color: '#FFFFFF',
                  boxShadow: '0 4px 10px rgba(37,99,235,0.3)',
                  border: '1px solid rgba(255,255,255,0.3)'
                }}
              >
                ৳
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.25rem', color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                  Bank Exam <span style={{ color: '#2563EB' }}>LMS</span>
                </div>
                <div style={{ fontSize: '0.74rem', color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Sparkles size={11} />
                  <span>{lang === 'en' ? 'Professional Preparation Portal' : 'ব্যাংক নিয়োগ প্রস্তুতি পোর্টাল'}</span>
                </div>
              </div>
            </div>

            {/* Navigation Links */}
            <nav style={{ display: 'flex', alignItems: 'center', gap: '22px' }} className="nav-links-desktop">
              <a
                href="#courses"
                style={{ textDecoration: 'none', color: '#0F172A', fontSize: '0.92rem', fontWeight: 600, transition: 'color 0.15s ease' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#2563EB')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#0F172A')}
              >
                {lang === 'en' ? 'Courses' : 'কোর্সসমূহ'}
              </a>
              <a
                href="#categories"
                style={{ textDecoration: 'none', color: '#0F172A', fontSize: '0.92rem', fontWeight: 600, transition: 'color 0.15s ease' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#2563EB')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#0F172A')}
              >
                {lang === 'en' ? 'Categories' : 'ক্যাটাগরি'}
              </a>
              <a
                href="#features"
                style={{ textDecoration: 'none', color: '#0F172A', fontSize: '0.92rem', fontWeight: 600, transition: 'color 0.15s ease' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#2563EB')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#0F172A')}
              >
                {lang === 'en' ? 'Features' : 'বৈশিষ্ট্য'}
              </a>
              <a
                href="#how-it-works"
                style={{ textDecoration: 'none', color: '#0F172A', fontSize: '0.92rem', fontWeight: 600, transition: 'color 0.15s ease' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#2563EB')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#0F172A')}
              >
                {lang === 'en' ? 'How it Works' : 'পদ্ধতি'}
              </a>
            </nav>
          </div>

          {/* Center Search Input */}
          <div style={{ flex: 1, maxWidth: '300px', position: 'relative' }} className="nav-search-desktop">
            <Search size={16} color="#64748B" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder={lang === 'en' ? 'Search published courses...' : 'কোর্স অনুসন্ধান করুন...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 14px 9px 38px',
                borderRadius: '10px',
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                fontSize: '0.88rem',
                color: '#0F172A',
                outline: 'none',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                e.currentTarget.style.background = '#FFFFFF';
                e.currentTarget.style.borderColor = '#2563EB';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.15)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.background = '#FFFFFF';
                e.currentTarget.style.borderColor = '#CBD5E1';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Right: Language Switcher & Authentication CTAs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={onToggleLang}
              className="btn-interactive"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#0F172A',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
              }}
            >
              <Globe size={15} color="#2563EB" />
              <span>{lang === 'en' ? 'বাংলা' : 'English'}</span>
            </button>

            <button
              onClick={onLoginClick}
              className="btn-interactive"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 18px',
                borderRadius: '8px',
                border: '1.5px solid #2563EB',
                background: '#2563EB',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(37,99,235,0.25)'
              }}
            >
              <LogIn size={15} />
              <span>{lang === 'en' ? 'Login' : 'লগইন'}</span>
            </button>

            <button
              onClick={onRegisterClick}
              className="btn-interactive"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 20px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #1D4ED8 0%, #1E40AF 100%)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow: '0 4px 10px rgba(29,78,216,0.28)'
              }}
            >
              <span>{lang === 'en' ? 'Register' : 'নিবন্ধন'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/* SECTION B — PREMIUM 2-COLUMN HERO SECTION (10MS-Style Rich)  */}
      {/* ============================================================ */}
      <section
        style={{
          background: '#142D4E',
          borderBottom: '1px solid #1E3A8A',
          position: 'relative',
          overflow: 'hidden',
          padding: '70px 24px 80px'
        }}
      >
        {/* Decorative Background Circles */}
        <div
          style={{
            position: 'absolute',
            top: '-60px',
            right: '-60px',
            width: '320px',
            height: '320px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(56,189,248,0.12) 0%, rgba(56,189,248,0) 70%)',
            pointerEvents: 'none'
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-80px',
            left: '-60px',
            width: '340px',
            height: '340px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, rgba(16,185,129,0) 70%)',
            pointerEvents: 'none'
          }}
        />

        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            alignItems: 'center',
            gap: '50px',
            position: 'relative',
            zIndex: 1
          }}
        >
          {/* Left Column: Heading, Value Proposition & Actions */}
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '30px',
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(125, 211, 252, 0.35)',
                color: '#BAE6FD',
                fontSize: '0.84rem',
                fontWeight: 700,
                marginBottom: '20px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
              }}
            >
              <Flame size={15} color="#FBBF24" />
              <span>{lang === 'en' ? 'Targeted Bangladesh Bank & Combined 8 Banks Prep' : 'বাংলাদেশ ব্যাংক ও ৮ ব্যাংক সমন্বিত সেরা প্রস্তুতি'}</span>
            </div>

            <h1
              style={{
                fontSize: '2.8rem',
                fontWeight: 900,
                color: '#FFFFFF',
                lineHeight: 1.2,
                marginBottom: '18px',
                letterSpacing: '-0.03em'
              }}
            >
              {lang === 'en' ? (
                <>
                  Prepare Smarter for Your <br />
                  <span
                    style={{
                      color: '#7DD3FC'
                    }}
                  >
                    Banking Career
                  </span>
                </>
              ) : (
                <>
                  আপনার স্বপ্নের <br />
                  <span
                    style={{
                      color: '#7DD3FC'
                    }}
                  >
                    ব্যাংক ক্যারিয়ারের
                  </span>{' '}
                  জন্য সেরা প্রস্তুতি
                </>
              )}
            </h1>

            <p
              style={{
                fontSize: '1.1rem',
                color: '#E2E8F0',
                lineHeight: 1.65,
                marginBottom: '32px',
                maxWidth: '540px'
              }}
            >
              {lang === 'en'
                ? 'Learn with structured courses, practice with mock exams, and track your progress toward your dream bank job with real-time analytics.'
                : 'পরিকল্পিত কোর্স, মক টেস্ট এবং রিয়েল-টাইম প্রোগ্রেস ট্র্যাকিং নিয়ে বাংলাদেশ ব্যাংক ও সরকারি ব্যাংকের সফল প্রস্তুতি নিন।'}
            </p>

            {/* Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <a
                href="#courses"
                className="btn-interactive"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '14px 30px',
                  borderRadius: '10px',
                  background: '#2563EB',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '1.02rem',
                  textDecoration: 'none',
                  boxShadow: '0 6px 14px rgba(37,99,235,0.4)'
                }}
              >
                <span>{lang === 'en' ? 'Explore Courses' : 'কোর্সসমূহ দেখুন'}</span>
                <ArrowRight size={18} />
              </a>

              <button
                onClick={onLoginClick}
                className="btn-interactive"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '14px 28px',
                  borderRadius: '10px',
                  background: '#FFFFFF',
                  color: '#0F172A',
                  border: '1.5px solid #FFFFFF',
                  fontWeight: 700,
                  fontSize: '1.02rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
                }}
              >
                <span>{lang === 'en' ? 'Get Started' : 'শুরু করুন'}</span>
              </button>
            </div>

            {/* Quick Metrics Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '24px',
                marginTop: '38px',
                paddingTop: '24px',
                borderTop: '1px solid rgba(255, 255, 255, 0.15)'
              }}
            >
              <div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#7DD3FC' }}>1,300+</div>
                <div style={{ fontSize: '0.78rem', color: '#CBD5E1', fontWeight: 600 }}>{lang === 'en' ? 'Question Bank' : 'প্রশ্ন সম্ভার'}</div>
              </div>
              <div style={{ width: '1px', height: '32px', background: 'rgba(255, 255, 255, 0.2)' }} />
              <div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#34D399' }}>Timed</div>
                <div style={{ fontSize: '0.78rem', color: '#CBD5E1', fontWeight: 600 }}>{lang === 'en' ? 'Server Authoritative' : 'টাইমারযুক্ত মক'}</div>
              </div>
              <div style={{ width: '1px', height: '32px', background: 'rgba(255, 255, 255, 0.2)' }} />
              <div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#C4B5FD' }}>Negative</div>
                <div style={{ fontSize: '0.78rem', color: '#CBD5E1', fontWeight: 600 }}>{lang === 'en' ? 'Marking Evaluator' : 'নেগেটিভ মার্কিং'}</div>
              </div>
            </div>
          </div>

          {/* Right Column: Premium Original Educational Visual Illustration */}
          <div style={{ position: 'relative' }}>
            {/* Background Glow Container */}
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '20px',
                padding: '24px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 20px 45px -5px rgba(0, 0, 0, 0.35), 0 10px 20px -5px rgba(0, 0, 0, 0.2)',
                position: 'relative'
              }}
            >
              {/* Educational Dashboard Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#EF4444' }} />
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#F59E0B' }} />
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10B981' }} />
                  <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 700, marginLeft: '6px' }}>
                    Bank Recruitment Simulation Environment
                  </span>
                </div>
                <span style={{ fontSize: '0.72rem', background: '#D1FAE5', color: '#065F46', padding: '3px 9px', borderRadius: '12px', fontWeight: 700, border: '1px solid #A7F3D0' }}>
                  ● Active Prep Engine
                </span>
              </div>

              {/* Stat Badges Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div style={{ background: '#EFF6FF', padding: '14px', borderRadius: '12px', border: '1px solid #BFDBFE' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1D4ED8', marginBottom: '4px' }}>
                    <Target size={17} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Target Examination</span>
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>Assistant Director (AD)</div>
                  <div style={{ fontSize: '0.72rem', color: '#2563EB', fontWeight: 600 }}>Bangladesh Bank Cadre</div>
                </div>

                <div style={{ background: '#FEF3C7', padding: '14px', borderRadius: '12px', border: '1px solid #FDE68A' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#B45309', marginBottom: '4px' }}>
                    <TrendingUp size={17} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Precision & Speed</span>
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>86.4% Accuracy</div>
                  <div style={{ fontSize: '0.72rem', color: '#92400E', fontWeight: 600 }}>Calculated from Submissions</div>
                </div>
              </div>

              {/* Floating Element 1: Mock Question Card */}
              <div
                className="hero-float-1"
                style={{
                  background: '#FFFFFF',
                  borderRadius: '12px',
                  padding: '16px',
                  border: '1.5px solid #93C5FD',
                  boxShadow: '0 8px 16px -2px rgba(37,99,235,0.12)',
                  marginBottom: '16px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1D4ED8', background: '#DBEAFE', padding: '2px 8px', borderRadius: '4px' }}>
                    Live Model Test #01
                  </span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#D97706', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} /> 28:15 Rem.
                  </span>
                </div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
                  Q: If an item is sold at 15% profit instead of 10% loss, the gain is ৳125. What is the cost price?
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
                  <div style={{ padding: '6px 10px', borderRadius: '6px', background: '#F8FAFC', border: '1px solid #CBD5E1', fontSize: '0.76rem', color: '#334155' }}>
                    A. ৳450
                  </div>
                  <div style={{ padding: '6px 10px', borderRadius: '6px', background: '#DCFCE7', border: '1px solid #86EFAC', fontSize: '0.76rem', color: '#166534', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>B. ৳500</span> <CheckCircle2 size={12} color="#166534" />
                  </div>
                </div>
              </div>

              {/* Floating Element 2: Proctoring Security Pill */}
              <div
                className="hero-float-2"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: '#EDE9FE',
                  borderRadius: '10px',
                  border: '1px solid #DDD6FE'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={18} color="#7C3AED" />
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#4C1D95' }}>AI Proctoring Guard Active</div>
                    <div style={{ fontSize: '0.7rem', color: '#6D28D9' }}>Fullscreen Lock • Tab Monitor</div>
                  </div>
                </div>
                <span style={{ fontSize: '0.72rem', background: '#FFFFFF', color: '#6D28D9', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                  0 Strikes
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION C — VIBRANT CATEGORY CARDS (Soft Pastel Accents)     */}
      {/* ============================================================ */}
      <section
        id="categories"
        style={{
          padding: '70px 24px',
          background: '#E8F5F0',
          borderBottom: '1px solid #C6E2D5'
        }}
      >
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0D9488', textTransform: 'uppercase', marginBottom: '6px' }}>
              {lang === 'en' ? 'Syllabus Breakdown' : 'সিলেবাস ভিত্তিক বিন্যাস'}
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>
              {lang === 'en' ? 'Exam Preparation Categories' : 'পরীক্ষার বিষয়ভিত্তিক ক্যাটাগরি'}
            </h2>
            <p style={{ color: '#334155', fontSize: '0.98rem' }}>
              {lang === 'en'
                ? 'Curated subjects aligned with Bangladesh Bank and Combined 8 Banks recruitment tests.'
                : 'বাংলাদেশ ব্যাংক ও ৮ ব্যাংক সমন্বিত সিলেবাসের সুনির্দিষ্ট বিষয়সমূহ।'}
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '18px'
            }}
          >
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;

              return (
                <div
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className="card-interactive category-pill"
                  style={{
                    padding: '22px 18px',
                    borderRadius: '14px',
                    background: isSelected ? cat.bgColor : '#FFFFFF',
                    border: isSelected ? `2px solid ${cat.color}` : '1.5px solid #CBD5E1',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 8px 16px -2px rgba(0,0,0,0.06)' : '0 2px 4px rgba(0,0,0,0.02)'
                  }}
                >
                  <div
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '12px',
                      background: cat.bgColor,
                      border: `1px solid ${cat.borderColor}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: cat.color,
                      marginBottom: '14px'
                    }}
                  >
                    <Icon size={22} />
                  </div>
                  <h3 style={{ fontSize: '1.02rem', fontWeight: 700, color: '#0F172A', marginBottom: '6px', lineHeight: 1.3 }}>
                    {lang === 'en' ? cat.titleEn : cat.titleBn}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
                    <span style={{ fontSize: '0.78rem', color: isSelected ? cat.color : '#475569', fontWeight: 700 }}>
                      {cat.count}
                    </span>
                    <ChevronRight size={14} color={isSelected ? cat.color : '#94A3B8'} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION D — FEATURED PUBLISHED COURSES (Vibrant Top Banners) */}
      {/* ============================================================ */}
      <section
        id="courses"
        style={{
          padding: '80px 24px',
          background: '#EAF2FF',
          borderBottom: '1px solid #BFDBFE'
        }}
      >
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', marginBottom: '6px' }}>
                {lang === 'en' ? 'Verified Curricula' : 'অনুমোদিত পাঠ্যক্রম'}
              </div>
              <h2 style={{ fontSize: '2.1rem', fontWeight: 800, color: '#0F172A' }}>
                {lang === 'en' ? 'Featured Bank Preparation Courses' : 'প্রকাশিত ব্যাংক নিয়োগ প্রস্তুতি কোর্সসমূহ'}
              </h2>
            </div>
            <span style={{ fontSize: '0.9rem', color: '#1E3A8A', fontWeight: 600, background: '#FFFFFF', padding: '6px 14px', borderRadius: '8px', border: '1px solid #BFDBFE' }}>
              {lang === 'en' ? `Showing ${filteredCourses.length} Approved Courses` : `${filteredCourses.length} টি অনুমোদিত কোর্স দেখানো হচ্ছে`}
            </span>
          </div>

          {filteredCourses.length === 0 ? (
            <div style={{ background: '#FFFFFF', padding: '50px 30px', borderRadius: '16px', textAlign: 'center', border: '1px solid #CBD5E1' }}>
              <p style={{ color: '#475569', fontSize: '1.05rem' }}>
                {lang === 'en' ? 'No published courses match your search or filter.' : 'আপনার অনুসন্ধানের সাথে মিলে এমন কোনো প্রকাশিত কোর্স পাওয়া যায়নি।'}
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))',
                gap: '26px'
              }}
            >
              {filteredCourses.map((c) => (
                <div
                  key={c.id}
                  className="card-interactive"
                  style={{
                    background: '#FFFFFF',
                    border: '1.5px solid #CBD5E1',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 2px 6px rgba(16, 42, 67, 0.04)'
                  }}
                >
                  {/* Distinctive Colorful Gradient Header */}
                  <div
                    style={{
                      background: c.gradient,
                      padding: '24px 22px',
                      color: '#FFFFFF',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          background: 'rgba(255, 255, 255, 0.22)',
                          backdropFilter: 'blur(4px)',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          color: '#FFFFFF'
                        }}
                      >
                        {c.tag}
                      </span>
                      <span style={{ fontSize: '0.74rem', opacity: 0.9, fontWeight: 600 }}>
                        {c.lessons} {lang === 'en' ? 'Interactive Lessons' : 'লেসন'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.88rem', opacity: 0.92, fontWeight: 500 }}>
                      {lang === 'en' ? c.categoryEn : c.categoryBn}
                    </div>
                  </div>

                  {/* Card Content Body */}
                  <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0F172A', marginBottom: '10px', lineHeight: 1.35 }}>
                      {lang === 'en' ? c.titleEn : c.titleBn}
                    </h3>
                    <p style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.6, marginBottom: '20px', flex: 1 }}>
                      {lang === 'en' ? c.descEn : c.descBn}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.8rem', color: '#475569', marginBottom: '20px', paddingTop: '14px', borderTop: '1px solid #F1F5F9' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Play size={14} color={c.accentColor} /> {c.lessons} {lang === 'en' ? 'Lessons' : 'লেসন'}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Clock size={14} color="#059669" /> {c.duration}
                      </span>
                      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', color: '#D97706', fontWeight: 700 }}>
                        <Star size={13} fill="#D97706" /> Approved
                      </span>
                    </div>

                    <button
                      onClick={onLoginClick}
                      className="btn-interactive"
                      style={{
                        width: '100%',
                        padding: '11px 16px',
                        borderRadius: '10px',
                        border: `1.5px solid ${c.accentColor}`,
                        background: c.tagBg,
                        color: c.tagColor,
                        fontWeight: 700,
                        fontSize: '0.92rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>{lang === 'en' ? 'Enroll & Learn' : 'কোর্সে প্রবেশ করুন'}</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION E — LMS LEARNING FEATURES (Staggered Colorful Grid)  */}
      {/* ============================================================ */}
      <section
        id="features"
        style={{
          padding: '80px 24px',
          background: '#FFF7E8',
          borderBottom: '1px solid #FED7AA'
        }}
      >
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '50px' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#C2410C', textTransform: 'uppercase', marginBottom: '6px' }}>
              {lang === 'en' ? 'Core Platform Engine' : 'প্ল্যাটফর্মের মূল সুবিধাসমূহ'}
            </div>
            <h2 style={{ fontSize: '2.1rem', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>
              {lang === 'en' ? 'Engineered for Banking Exam Success' : 'ব্যাংক নিয়োগে শতভাগ সফলতার জন্য তৈরি'}
            </h2>
            <p style={{ color: '#334155', fontSize: '0.98rem' }}>
              {lang === 'en'
                ? 'Strictly built upon confirmed, tested examination and course delivery mechanisms.'
                : 'বাস্তব পরীক্ষার আদলে প্রস্তুতকৃত কার্যপদ্ধতি ও ডিজিটাল মূল্যায়ন ব্যবস্থা।'}
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))',
              gap: '24px'
            }}
          >
            {features.map((f, idx) => {
              const Icon = f.icon;
              return (
                <div
                  key={idx}
                  className="card-interactive"
                  style={{
                    padding: '28px',
                    borderRadius: '16px',
                    background: '#FFFFFF',
                    border: '1.5px solid #FED7AA',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: f.bgColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: f.color
                      }}
                    >
                      <Icon size={24} />
                    </div>
                    <span style={{ fontSize: '0.72rem', background: '#FEF3C7', color: '#92400E', padding: '3px 9px', borderRadius: '6px', fontWeight: 700 }}>
                      {f.badge}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.18rem', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
                    {lang === 'en' ? f.titleEn : f.titleBn}
                  </h3>
                  <p style={{ fontSize: '0.92rem', color: '#334155', lineHeight: 1.6 }}>
                    {lang === 'en' ? f.descEn : f.descBn}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION F — HOW IT WORKS (Connected Flow with Accents)       */}
      {/* ============================================================ */}
      <section
        id="how-it-works"
        style={{
          padding: '80px 24px',
          background: '#EEEAFE',
          borderBottom: '1px solid #DDD6FE'
        }}
      >
        <div style={{ maxWidth: '1080px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#6D28D9', textTransform: 'uppercase', marginBottom: '6px' }}>
            {lang === 'en' ? 'Student Journey' : 'প্রস্তুতি প্রক্রিয়া'}
          </div>
          <h2 style={{ fontSize: '2.1rem', fontWeight: 800, color: '#0F172A', marginBottom: '40px' }}>
            {lang === 'en' ? 'Get Started in Three Simple Steps' : 'সহজ তিনটি ধাপে আপনার প্রস্তুতি শুরু করুন'}
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '24px',
              textAlign: 'left'
            }}
          >
            {steps.map((st) => (
              <div
                key={st.num}
                className="card-interactive"
                style={{
                  background: '#FFFFFF',
                  border: '1.5px solid #DDD6FE',
                  borderRadius: '16px',
                  padding: '30px 24px',
                  position: 'relative',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.03)'
                }}
              >
                <div
                  style={{
                    fontSize: '2.4rem',
                    fontWeight: 900,
                    color: '#DDD6FE',
                    position: 'absolute',
                    top: '16px',
                    right: '20px'
                  }}
                >
                  {st.num}
                </div>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: st.badgeColor,
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    marginBottom: '18px',
                    boxShadow: `0 3px 6px ${st.badgeColor}40`
                  }}
                >
                  {st.num}
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
                  {lang === 'en' ? st.titleEn : st.titleBn}
                </h3>
                <p style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.6 }}>
                  {lang === 'en' ? st.descEn : st.descBn}
                </p>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '44px' }}>
            <button
              onClick={onRegisterClick}
              className="btn-interactive"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                padding: '14px 34px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '1.05rem',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 6px 14px rgba(37,99,235,0.35)'
              }}
            >
              <span>{lang === 'en' ? 'Create Your Student Account' : 'এখনই অ্যাকাউন্ট তৈরি করুন'}</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SECTION G — SLEEK NAVY FOOTER (Legitimate Info Only)          */}
      {/* ============================================================ */}
      <footer
        style={{
          background: '#102A43',
          color: '#F8FAFC',
          padding: '56px 24px 34px'
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '36px',
            paddingBottom: '36px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.12)'
          }}
        >
          {/* Brand & Project Info */}
          <div style={{ maxWidth: '380px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: '#2563EB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  color: '#FFFFFF',
                  fontSize: '18px'
                }}
              >
                ৳
              </div>
              <span style={{ fontWeight: 800, fontSize: '1.25rem', color: '#FFFFFF' }}>Bank Exam LMS</span>
            </div>
            <p style={{ fontSize: '0.88rem', color: '#CBD5E1', lineHeight: 1.65 }}>
              {lang === 'en'
                ? 'Educational examination portal designed for Bangladesh banking sector recruitment preparation, offering structured courses, verified question practice, and server-timed mock examinations.'
                : 'বাংলাদেশ ব্যাংকিং খাতের নিয়োগ পরীক্ষার প্রস্তুতির আধুনিক শিক্ষামূলক প্ল্যাটফর্ম — পরিকল্পিত কোর্স, প্রশ্নব্যাংক ও লাইভ মক টেস্ট ব্যবস্থা।'}
            </p>
          </div>

          {/* Quick Navigation Links */}
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '14px' }}>
              {lang === 'en' ? 'Platform Navigation' : 'প্ল্যাটফর্ম ন্যাভিগেশন'}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.88rem' }}>
              <a
                href="#"
                style={{ textDecoration: 'none', color: '#E2E8F0', transition: 'color 0.15s ease' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#38BDF8')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#E2E8F0')}
              >
                {lang === 'en' ? 'Home' : 'হোম'}
              </a>
              <a
                href="#courses"
                style={{ textDecoration: 'none', color: '#E2E8F0', transition: 'color 0.15s ease' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#38BDF8')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#E2E8F0')}
              >
                {lang === 'en' ? 'Courses' : 'কোর্সসমূহ'}
              </a>
              <a
                href="#categories"
                style={{ textDecoration: 'none', color: '#E2E8F0', transition: 'color 0.15s ease' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#38BDF8')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#E2E8F0')}
              >
                {lang === 'en' ? 'Categories' : 'ক্যাটাগরি'}
              </a>
              <a
                href="#features"
                style={{ textDecoration: 'none', color: '#E2E8F0', transition: 'color 0.15s ease' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#38BDF8')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#E2E8F0')}
              >
                {lang === 'en' ? 'Features' : 'সুবিধাসমূহ'}
              </a>
            </div>
          </div>

          {/* User Access Links */}
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '14px' }}>
              {lang === 'en' ? 'User Access' : 'ব্যবহারকারী এক্সেস'}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.88rem' }}>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onLoginClick();
                }}
                style={{ textDecoration: 'none', color: '#38BDF8', fontWeight: 600 }}
              >
                {lang === 'en' ? 'Portal Login' : 'পোর্টাল লগইন'}
              </a>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onRegisterClick();
                }}
                style={{ textDecoration: 'none', color: '#34D399', fontWeight: 600 }}
              >
                {lang === 'en' ? 'Student Registration' : 'স্টুডেন্ট নিবন্ধন'}
              </a>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: '1280px', margin: '24px auto 0', textAlign: 'center', fontSize: '0.82rem', color: '#CBD5E1' }}>
          © {new Date().getFullYear()} Bank Exam LMS. All rights reserved.
        </div>
      </footer>
    </div>
  );
};
