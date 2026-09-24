'use strict'

const SUPABASE_URL = 'https://jgdwnngcjvluuejlzxbw.supabase.co'
const SUPABASE_KEY = 'sb_publishable_2eIfdVNDKmwmnF17fRnyrg_VbSu9QTY'
const PER = 15 // угод на сторінку
const MS_MIN = 6e4
const MS_DAY = 864e5
const TAGS = [
	'FOMO',
	'Revenge',
	'Ранній вихід',
	'Порушив план',
	'Овертрейд',
	'Пізній вхід',
	'За планом',
]
const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']
const IC = {
	edit: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>',
	del: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#ef4444" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
}
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)

const State = {
	user: null,
	trades: [],
	base: [],
	view: [],
	editId: null,
	modalId: null,
	page: 1,
	tab: 'strats',
	cal: 'week',
	off: 0,
	day: null,
	unit: 'pct',
	sort: { k: '_ts', d: -1 },
}

// ---------- УТИЛІТИ ----------
const $ = id => document.getElementById(id)
const escapeHTML = s =>
	String(s ?? '').replace(
		/[&<>"']/g,
		c =>
			({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
				c
			],
	)
const sum = a => a.reduce((x, y) => x + y, 0)
const sign = v => (v > 0 ? '+' : '') + v.toFixed(2)
const cls = v => (v > 0 ? 'pos' : v < 0 ? 'neg' : '')
const V = t => (State.unit === 'r' ? t._r : t._pnl)
const fmt = v => sign(v) + (State.unit === 'r' ? 'R' : '%')
const closedTrades = a => a.filter(t => t._res !== 'open' && V(t) != null)
const p2 = n => String(n).padStart(2, '0')
const dayKey = d =>
	`${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
const toLocalInput = d =>
	new Date(d - new Date().getTimezoneOffset() * MS_MIN)
		.toISOString()
		.slice(0, 16)

function toast(m, err = false) {
	const t = document.createElement('div')
	t.className = 'toast' + (err ? ' err' : '')
	t.textContent = m
	$('toasts').appendChild(t)
	setTimeout(() => {
		t.style.opacity = '0'
		setTimeout(() => t.remove(), 250)
	}, 3000)
}

function debounce(f, w) {
	let t
	return (...a) => {
		clearTimeout(t)
		t = setTimeout(() => f(...a), w)
	}
}

function toggleTheme() {
	const n = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
	document.documentElement.dataset.theme = n
	localStorage.setItem('theme', n)
}

// ---------- ЛОГІКА ----------
function enrich(t) {
	const d = t.direction === 'Short' ? -1 : 1,
		e = t.entry_price,
		x = t.exit_price
	const risk = t.stop_loss ? Math.abs(e - t.stop_loss) : 0
	const diff = x == null ? null : d * (x - e)
	t._ts = new Date(t.opened_at || t.created_at)
	t._res = diff == null ? 'open' : diff > 0 ? 'win' : diff < 0 ? 'loss' : 'be'
	t._pnl = diff == null ? null : (diff / e) * 100
	t._r = diff == null || !risk ? null : diff / risk
	t._plan = t.take_profit && risk ? (d * (t.take_profit - e)) / risk : null
	return t
}

const getSetups = () =>
	JSON.parse(localStorage.getItem('setups') || 'null') || [
		'Пробій',
		'Відскок',
		'BOS',
		'Інше',
	]

function fillSetups() {
	const s = [
		...new Set([
			...getSetups(),
			...State.trades.map(t => t.strategy).filter(Boolean),
		]),
	]
	const o = s.map(x => `<option>${escapeHTML(x)}</option>`).join('')
	const cur = $('strategy').value,
		fv = $('f-st').value
	$('strategy').innerHTML = o
	if (s.includes(cur)) $('strategy').value = cur
	$('f-st').innerHTML = '<option value="">Сетап</option>' + o
	if (s.includes(fv)) $('f-st').value = fv
}

// ---------- РЕНДЕР ----------
const Render = {
	stats() {
		const c = closedTrades(State.base).sort((a, b) => a._ts - b._ts)
		const v = c.map(V)
		const w = c.filter(t => t._res === 'win'),
			l = c.filter(t => t._res === 'loss')
		const gw = sum(w.map(V)),
			gl = Math.abs(sum(l.map(V)))
		const avg = a => (a.length ? sum(a.map(V)) / a.length : 0)
		const net = sum(v),
			wr = c.length ? Math.round((w.length / c.length) * 100) : 0
		let run = 0,
			pk = 0,
			dd = 0
		v.forEach(x => {
			run += x
			pk = Math.max(pk, run)
			dd = Math.max(dd, pk - run)
		})
		let st = 0,
			sr = ''
		for (let i = c.length - 1; i >= 0; i--) {
			const r = c[i]._res
			if (r === 'be' || (sr && r !== sr)) break
			sr = r
			st++
		}
		const ex = c.length ? net / c.length : 0
		const card = [
			['Угод (закритих)', c.length, ''],
			['Win Rate', wr + '%', wr >= 50 ? 'pos' : c.length ? 'neg' : ''],
			['Net', fmt(net), cls(net)],
			[
				'Profit Factor',
				gl ? (gw / gl).toFixed(2) : '—',
				gl ? (gw > gl ? 'pos' : 'neg') : '',
			],
			['Avg Win', w.length ? fmt(avg(w)) : '—', 'pos'],
			['Avg Loss', l.length ? fmt(avg(l)) : '—', 'neg'],
			['Expectancy', c.length ? fmt(ex) : '—', cls(ex)],
			[
				'Max Drawdown',
				c.length ? '-' + dd.toFixed(2) + (State.unit === 'r' ? 'R' : '%') : '—',
				dd ? 'neg' : '',
			],
			[
				'Best / Worst',
				c.length ? `${fmt(Math.max(...v))} / ${fmt(Math.min(...v))}` : '—',
				'',
			],
			[
				'Серія',
				st ? st + (sr === 'win' ? ' W' : ' L') : '—',
				sr === 'win' ? 'pos' : sr ? 'neg' : '',
			],
		]
		$('stats').innerHTML = card
			.map(
				([t, x, k]) =>
					`<div class="stat-card"><b>${t}</b><span class="${k}">${x}</span></div>`,
			)
			.join('')
	},

	calendar() {
		const today = new Date()
		today.setHours(0, 0, 0, 0)
		let s,
			n,
			pad = 0,
			label
		if (State.cal === 'week') {
			s = new Date(today)
			s.setDate(today.getDate() - ((today.getDay() + 6) % 7) + State.off * 7)
			n = 7
			const e = new Date(s)
			e.setDate(s.getDate() + 6)
			const f = d =>
				d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
			label = f(s) + ' – ' + f(e)
		} else {
			s = new Date(today.getFullYear(), today.getMonth() + State.off, 1)
			n = new Date(s.getFullYear(), s.getMonth() + 1, 0).getDate()
			pad = (s.getDay() + 6) % 7
			label = s.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' })
		}
		$('cal-label').textContent = label
		const by = {}
		closedTrades(State.base).forEach(t => (by[dayKey(t._ts)] ||= []).push(t))
		const days = Array.from({ length: n }, (_, i) => {
			const d = new Date(s)
			d.setDate(s.getDate() + i)
			const a = by[dayKey(d)] || []
			return { d, k: dayKey(d), c: a.length, p: sum(a.map(V)) }
		})
		const mx = Math.max(1e-9, ...days.map(x => Math.abs(x.p)))
		$('calendar-grid').innerHTML =
			'<div class="cal-empty-slot"></div>'.repeat(pad) +
			days
				.map(({ d, k, c, p }) => {
					const st = c ? (p > 0 ? 'win' : p < 0 ? 'loss' : 'be') : 'empty'
					const bg =
						c && p
							? ` style="background:rgba(${p > 0 ? '16,185,129' : '239,68,68'},${(0.12 + (0.5 * Math.abs(p)) / mx).toFixed(2)})"`
							: ''
					const txt = c ? fmt(p) : d > today ? '—' : '0'
					return `<div class="cal-day ${st}${d.getTime() === today.getTime() ? ' today' : ''}${State.day === k ? ' sel' : ''}" data-day="${k}"${bg}><div class="d-num">${d.getDate()}</div><div class="d-pnl">${txt}</div></div>`
				})
				.join('')
	},

	chart() {
		const c = closedTrades(State.base).sort((a, b) => a._ts - b._ts)
		if (!c.length) {
			$('chart').innerHTML = '<div class="empty">Немає закритих угод</div>'
			$('eq-val').textContent = ''
			return
		}
		let r = 0,
			pk = 0
		const pts = [0],
			pks = [0]
		c.forEach(t => {
			r += V(t)
			pts.push(r)
			pk = Math.max(pk, r)
			pks.push(pk)
		})
		const lb = [
			'Старт',
			...c.map(t =>
				t._ts.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' }),
			),
		]
		const W = 600,
			H = 220,
			L = 46,
			B = 22,
			T = 10,
			R = 10
		const mn = Math.min(...pts),
			mx = Math.max(...pks),
			rg = mx - mn || 1
		const X = i => L + (i * (W - L - R)) / (pts.length - 1)
		const Y = v => T + (1 - (v - mn) / rg) * (H - T - B)
		const P = a =>
			a
				.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`)
				.join('')
		const dd =
			P(pks) +
			[...pts]
				.reverse()
				.map(
					(v, i) => `L${X(pts.length - 1 - i).toFixed(1)},${Y(v).toFixed(1)}`,
				)
				.join('') +
			'Z'
		const col = r >= 0 ? 'var(--green)' : 'var(--red)'
		const grid = [0, 1, 2, 3]
			.map(i => {
				const v = mn + (rg * i) / 3,
					y = Y(v).toFixed(1)
				return `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="var(--border)"/><text x="${L - 6}" y="${+y + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${v.toFixed(rg < 0.1 ? 3 : rg < 1 ? 2 : rg < 10 ? 1 : 0)}</text>`
			})
			.join('')
		const zero =
			mn < 0 && mx > 0
				? `<line x1="${L}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--muted)" stroke-dasharray="4"/>`
				: ''
		$('eq-val').className = cls(r)
		$('eq-val').textContent = fmt(r)
		$('chart').innerHTML =
			`<svg viewBox="0 0 ${W} ${H}">${grid}${zero}<path d="${dd}" fill="var(--rd)"/><path d="${P(pts)}" fill="none" stroke="${col}" stroke-width="2.5"/><text x="${L}" y="${H - 5}" font-size="11" fill="var(--muted)">${lb[1]}</text><text x="${W - R}" y="${H - 5}" text-anchor="end" font-size="11" fill="var(--muted)">${lb[lb.length - 1]}</text><circle id="dot" r="4" fill="${col}" style="display:none"/></svg><div class="tip" id="tip"></div>`
		const svg = $('chart').querySelector('svg'),
			tip = $('tip'),
			dot = $('dot')
		svg.onpointermove = e => {
			const b = svg.getBoundingClientRect()
			const x = ((e.clientX - b.left) / b.width) * W
			const i = Math.max(
				0,
				Math.min(
					pts.length - 1,
					Math.round(((x - L) / (W - L - R)) * (pts.length - 1)),
				),
			)
			dot.setAttribute('cx', X(i))
			dot.setAttribute('cy', Y(pts[i]))
			dot.style.display = ''
			tip.style.display = 'block'
			tip.textContent = `${lb[i]}: ${fmt(pts[i])}`
			tip.style.left = (X(i) / W) * b.width + 'px'
			tip.style.top = Math.max(0, (Y(pts[i]) / H) * b.height - 32) + 'px'
		}
		svg.onpointerleave = () => {
			dot.style.display = 'none'
			tip.style.display = 'none'
		}
	},

	analytics() {
		const tab = State.tab
		const K = {
			strats: t => [t.strategy || 'Інше'],
			pairs: t => [t.pair],
			hour: t => [p2(t._ts.getHours()) + ':00'],
			day: t => [DAYS[(t._ts.getDay() + 6) % 7]],
			sess: t => {
				const h = t._ts.getUTCHours()
				return [h < 7 || h >= 21 ? 'Азія' : h < 12 ? 'Лондон' : 'Нью-Йорк']
			},
			tags: t => t.tags || [],
		}[tab]
		const g = {}
		State.base.forEach(t => K(t).forEach(k => (g[k] ||= []).push(t)))
		const order =
			tab === 'day'
				? (a, b) => DAYS.indexOf(a[0]) - DAYS.indexOf(b[0])
				: tab === 'hour'
					? (a, b) => a[0].localeCompare(b[0])
					: (a, b) => b[1].length - a[1].length
		$('analytics-content').innerHTML =
			Object.entries(g)
				.sort(order)
				.map(([n, a]) => {
					const c = closedTrades(a),
						w = c.filter(t => t._res === 'win').length
					const wr = c.length ? Math.round((w / c.length) * 100) : 0,
						s = sum(c.map(V))
					return `<div class="an"><div class="an-top"><span>${escapeHTML(n)} <small>(${a.length})</small></span><span>${wr}% · <b class="${cls(s)}">${fmt(s)}</b></span></div><div class="bar"><i style="width:${wr}%"></i></div></div>`
				})
				.join('') || '<div class="empty">Немає даних</div>'
	},

	table() {
		$('day-note').textContent = State.day
			? `День: ${State.day} (клік по дню — скинути)`
			: ''
		const p = State.view.slice((State.page - 1) * PER, State.page * PER)
		if (!p.length) {
			$('tb').innerHTML =
				'<tr><td colspan="10" class="empty">Немає записів</td></tr>'
			return this.pagination()
		}
		const nd = '<span class="muted">—</span>'
		$('tb').innerHTML = p
			.map(t => {
				const d = t._ts.toLocaleString('uk-UA', {
					day: '2-digit',
					month: '2-digit',
					hour: '2-digit',
					minute: '2-digit',
				})
				const rt = { win: 'WIN', loss: 'LOSS', be: 'B/E', open: 'OPEN' }[t._res]
				const tg = (t.tags || []).length
					? `<br><small>${t.tags.map(escapeHTML).join(', ')}</small>`
					: ''
				return `<tr data-id="${t.id}">
<td>${d}</td><td><b>${escapeHTML(t.pair)}</b>${tg}</td>
<td><span class="badge ${t.direction === 'Long' ? 'win' : 'loss'}">${t.direction}</span></td>
<td>${t.strategy ? escapeHTML(t.timeframe || '') + ' ' + escapeHTML(t.strategy) : '—'}</td>
<td>${t.entry_price}</td><td>${t.exit_price ?? nd}</td>
<td><span class="badge ${t._res}">${rt}</span></td>
<td>${t._pnl != null ? `<b class="${cls(t._pnl)}">${sign(t._pnl)}%</b>` : nd}</td>
<td class="${cls(t._r)}">${t._r != null ? sign(t._r) + 'R' : '—'}</td>
<td>${t._res === 'open' ? '<button class="btn sm" data-a="close">Закрити</button>' : ''}<button class="btn sm ghost" data-a="edit" aria-label="Редагувати">${IC.edit}</button><button class="btn sm ghost" data-a="del" aria-label="Видалити">${IC.del}</button></td></tr>`
			})
			.join('')
		this.pagination()
	},

	pagination() {
		const total = Math.ceil(State.view.length / PER)
		if (total <= 1) return ($('pagination').innerHTML = '')
		$('pagination').innerHTML = Array.from(
			{ length: total },
			(_, i) =>
				`<button class="btn sm ${i + 1 === State.page ? '' : 'ghost'}" data-page="${i + 1}">${i + 1}</button>`,
		).join('')
	},
}

