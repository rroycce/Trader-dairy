# Trader Diary

[![Vanilla JS](https://img.shields.io/badge/UI-Vanilla%20JS-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](https://developer.mozilla.org/docs/Web/JavaScript)
[![Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Hosting-Vercel-000000?style=flat-square&logo=vercel&logoColor=white)](https://vercel.com/)

A web application for logging and analyzing trades: open a position in seconds, close it later, then review the result, tag your mistakes and track performance over time. The interface is in Ukrainian.

![Trader Diary dashboard](./preview.png)

## Features

- **Authentication** via Supabase Auth (email and password).
- **Data isolation:** Row Level Security ensures users can only access their own trades.
- **Trade logging:** pair, direction, timeframe, custom setups, entry, stop loss, take profit, exit price, date and time, entry reason.
- **Open / close workflow:** trades are saved as open, then closed and reviewed later with exit price, mistake tags and a lesson.
- **Automatic results:** Win / Loss / Break-even, P&L in percent and result in R-multiples, with a % / R switch across the whole dashboard.
- **Dashboard:**
  - Win rate, profit factor, expectancy, average win / loss, max drawdown, best / worst trade, current streak.
  - Equity curve with drawdown shading and tooltips.
  - Weekly / monthly P&L calendar; click a day to filter the history.
- **Analytics:** performance by setup, pair, hour, weekday, trading session and mistake tag.
- **History:** search, filters, column sorting, pagination, trade details modal, CSV export.
- **Light / dark theme** with saved preference.
- **Responsive layout:** sidebar form on desktop, bottom sheet and card list on mobile.

## Tech Stack

- HTML5, CSS3, vanilla JavaScript (ES6+), no build step
- [Supabase](https://supabase.com/) (PostgreSQL, Auth)
- [Vercel](https://vercel.com/) for hosting
- Inline SVG for charts and icons

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/rroycce/trader-diary.git
cd trader-diary
```

### 2. Set up Supabase

Create a project on [Supabase](https://supabase.com/), open the **SQL Editor** and run:

```sql
create table trades (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  pair text not null,
  direction text not null check (direction in ('Long', 'Short')),
  timeframe text,
  strategy text,
  entry_price numeric not null check (entry_price > 0),
  exit_price numeric,
  stop_loss numeric not null,
  take_profit numeric,
  notes text,
  lesson text,
  tags text[],
  opened_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table trades enable row level security;

create policy "Users can insert their own trades"
  on trades for insert with check (auth.uid() = user_id);

create policy "Users can view their own trades"
  on trades for select using (auth.uid() = user_id);

create policy "Users can update their own trades"
  on trades for update using (auth.uid() = user_id);

create policy "Users can delete their own trades"
  on trades for delete using (auth.uid() = user_id);
```

### 3. Configure the app

In `app.js`, set your project credentials (**Project Settings → API**):

```javascript
const SUPABASE_URL = 'https://your-project.supabase.co'
const SUPABASE_KEY = 'your-publishable-key'
```

The publishable (anon) key is safe to expose in the frontend as long as Row Level Security is enabled. Never use the `service_role` key here.

### 4. Run

No build is required. Open `index.html` in a browser or use a static server such as VS Code Live Server.

## Deployment

Push the repository to GitHub and import it in Vercel as a static site. No build command or output directory is needed.

## Project Structure

```text
├── index.html   # Layout and styles
├── app.js       # Application logic, Supabase client, state and rendering
├── preview.png  # Dashboard screenshot used in this README
└── README.md
```

## License

Released under the [MIT License](LICENSE).