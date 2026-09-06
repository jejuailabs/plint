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
  const { error, supabase, user } = await assertAdmin();
  if (error || !user)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { title, content, is_published } = body;

  const { data, error: dbError } = await supabase
    .from('notices')
    .insert({
      title,
      content,
      is_published: is_published ?? false,
      published_at: is_published ? new Date().toISOString() : null,
      created_by: user.id,
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
  const { id, title, content, is_published } = body;

  const { data, error: dbError } = await supabase
    .from('notices')
    .update({
      title,
      content,
      is_published,
      published_at: is_published ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
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
    .from('notices')
    .delete()
    .eq('id', id);

  if (dbError)
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
