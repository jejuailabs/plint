import { createClient } from '@/lib/supabase/server';
import { AdminContentClient } from '@/components/admin/admin-content-client';

export const dynamic = 'force-dynamic';

export default async function AdminContentPage() {
  const supabase = await createClient();

  const [noticesResult, faqsResult] = await Promise.all([
    supabase
      .from('notices')
      .select('id, title, content, is_published, published_at, created_at, updated_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('faqs')
      .select('id, category, question, answer, display_order, is_published, created_at')
      .order('display_order', { ascending: true }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">콘텐츠 관리</h1>
        <p className="text-sm text-muted-foreground">
          공지사항과 FAQ를 관리합니다.
        </p>
      </div>
      <AdminContentClient
        notices={noticesResult.data ?? []}
        faqs={faqsResult.data ?? []}
      />
    </div>
  );
}
