// --- ВСТАВТЕ ВАШІ КЛЮЧІ ТУТ ---
const supabaseUrl = 'https://jgdwnngcjvluuejlzxbw.supabase.co';
// Вставте ключ sb_publishable_... повністю з останнього скріншоту
const supabaseKey = 'sb_publishable_2eIfdVNDKmwmnF17fRnyrg_VbSu9QTYИ' 
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Елементи UI
const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');
const authMsg = document.getElementById('auth-msg');
const tradesBody = document.getElementById('trades-body');

let currentUser = null;

// Перевірка сесії при завантаженні сторінки
window.onload = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        showDashboard();
    }
};

// Авторизація (Вхід або Реєстрація)
async function handleAuth(action) {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    authMsg.textContent = "Обробка...";

    let error, data;

    if (action === 'register') {
        ({ data, error } = await supabase.auth.signUp({ email, password }));
    } else {
        ({ data, error } = await supabase.auth.signInWithPassword({ email, password }));
    }

    if (error) {
        authMsg.textContent = "Помилка: " + error.message;
    } else if (data.user) {
        currentUser = data.user;
        authMsg.textContent = "";
        showDashboard();
    }
}

// Вихід
async function logOut() {
    await supabase.auth.signOut();
    currentUser = null;
    dashboardSection.classList.add('hidden');
    authSection.classList.remove('hidden');
    document.getElementById('email').value = '';
    document.getElementById('password').value = '';
}

// Показати дашборд і завантажити угоди
function showDashboard() {
    authSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    loadTrades();
}

// Розрахунок PnL (спрощений для базової статистики)
function calculateResult(direction, entry, exit) {
    let diff = exit - entry;
    if (direction === 'Short') diff = -diff;
    return (diff > 0) ? 'win' : (diff < 0) ? 'loss' : 'breakeven';
}

// Збереження угоди в Supabase
async function addTrade() {
    const pair = document.getElementById('pair').value.toUpperCase();
    const direction = document.getElementById('direction').value;
    const entry = parseFloat(document.getElementById('entry').value);
    const exit = parseFloat(document.getElementById('exit').value);
    const notes = document.getElementById('notes').value;

    if (!pair || !entry || !exit) {
        alert("Заповніть всі обов'язкові поля!");
        return;
    }

    const resultClass = calculateResult(direction, entry, exit);
    let resultValue = 0; // Тут можна додати логіку підрахунку $ або R:R пізніше

    const { data, error } = await supabase
        .from('trades')
        .insert([{ 
            user_id: currentUser.id,
            pair, 
            direction, 
            entry_price: entry, 
            exit_price: exit, 
            result: resultValue,
            notes 
        }]);

    if (error) {
        alert("Помилка збереження: " + error.message);
    } else {
        // Очистити форму
        document.getElementById('pair').value = '';
        document.getElementById('entry').value = '';
        document.getElementById('exit').value = '';
        document.getElementById('notes').value = '';
        loadTrades(); // Оновити таблицю
    }
}

// Завантаження угод з бази (RLS віддасть тільки ваші)
async function loadTrades() {
    tradesBody.innerHTML = '<tr><td colspan="7">Завантаження...</td></tr>';
    
    const { data, error } = await supabase
        .from('trades')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        tradesBody.innerHTML = '<tr><td colspan="7">Помилка завантаження даних</td></tr>';
        return;
    }

    tradesBody.innerHTML = '';
    
    if (data.length === 0) {
        tradesBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Угод поки немає</td></tr>';
        return;
    }

    data.forEach(trade => {
        const date = new Date(trade.created_at).toLocaleDateString('uk-UA');
        const resClass = calculateResult(trade.direction, trade.entry_price, trade.exit_price);
        const resText = resClass === 'win' ? '+ Плюс' : resClass === 'loss' ? '- Мінус' : 'Б/У';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${date}</td>
            <td><strong>${trade.pair}</strong></td>
            <td style="color: ${trade.direction === 'Long' ? '#00ff88' : '#ff4444'}">${trade.direction}</td>
            <td>${trade.entry_price}</td>
            <td>${trade.exit_price}</td>
            <td class="${resClass}"><strong>${resText}</strong></td>
            <td style="font-size: 0.9em; opacity: 0.8;">${trade.notes || '-'}</td>
        `;
        tradesBody.appendChild(tr);
    });
}