function showTrade(id, focus) {
	const t = State.trades.find(x => String(x.id) === String(id))
	if (!t) return
	State.modalId = id
	const row = (k, v) =>
		v == null || v === ''
			? ''
			: `<div class="mrow"><span>${k}</span><b>${v}</b></div>`
	const rt = { win: 'WIN', loss: 'LOSS', be: 'B/E', open: 'OPEN' }[t._res]
	$('modal-body').innerHTML =
		`<h3>${escapeHTML(t.pair)} · ${t.direction} <span class="badge ${t._res}">${rt}</span></h3>` +
		row('Дата', t._ts.toLocaleString('uk-UA')) +
		row('ТФ / Сетап', escapeHTML(`${t.timeframe || ''} ${t.strategy || ''}`)) +
		row(
			'Вхід / SL / TP',
			[t.entry_price, t.stop_loss ?? '—', t.take_profit ?? '—'].join(' / '),
		) +
		row('P&L', t._pnl != null ? sign(t._pnl) + '%' : '') +
		row('Результат', t._r != null ? sign(t._r) + 'R' : '') +
		row('План (TP)', t._plan != null ? t._plan.toFixed(2) + 'R' : '') +
		row('Причина входу', escapeHTML(t.notes)) +
		`<div class="input-group" style="margin:14px 0"><label for="m-exit">Ціна виходу (пусто = OPEN)</label><input type="number" step="any" id="m-exit" value="${t.exit_price ?? ''}"></div>
<div class="lbl">Помилки / теги</div>
<div class="tags" id="m-tags">${TAGS.map(x => `<label class="chip"><input type="checkbox" value="${x}"${(t.tags || []).includes(x) ? ' checked' : ''}><span>${x}</span></label>`).join('')}</div>
<div class="input-group"><label for="m-lesson">Висновок</label><textarea id="m-lesson" rows="3">${escapeHTML(t.lesson)}</textarea></div>`
	$('modal').showModal()
	if (focus) $('m-exit').focus()
}

