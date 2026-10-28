import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { initDatabase } from './db/schema';
import { seedDatabase, ensureActiveDemoExam } from './db/seed';
import { authRouter } from './routes/auth';
import { questionsRouter } from './routes/questions';
import { examsRouter } from './routes/exams';
import { dashboardRouter } from './routes/dashboard';
import { coursesRouter } from './routes/courses';
import { adminRouter } from './routes/admin';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for client requests
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// Initialize Database & Seed realistic bank exam questions
initDatabase();
seedDatabase();
ensureActiveDemoExam();

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/exams', examsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/admin', adminRouter);

// Healthcheck & server authoritative time endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    serverTimeUtc: new Date().toISOString(),
    timezone: 'UTC (Dhaka +06:00)',
    service: 'Bank Exam LMS API Engine'
  });
});

app.listen(PORT, () => {
  console.log(`[Bank Exam LMS] Server engine active on http://localhost:${PORT}`);
});
