import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, Button, Badge } from '../design-system';
import { MathRenderer } from './MathRenderer';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, Filter, Upload, Trash2, Edit3, CheckCircle2, AlertCircle, ShieldCheck, ShieldAlert, ChevronLeft, ChevronRight } from 'lucide-react';
import type { QuestionModel, QuestionDifficulty, QuestionType } from '../../../shared';

export const QuestionBankManager: React.FC = () => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<QuestionModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [selectedApproved, setSelectedApproved] = useState<string>('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Modal / Form state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvText, setCsvText] = useState('');

  // Form fields
  const [subject, setSubject] = useState('English Language & Literature');
  const [chapter, setChapter] = useState('Grammar');
  const [topic, setTopic] = useState('Prepositions');
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>('MEDIUM');
  const [type, setType] = useState<QuestionType>('SINGLE_MCQ');
  const [prompt, setPrompt] = useState('');
  const [promptBangla, setPromptBangla] = useState('');
  const [explanation, setExplanation] = useState('');
  const [explanationBangla, setExplanationBangla] = useState('');
  const [options, setOptions] = useState([
    { optionKey: 'A', text: '', textBangla: '', isCorrect: true },
    { optionKey: 'B', text: '', textBangla: '', isCorrect: false },
    { optionKey: 'C', text: '', textBangla: '', isCorrect: false },
    { optionKey: 'D', text: '', textBangla: '', isCorrect: false }
  ]);

  const fetchQuestions = async (targetPage = page) => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get('http://localhost:5000/api/questions', {
        params: {
          search: search || undefined,
          subject: selectedSubject || undefined,
          difficulty: selectedDifficulty || undefined,
          isApproved: selectedApproved !== '' ? selectedApproved : undefined,
          page: targetPage,
          pageSize: pageSize
        }
      });
      if (res.data.success) {
        setQuestions(res.data.questions || []);
        if (typeof res.data.totalItems === 'number') {
          setTotalItems(res.data.totalItems);
          setTotalPages(res.data.totalPages || 1);
          setPage(res.data.page || targetPage);
        } else {
          setTotalItems(res.data.count || (res.data.questions || []).length);
          setTotalPages(1);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch questions.');
    } finally {
      setLoading(false);
    }
  };

  // Reset pagination to Page 1 whenever filters change
  useEffect(() => {
    setPage(1);
    fetchQuestions(1);
  }, [selectedSubject, selectedDifficulty, selectedApproved]);

  const handleToggleApprove = async (id: string, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const nextStatus = !currentStatus;
      const res = await axios.patch(
        `http://localhost:5000/api/questions/${id}/status`,
        { isApproved: nextStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setSuccess(res.data.message);
        fetchQuestions(page);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update approval status.');
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchQuestions(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return;
    setPage(newPage);
    fetchQuestions(newPage);
  };

  const handleOptionChange = (idx: number, field: string, value: any) => {
    const updated = [...options];
    if (field === 'isCorrect' && type === 'SINGLE_MCQ') {
      updated.forEach((opt, i) => {
        opt.isCorrect = i === idx;
      });
    } else {
      (updated[idx] as any)[field] = value;
    }
    setOptions(updated);
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const payload = {
        subject,
        chapter,
        topic,
        difficulty,
        type,
        prompt,
        promptBangla: promptBangla || undefined,
        explanation: explanation || undefined,
        explanationBangla: explanationBangla || undefined,
        defaultMarks: 1.0,
        defaultNegativeMarks: 0.25,
        options: options.map((opt) => ({
          optionKey: opt.optionKey,
          text: opt.text,
          textBangla: opt.textBangla || undefined,
          isCorrect: opt.isCorrect
        }))
      };

      const res = await axios.post('http://localhost:5000/api/questions', payload);
      if (res.data.success) {
        setSuccess('Question successfully created!');
        setIsCreateOpen(false);
        // Reset form
        setPrompt('');
        setPromptBangla('');
        setExplanation('');
        fetchQuestions();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create question.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;
    try {
      await axios.delete(`http://localhost:5000/api/questions/${id}`);
      setSuccess('Question deleted.');
      fetchQuestions();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Delete failed.');
    }
  };

  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await axios.post('http://localhost:5000/api/questions/import-csv', { csvData: csvText });
      if (res.data.success) {
        setSuccess(res.data.message);
        setIsCsvModalOpen(false);
        setCsvText('');
        fetchQuestions();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'CSV import failed.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>Question Bank & Content Engine</h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
            Bilingual (English + Bengali) & LaTeX Math Questions for Bangladesh Bank Recruitment
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="outline" size="sm" onClick={() => setIsCsvModalOpen(true)}>
            <Upload size={14} /> Bulk CSV Import
          </Button>
          <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus size={14} /> Add New Question
          </Button>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div style={{ padding: '10px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: '10px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7', fontSize: '0.85rem' }}>
          {success}
        </div>
      )}

      {/* Filter / Search Bar */}
      <Card>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '220px', display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff', padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
            <Search size={16} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search by topic, chapter, or LaTeX formula..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: '#0f172a', outline: 'none', width: '100%', fontSize: '0.9rem' }}
            />
          </div>

          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            style={{ padding: '8px 12px', background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '6px' }}
          >
            <option value="">All Subjects</option>
            <option value="Quantitative Mathematics">Quantitative Mathematics</option>
            <option value="English Language">English Language</option>
            <option value="Bangla Language">Bangla Language</option>
            <option value="General Knowledge">General Knowledge</option>
            <option value="Banking & ICT">Banking & ICT</option>
            <option value="Analytical Reasoning">Analytical Reasoning</option>
          </select>

          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            style={{ padding: '8px 12px', background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '6px' }}
          >
            <option value="">All Difficulties</option>
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>

          <select
            value={selectedApproved}
            onChange={(e) => setSelectedApproved(e.target.value)}
            style={{ padding: '8px 12px', background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '6px' }}
          >
            <option value="">All Approval Status</option>
            <option value="true">Approved Only</option>
            <option value="false">Unapproved Only</option>
          </select>

          <Button variant="secondary" size="sm" type="submit">
            Filter Questions
          </Button>
        </form>
      </Card>

      {/* Question Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>Loading question bank...</div>
        ) : questions.length === 0 ? (
          <Card>
            <div style={{ textAlign: 'center', color: '#64748b', padding: '24px' }}>
              No questions found matching the selected criteria.
            </div>
          </Card>
        ) : (
          questions.map((q, idx) => (
            <Card key={q.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, color: '#2563eb' }}>Q{idx + 1}.</span>
                  <Badge text={q.subject} type="info" />
                  <Badge text={q.chapter} type="warning" />
                  <Badge text={q.difficulty} type={q.difficulty === 'HARD' ? 'danger' : 'success'} />
                  {q.isApproved ? (
                    <Badge text="APPROVED" type="success" />
                  ) : (
                    <Badge text="UNAPPROVED" type="danger" />
                  )}
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    (+{q.defaultMarks} / -{q.defaultNegativeMarks})
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {user?.role === 'ADMIN' && (
                    <button
                      onClick={() => handleToggleApprove(q.id, Boolean(q.isApproved))}
                      style={{
                        background: q.isApproved ? '#fee2e2' : '#dcfce7',
                        border: '1px solid ' + (q.isApproved ? '#fca5a5' : '#86efac'),
                        color: q.isApproved ? '#b91c1c' : '#15803d',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: 700
                      }}
                      title={q.isApproved ? 'Unapprove question' : 'Approve question for live exams'}
                    >
                      {q.isApproved ? (
                        <>
                          <ShieldAlert size={13} /> Unapprove
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={13} /> Approve
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(q.id)}
                    style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer' }}
                    title="Delete question"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Bilingual Question Prompts with Math Rendering */}
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>
                  <MathRenderer text={q.prompt} />
                </div>
                {q.promptBangla && (
                  <div style={{ fontSize: '0.95rem', color: '#334155', fontStyle: 'italic' }}>
                    <MathRenderer text={q.promptBangla} />
                  </div>
                )}
              </div>

              {/* Options Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px', marginTop: '12px' }}>
                {q.options?.map((opt) => (
                  <div
                    key={opt.id}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: opt.isCorrect ? '#dcfce7' : '#ffffff',
                      border: opt.isCorrect ? '1px solid #86efac' : '1px solid #cbd5e1',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: opt.isCorrect ? '0 1px 2px rgba(22, 101, 52, 0.05)' : 'none'
                    }}
                  >
                    <span style={{ fontWeight: 700, color: opt.isCorrect ? '#166534' : '#64748b' }}>
                      {opt.optionKey}.
                    </span>
                    <span style={{ color: opt.isCorrect ? '#166534' : '#334155', fontSize: '0.9rem', fontWeight: opt.isCorrect ? 600 : 400 }}>
                      <MathRenderer text={opt.text} />
                      {opt.textBangla && <span style={{ color: opt.isCorrect ? '#15803d' : '#64748b', marginLeft: '6px' }}>({opt.textBangla})</span>}
                    </span>
                    {opt.isCorrect && <CheckCircle2 size={16} color="#166534" style={{ marginLeft: 'auto', flexShrink: 0 }} />}
                  </div>
                ))}
              </div>

              {/* Written Explanation */}
              {q.explanation && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    background: '#eff6ff',
                    border: '1px solid #93c5fd',
                    borderLeft: '4px solid #3b82f6',
                    fontSize: '0.85rem',
                    color: '#1e40af',
                    lineHeight: 1.5
                  }}
                >
                  <strong style={{ color: '#1e3a8a' }}>Explanation: </strong> <MathRenderer text={q.explanation} />
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Server-Side Pagination Bar */}
      {totalItems > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '16px 20px',
            background: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            marginTop: '8px'
          }}
        >
          <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
            {`Showing ${Math.min((page - 1) * pageSize + 1, totalItems).toLocaleString()}–${Math.min(page * pageSize, totalItems).toLocaleString()} of ${totalItems.toLocaleString()} questions`}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1 || loading}
            >
              <ChevronLeft size={16} /> Previous
            </Button>

            <span
              style={{
                color: '#1e293b',
                fontSize: '0.9rem',
                padding: '4px 10px',
                background: '#ffffff',
                borderRadius: '6px',
                border: '1px solid #cbd5e1'
              }}
            >
              Page {page} of {totalPages}
            </span>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages || loading}
            >
              Next <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* CREATE QUESTION MODAL */}
      {isCreateOpen && (
        <div className="integrity-overlay" style={{ overflowY: 'auto', padding: '24px 0' }}>
          <div className="glass-panel-elevated" style={{ maxWidth: '640px', width: '90%', padding: '24px', margin: 'auto' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '16px' }}>
              Create New Question
            </h3>
            <form onSubmit={handleCreateQuestion} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Subject</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Chapter</label>
                  <input
                    type="text"
                    required
                    value={chapter}
                    onChange={(e) => setChapter(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Topic</label>
                  <input
                    type="text"
                    required
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a' }}
                  />
                </div>
                <div style={{ width: '120px' }}>
                  <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Difficulty</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                    style={{ width: '100%', padding: '8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a' }}
                  >
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Prompt (Supports LaTeX with $...$)</label>
                <textarea
                  required
                  rows={2}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. Find the value of $\int_0^1 x^2 dx$."
                  style={{ width: '100%', padding: '8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Bangla Prompt (Optional)</label>
                <textarea
                  rows={2}
                  value={promptBangla}
                  onChange={(e) => setPromptBangla(e.target.value)}
                  placeholder="বাংলা প্রশ্ন লিখুন..."
                  style={{ width: '100%', padding: '8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a' }}
                />
              </div>

              {/* Options */}
              <div>
                <label style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px', display: 'block' }}>
                  Options (Check the radio button for the correct answer)
                </label>
                {options.map((opt, idx) => (
                  <div key={opt.optionKey} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                    <input
                      type="radio"
                      name="correctOption"
                      checked={opt.isCorrect}
                      onChange={() => handleOptionChange(idx, 'isCorrect', true)}
                    />
                    <span style={{ fontWeight: 700, width: '20px' }}>{opt.optionKey}.</span>
                    <input
                      type="text"
                      required
                      placeholder={`Option ${opt.optionKey} text`}
                      value={opt.text}
                      onChange={(e) => handleOptionChange(idx, 'text', e.target.value)}
                      style={{ flex: 1, padding: '6px 8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a' }}
                    />
                  </div>
                ))}
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#64748b' }}>Written Explanation</label>
                <textarea
                  rows={2}
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Step-by-step mathematical reasoning..."
                  style={{ width: '100%', padding: '8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <Button variant="secondary" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Save Question
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK CSV MODAL */}
      {isCsvModalOpen && (
        <div className="integrity-overlay">
          <div className="glass-panel-elevated" style={{ maxWidth: '580px', width: '90%', padding: '24px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
              Bulk CSV Question Importer
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '12px' }}>
              Paste comma-separated rows. Required columns: subject, chapter, topic, difficulty, type, prompt, promptBangla, optA, optB, optC, optD, correctOpt, explanation.
            </p>
            <form onSubmit={handleCsvImport} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <textarea
                required
                rows={8}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={`subject,chapter,topic,difficulty,type,prompt,promptBangla,optA,optB,optC,optD,correctOpt,explanation\nEnglish,Grammar,Prepositions,EASY,SINGLE_MCQ,"Proficient ___ English.","","in","at","with","on",A,"Proficient takes 'in'."`}
                style={{ width: '100%', padding: '10px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', fontFamily: 'monospace', fontSize: '0.8rem' }}
              />
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <Button variant="secondary" onClick={() => setIsCsvModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Import CSV
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