async function saveReview() {
	const s = $('m-exit').value,
		v = s === '' ? null : parseFloat(s)
	if (v !== null && (isNaN(v) || v <= 0))
		return toast('Некоректна ціна виходу', true)
	const { error } = await sb
		.from('trades')
		.update({
			exit_price: v,
			tags: [...document.querySelectorAll('#m-tags input:checked')].map(
				i => i.value,
			),
			lesson: $('m-lesson').value.trim(),
		})
		.eq('id', State.modalId)
	if (error) return toast('Помилка: ' + error.message, true)
	toast('Збережено')
	$('modal').close()
	loadData()
}

// ---------- ДАНІ ----------
async function loadData() {
	try {
		const { data, error } = await sb
			.from('trades')
			.select('*')
			.order('created_at', { ascending: false })
		if (error) throw error
		State.trades = data.map(enrich)
		fillSetups()
		recompute()
	} catch (e) {
		toast('Помилка завантаження: ' + e.message, true)
	}
}

function recompute() {
	const q = $('f-q').value.toLowerCase(),
		d = $('f-dir').value,
		stat = $('f-status').value,
		r = $('f-res').value,
		s = $('f-st').value,
		p = +$('f-per').value,
		lim = p ? Date.now() - p * MS_DAY : 0
	State.base = State.trades.filter(t => {
		const open = t._res === 'open'
		return (
			(!q ||
				`${t.pair} ${t.notes ?? ''} ${t.lesson ?? ''}`
					.toLowerCase()
					.includes(q)) &&
			(!d || t.direction === d) &&
			(!stat || (stat === 'open' ? open : !open)) &&
			(!r || t._res === r) &&
			(!s || t.strategy === s) &&
			(!lim || +t._ts >= lim)
		)
	})
	const { k, d: dir } = State.sort
	const f = t => {
		const x = t[k]
		return x instanceof Date ? +x : (x ?? -Infinity)
	}
	State.view = State.base
		.filter(t => !State.day || dayKey(t._ts) === State.day)
		.sort((a, b) => (f(a) > f(b) ? 1 : f(a) < f(b) ? -1 : 0) * dir)
	State.page = 1
	Render.stats()
	Render.calendar()
	Render.chart()
	Render.analytics()
	Render.table()
}
const applyFilters = debounce(recompute, 250)

