import { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = 'http://localhost:3000/api';

function App() {
  const [theme, setTheme] = useState('dark');
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [role, setRole] = useState(localStorage.getItem('role') || 'user');
  const [userName, setUserName] = useState(localStorage.getItem('userName') || '');
  const [currentTab, setCurrentTab] = useState('events');

  const [events, setEvents] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('id');

  const [myTickets, setMyTickets] = useState([]);
  const [stats, setStats] = useState([]);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [authForm, setAuthForm] = useState({ email: '', password: '', role: 'user', name: '', isLogin: true });

  useEffect(() => {
    axios.defaults.headers.common['Authorization'] = token ? `Bearer ${token}` : '';
  }, [token]);

  useEffect(() => { document.body.className = theme; }, [theme]);

  // Скидаємо сторінку на першу при зміні пошуку або сортування
  useEffect(() => { setPage(1); }, [search, sort]);

  const fetchEvents = async () => {
    try {
      const res = await axios.get(`${API_URL}/events`, {
        params: { page, limit: 6, search, sort }
      });
      setEvents(res.data.events);
      setTotalPages(res.data.totalPages);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchMyTickets = async () => {
    try {
      const res = await axios.get(`${API_URL}/my-tickets`, {
        params: { search, sort }
      });
      setMyTickets(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API_URL}/stats`);
      setStats(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (!token) return;
    const delayDebounceFn = setTimeout(() => {
      if (currentTab === 'events') fetchEvents();
      if (currentTab === 'my-tickets') fetchMyTickets();
      if (currentTab === 'dashboard') fetchStats();
    }, 300); // 300ms debounce для пошуку

    return () => clearTimeout(delayDebounceFn);
  }, [token, currentTab, page, search, sort]);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 4000);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    const endpoint = authForm.isLogin ? '/login' : '/register';
    try {
      const res = await axios.post(`${API_URL}${endpoint}`, authForm);
      if (authForm.isLogin) {
        setToken(res.data.token);
        setRole(res.data.role);
        setUserName(res.data.name || '');
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('role', res.data.role);
        localStorage.setItem('userName', res.data.name || '');
        setCurrentTab('events');
      } else {
        showMessage('Зареєстровано! Тепер увійдіть.', 'success');
        setAuthForm({ ...authForm, isLogin: true, password: '' });
      }
    } catch (error) {
      showMessage(error.response?.data?.error || 'Помилка', 'error');
    }
  };

  const logout = () => {
    setToken(''); setRole('user'); setUserName('');
    localStorage.removeItem('token'); localStorage.removeItem('role'); localStorage.removeItem('userName');
    setCurrentTab('events');
  };

  const updateProfile = async () => {
    const name = prompt('Введіть ваше ім’я:', userName);
    if (!name) return;
    try {
      await axios.put(`${API_URL}/profile`, { name });
      setUserName(name);
      localStorage.setItem('userName', name);
      showMessage('Ім’я оновлено', 'success');
    } catch (error) {
      showMessage('Не вдалося оновити ім’я', 'error');
    }
  };

  const deleteEvent = async (id) => {
    if (!window.confirm('Видалити подію?')) return;
    try {
      await axios.delete(`${API_URL}/admin/events/${id}`);
      showMessage('Подію видалено', 'success');
      fetchEvents();
    } catch (error) {
      showMessage(error.response?.data?.error || 'Не вдалося видалити подію', 'error');
    }
  };

  const buyTicket = async (eventId) => {
    try {
      const res = await axios.post(`${API_URL}/buy-ticket`, { eventId });
      showMessage(`Успішно!`, 'success');
      setEvents(events.map(ev =>
        ev.id === eventId ? { ...ev, current_price: res.data.new_price, sold_tickets: res.data.new_sold } : ev
      ));
    } catch (error) {
      showMessage(error.response?.data?.error || 'Помилка покупки', 'error');
    }
  };

  const switchTab = (tab) => {
    setSearch(''); // Очищаємо пошук при зміні вкладки
    setPage(1);
    setCurrentTab(tab);
  };

  if (!token) {
    return (
      <div className="auth-container">
        <div className="card auth-card">
          <h2>{authForm.isLogin ? 'Вхід' : 'Реєстрація'}</h2>
          <form onSubmit={handleAuth}>
            {!authForm.isLogin && (
              <input type="text" placeholder="Ваше ім'я" value={authForm.name} onChange={e => setAuthForm({ ...authForm, name: e.target.value })} />
            )}
            <input type="email" placeholder="Email" required value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} />
            <input type="password" placeholder="Пароль" required value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} />
            {!authForm.isLogin && (
              <select value={authForm.role} onChange={e => setAuthForm({ ...authForm, role: e.target.value })} style={{ padding: '12px', marginBottom: '10px', borderRadius: '8px' }}>
                <option value="user">Покупець</option>
                <option value="organizer">Організатор</option>
                <option value="admin">Адмін</option>
              </select>
            )}
            <button type="submit" className="btn-primary">{authForm.isLogin ? 'Увійти' : 'Створити акаунт'}</button>
          </form>
          <p onClick={() => setAuthForm({ ...authForm, isLogin: !authForm.isLogin })} style={{ cursor: 'pointer', marginTop: '10px' }}>
            {authForm.isLogin ? 'Немає акаунту? Реєстрація' : 'Вже є акаунт? Увійти'}
          </p>
          {message.text && <div className={`alert ${message.type}`}>{message.text}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => switchTab('events')} className={`btn-icon ${currentTab === 'events' ? 'active' : ''}`}>Всі події</button>
          {role === 'user' && <button onClick={() => switchTab('my-tickets')} className={`btn-icon ${currentTab === 'my-tickets' ? 'active' : ''}`}>Мої квитки</button>}
          {(role === 'organizer' || role === 'admin') && <button onClick={() => switchTab('dashboard')} className={`btn-icon ${currentTab === 'dashboard' ? 'active' : ''}`}>Дашборд</button>}
        </div>
        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ cursor: 'pointer' }} onClick={updateProfile}>
            Привіт, <b>{userName || (role === 'user' ? 'Додай ім’я' : role)}</b> ⚙️
          </span>
          <button className="btn-outline-danger" onClick={logout}>Вийти</button>
        </div>
      </header>

      {/* Фільтри працюють для "Всі події" та "Мої квитки" */}
      {(currentTab === 'events' || currentTab === 'my-tickets') && (
        <div className="filters card" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
          <input type="text" placeholder="Пошук..." value={search} onChange={e => setSearch(e.target.value)} />
          <select value={sort} onChange={e => setSort(e.target.value)}>
            <option value="id">За замовчуванням</option>
            <option value={currentTab === 'events' ? 'current_price' : 'purchase_price'}>За ціною</option>
            <option value="event_date">За датою</option>
            <option value="title">За назвою</option>
          </select>
          <button className="btn-secondary" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      )}

      <div className="main-content">
        {(role === 'organizer' || role === 'admin') && currentTab === 'events' && (
          <aside className="sidebar">
            <div className="card">
              <h2 className="section-title">Нова подія</h2>
              {/* ФОРМА БЕЗ РУДИМЕНТІВ */}
              <form className="create-form" onSubmit={async (e) => { 
                  e.preventDefault(); 
                  try {
                    await axios.post(`${API_URL}/events`, { 
                        title: e.target.title.value, 
                        total_tickets: Number(e.target.total_tickets.value), 
                        base_price: Number(e.target.base_price.value), 
                        event_date: e.target.event_date.value 
                    }); 
                    showMessage('Подію створено!', 'success'); 
                    fetchEvents(); 
                    e.target.reset(); // Очищаємо форму після створення
                  } catch (err) {
                    showMessage('Помилка', 'error');
                  }
              }}>
                <input name="title" type="text" placeholder="Назва" required />
                <input name="event_date" type="date" required />
                <input name="total_tickets" type="number" placeholder="Всього квитків" required />
                <input name="base_price" type="number" placeholder="Стартова ціна" required />
                <button type="submit" className="btn-success">Створити</button>
              </form>
            </div>
          </aside>
        )}

        {currentTab === 'events' && (
          <section className="events-grid">
            {events.map(event => (
              <div className="card event-card" key={event.id}>
                <h3>{event.title}</h3>
                <p>Дата: {event.event_date}</p>
                <div className="price">{event.current_price.toFixed(2)} грн</div>
                <div className="stats">Продано: {event.sold_tickets}/{event.total_tickets}</div>
                <div className="progress-container" style={{ margin: '10px 0' }}>
                  <div className="progress-bar" style={{ width: `${(event.sold_tickets / event.total_tickets) * 100}%` }}></div>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                  {role === 'user' && <button className="btn-info" onClick={() => buyTicket(event.id)} disabled={event.sold_tickets >= event.total_tickets}>Купити</button>}
                  {(role === 'admin' || role === 'organizer') && <button className="btn-outline-danger" onClick={() => deleteEvent(event.id)}>Видалити</button>}
                </div>
              </div>
            ))}
          </section>
        )}

        {currentTab === 'my-tickets' && (
          <section style={{ width: '100%' }}>
            <h2>Мої квитки</h2>
            {myTickets.length === 0 ? <p>Ви ще нічого не купили.</p> : (
              <div className="events-grid">
                {myTickets.map(ticket => (
                  <div className="card event-card" key={ticket.id} style={{ borderLeft: '4px solid var(--success)' }}>
                    <h3>🎟️ {ticket.title}</h3>
                    <p>Дата події: <b>{ticket.event_date}</b></p>
                    <p>Куплено за: <b>{ticket.purchase_price} грн</b></p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Дата покупки: {new Date(ticket.purchase_date).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {currentTab === 'dashboard' && (
          <section style={{ width: '100%' }}>
            <h2>Аналітика ваших продажів</h2>
            <div className="events-grid">
              {stats.map((stat, i) => (
                <div className="card event-card" key={i}>
                  <h3>{stat.title}</h3>
                  <p>Конверсія: {((stat.sold_tickets / stat.total_tickets) * 100).toFixed(1)}% ({stat.sold_tickets} шт)</p>
                  <p>Загальний дохід: <b style={{ color: 'var(--success)', fontSize: '1.5rem' }}>{stat.total_income.toFixed(2)} грн</b></p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {currentTab === 'events' && totalPages > 1 && (
        <div className="pagination" style={{ marginTop: '20px', display: 'flex', gap: '5px', justifyContent: 'center' }}>
          {Array.from({ length: totalPages }, (_, i) => (
            <button 
              key={i} 
              onClick={() => setPage(i + 1)} 
              style={{ 
                padding: '5px 12px', 
                background: page === i + 1 ? 'var(--primary)' : 'var(--card-bg)',
                color: page === i + 1 ? '#fff' : 'var(--text-color)',
                border: '1px solid var(--border-color)'
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;