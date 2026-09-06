'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, Plus, Trash2 } from 'lucide-react';

interface Notice {
  id: string;
  title: string;
  content: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Faq {
  id: string;
  category: string;
  question: string;
  answer: string;
  display_order: number;
  is_published: boolean;
  created_at: string;
}

export function AdminContentClient({
  notices: initialNotices,
  faqs: initialFaqs,
}: {
  notices: Notice[];
  faqs: Faq[];
}) {
  const [tab, setTab] = useState<'notices' | 'faqs'>('notices');

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setTab('notices')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === 'notices'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          공지사항
        </button>
        <button
          onClick={() => setTab('faqs')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === 'faqs'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          FAQ
        </button>
      </div>

      {tab === 'notices' && <NoticesSection notices={initialNotices} />}
      {tab === 'faqs' && <FaqsSection faqs={initialFaqs} />}
    </div>
  );
}

/* ─── Notices ─── */

function NoticesSection({ notices }: { notices: Notice[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Notice | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', is_published: false });
  const [loading, setLoading] = useState(false);

  const startEdit = (n: Notice) => {
    setCreating(false);
    setEditing(n);
    setForm({ title: n.title, content: n.content, is_published: n.is_published });
  };

  const startCreate = () => {
    setEditing(null);
    setCreating(true);
    setForm({ title: '', content: '', is_published: false });
  };

  const cancel = () => {
    setEditing(null);
    setCreating(false);
  };

  const save = async () => {
    setLoading(true);
    try {
      if (creating) {
        await fetch('/api/admin/notices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      } else if (editing) {
        await fetch('/api/admin/notices', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editing.id, ...form }),
        });
      }
      cancel();
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    await fetch('/api/admin/notices', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  };

  if (creating || editing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            {creating ? '새 공지사항' : '공지사항 수정'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="제목"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <Textarea
            placeholder="내용 (마크다운 지원)"
            rows={10}
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
          />
          <div className="flex items-center gap-2">
            <Switch
              checked={form.is_published}
              onCheckedChange={(checked) =>
                setForm({ ...form, is_published: checked })
              }
            />
            <span className="text-sm">게시</span>
          </div>
          {form.content && (
            <details className="rounded-md border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                미리보기
              </summary>
              <div className="mt-2 whitespace-pre-wrap text-sm">
                {form.content}
              </div>
            </details>
          )}
          <div className="flex gap-2">
            <Button onClick={save} disabled={loading || !form.title}>
              {loading ? '저장 중...' : '저장'}
            </Button>
            <Button variant="outline" onClick={cancel}>
              취소
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Button size="sm" onClick={startCreate}>
        <Plus className="size-4 mr-1" /> 새 공지사항
      </Button>
      {notices.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          공지사항이 없습니다.
        </p>
      ) : (
        notices.map((n) => (
          <div
            key={n.id}
            className="flex items-center justify-between rounded-md border border-border px-4 py-3"
          >
            <div className="space-y-0.5">
              <p className="font-medium">{n.title}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(n.created_at).toLocaleDateString('ko-KR')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={n.is_published ? 'default' : 'secondary'}>
                {n.is_published ? '게시중' : '비공개'}
              </Badge>
              <Button variant="ghost" size="icon-sm" onClick={() => startEdit(n)}>
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(n.id)}
              >
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ─── FAQs ─── */

function FaqsSection({ faqs }: { faqs: Faq[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Faq | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    category: '',
    question: '',
    answer: '',
    display_order: 0,
    is_published: true,
  });
  const [loading, setLoading] = useState(false);

  const startEdit = (f: Faq) => {
    setCreating(false);
    setEditing(f);
    setForm({
      category: f.category,
      question: f.question,
      answer: f.answer,
      display_order: f.display_order,
      is_published: f.is_published,
    });
  };

  const startCreate = () => {
    setEditing(null);
    setCreating(true);
    setForm({
      category: '',
      question: '',
      answer: '',
      display_order: faqs.length,
      is_published: true,
    });
  };

  const cancel = () => {
    setEditing(null);
    setCreating(false);
  };

  const save = async () => {
    setLoading(true);
    try {
      if (creating) {
        await fetch('/api/admin/faqs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      } else if (editing) {
        await fetch('/api/admin/faqs', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editing.id, ...form }),
        });
      }
      cancel();
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    await fetch('/api/admin/faqs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  };

  if (creating || editing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            {creating ? '새 FAQ' : 'FAQ 수정'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="카테고리 (예: 요금, 사용법, 데이터)"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
          <Input
            placeholder="질문"
            value={form.question}
            onChange={(e) => setForm({ ...form, question: e.target.value })}
          />
          <Textarea
            placeholder="답변 (마크다운 지원)"
            rows={6}
            value={form.answer}
            onChange={(e) => setForm({ ...form, answer: e.target.value })}
          />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">순서:</label>
              <Input
                type="number"
                className="w-20"
                value={form.display_order}
                onChange={(e) =>
                  setForm({ ...form, display_order: Number(e.target.value) })
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_published}
                onCheckedChange={(checked) =>
                  setForm({ ...form, is_published: checked })
                }
              />
              <span className="text-sm">게시</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={loading || !form.question}>
              {loading ? '저장 중...' : '저장'}
            </Button>
            <Button variant="outline" onClick={cancel}>
              취소
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group FAQs by category
  const categories = [...new Set(faqs.map((f) => f.category))];

  return (
    <div className="space-y-3">
      <Button size="sm" onClick={startCreate}>
        <Plus className="size-4 mr-1" /> 새 FAQ
      </Button>
      {faqs.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          FAQ가 없습니다.
        </p>
      ) : (
        categories.map((cat) => (
          <div key={cat} className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">
              {cat}
            </h3>
            {faqs
              .filter((f) => f.category === cat)
              .map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between rounded-md border border-border px-4 py-3"
                >
                  <div className="space-y-0.5">
                    <p className="font-medium">{f.question}</p>
                    <p className="line-clamp-1 text-xs text-muted-foreground">
                      {f.answer}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      #{f.display_order}
                    </span>
                    <Badge variant={f.is_published ? 'default' : 'secondary'}>
                      {f.is_published ? '게시중' : '비공개'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => startEdit(f)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => remove(f.id)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        ))
      )}
    </div>
  );
}