// ---------- ФОРМА ----------
function validateForm() {
	const pair = $('pair').value.trim().toUpperCase()
	const dir = document.querySelector('input[name=direction]:checked').value
	const n = id => ($(id).value === '' ? null : parseFloat($(id).value))
	const entry = n('entry'),
		exit = n('exit'),
		sl = n('stoploss'),
		tp = n('takeprofit')
	const L = dir === 'Long'
	if (!/^[A-Z0-9/-]{2,15}$/.test(pair))
		return toast('Вкажіть коректну пару (напр. XAU/USD)', true)
	if (entry == null || entry <= 0)
		return toast('Вкажіть коректну ціну входу', true)
	if (sl == null) return toast("Stop Loss обов'язковий (потрібен для R)", true)
	if (sl <= 0 || (L ? sl >= entry : sl <= entry))
		return toast(
			L
				? 'Для Long SL має бути нижче входу'
				: 'Для Short SL має бути вище входу',
			true,
		)
	if (tp != null && (L ? tp <= entry : tp >= entry))
		return toast(
			L
				? 'Для Long TP має бути вище входу'
				: 'Для Short TP має бути нижче входу',
			true,
		)
	if (exit != null && exit <= 0)
		return toast('Ціна виходу має бути позитивною', true)
	return {
		pair,
		direction: dir,
		entry_price: entry,
		exit_price: exit,
		stop_loss: sl,
		take_profit: tp,
		timeframe: $('timeframe').value,
		strategy: $('strategy').value,
		opened_at: $('opened').value
			? new Date($('opened').value).toISOString()
			: new Date().toISOString(),
		notes: $('notes').value.trim(),
	}
}

