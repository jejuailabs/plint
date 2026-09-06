import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== 'admin') {
    return { error: true, supabase, user: null };
  }
  return { error: false, supabase, user };
}

export async function POST(req: NextRequest) {
  const { error, supabase } = await assertAdmin();
  if (error)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { category, question, answer, display_order, is_published } = body;

  const { data, error: dbError } = await supabase
    .from('faqs')
    .insert({
      category,
      question,
      answer,
      display_order: display_order ?? 0,
      is_published: is_published ?? true,
    })
    .select()
    .single();

  if (dbError)
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const { error, supabase } = await assertAdmin();
  if (error)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { id, category, question, answer, display_order, is_published } = body;

  const { data, error: dbError } = await supabase
    .from('faqs')
    .update({ category, question, answer, display_order, is_published })
    .eq('id', id)
    .select()
    .single();

  if (dbError)
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const { error, supabase } = await assertAdmin();
  if (error)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await req.json();

  const { error: dbError } = await supabase
    .from('faqs')
    .delete()
    .eq('id', id);

  if (dbError)
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
