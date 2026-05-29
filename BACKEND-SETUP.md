# SP4RK Backend Setup

This app now has a real backend path for saving orders, but it needs Supabase keys added in Vercel.

## 1. Create Supabase Project

Go to Supabase and create a new project.

Create a private storage bucket named:

```text
sp4rk-orders
```

## 2. Create Orders Table

In Supabase SQL Editor, run the contents of:

```text
supabase-schema.sql
```

## 3. Add Vercel Environment Variables

In Vercel project settings, add:

```text
SUPABASE_URL=your Supabase project URL
SUPABASE_SERVICE_ROLE_KEY=your Supabase service role key
SUPABASE_BUCKET=sp4rk-orders
ADMIN_SECRET=make-a-private-password-here
```

Important:

- Keep `SUPABASE_SERVICE_ROLE_KEY` private.
- Do not put the service role key in frontend code.
- `ADMIN_SECRET` is what you type into the owner page to load orders.

## 4. Owner Page

Use:

```text
https://sp4rk-stencil-studio.vercel.app?owner=1
```

Then open the studio and use:

```text
Backend Orders
```

Enter your `ADMIN_SECRET`, then click `Load Orders`.

## 5. Customer Flow

Customers can:

1. Upload image.
2. Pick package.
3. Enter email and notes.
4. Click `Save Order`.
5. Click `Start Payment`.

If Supabase is not configured yet, payment still works, but orders will not save to the backend.
