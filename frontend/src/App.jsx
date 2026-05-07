import { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = 'http://localhost:3000/api';

function App() {
  const [theme, setTheme] = useState('light');
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [role, setRole] = useState(localStorage.getItem('role') || 'user');
  const [currentTab, setCurrentTab] = useState('events');

  const [events, setEvents] = useState([]);
  const [myTickets, setMyTickets] = useState([]);
  const [stats, setStats] = useState([]);

  const [authForm, setAuthForm] = useState({ email: '', password: '', role: 'user', isLogin: true });
  const [newEvent, setNewEvent] = useState({ title: '', total_tickets: 100, base_price: 100, increase_step: 20, threshold: 10, event_date: '' });
  const [message, setMessage] = useState({ text: '', type: '' });

  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

  useEffect(() => { document.body.className = theme; }, [theme]);

  const fetchData = async () => {
    try {
      if (currentTab === 'events') {
        const res = await axios.get(`${API_URL}/events`);
        setEvents(res.data);
      } else if (currentTab === 'my-tickets') {
        const res = await axios.get(`${API_URL}/my-tickets`);
        setMyTickets(res.data);
      } else if (currentTab === 'dashboard') {
        const res = await axios.get(`${API_URL}/stats`);
        setStats(res.data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => { if (token) fetchData(); }, [token, currentTab]);

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
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('role', res.data.role);
        setCurrentTab('events');
      } else {
        showMessage('Зареєстровано! Тепер увійдіть.', 'success');
        setAuthForm({ ...authForm, isLogin: true });
      }
    } catch (error) {
      showMessage(error.response?.data?.error || 'Помилка', 'error');
    }
  };

  const logout = () => {
    setToken('');
    setRole('');
    localStorage.removeItem('token');
    localStorage.removeItem('role');
  };

  const createEvent = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/events`, newEvent);
      showMessage('Подію створено!', 'success');
      fetchData();
    } catch (error) {
      showMessage('Помилка створення', 'error');
    }
  };

  const buyTicket = async (eventId) => {
    try {
      const res = await axios.post(`${API_URL}/buy-ticket`, { eventId });
      showMessage(`Успішно! Списано ${res.data.paid_price} грн.`, 'success');
      setEvents(events.map(ev => 
        ev.id === eventId ? { ...ev, current_price: res.data.new_current_price, sold_tickets: res.data.new_sold_tickets } : ev
      ));
    } catch (error) {
      showMessage(error.response?.data?.error || 'Помилка покупки', 'error');
    }
  };

  if (!token) {
    return (
      <div className="auth-container">
        <div className="card auth-card">
          <h2>{authForm.isLogin ? 'Вхід' : 'Реєстрація'}</h2>
          <form onSubmit={handleAuth}>
            <input type="email" placeholder="Email" required value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} />
            <input type="password" placeholder="Пароль" required value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} />
            {!authForm.isLogin && (
              <select value={authForm.role} onChange={e => setAuthForm({...authForm, role: e.target.value})} style={{ padding: '12px', marginBottom: '10px', borderRadius: '8px' }}>
                <option value="user">Покупець</option>
                <option value="organizer">Організатор</option>
              </select>
            )}
            <button type="submit" className="btn-primary">{authForm.isLogin ? 'Увійти' : 'Створити акаунт'}</button>
          </form>
          <p onClick={() => setAuthForm({...authForm, isLogin: !authForm.isLogin})} style={{ cursor: 'pointer', marginTop: '10px' }}>
            {authForm.isLogin ? 'Немає акаунту? Реєстрація' : 'Вже є акаунт? Увійти'}
          </p>
          {message.text && <div className={`alert ${message.type}`}>{message.text}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ccc', paddingBottom: '10px', marginBottom: '20px' }}>
        <div>
          <button onClick={() => setCurrentTab('events')} className={`btn-icon ${currentTab === 'events' ? 'active' : ''}`}>Всі події</button>
          {role === 'user' && <button onClick={() => setCurrentTab('my-tickets')} className={`btn-icon ${currentTab === 'my-tickets' ? 'active' : ''}`}>Мої квитки</button>}
          {role === 'organizer' && <button onClick={() => setCurrentTab('dashboard')} className={`btn-icon ${currentTab === 'dashboard' ? 'active' : ''}`}>Дашборд</button>}
        </div>
        <div className="header-actions">
          <span style={{ marginRight: '15px' }}>Ви: <b>{role}</b></span>
          <button className="btn-outline-danger" onClick={logout}>Вийти</button>
        </div>
      </header>

      {message.text && <div className={`alert ${message.type}`}>{message.text}</div>}

      <div className="main-content">
        {role === 'organizer' && currentTab === 'events' && (
          <aside className="sidebar">
            <div className="card">
              <h2 className="section-title">Нова подія</h2>
              <form className="create-form" onSubmit={createEvent}>
                <input type="text" placeholder="Назва" required onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
                <input type="date" required onChange={e => setNewEvent({...newEvent, event_date: e.target.value})} />
                <input type="number" placeholder="Всього квитків" required onChange={e => setNewEvent({...newEvent, total_tickets: Number(e.target.value)})} />
                <input type="number" placeholder="Стартова ціна" required onChange={e => setNewEvent({...newEvent, base_price: Number(e.target.value)})} />
                <input type="number" placeholder="Крок ціни" required onChange={e => setNewEvent({...newEvent, increase_step: Number(e.target.value)})} />
                <input type="number" placeholder="Порог квитків" required onChange={e => setNewEvent({...newEvent, threshold: Number(e.target.value)})} />
                <button type="submit" className="btn-success">Створити</button>
              </form>
            </div>
          </aside>
        )}

        {currentTab === 'events' && (
          <section className="events-grid">
            {events.map(event => (
              <div className="card event-card" key={event.id}>
                <h3>{event.title} <small style={{fontSize: '0.6em', color: 'gray'}}>(Дата: {event.event_date})</small></h3>
                <div className="event-details">
                  <div className="price-block">
                    <span className="price">{event.current_price.toFixed(2)} грн</span>
                    <span className="stats">Продано: {event.sold_tickets} / {event.total_tickets}</span>
                  </div>
                  {role === 'user' && (
                    <button className="btn-info" onClick={() => buyTicket(event.id)} disabled={event.sold_tickets >= event.total_tickets}>Купити</button>
                  )}
                </div>
                <div className="progress-container"><div className="progress-bar" style={{ width: `${(event.sold_tickets / event.total_tickets) * 100}%` }}></div></div>
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
                  <div className="card event-card" key={ticket.id} style={{ borderLeft: '4px solid #00b894' }}>
                    <h3>🎟️ {ticket.title}</h3>
                    <p>Дата події: <b>{ticket.event_date}</b></p>
                    <p>Куплено за: <b>{ticket.purchase_price} грн</b></p>
                    <p style={{fontSize: '0.8rem', color: 'gray'}}>Дата покупки: {new Date(ticket.purchase_date).toLocaleString()}</p>
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
                  <p>Загальний дохід: <b style={{color: '#00b894', fontSize: '1.5rem'}}>{stat.total_income.toFixed(2)} грн</b></p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default App;