async function handleSave(e) {
	e.preventDefault()
	const payload = validateForm()
	if (!payload) return
	$('save-btn').disabled = true
	try {
		if (!State.editId) payload.user_id = State.user.id
		const { error } = State.editId
			? await sb.from('trades').update(payload).eq('id', State.editId)
			: await sb.from('trades').insert([payload])
		if (error) throw error
		toast(State.editId ? 'Угоду оновлено' : 'Угоду збережено')
		resetForm()
		loadData()
	} catch (err) {
		toast('Помилка: ' + err.message, true)
	} finally {
		$('save-btn').disabled = false
	}
}

function startEdit(id) {
	const t = State.trades.find(x => String(x.id) === String(id))
	State.editId = id
	$('pair').value = t.pair
	$(t.direction === 'Long' ? 'dl' : 'ds').checked = true
	$('entry').value = t.entry_price
	$('exit').value = t.exit_price ?? ''
	$('stoploss').value = t.stop_loss ?? ''
	$('takeprofit').value = t.take_profit ?? ''
	$('timeframe').value = t.timeframe ?? '15m'
	if (t.strategy) $('strategy').value = t.strategy
	$('opened').value = toLocalInput(t._ts)
	$('more').open = true
	$('notes').value = t.notes ?? ''
	$('form-title').textContent = 'Редагування угоди'
	$('cancel-btn').classList.remove('hidden')
	sheet(true)
	if (innerWidth > 1100) $('form-card').scrollIntoView({ behavior: 'smooth' })
}

function resetForm() {
	State.editId = null
	$('trade-form').reset()
	$('opened').value = toLocalInput(new Date())
	$('form-title').textContent = 'Нова угода'
	$('more').open = false
	$('cancel-btn').classList.add('hidden')
	$('preview').innerHTML = ''
	sheet(false)
}

function sheet(open) {
	$('side').classList.toggle('open', open)
	$('sheet-bg').classList.toggle('show', open)
}

const closeTrade = id => showTrade(id, true)

function exportCSV() {
	if (!State.view.length) return toast('Немає даних для експорту', true)
	const e = v => `"${String(v ?? '').replace(/"/g, '""')}"`
	const rows = [
		[
			'Дата',
			'Пара',
			'Напрямок',
			'TF',
			'Сетап',
			'Вхід',
			'SL',
			'TP',
			'Вихід',
			'Рез',
			'P&L %',
			'R',
			'Теги',
			'Причина',
			'Висновок',
		],
		...State.view.map(t => [
			t._ts.toISOString(),
			t.pair,
			t.direction,
			t.timeframe,
			t.strategy,
			t.entry_price,
			t.stop_loss ?? '',
			t.take_profit ?? '',
			t.exit_price ?? '',
			t._res.toUpperCase(),
			t._pnl != null ? t._pnl.toFixed(2) : '',
			t._r != null ? t._r.toFixed(2) : '',
			(t.tags || []).join('; '),
			t.notes,
			t.lesson,
		]),
	]
	const a = document.createElement('a')
	a.href = URL.createObjectURL(
		new Blob(['\ufeff' + rows.map(r => r.map(e).join(',')).join('\n')], {
			type: 'text/csv;charset=utf-8;',
		}),
	)
	a.download = `trades_${dayKey(new Date())}.csv`
	a.click()
}

// ---------- СЛУХАЧІ ----------
function setupListeners() {
	$('opened').value = toLocalInput(new Date())
	$('trade-form').addEventListener('submit', handleSave)
	$('cancel-btn').addEventListener('click', resetForm)
	$('filters').addEventListener('input', applyFilters)
	$('theme-btn').addEventListener('click', () => {
		toggleTheme()
		if (State.user) Render.chart()
	})
	$('btn-login').addEventListener('click', () => auth('login'))
	$('btn-register').addEventListener('click', () => auth('register'))
	$('logout').addEventListener('click', async () => {
		await sb.auth.signOut()
		location.reload()
	})
	;['email', 'password'].forEach(i =>
		$(i).addEventListener('keydown', e => {
			if (e.key === 'Enter') auth('login')
		}),
	)

	$('add-setup').addEventListener('click', () => {
		const n = (prompt('Назва сетапу:') || '').trim()
		if (!n) return
		localStorage.setItem(
			'setups',
			JSON.stringify([...new Set([...getSetups(), n])]),
		)
		fillSetups()
		$('strategy').value = n
	})

	const live = debounce(() => {
		const e = parseFloat($('entry').value),
			sl = parseFloat($('stoploss').value),
			tp = parseFloat($('takeprofit').value)
		if (isNaN(e)) return ($('preview').innerHTML = '')
		let h = ''
		if (sl > 0)
			h += `Ризик до SL: <b>${((Math.abs(e - sl) / e) * 100).toFixed(2)}%</b>`
		if (sl > 0 && tp > 0)
			h += ` · План: <b>${(Math.abs(tp - e) / Math.abs(e - sl)).toFixed(2)}R</b>`
		$('preview').innerHTML = h
	}, 200)
	;['entry', 'stoploss', 'takeprofit'].forEach(i =>
		$(i).addEventListener('input', live),
	)

	$('tb').addEventListener('click', async e => {
		const tr = e.target.closest('tr[data-id]')
		if (!tr) return
		const id = tr.dataset.id,
			a = e.target.closest('button')?.dataset.a
		if (a === 'del') {
			if (!confirm('Видалити назавжди?')) return
			const { error } = await sb.from('trades').delete().eq('id', id)
			if (error) toast('Помилка', true)
			else {
				toast('Видалено')
				loadData()
			}
		} else if (a === 'edit') startEdit(id)
		else if (a === 'close') closeTrade(id)
		else showTrade(id)
	})

	$('pagination').addEventListener('click', e => {
		if (e.target.dataset.page) {
			State.page = +e.target.dataset.page
			Render.table()
		}
	})

	document.querySelectorAll('.tab-btn').forEach(b =>
		b.addEventListener('click', e => {
			document
				.querySelectorAll('.tab-btn')
				.forEach(x => x.classList.remove('active'))
			e.target.classList.add('active')
			State.tab = e.target.dataset.target
			Render.analytics()
		}),
	)

	document.querySelectorAll('input[name=cal-view]').forEach(r =>
		r.addEventListener('change', e => {
			State.cal = e.target.value
			State.off = 0
			Render.calendar()
		}),
	)
	document.querySelectorAll('input[name=unit]').forEach(r =>
		r.addEventListener('change', e => {
			State.unit = e.target.value
			recompute()
		}),
	)
	$('cal-prev').addEventListener('click', () => {
		State.off--
		Render.calendar()
	})
	$('cal-next').addEventListener('click', () => {
		State.off++
		Render.calendar()
	})
	$('calendar-grid').addEventListener('click', e => {
		const d = e.target.closest('[data-day]')
		if (!d) return
		State.day = State.day === d.dataset.day ? null : d.dataset.day
		recompute()
	})

	document.querySelectorAll('th[data-sort]').forEach(th =>
		th.addEventListener('click', () => {
			const k = th.dataset.sort
			State.sort = { k, d: State.sort.k === k ? -State.sort.d : -1 }
			recompute()
		}),
	)

	$('modal-close').addEventListener('click', () => $('modal').close())
	$('modal').addEventListener('click', e => {
		if (e.target === $('modal')) $('modal').close()
	})
	$('csv-btn').addEventListener('click', exportCSV)
	$('fab').addEventListener('click', () => sheet(true))
	;['sheet-x', 'sheet-bg'].forEach(i =>
		$(i).addEventListener('click', () => sheet(false)),
	)
	$('modal-save').addEventListener('click', saveReview)
}

// ---------- АВТОРИЗАЦІЯ ----------
function showDash(user) {
	State.user = user
	$('auth').classList.add('hidden')
	$('dash').classList.remove('hidden')
	$('logout').classList.remove('hidden')
	loadData()
}

async function auth(type) {
	const email = $('email').value,
		password = $('password').value
	if (password.length < 6)
		return ($('auth-msg').textContent = 'Слабкий пароль (мін 6)')
	$('auth-msg').textContent = 'Обробка...'
	$('auth-msg').style.color = 'var(--text)'
	const { data, error } =
		type === 'register'
			? await sb.auth.signUp({ email, password })
			: await sb.auth.signInWithPassword({ email, password })
	if (error) {
		$('auth-msg').style.color = 'var(--red)'
		$('auth-msg').textContent = error.message
	} else if (data.session) {
		$('auth-msg').textContent = ''
		showDash(data.user)
	} else $('auth-msg').textContent = 'Перевірте пошту для підтвердження.'
}

async function init() {
	setupListeners()
	fillSetups()
	const {
		data: { session },
	} = await sb.auth.getSession()
	if (session) showDash(session.user)
}

init()
